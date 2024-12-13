import { AnalyzeDocumentCustomStatus, AnalyzeDocumentProgress } from "../client/AzureFunctionClientWrapper";
import { AnalyzeStage } from "./enums";

export interface ProcessingStatus {
  stage: AnalyzeStage,
  statusMessage?: string
  progress?: AnalyzeDocumentProgress | undefined
}