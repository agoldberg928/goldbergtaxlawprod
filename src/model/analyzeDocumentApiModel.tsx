import { ReactNodeError } from "./error/ReactNodeError"

/**
 * Defines the types for the Analyze Document API
 */
export type GetAnalyzeDocumentStatusOutput = {
    name: string
    instanceId: string
    runtimeStatus: RuntimeStatus
    customStatus: AnalyzeDocumentCustomStatus
    // input: {}  ignore for now
    output: AnalyzeDocumentOutput
    createdTime: string
    lastUpdatedTime: string
}

export type AnalyzeDocumentCustomStatus = {
    stage: string
    documents: Array<DocumentStatus>
    totalPages: number
    pagesCompleted: number
}

export type DocumentStatus = {
    fileName: string
    totalPages: number
    pagesCompleted: number
}

// this is a subset of GetAnalyzeDocumentStatusOutput
export type AnalyzeDocumentProgress = {
    requestId: string
    status: AnalyzeDocumentCustomStatus
    createdTime: string // might have to store as string
    lastUpdatedTime: string
}

export type AnalyzeDocumentOutput = {
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

export enum RuntimeStatus {
    PENDING = "Pending",
    RUNNING = "Running",
    COMPLETED = "Completed",
    FAILED = "Failed"
}

// Output of writeCsv function
export interface WriteCsvSummaryOutput {
    status: FinalStatus,
    errorMessage: string,
    checkSummaryFile: string,
    accountSummaryFile: string,
    statementSummaryFile: string,
    recordsFile: string,
}

// tracking interface of the status of an analyze document run for the frontend application
export interface ProcessingRun {
    id: string
    stage: AnalyzeStage,
    inputFiles: string[]
    client: string
    error?: string
    progress?: AnalyzeDocumentProgress | undefined,
    result?: AnalyzeDocumentResult
    spreadsheetId?: string
}

export enum AnalyzeStage {
    UPLOADING = "Uploading Files",
    VERIFYING_DOCUMENTS = "Verifying Documents",
    EXTRACTING_DATA = "Extracting Data",
    CREATING_CSV = "Creating CSV",
    COMPLETE = "Complete"
}

export enum UploadStatus {
    PENDING = "Pending",
    UPLOADING = "Uploading",
    FAILED = "Failed",
    SUCCESS = "Success"
}

export enum ClassificationOverride {
    AMEX_CC = "AMEX CC",
    C1_CC = "C1 CC",
    CITI_CC = "CITI CC",
    WF_CC = "WF CC",
    B_OF_A_CC = "BofA CC",
    EAGLE_BANK = "Eagle Bank",
    WF_BANK = "WF Bank",
    B_OF_A = "BofA",
    NFCU_BANK = "NFCU Bank",
    EAGLE_BANK_CHECK = "Eagle Bank Check",
    B_OF_A_CHECK = "BofA Check",
    MISC_CHECK = "Misc Check",
    NFCU_CHECK = "NFCU Check",
    EXTRA_PAGES = "Extra Pages",
}