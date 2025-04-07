import { IMsalContext } from "@azure/msal-react";
import { loginRequest } from "../auth/authConfig";
import { AnalyzeDocumentProgress, AnalyzeDocumentResult, GetAnalyzeDocumentStatusOutput, FinalStatus, RuntimeStatus, WriteCsvSummaryOutput, ClassificationOverride,  } from "../model/analyzeDocumentApiModel";
import { BlobContainerName } from "../model/blobContainerName"
import { ApiError, CustomerFacingError } from "../model/error/CustomFacingError";
import { CookieKey, DynamicCookieKey, getCookie, setCookie } from "./CookieWrapper"
import { LOCAL_STORAGE_CLIENT } from "./LocalStorageClient";

export class AzureFunctionClientWrapper {
    private analyzeDocumentEndpoint: string
    private fetchSasTokenEndpoint: string
    private writeCsvSummaryEndpoint: string
    private listClientsEndpoint: string
    private newClientEndpoint: string
    private getDocumentDataModelEndpoint: string
    private putDocumentDataModelEndpoint: string
    private analyzePageEndpoint: string
    
    constructor(clientEndpoint: string) {
        this.analyzeDocumentEndpoint = clientEndpoint.concat(AzureFunctionClientWrapper.ANALYZE_DOCUMENT_ENDPOINT_SUFFIX)
        this.fetchSasTokenEndpoint = clientEndpoint.concat(AzureFunctionClientWrapper.FETCH_SAS_TOKEN_ENDPOINT_SUFFIX)
        this.writeCsvSummaryEndpoint = clientEndpoint.concat(AzureFunctionClientWrapper.WRITE_CSV_SUMMARY_ENDPOINT_SUFFIX)
        this.listClientsEndpoint = clientEndpoint.concat(AzureFunctionClientWrapper.LIST_CLIENTS_ENDPOINT_SUFFIX)
        this.newClientEndpoint = clientEndpoint.concat(AzureFunctionClientWrapper.NEW_CLIENT_ENDPOINT_SUFFIX)
        this.getDocumentDataModelEndpoint = clientEndpoint.concat(AzureFunctionClientWrapper.GET_DOCUMENT_DATA_MODEL_ENDPOINT_SUFFIX)
        this.putDocumentDataModelEndpoint = clientEndpoint.concat(AzureFunctionClientWrapper.PUT_DOCUMENT_DATA_MODEL_ENDPOINT_SUFFIX)
        this.analyzePageEndpoint = clientEndpoint.concat(AzureFunctionClientWrapper.ANALYZE_PAGE_ENDPOINT_SUFFIX)
    }

    @StandardErrorHandler()
    async listClients(forceRefresh: Boolean, msal: IMsalContext): Promise<string[]> {
        if (!forceRefresh) {
            const storedData = LOCAL_STORAGE_CLIENT.getClients()
            if (storedData) {
                console.log(`Loaded clients from local storage`, storedData)
                return storedData
            }
        }
        const response = await this.fetchResponse(this.listClientsEndpoint, { method: "GET" }, msal);
        LOCAL_STORAGE_CLIENT.storeClients(response.clients)
        return response.clients
    }

    @StandardErrorHandler({includeArgs: [0]})
    async newClient(clientName: string, msal: IMsalContext): Promise<void> {
        return await this.fetchResponse(this.newClientEndpoint, { 
            method: "POST",
            body: JSON.stringify({
                clientName: clientName
            })
        }, msal);
    }

    
    async retrieveSasToken(clientName: string, action: BlobContainerName, msal: IMsalContext): Promise<string> {
        try {
            const cookieKey = BlobContainerName.forClient(clientName, action)
            return getCookie(cookieKey) ?? await this.fetchNewSasToken(clientName, action, cookieKey, msal)
        } catch (error: any) {
            throw new ApiError(`Unable to fetch connection string to Azure Storage: ${error.message}`)
        }
    }

    @StandardErrorHandler()
    private async fetchNewSasToken(clientName: string, action: BlobContainerName, cookieKey: DynamicCookieKey, msal: IMsalContext): Promise<string> {
        const searchParams = new URLSearchParams({ clientName: clientName, action: action })
    
        const response = await this.fetchResponse(`${this.fetchSasTokenEndpoint}?${searchParams}`, { method: "GET" }, msal);
        const token = response.token;
        
        console.log(`fetched new ${cookieKey} token: ${token}`)

        setCookie(cookieKey, token, AzureFunctionClientWrapper.SAS_TOKEN_EXPIRY_SECONDS);

        return token;
    }

