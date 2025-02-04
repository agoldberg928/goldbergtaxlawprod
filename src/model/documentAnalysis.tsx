import { AnalyzeDocumentCustomStatus, AnalyzeDocumentProgress, AnalyzeDocumentResult } from "../client/AzureFunctionClientWrapper";

export interface ProcessingRun {
  stage: AnalyzeStage,
  inputFiles: string[]
  statusMessage?: string
  progress?: AnalyzeDocumentProgress | undefined,
  result?: AnalyzeDocumentResult
  spreadsheetId?: string
}

export enum UploadStatus {
  PENDING = "Pending",
  UPLOADING = "Uploading",
  FAILED = "Failed",
  SUCCESS = "Success"
}

export enum AnalyzeStage {
  UPLOADING = "Uploading Files",
  VERIFYING_DOCUMENTS = "Verifying Documents",
  EXTRACTING_DATA = "Extracting Data",
  CREATING_CSV = "Creating CSV",
  COMPLETE = "Complete"
}
