import { AccountInfo } from "@azure/msal-browser";
import { IMsalContext, useMsal } from "@azure/msal-react";
import { loginRequest } from "../auth/authConfig";
import { BlobContainerName } from "../model/enums"
import { CookieKey, DynamicCookieKey, getCookie, setCookie } from "./CookieWrapper"
import { LOCAL_STORAGE_CLIENT } from "./LocalStorageClient";

export class AzureFunctionClientWrapper {
    private analyzeDocumentEndpoint: string
    private fetchSasTokenEndpoint: string
    private writeCsvSummaryEndpoint: string
    private listClientsEndpoint: string
    private newClientEndpoint: string
    private msal: IMsalContext
    
    constructor(clientEndpoint: string, msal: IMsalContext) {
        this.msal = msal
        this.analyzeDocumentEndpoint = clientEndpoint.concat(AzureFunctionClientWrapper.ANALYZE_DOCUMENT_ENDPOINT_SUFFIX)
        this.fetchSasTokenEndpoint = clientEndpoint.concat(AzureFunctionClientWrapper.FETCH_SAS_TOKEN_ENDPOINT_SUFFIX)
        this.writeCsvSummaryEndpoint = clientEndpoint.concat(AzureFunctionClientWrapper.WRITE_CSV_SUMMARY_ENDPOINT_SUFFIX)
        this.listClientsEndpoint = clientEndpoint.concat(AzureFunctionClientWrapper.LIST_CLIENTS_ENDPOINT_SUFFIX)
        this.newClientEndpoint = clientEndpoint.concat(AzureFunctionClientWrapper.NEW_CLIENT_ENDPOINT_SUFFIX)
    }

    async listClients(forceRefresh: Boolean): Promise<string[]> {
        if (!forceRefresh) {
            const storedData = LOCAL_STORAGE_CLIENT.getClients()
            if (storedData) {
                console.log(`Loaded clients from local storage`)
                console.log(storedData)
                return storedData
            }
        }
        try {
            const response = await this.fetchResponse(this.listClientsEndpoint, { method: "GET" });
            LOCAL_STORAGE_CLIENT.storeClients(response.clients)
            return response.clients
        } catch (error: any) {
            console.error("Error calling listClients:", error);
            throw Error(`listClients failed: ${error}`)
        }
    }

    async newClient(clientName: string): Promise<void> {
        try {
            const response = await this.fetchResponse(this.newClientEndpoint, { 
                method: "POST",
                body: JSON.stringify({
                    clientName: clientName
                })
            });

            console.log(response)
        } catch (error: any) {
            console.error("Error calling newClient:", error);
            throw Error(`newClient failed with input [${clientName}]: ${error}`)
        }
    }

    async retrieveSasToken(clientName: string, action: BlobContainerName): Promise<string> {
        const cookieKey = BlobContainerName.forClient(clientName, action)
        return getCookie(cookieKey) ?? await this.fetchNewSasToken(clientName, action, cookieKey)
    }

    private async fetchNewSasToken(clientName: string, action: BlobContainerName, cookieKey: DynamicCookieKey): Promise<string> {
        const searchParams = new URLSearchParams({ clientName: clientName, action: action })
        
        try {
            const response = await this.fetchResponse(`${this.fetchSasTokenEndpoint}?${searchParams}`, { 
                method: "GET"
            });
            const token = response.token;
            
            console.log(`fetched new ${cookieKey} token: ${token}`)
    
            setCookie(cookieKey, token, AzureFunctionClientWrapper.SAS_TOKEN_EXPIRY_SECONDS);
    
            return token;
        } catch (error: any) {
            // TODO: what to do if we don't have a SAS token?  Probably should retry/break the page
            console.error("Error fetching the SAS token:", error);
            alert(`Unable to fetch connection string to Azure Storage: ${error}`)
            throw Error(error.message)
        }
    }

    async uploadFile() {
        
    }

    async analyzeDocuments(clientName: string, filenames: string[], pollerFunc: (status: AnalyzeDocumentProgress) => void): Promise<AnalyzeDocumentResult> {
        const statusQueryURL = await this.initAnalyzeDocuments(clientName, filenames)
        return this.pollForStatus(statusQueryURL, pollerFunc)
    }

    private async initAnalyzeDocuments(clientName: string, filenames: string[]): Promise<string> {
        try {
            const response = await this.fetchResponse(this.analyzeDocumentEndpoint, { 
                method: "POST",
                body: JSON.stringify({
                    clientName: clientName,
                    documents: filenames,
                    overwrite: true
                })
            });
            return response.statusQueryGetUri;
        } catch (error: any) {
            console.error("Error calling initAnalyzeDocuments:", error);
            throw Error(`initAnalyzeDocuments failed with input [${filenames}]: ${error}`)
        }
    }