    @StandardErrorHandler({includeArgs: [1]})
    async initAnalyzeDocuments(clientName: string, filenames: string[], msal: IMsalContext): Promise<string> {
        const response = await this.fetchResponse(this.analyzeDocumentEndpoint, { 
            method: "POST",
            body: JSON.stringify({
                clientName: clientName,
                documents: filenames,
                overwrite: true
            })
        }, msal);
        return response.statusQueryGetUri;
    }

    @StandardErrorHandler({includeArgs: [0]})
    async pollForStatus(statusQueryURL: string, pollerFunc: (status: AnalyzeDocumentProgress) => void, msal: IMsalContext): Promise<AnalyzeDocumentResult> {
        let currentRunningStatus: RuntimeStatus
        let statusInfo: GetAnalyzeDocumentStatusOutput
        do {
            await wait(3000)
            statusInfo = await this.getAnalyzeDocumentStatus(statusQueryURL, msal)
            console.log(`current status: `, statusInfo)
            currentRunningStatus = statusInfo.runtimeStatus
            pollerFunc({
                requestId: statusInfo.instanceId,
                status: statusInfo.customStatus,
                createdTime: statusInfo.createdTime,
                lastUpdatedTime: statusInfo.lastUpdatedTime
            })
            if ((new Date(statusInfo.lastUpdatedTime).valueOf() + AzureFunctionClientWrapper.POLLING_TIMEOUT_PERIOD_MS) < new Date().valueOf()) {
                throw new CustomerFacingError(`[${statusQueryURL}] Function appears to be stuck as it has not updated in 5 minutes.  Please check the run ID for more details`)
            }
        } while (currentRunningStatus === RuntimeStatus.RUNNING)
        
        if (statusInfo.runtimeStatus == RuntimeStatus.COMPLETED && statusInfo.output.status == FinalStatus.SUCCESS) {
            return statusInfo.output.result
        } else if (statusInfo.runtimeStatus == RuntimeStatus.COMPLETED && statusInfo.output.status == FinalStatus.FAILED) {
            throw new CustomerFacingError(`[${statusQueryURL}] Analyze Document process return FAILED status: ${statusInfo.output.errorMessage}`)
        } else {
            throw new CustomerFacingError(`[${statusQueryURL}] Analyze Document process failed to complete.  Please check the runId for more details. Last known status: ${JSON.stringify(statusInfo)}.`)
        }
    }

    private async getAnalyzeDocumentStatus(statusQueryUrl: string, msal: IMsalContext): Promise<GetAnalyzeDocumentStatusOutput> {
        try {
            return await this.fetchResponse(statusQueryUrl, { method: "GET" }, msal);
        } catch(err: any) {
            // TODO: what to do if this fails? Should probably implement limited retry to persist through network failures, etc.
            throw new CustomerFacingError(`[${statusQueryUrl}] Call to get status of analyze documents process failed: ${err}`)
        }
    }

    @StandardErrorHandler({includeArgs: [1]})
    async writeCsv(clientName: string, statements: string[], msal: IMsalContext): Promise<WriteCsvSummaryOutput> {
        const response = await this.fetchResponse(this.writeCsvSummaryEndpoint, { 
            method: "POST",
            body: JSON.stringify({
                clientName: clientName,
                statementKeys: statements,
                outputDirectory: "reacttest",
            })
        }, msal);
        const result = response as WriteCsvSummaryOutput
        if (result.status == FinalStatus.SUCCESS) {
            return result;
        } else {
            throw new ApiError(result.errorMessage)
        }
    }

    @StandardErrorHandler({includeArgs: [1, 2]})
    async getDocumentDataModel(clientName: string, filename: string, page: number, msal: IMsalContext): Promise<any> {
        // TODO: this should probably be a GET request but it's implemented as POST on the server
        const response = await this.fetchResponse(this.getDocumentDataModelEndpoint, {
            method: "POST",
            body: JSON.stringify({
                requestId: "website-".concat(crypto.randomUUID()),
                clientName: clientName,
                pdfPageData: {
                    fileName: filename,
                    page: page
                }
            })
        }, msal);
        if (response.status === "Failed") {
            throw new ApiError(response.errorMessage)
        }
        return response;
    }

    @StandardErrorHandler({includeArgs: [1, 2]})
    async putDocumentDataModel(clientName: string, filename: string, page: number, statementType: string, document: any, msal: IMsalContext): Promise<any> {
        const response = await this.fetchResponse(this.putDocumentDataModelEndpoint, {
            method: "POST",
            body: JSON.stringify({
                clientName: clientName,
                pdfPageData: {
                    fileName: filename,
                    page: page
                },
                model: {
                    [statementType]: document
                }
            })
        }, msal);
        if (response.status === "Failed") {
            throw new ApiError(response.errorMessage)
        }
        return response;
    }

