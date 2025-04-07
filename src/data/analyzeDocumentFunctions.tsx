import { IMsalContext } from "@azure/msal-react";
import { AZURE_FUNCTION_WRAPPER } from "../client/AzureFunctionClientWrapper";
import { AZURE_STORAGE_WRAPPER } from "../client/AzureStorageClientWrapper";
import { GOOGLE_API_WRAPPER } from "../client/GoogleApiClient";
import { LOCAL_STORAGE_CLIENT } from "../client/LocalStorageClient";
import { AnalyzeStage } from "../model/analyzeDocumentApiModel";
import store from "../store";
import { selectCurrentClient } from "./clientsSlice";
import { downloadMetadataThunk, selectAllFiles, selectAllSelectedFiles, selectFileFailures, selectSelectedNotUploadedFiles, uploadFileThunk } from "./uploadedFilesSlice";
import { completeRunFailed, completeRunSuccess, pollAnalyzeDocumentsStatusThunk, selectLatestRun, startRun, submitAnalyzeDocumentsThunk, updateRunStatus } from "./analyzeDocumentsStatusSlice";
import { FileUploadFailure } from "../model/error/ReactNodeError";

export async function uploadAndAnalyzeDocuments(msal: IMsalContext) {
    const currentClient = selectCurrentClient(store.getState())
    try {
        const selectedFiles = selectAllSelectedFiles(store.getState())
        
        store.dispatch(startRun({currentClient: currentClient, files: selectedFiles.map(file => file.id)}))
        
        // Step 1: Upload files
        await uploadFiles(msal)
    
        // step 2: begin analyze documents function
        store.dispatch(updateRunStatus({stage: AnalyzeStage.VERIFYING_DOCUMENTS}))
        const requestUrl = await store.dispatch(submitAnalyzeDocumentsThunk({ msal })).unwrap()
    
        // step 3: poll for status
        const statements = await store.dispatch(pollAnalyzeDocumentsStatusThunk({ requestUrl, msal })).unwrap()
    
        // step 4: create the CSV
        const spreadsheetName = `${currentClient.capitalize()} Transactions ${selectLatestRun(store.getState())?.progress?.requestId}`
        const spreadsheetId = await prepareCsv(currentClient, Object.values(statements).flatMap((val) => val), spreadsheetName, msal)
        
        store.dispatch(completeRunSuccess({ spreadsheetId }))
    } catch (error: any) {
        // TODO: the error does not serialize
        store.dispatch(completeRunFailed(error.message))
    } finally {
        LOCAL_STORAGE_CLIENT.storeUploadedFiles(currentClient, selectAllFiles(store.getState()), true)
    }
}

async function uploadFiles(msal: IMsalContext) {
    const uploadFilesPromises = selectSelectedNotUploadedFiles(store.getState()).map(async (file) => {
        // step a: download metadata to check if file already exists
        try {
            const metadata = await store.dispatch(downloadMetadataThunk({ filename: file.name, msal })).unwrap()
            
            // step b: if metadata exists, the file is already uploaded
            if (!metadata) {
                return await store.dispatch(uploadFileThunk({ file, msal })).unwrap()
            }
        } catch(error: any) {
            // do nothing, the errors are handled inside the thunk/state
            console.error("Unexpected error during file upload:", error);
        }
    })
    await Promise.allSettled(uploadFilesPromises)

    const fileFailures = selectFileFailures(store.getState())
    if (Object.keys(fileFailures).length > 0) {
        throw new FileUploadFailure(fileFailures)
    }
}

export async function prepareCsv(currentClient: string, statements: string[], spreadsheetName: string, msal: IMsalContext): Promise<string> {
    const csvSummaryFiles = await AZURE_FUNCTION_WRAPPER.writeCsv(currentClient, statements, msal)
    const csvFiles = await AZURE_STORAGE_WRAPPER.loadCsvFiles(currentClient, csvSummaryFiles, msal)

    // TODO: add client name when it's available
    return await GOOGLE_API_WRAPPER.createGoogleSpreadSheet(spreadsheetName, csvFiles)
  }