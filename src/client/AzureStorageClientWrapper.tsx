import { BlobUploadCommonResponse, ContainerClient } from "@azure/storage-blob";
import { AzureFunctionClientWrapper, WriteCsvSummaryResult } from "./AzureFunctionClientWrapper";
import { CookieKey, getCookie } from "./CookieWrapper";
import { BlobContainerName } from "../model/enums";
import { BankStatementDetails, BankStatementInfo } from "../model/statement_model";
import { transformStatementsField } from "../util/util";
import { LOCAL_STORAGE_CLIENT } from "./LocalStorageClient";
import { UploadStatus } from "../model/documentAnalysis";


export class AzureStorageClientWrapper {
    private azureFunctionWrapper: AzureFunctionClientWrapper
    private containerClients: Map<string, ContainerClient> = new Map()

    private storageAccountName: string
    constructor(functionWrapper: AzureFunctionClientWrapper, storageAccountName: string) {
        this.storageAccountName = storageAccountName
        this.azureFunctionWrapper = functionWrapper
    }

    async getContainerClient(clientName: string, container: BlobContainerName): Promise<ContainerClient> {
        const clientContainerName = BlobContainerName.forClient(clientName, container)
        if (getCookie(clientContainerName) && this.containerClients.has(container)) {
            return this.containerClients.get(container)!
        } else {
            const sasToken = await this.azureFunctionWrapper.retrieveSasToken(clientName, container)
            const client = new ContainerClient(`https://${this.storageAccountName}.blob.core.windows.net/${clientContainerName}?${sasToken}`)
            this.containerClients.set(clientContainerName, client)
            return client
        }
    }

    async uploadFile(clientName: string, file: File): Promise<BlobUploadCommonResponse> {
        const blobClient = (await this.getContainerClient(clientName, BlobContainerName.INPUT)).getBlockBlobClient(file.name);
        return blobClient.uploadData(file)
    }

    async downloadInputFile(clientName: string, filename: string): Promise<File> {
        const blobClient = (await this.getContainerClient(clientName, BlobContainerName.INPUT)).getBlockBlobClient(filename);
        const resp = await blobClient.download()
        const blob = await resp.blobBody

        if (!blob) throw Error (`Unable to download blob from ${filename}, returned empty`)
        
        // TODO: convert to File? Or use another object
        const file = new File([blob], filename, {
            type: "application/pdf",
            lastModified: resp.lastModified?.getUTCMilliseconds(), // Set last modified date to current time
        });
        console.log(file)
        return file
    }

    async downloadMetadataIfExists(clientName: string, filename: string): Promise<InputFileMetadata | undefined> {
        try {
            const blobClient = (await this.getContainerClient(clientName, BlobContainerName.INPUT)).getBlockBlobClient(filename);
            const properties = await blobClient.getProperties()
            return properties.metadata as any as InputFileMetadata
        } catch(e: any) {
            if (e.details?.errorCode === "BlobNotFound") {
                return undefined
            } else {
                console.log(`ERROR calling metadata: ${e}`)
                throw e
            }
        }
    }

    async loadUploadedFilesList(clientName: string, forceRefresh: Boolean = false): Promise<UploadedFile[]> {
        if (!forceRefresh) {
            const storedData = LOCAL_STORAGE_CLIENT.getUploadedFiles(clientName)
            if (storedData) {
                console.log(`Loaded uploaded files from local storage`)
                console.log(storedData)
                return storedData
            }
        }
        const files: UploadedFile[] = []
        
        for await (const blob of (await this.getContainerClient(clientName, BlobContainerName.INPUT)).listBlobsFlat({includeTags: true, includeMetadata: true})) {
            const metadata = (blob.metadata || undefined) as InputFileMetadata | undefined
            files.push({
                name: blob.name,
                uploadStatus: UploadStatus.SUCCESS,
                pagesAnalyzed: metadata?.analyzed ? Number(metadata?.totalpages) : 0,
                totalPages: Number(metadata?.totalpages),
                statements: metadata?.statements?.split(", "),
            })
        }

        console.log(`Loaded uploaded files list from server`)
        console.log(files)

        LOCAL_STORAGE_CLIENT.storeUploadedFiles(clientName, files)

        return files
    }

