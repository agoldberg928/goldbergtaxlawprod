
import { Box } from "@mui/system";
import React from 'react';
import { LinearProgressWithLabel, VisuallyHiddenInput } from './CustomMuiComponents';
import { ProcessingStatus } from "../model/interfaces";

export function AnalyzeDocumentProgressBar({stage, statusMessage, progress}: ProcessingStatus) {
    const lastStatus = progress?.status
    let percentComplete = 0
    if (lastStatus && lastStatus.totalPages) {
        percentComplete = lastStatus.pagesCompleted / lastStatus.totalPages * 100
    }

    return (
        <Box>
            <LinearProgressWithLabel 
                value={percentComplete} 
                description={stage ?? lastStatus?.stage}
                />
            <AnalyzeDocumentProgressInfo stage={stage} progress={progress} />
        </Box>
    )
}

export function AnalyzeDocumentProgressInfo({stage, statusMessage, progress}: ProcessingStatus) {
    return (
        <div>
            <p> RequestId: {progress?.requestId} </p>
            <p> Started: {progress?.createdTime.toString()} </p>
            <p> Last Update: {progress?.lastUpdatedTime.toString()} </p>
            { statusMessage &&
                <p> Status: {statusMessage} </p>
            }
            { stage &&
                <p> Stage: {stage} </p>
            }
        </div>
    )
}