    private async pollForStatus(statusQueryURL: string, pollerFunc: (status: AnalyzeDocumentProgress) => void) {
        let currentRunningStatus: RuntimeStatus
        let statusInfo: AnalyzeDocumentStatus
        do {
            await wait(3000)
            statusInfo = await this.getAnalyzeDocumentStatus(statusQueryURL)
            console.log(`current status: ${JSON.stringify(statusInfo)}`)
            currentRunningStatus = statusInfo.runtimeStatus
            pollerFunc({
                requestId: statusInfo.instanceId,
                status: statusInfo.customStatus,
                createdTime: new Date(statusInfo.createdTime),
                lastUpdatedTime: new Date(statusInfo.lastUpdatedTime)
            })
            if ((new Date(statusInfo.lastUpdatedTime).valueOf() + AzureFunctionClientWrapper.POLLING_TIMEOUT_PERIOD_MS) < new Date().valueOf()) {
                throw Error(`[${statusQueryURL}] Function appears to be stuck as it has not updated in 5 minutes.  Please check the run ID for more details`)
            }
        } while (currentRunningStatus === RuntimeStatus.RUNNING)
        
        if (statusInfo.runtimeStatus == RuntimeStatus.COMPLETED && statusInfo.output.status == FinalStatus.SUCCESS) {
            return statusInfo.output.result
        } else if (statusInfo.runtimeStatus == RuntimeStatus.COMPLETED && statusInfo.output.status == FinalStatus.FAILED) {
            throw Error(`[${statusQueryURL}] Analyze Document process return FAILED status: ${statusInfo.output.errorMessage}`)
        } else {
            throw Error(`[${statusQueryURL}] Analyze Document process failed to complete.  Please check the runId for more details. Last known status: ${JSON.stringify(statusInfo)}.`)
        }
    }

    private async getAnalyzeDocumentStatus(statusQueryUrl: string): Promise<AnalyzeDocumentStatus> {
        try {
            return await this.fetchResponse(statusQueryUrl, { method: "GET" });
        } catch(err: any) {
            // TODO: what to do if this fails? Should probably implement limited retry to persist through network failures, etc.
            throw Error(`[${statusQueryUrl}] Call to get status of analyze documents process failed: ${err}`)
        }
    }

    async writeCsv(clientName: string, statements: string[]): Promise<WriteCsvSummaryResult> {
        try {
            const response = await this.fetchResponse(this.writeCsvSummaryEndpoint, { 
                method: "POST",
                body: JSON.stringify({
                    clientName: clientName,
                    statementKeys: statements,
                    outputDirectory: "reacttest",
                })
            });
            const result = response as WriteCsvSummaryResult
            if (result.status == FinalStatus.SUCCESS) {
                return result;
            } else {
                throw Error(result.errorMessage)
            }
        } catch (error: any) {
            // TODO: Probably should alert with error message
            console.error("Error calling WriteCsvSummary:", error);
            throw Error(`writeCsvSummary failed with input [${statements}]: ${error}`)
        }
    }


    private async fetchResponse(url: string, requestParams: RequestInit | undefined): Promise<any> {
        const header = await this.getValidAuthHeader()
        const response = await fetch(url, { 
            ...requestParams,
            headers: header
        });
        const blobText = await (await response.blob()).text()
        if (blobText.length == 0) {
            throw Error(`[${response.url}] failed with status ${response.status}: ${response.statusText}`)
        }
        try {
            return JSON.parse(blobText)
        } catch(err: any) {
            throw Error(blobText)
        }
    }

    private async getValidAuthHeader(): Promise<HeadersInit> {
        // @ts-ignore
        const authResponse = await this.msal.instance.acquireTokenSilent({...loginRequest, account: this.msal.accounts[0]})
        return {
            Authorization: `Bearer ${authResponse.accessToken}`, // Attach the token
            'Content-Type': 'application/json'
        }
    }

    private static ANALYZE_DOCUMENT_ENDPOINT_SUFFIX = "/api/InitAnalyzeDocuments"
    private static FETCH_SAS_TOKEN_ENDPOINT_SUFFIX = "/api/RequestSASToken"
    private static WRITE_CSV_SUMMARY_ENDPOINT_SUFFIX = "/api/WriteCsvSummary"
    private static LIST_CLIENTS_ENDPOINT_SUFFIX = "/api/ListClients"
    private static NEW_CLIENT_ENDPOINT_SUFFIX = "/api/NewClient"
    
    private static SAS_TOKEN_EXPIRY_SECONDS = 60 * 15  // 15 minutes
    private static POLLING_TIMEOUT_PERIOD_MS = 1000 * 60 * 5  // 5 minutes
} 

// TODO: verify these statuses
enum RuntimeStatus {
    PENDING = "Pending",
    RUNNING = "Running",
    COMPLETED = "Completed",
    FAILED = "Failed"
}

type AnalyzeDocumentStatus = {
    name: string
    instanceId: string
    runtimeStatus: RuntimeStatus
    customStatus: AnalyzeDocumentCustomStatus
    // input: {}  ignore for now
    output: AnalyzeDocumentOutput
    createdTime: string // might have to store as string
    lastUpdatedTime: string
}

export type AnalyzeDocumentCustomStatus = {
    stage: string
    documents: Array<DocumentStatus>
    totalPages: number
    pagesCompleted: number
}

export type AnalyzeDocumentProgress = {
    requestId: string
    status: AnalyzeDocumentCustomStatus
    createdTime: Date // might have to store as string
    lastUpdatedTime: Date
}

export type DocumentStatus = {
    fileName: string
    totalPages: number
    pagesCompleted: number
}

type AnalyzeDocumentOutput = {
    status: FinalStatus
    result: AnalyzeDocumentResult
    errorMessage: string
}

export type AnalyzeDocumentResult = {
    [key: string]: string[];
}

export enum FinalStatus {
    SUCCESS = "Success",
    FAILED = "Failed"
}

export interface WriteCsvSummaryResult {
    status: FinalStatus,
    errorMessage: string,
    checkSummaryFile: string,
    accountSummaryFile: string,
    statementSummaryFile: string,
    recordsFile: string,
}

function wait(ms: number = 1000) {
    return new Promise(resolve => { setTimeout(resolve, ms); });
};