    @StandardErrorHandler({includeArgs: [1, 2]})
    async analyzePage(clientName: string, filename: string, pages: number[], classificationOverride: ClassificationOverride | null, msal: IMsalContext): Promise<any> {
        const requests = pages.map((page) => ({
            requestId: "website-".concat(crypto.randomUUID()),
            clientName: clientName,
            pdfPageData: {
                fileName: filename,
                page: page
            },
            overrideTypeClassification: classificationOverride
        }))
        const response = await this.fetchResponse(this.analyzePageEndpoint, {
            method: "POST",
            body: JSON.stringify({
                pageRequests: requests
            })
        }, msal);
        if (response.status === "Failed") {
            throw new ApiError(response.errorMessage)
        }
        return response;
    }


    private async fetchResponse(url: string, requestParams: RequestInit | undefined, msal: IMsalContext): Promise<any> {
        try {
            const header = await this.getValidAuthHeader(msal)
            const response = await fetch(url, { 
                ...requestParams,
                headers: header
            });
            const blobText = await (await response.blob()).text()
            if (blobText.length == 0) {
                throw new ApiError(`[${response.url}] failed with status ${response.status}: ${response.statusText}`)
            }
            try {
                return JSON.parse(blobText)
            } catch(err: any) {
                throw new ApiError(blobText)
            }
        } catch(error: any) {
            if (error instanceof TypeError) {
                throw new ApiError(`Unable to fetch from ${url}, check your internet connection and ensure the server is up and running`)
            } else { // if (error instanceof ApiError) {
                throw error
            }
        }
    }

    private async getValidAuthHeader(msal: IMsalContext): Promise<HeadersInit> {
        try {
            const authResponse = await msal.instance.acquireTokenSilent({...loginRequest, account: msal.accounts[0]})
            return {
                Authorization: `Bearer ${authResponse.accessToken}`, // Attach the token
                'Content-Type': 'application/json'
            }
        } catch(error: any) {
            throw new ApiError(`Unable to fetch azure access token: ${error}`)
        }
    }

    private static ANALYZE_DOCUMENT_ENDPOINT_SUFFIX = "/api/InitAnalyzeDocuments"
    private static FETCH_SAS_TOKEN_ENDPOINT_SUFFIX = "/api/RequestSASToken"
    private static WRITE_CSV_SUMMARY_ENDPOINT_SUFFIX = "/api/WriteCsvSummary"
    private static LIST_CLIENTS_ENDPOINT_SUFFIX = "/api/ListClients"
    private static NEW_CLIENT_ENDPOINT_SUFFIX = "/api/NewClient"
    private static GET_DOCUMENT_DATA_MODEL_ENDPOINT_SUFFIX = "/api/GetDocumentDataModel"
    private static PUT_DOCUMENT_DATA_MODEL_ENDPOINT_SUFFIX = "/api/PutDocumentDataModel"
    private static ANALYZE_PAGE_ENDPOINT_SUFFIX = "/api/AnalyzePage"
    
    private static SAS_TOKEN_EXPIRY_SECONDS = 60 * 10  // 10 minutes
    private static POLLING_TIMEOUT_PERIOD_MS = 1000 * 60 * 5  // 5 minutes
}

export const AZURE_FUNCTION_WRAPPER = new AzureFunctionClientWrapper(process.env.REACT_APP_AZURE_FUNCTION_BASE_URL!)

export interface RequiresMSAL {
    msal: IMsalContext;
}

export interface ForceRefresh {
    forceRefresh: boolean;
}

export interface ListClientsProps extends RequiresMSAL, ForceRefresh {}

export interface NewClientProps extends RequiresMSAL {
    clientName: string;
}

export interface PollForStatusProps extends RequiresMSAL {
    requestUrl: string;
}


function wait(ms: number = 1000) {
    return new Promise(resolve => { setTimeout(resolve, ms); });
};

function StandardErrorHandler(options?: { includeArgs?: number[], apiName?: string }) {
    return function(target: any, functionName: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
    
        descriptor.value = async function (...args: any[]) {
            try {
                // console.log(`Calling ${propertyKey} with arguments:`, args);
                return await originalMethod.apply(this, args);
            } catch (error) {
                const argsMessage = options?.includeArgs ? ` with arguments ${options.includeArgs.map((argNum => args[argNum]))}` : ''
                const message = `${options?.apiName ?? functionName.capitalize()} failed${argsMessage}: `
                console.error(message, error);
                if (error instanceof CustomerFacingError) {
                    throw error
                } else if (error instanceof ApiError) {
                    throw new CustomerFacingError(`${message} ${error.message}`)
                } else {
                    throw new CustomerFacingError(`${message} ${error}`)
                }
            }
        };
    
        return descriptor;
    }
}
