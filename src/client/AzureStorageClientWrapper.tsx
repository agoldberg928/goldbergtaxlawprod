import { BlobUploadCommonResponse, ContainerClient, BlobItem } from "@azure/storage-blob";
import { AzureFunctionClientWrapper, WriteCsvSummaryResult } from "./AzureFunctionClientWrapper";
import { CookieKey, getCookie } from "./cookieClient";
import { BlobContainerName } from "../model/enums";
import { BankStatement } from "../model/statement_model";


export class AzureStorageClientWrapper {
    private azureFunctionWrapper: AzureFunctionClientWrapper
    private inputContainerClient: Promise<ContainerClient> | undefined
    private outputContainerClient: Promise<ContainerClient> | undefined
    private storageAccountName: string
    constructor(functionWrapper: AzureFunctionClientWrapper, storageAccountName: string) {
        this.storageAccountName = storageAccountName
        this.azureFunctionWrapper = functionWrapper
        // this.inputContainerClient = this.newClientFromSasToken(BlobContainerName.INPUT)
        // this.outputContainerClient = this.newClientFromSasToken(BlobContainerName.OUTPUT)
        this.inputContainerClient = undefined
        this.outputContainerClient = undefined
    }

    private async getInputClient(): Promise<ContainerClient> {
        if (getCookie(CookieKey.INPUT_SAS_TOKEN) && this.inputContainerClient) return this.inputContainerClient
        else return this.refreshInputClient()
    }
    
    
    private async getOutputClient(): Promise<ContainerClient> {
        if (getCookie(CookieKey.OUTPUT_SAS_TOKEN) && this.outputContainerClient) return this.outputContainerClient
        else return this.refreshOutputClient()
    }

    private async refreshInputClient(): Promise<ContainerClient> {
        this.inputContainerClient = this.newClientFromSasToken(BlobContainerName.INPUT)
        return this.inputContainerClient
    }

    private async refreshOutputClient(): Promise<ContainerClient> {
        this.outputContainerClient = this.newClientFromSasToken(BlobContainerName.OUTPUT)
        return this.outputContainerClient
    }
    
    private async newClientFromSasToken(container: BlobContainerName): Promise<ContainerClient> {
        const sasToken = await this.azureFunctionWrapper.retrieveSasToken(container)
        return new ContainerClient(`https://${this.storageAccountName}.blob.core.windows.net/${container}?${sasToken}`)
    }

    async uploadFile(file: File): Promise<BlobUploadCommonResponse> {
        const blobClient = (await this.getInputClient()).getBlockBlobClient(file.name);
        return blobClient.uploadData(file)
    }

    async downloadMetadataIfExists(filename: string): Promise<InputFileMetadata | undefined> {
        try {
            const blobClient = (await this.getInputClient()).getBlockBlobClient(filename);
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

    async loadExistingInputFiles(): Promise<BlobItem[]> {
        const blobItems: BlobItem[] = []
        for await (const response of (await this.getInputClient()).listBlobsFlat({includeTags: true, includeMetadata: true}).byPage({ maxPageSize: 20 })) {
            for (const blob of response.segment.blobItems) {
                blobItems.push(blob)
            }
        }
        return blobItems
    }

    async loadBankStatements(statementKeys: string[]): Promise<BankStatement[]> {
        return Promise.all(statementKeys.map(async (link): Promise<BankStatement> => {
            const response = await (await (await this.getOutputClient()).getBlobClient(link).download()).blobBody;
            return JSON.parse(await response!.text()) as BankStatement
        }))
    }

    async loadCsvFiles(links: WriteCsvSummaryResult): Promise<CsvSummary> {
        const checkSummaryPromise = this.loadCsvFile(links.checkSummaryFile)
        const accountSummaryPromise = this.loadCsvFile(links.accountSummaryFile)
        const statementSummaryPromise = this.loadCsvFile(links.statementSummaryFile)
        const recordsPromise = this.loadCsvFile(links.recordsFile)
        return {
            checkSummary: await checkSummaryPromise,
            accountSummary: await accountSummaryPromise,
            statementSummary: await statementSummaryPromise,
            records: await recordsPromise,
        }
    }
    
    async loadCsvFile(link: string) {
        const blobResponse = (await (await this.getOutputClient()).getBlobClient(link).download())
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
    statements: string
}