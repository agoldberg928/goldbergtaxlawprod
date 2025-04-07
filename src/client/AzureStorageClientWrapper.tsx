import { BlobUploadCommonResponse, ContainerClient, Metadata } from "@azure/storage-blob";
import { AzureFunctionClientWrapper, AZURE_FUNCTION_WRAPPER, ForceRefresh, RequiresMSAL } from "./AzureFunctionClientWrapper";
import { getCookie } from "./CookieWrapper";
import { BlobContainerName } from "../model/blobContainerName";
import { BankStatementDetails, BankStatementInfo } from "../model/statementModel";
import { transformStatementsField } from "../util/util";
import { UploadStatus } from "../model/analyzeDocumentApiModel";
import { IMsalContext } from "@azure/msal-react";
import { WriteCsvSummaryOutput } from "../model/analyzeDocumentApiModel";
import { FUNCTION_NAME_KEY, logResult } from "../util/decorators/LogResultDecorator";
import { ApiError } from "../model/error/CustomFacingError";
import { UploadedFile } from "../data/uploadedFilesSlice";


export class AzureStorageClientWrapper {
    private azureFunctionWrapper: AzureFunctionClientWrapper
    private containerClients: Map<string, ContainerClient> = new Map()

    private storageAccountName: string
    constructor(functionWrapper: AzureFunctionClientWrapper, storageAccountName: string) {
        this.storageAccountName = storageAccountName
        this.azureFunctionWrapper = functionWrapper
    }

    async getContainerClient(clientName: string, container: BlobContainerName, msal: IMsalContext): Promise<ContainerClient> {
        const clientContainerName = BlobContainerName.forClient(clientName, container)
        if (getCookie(clientContainerName) && this.containerClients.has(container)) {
            return this.containerClients.get(container)!
        } else {
            const sasToken = await this.azureFunctionWrapper.retrieveSasToken(clientName, container, msal)
            const client = new ContainerClient(`https://${this.storageAccountName}.blob.core.windows.net/${clientContainerName}?${sasToken}`)
            this.containerClients.set(clientContainerName, client)
            return client
        }
    }

    async getInputBlobUrl(clientName: string, filename: string, msal: IMsalContext): Promise<string> {
        const clientContainerName = BlobContainerName.forClient(clientName, BlobContainerName.INPUT)
        const sasToken = getCookie(clientContainerName) || await this.azureFunctionWrapper.retrieveSasToken(clientName, BlobContainerName.INPUT, msal)
        return `https://${this.storageAccountName}.blob.core.windows.net/${clientContainerName}/${filename}?${sasToken}`
    }

    async uploadFile(clientName: string, file: File, msal: IMsalContext): Promise<BlobUploadCommonResponse> {
        const blobClient = (await this.getContainerClient(clientName, BlobContainerName.INPUT, msal)).getBlockBlobClient(file.name);
        return blobClient.uploadData(file, { blobHTTPHeaders: { blobContentType: "application/pdf" } });
    }

    async deleteStatement(clientName: string, filename: string, msal: IMsalContext) {
        const blobClient = (await this.getContainerClient(clientName, BlobContainerName.STATEMENTS, msal)).getBlockBlobClient(filename);
        blobClient.delete()
    }

    @logStorageClientResult()
    async downloadInputFile(clientName: string, filename: string, msal: IMsalContext): Promise<File> {
        const blobClient = (await this.getContainerClient(clientName, BlobContainerName.INPUT, msal)).getBlockBlobClient(filename);
        const resp = await blobClient.download();
        const blob = await resp.blobBody;

        if (!blob) throw new ApiError(`Unable to download blob from ${filename}, returned empty`)
        
        return new File([blob], filename, {
            type: "application/pdf",
            lastModified: resp.lastModified?.getUTCMilliseconds()
        });
    }

    async downloadMetadataIfExists(clientName: string, filename: string, msal: IMsalContext): Promise<InputFileMetadata | undefined> {
        try {
            const blobClient = (await this.getContainerClient(clientName, BlobContainerName.INPUT, msal)).getBlockBlobClient(filename);
            const properties = await blobClient.getProperties();
            return properties.metadata as any as InputFileMetadata;
        } catch (e: any) {
            if (e.details?.errorCode === "BlobNotFound") {
                return undefined
            } else {
                console.log(`ERROR calling metadata: ${e}`)
                throw e
            }
        }
    }

    async updateInputMetadata(clientName: string, filename: string, metadata: InputFileMetadata, msal: IMsalContext) {
        const blobClient = (await this.getContainerClient(clientName, BlobContainerName.INPUT, msal)).getBlockBlobClient(filename);
        blobClient.setMetadata(metadata as any as Metadata)
    }