    async loadStatementsList(clientName: string, forceRefresh: Boolean = false): Promise<BankStatementInfo[]> {
        if (!forceRefresh) {
            const storedData = LOCAL_STORAGE_CLIENT.getStatements(clientName)
            if (storedData) {
                console.log(`Loaded statements list from local storage`)
                console.log(storedData)
                return storedData
            }
        }

        const statementInfos: BankStatementInfo[] = []
        for await (const blob of (await this.getContainerClient(clientName, BlobContainerName.STATEMENTS)).listBlobsFlat({includeTags: true, includeMetadata: true})) {
            // format is 9652:CITI CC:9_7_2023.json
            const [account, bank, date] = transformStatementsField(blob.name).split(":")
            const metadata = blob.metadata! as any as BankStatementFileMetadata
            statementInfos.push({
                stmtFilename: blob.name,
                account: account,
                bankName: bank,
                date: date,
                totalSpending: Number(metadata.totalspending),
                totalIncomeCredits: Number(metadata.totalincomecredits),
                numTransactions: Number(metadata.numtransactions),
                bankType: metadata.banktype,
                inputFileInfo: {
                    name: metadata.filename,
                    startPage: Number(metadata.pagerange.split("-")[0]),
                    endPage: Number(metadata.pagerange.split("-")[1])
                },
                verifiedInfo: {
                    suspicious: metadata.suspicious === "true",
                    missingChecks: metadata.missingChecks === "true",
                    manuallyVerified: metadata.manuallyVerified === "true"
                }
            })
        }

        console.log(`Loaded statements list from server`)
        console.log(statementInfos)

        LOCAL_STORAGE_CLIENT.storeStatements(clientName, statementInfos)

        return statementInfos
    }

    async loadStatementDetails(clientName: string, info: BankStatementInfo, forceRefresh: Boolean = false): Promise<BankStatementDetails> {
        if (!forceRefresh) {
            const storedData = LOCAL_STORAGE_CLIENT.getStatementDetails(clientName, info.stmtFilename)
            if (storedData) {
                console.log(`Loaded statement details from local storage for ${info.stmtFilename}`)
                console.log(storedData)
                return storedData
            }
        }
        const response = await (await (await this.getContainerClient(clientName, BlobContainerName.STATEMENTS)).getBlobClient(info.stmtFilename).download()).blobBody;
        const details = JSON.parse(await response!.text()) as BankStatementDetails

        LOCAL_STORAGE_CLIENT.storeStatementDetails(clientName, info.stmtFilename, details)
        return details
    }

    async loadCsvFiles(clientName: string, links: WriteCsvSummaryResult): Promise<CsvSummary> {
        const checkSummaryPromise = this.loadCsvFile(clientName, links.checkSummaryFile)
        const accountSummaryPromise = this.loadCsvFile(clientName, links.accountSummaryFile)
        const statementSummaryPromise = this.loadCsvFile(clientName, links.statementSummaryFile)
        const recordsPromise = this.loadCsvFile(clientName, links.recordsFile)
        return {
            checkSummary: await checkSummaryPromise,
            accountSummary: await accountSummaryPromise,
            statementSummary: await statementSummaryPromise,
            records: await recordsPromise,
        }
    }
    
    async loadCsvFile(clientName: string, link: string) {
        const blobResponse = (await (await this.getContainerClient(clientName, BlobContainerName.OUTPUT)).getBlobClient(link).download())
        const blobBody = blobResponse.blobBody
        return (await blobBody)!.text()
        // return await (await (await (await this.getOutputClient()).getBlobClient(link).download()).blobBody!).text();
    }
}

export interface CsvSummary {
    checkSummary: string,
    accountSummary: string,
    statementSummary: string,
    records: string,
}

export interface InputFileMetadata {
    split: string
    analyzed: string
    totalpages: string
    statements?: string
}

export interface BankStatementFileMetadata {
    filename: string
    pagerange: string
    totalspending: string
    totalincomecredits: string
    numtransactions: string
    banktype: string
    suspicious: string
    missingChecks: string
    manuallyVerified: string
}