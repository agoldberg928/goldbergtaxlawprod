import { AccountInfo, IPublicClientApplication } from "@azure/msal-browser"
import { IMsalContext, useMsal } from "@azure/msal-react";
import { loginRequest } from "../auth/authConfig";
import { BlobContainerName } from "../model/enums"
import { CookieKey, getCookie, setCookie } from "./cookieClient"

export class AzureFunctionClientWrapper {
    private analyzeDocumentEndpoint: string
    private fetchSasTokenEndpoint: string
    private writeCsvSummaryEndpoint: string
    private instance: IPublicClientApplication
    private accounts: AccountInfo[]
    
    constructor(clientEndpoint: string, msalContext: IMsalContext) {
        this.instance = msalContext.instance
        this.accounts = msalContext.accounts
        this.analyzeDocumentEndpoint = clientEndpoint.concat(AzureFunctionClientWrapper.ANALYZE_DOCUMENT_ENDPOINT_SUFFIX)
        this.fetchSasTokenEndpoint = clientEndpoint.concat(AzureFunctionClientWrapper.FETCH_SAS_TOKEN_ENDPOINT_SUFFIX)
        this.writeCsvSummaryEndpoint = clientEndpoint.concat(AzureFunctionClientWrapper.WRITE_CSV_SUMMARY_ENDPOINT_SUFFIX)
    }

    async retrieveSasToken(action: BlobContainerName): Promise<string> {
        const cookieKey = CookieKey.forBlobContainer(action)
        return getCookie(cookieKey) ?? await this.fetchNewSasToken(action, cookieKey)
    }

    private async fetchNewSasToken(action: BlobContainerName, cookieKey: CookieKey): Promise<string> {
        const searchParams = new URLSearchParams({ action: action })
        
        try {
            const response = await this.fetchResponse(`${this.fetchSasTokenEndpoint}?${searchParams}`, { 
                method: "GET"
            });
            const token = response.token;
    
            setCookie(cookieKey, token, AzureFunctionClientWrapper.SAS_TOKEN_EXPIRY_SECONDS);
    
            return token;
        } catch (error: any) {
            // TODO: what to do if we don't have a SAS token?  Probably should retry/break the page
            console.error("Error fetching the SAS token:", error);
            alert(`Unable to fetch connection string to Azure Storage: ${error}`)
            throw Error(error.message)
        }
    }

    async analyzeDocuments(filenames: string[], pollerFunc: (status: AnalyzeDocumentIntermediateStatus) => void): Promise<string[]> {
        const statusQueryURL = await this.initAnalyzeDocuments(filenames)
        return this.pollForStatus(statusQueryURL, pollerFunc)
    }

    private async initAnalyzeDocuments(filenames: string[]): Promise<string> {
        try {
            const response = await this.fetchResponse(this.analyzeDocumentEndpoint, { 
                method: "POST",
                body: JSON.stringify({
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

    private async pollForStatus(statusQueryURL: string, pollerFunc: (status: AnalyzeDocumentIntermediateStatus) => void) {
        let currentRunningStatus: RuntimeStatus
        let statusInfo: AnalyzeDocumentStatus
        do {
            await wait(3000)
            statusInfo = await this.getAnalyzeDocumentStatus(statusQueryURL)
            console.log(`current status: ${JSON.stringify(statusInfo)}`)
            currentRunningStatus = statusInfo.runtimeStatus
            pollerFunc(statusInfo.customStatus)
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
            const response = await this.fetchResponse(statusQueryUrl, { method: "GET" });
            return response
        } catch(err: any) {
            // TODO: what to do if this fails? Should probably implement limited retry to persist through network failures, etc.
            throw Error(`[${statusQueryUrl}] Call to get status of analyze documents process failed: ${err}`)
        }
    }

    async writeCsv(statements: string[]): Promise<WriteCsvSummaryResult> {
        try {
            const response = await this.fetchResponse(this.writeCsvSummaryEndpoint, { 
                method: "POST",
                body: JSON.stringify({
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
        const authResponse = await this.instance.acquireTokenSilent({...loginRequest, account: this.accounts[0]})
        return {
            Authorization: `Bearer ${authResponse.accessToken}`, // Attach the token
            'Content-Type': 'application/json'
        }
    }

    private static ANALYZE_DOCUMENT_ENDPOINT_SUFFIX = "/api/InitAnalyzeDocuments"
    private static FETCH_SAS_TOKEN_ENDPOINT_SUFFIX = "/api/RequestSASToken"
    private static WRITE_CSV_SUMMARY_ENDPOINT_SUFFIX = "/api/WriteCsvSummary"
    
    private static SAS_TOKEN_EXPIRY_SECONDS = 60 * 15  // 15 minutes
    private static POLLING_TIMEOUT_PERIOD_MS = 1000 * 60 * 2  // 2 minutes
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
    customStatus: AnalyzeDocumentIntermediateStatus
    // input: {}  ignore for now
    output: AnalyzeDocumentOutput
    createdTime: Date // might have to store as string
    lastUpdatedTime: Date
}

export type AnalyzeDocumentIntermediateStatus = {
    stage: string
    documents: Array<DocumentStatus>
    totalPages: number
    pagesCompleted: number
}


enum AnalyzeDocumentAction {
    VERIFYING = "Verifying",
    EXTRACTING_DATA = "Extracting Data"
}

export type DocumentStatus = {
    documentName: string
    totalPages: number
    pagesCompleted: number
}

type AnalyzeDocumentOutput = {
    status: FinalStatus
    result: string[]
    errorMessage: string
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