    @logStorageClientResult()
    async loadUploadedFilesList(clientName: string, msal: IMsalContext): Promise<UploadedFile[]> {
        const files: UploadedFile[] = []
        
        for await (const blob of (await this.getContainerClient(clientName, BlobContainerName.INPUT, msal)).listBlobsFlat({includeTags: true, includeMetadata: true})) {
            const metadata = (blob.metadata || undefined) as InputFileMetadata | undefined;
            files.push({
                id: blob.name,
                name: blob.name,
                // fileObjectUrl: `https://${this.storageAccountName}.blob.core.windows.net/${BlobContainerName.INPUT}/${blob.name}`, // Updated to use fileObjectUrl
                uploadStatus: UploadStatus.SUCCESS,
                pagesAnalyzed: metadata?.analyzed ? Number(metadata?.totalpages) : 0,
                totalPages: Number(metadata?.totalpages),
                statements: metadata?.statements?.split(", "),
            })
        }

        return files
    }

    @logStorageClientResult()
    async loadStatementsList(clientName: string, msal: IMsalContext): Promise<BankStatementInfo[]> {
        const statementInfos: BankStatementInfo[] = []
        for await (const blob of (await this.getContainerClient(clientName, BlobContainerName.STATEMENTS, msal)).listBlobsFlat({includeTags: true, includeMetadata: true})) {
            // format is 9652:CITI CC:9_7_2023.json
            const [account, bank, date] = transformStatementsField(blob.name).split(":")
            const metadata = blob.metadata! as any as BankStatementFileMetadata
            statementInfos.push({
                id: blob.name,
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

        return statementInfos
    }

    @logStorageClientResult({ useArgs: { "filename": 1 } })
    async loadStatementDetails(clientName: string, stmtFilename: string, msal: IMsalContext, forceRefresh: Boolean = false): Promise<BankStatementDetails> {
        const response = await (await (await this.getContainerClient(clientName, BlobContainerName.STATEMENTS, msal)).getBlobClient(stmtFilename).download()).blobBody;
        const res = JSON.parse(await response!.text()) as BankStatementDetails
        return {...res, id: res.filename} as BankStatementDetails
    }

    async loadCsvFiles(clientName: string, links: WriteCsvSummaryOutput, msal: IMsalContext): Promise<CsvSummary> {
        const checkSummaryPromise = this.loadCsvFile(clientName, links.checkSummaryFile, msal)
        const accountSummaryPromise = this.loadCsvFile(clientName, links.accountSummaryFile, msal)
        const statementSummaryPromise = this.loadCsvFile(clientName, links.statementSummaryFile, msal)
        const recordsPromise = this.loadCsvFile(clientName, links.recordsFile, msal)
        return {
            checkSummary: await checkSummaryPromise,
            accountSummary: await accountSummaryPromise,
            statementSummary: await statementSummaryPromise,
            records: await recordsPromise,
        }
    }
    
    async loadCsvFile(clientName: string, link: string, msal: IMsalContext): Promise<string> {
        const blobResponse = (await (await this.getContainerClient(clientName, BlobContainerName.OUTPUT, msal)).getBlobClient(link).download())
        const blobBody = await blobResponse.blobBody
        if (!blobBody) throw new ApiError(`Unable to load csv ${link}: the response is`)
        return blobBody.text()
    }
}

export const AZURE_STORAGE_WRAPPER = new AzureStorageClientWrapper(AZURE_FUNCTION_WRAPPER, process.env.REACT_APP_STORAGE_ACCOUNT!);

export interface LoadUploadedFilesProps extends RequiresMSAL, ForceRefresh {}

export interface LoadStatementsListProps extends RequiresMSAL, ForceRefresh {}

export interface DownladAllMetadataProps extends RequiresMSAL {}

export interface DownladMetadataProps extends RequiresMSAL {
    filename: string
}

export interface DeleteStatementProps extends RequiresMSAL {
    filename: string
}

export interface UpdateMetadataProps extends RequiresMSAL {
    filename: string,
    metadata: InputFileMetadata
}

export interface DownloadFileProps extends RequiresMSAL {
    filename: string
}

export interface DownloadStatementDetailsProps extends RequiresMSAL, ForceRefresh {
    filename: string
}

export interface UploadFileProps extends RequiresMSAL {
    file: UploadedFile
}

export interface UploadFilesProps extends RequiresMSAL {}

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

function logStorageClientResult(options?: {useArgs?: Record<string, number>}) {
    return logResult({message: `Loaded ${FUNCTION_NAME_KEY} from server`, functionNameTransform: transformFunctionName, useArgs: options?.useArgs})
}

function transformFunctionName(functionName: string) {
    return functionName.replace(/^load/, "").addSpacesBeforeCapitalLetters().trim().toLowerCase();
}