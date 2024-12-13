// import { Backdrop, Dialog, Modal, Step, StepLabel, Stepper, Typography } from "@mui/material";
// import { Box } from "@mui/system";
// import { DataGrid, GridColDef } from "@mui/x-data-grid";
// import React from "react";
// import { AnalyzeDocumentCustomStatus, AnalyzeDocumentProgress } from "../client/AzureFunctionClientWrapper";
// import { AnalyzeStage } from "../model/enums";
// import { LinearProgressWithLabel } from "./CustomMuiComponents";
// import '../util/ext/extensions'
// import { ProcessingStatus } from "../model/interfaces";

// export interface ProgressModalProps {
//     open: boolean
//     status: ProcessingStatus
//     files: Map<string, File>
// }

// export function AnalyzeDocumentsProgressModel({open, status, files}: ProgressModalProps) {
//     const lastStatus = status.progress?.status
//     let percentComplete = 0
//     if (lastStatus && lastStatus.totalPages) {
//         percentComplete = lastStatus.pagesCompleted / lastStatus.totalPages * 100
//     }
//     const percentage = status ? status?.progress?.status?.pagesCompleted / status.progress.status?.totalPages : undefined
//     const steps = Object.values(AnalyzeStage).map((stage) => {
//         let progressBar
//         if (stage == AnalyzeStage.EXTRACTING_DATA && percentage) {
//             progressBar = <LinearProgressWithLabel value={percentage} description={props.stage}/>
//         }
//         return (
//             <Step key={stage}><StepLabel>{stage}</StepLabel>
//                 {progressBar}
//             </Step>
//         )
//     })

    

//     const rows = props.files.map((filename: string, file: File) => {
//         return {
//             id: filename,
//             file: filename,
//             uploadStatus: file.uploadStatus,
//             processStatus: `${file.runStatus ?? ""} ${file.totalPages ? file.pagesAnalyzed + "/" + file.totalPages : ""}`,
//           }
//     })

//     const columns: GridColDef[] = [
//         { field: 'file', headerName: 'Filename', width: 400},
//         { field: 'uploadStatus', headerName: 'Upload Status', width: 160 },
//         { field: 'processStatus', headerName: 'Process Status', width: 200 },
//       ];

//     return (
//         <>
//             <Dialog
//                 open={props.open}
//                 aria-labelledby="modal-modal-title"
//                 aria-describedby="modal-modal-description"
//                 fullWidth={true}
//             >
//                 <>
//                     <Box>
//                         <Stepper activeStep={Object.values(AnalyzeStage).indexOf(props.status.stage)} alternativeLabel>
//                             {steps}
//                         </Stepper>
//                     </Box>
//                     <DataGrid rows={rows} columns={columns} />
//                 </>
//             </Dialog>
//         </> 
//     )
// }