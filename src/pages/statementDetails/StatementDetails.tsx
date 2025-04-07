import { Box, Button, Chip, Grid2, Skeleton, Typography } from "@mui/material";
import React, { useEffect } from "react";
import { PdfViewContainer } from "../components/PdfViewContainer";
import { LastSyncTimeLabel } from "../components/LastSyncTimeLabel";
import { useMsal } from "@azure/msal-react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../../store";
import { selectDetails, selectTransactionsLastSyncedTime, selectFirstPageOfFile, selectSuspiciousReasons } from "../../data/transactionsSlice";
import { downloadStatementDetailsThunk } from "../../data/transactionsSlice";
import { ErrorDisplay } from "../components/ErrorDisplay";
import { DetailsGrid } from "./DetailsGrid";
import { SnackbarProvider } from "notistack";
import { UndoRedoListener } from "./UndoRedoListener";
import { AZURE_STORAGE_WRAPPER } from "../../client/AzureStorageClientWrapper";
import { selectCurrentClient } from "../../data/clientsSlice";
import { replaceLineBreaksWithReactNode, reportError } from "../../data/errorsSlice";
import { AnalyzePageForm } from "../api_helper/AnalyzePageForm";
import { ApiError } from "../../model/error/CustomFacingError";

interface StatementDetailsProps {
    stmtId: string
}

export function StatementDetails({stmtId}: StatementDetailsProps) {
    const msal = useMsal();
    const dispatch = useDispatch<AppDispatch>()
    
    const currentClient = useSelector(selectCurrentClient)
    const stmt = useSelector((state: RootState) => selectDetails(state))
    const [fileObjectUrl, setFileObjectUrl] = React.useState<string | undefined>(undefined);
    const firstPageOfFile = useSelector(selectFirstPageOfFile)

    useEffect(() => {
        async function loadDetails() {
            await dispatch(downloadStatementDetailsThunk({filename: stmtId, forceRefresh: false, msal})).unwrap()
        }
        loadDetails()
    }, [])

    useEffect(() => {
        async function loadFileUrl() {
            try {
                const fileObjectUrl = await AZURE_STORAGE_WRAPPER.getInputBlobUrl(currentClient, stmt.filename, msal)
                setFileObjectUrl(fileObjectUrl)
            } catch (err: any) {
                dispatch(reportError(new ApiError(`Unable to load file '${stmt.filename}': ${err}`)))
            }
        }
        if (stmt?.filename) {
            loadFileUrl()
        }
    }, [stmt])
    
    const detailsLastSyncTime = useSelector(selectTransactionsLastSyncedTime)
    const suspiciousReasons = useSelector(selectSuspiciousReasons)

    return !stmt.filename ? (<><ErrorDisplay/><Skeleton/></>) : (
        <Box sx={{width: "100%"}}>
            <UndoRedoListener />
            <SnackbarProvider>
                <ErrorDisplay/>
                <LastSyncTimeLabel lastSyncTime={detailsLastSyncTime} handleClick={() => dispatch(downloadStatementDetailsThunk({filename: stmtId, msal, forceRefresh: true}))} />
                <Grid2 container columns={12} spacing={2} sx={{margin: 1, width: "100%", maxWidth: 1400}}>
                    <Grid2 size={{xs: 12, md: 6}}>
                        <h4>Filename: {stmt.filename}</h4>
                        <h4>Suspicious Reasons: </h4>
                        {replaceLineBreaksWithReactNode(suspiciousReasons.join("\n"))}
                    </Grid2>
                    <Grid2 size={{xs: 12, md: 6}}>
                        <AnalyzePageForm currentClient={currentClient} filename={stmt.filename}/>
                    </Grid2>
                    <Grid2 container columns={12} spacing={2} sx={{margin: 1, width: "100%"}}>
                        <DetailsGrid />
                    </Grid2>
                    <Box width="100%" maxWidth={1400} className='pdf-display-container'>
                        {fileObjectUrl && <PdfViewContainer fileObjectUrl={fileObjectUrl} page={firstPageOfFile}/>}
                    </Box>
                </Grid2>
            </SnackbarProvider>
        </Box>
    )
}

/**
     * 
     * {
    "id": 0,
    "field": "amount",
    "row": {
        "id": 0,
        "date": "12/10/2021",
        "description": "Transfer PAYPAL",
        "amount": -16184.61,
        "batesStamp": "MH003130",
        "source": "12_22_21 2.pdf[3]"
    },
    "rowNode": {
        "id": 0,
        "depth": 0,
        "parent": "auto-generated-group-node-root",
        "type": "leaf",
        "groupingKey": null
    },
    "colDef": {
        "width": 100,
        "minWidth": 125,
        "maxWidth": null,
        "hideable": true,
        "sortable": true,
        "resizable": true,
        "filterable": true,
        "groupable": true,
        "pinnable": true,
        "aggregable": true,
        "editable": true,
        "type": "string",
        "align": "left",
        "filterOperators": [
            {
                "value": "contains"
            },
            {
                "value": "doesNotContain"
            },
            {
                "value": "equals"
            },
            {
                "value": "doesNotEqual"
            },
            {
                "value": "startsWith"
            },
            {
                "value": "endsWith"
            },
            {
                "value": "isEmpty",
                "requiresFilterValue": false
            },
            {
                "value": "isNotEmpty",
                "requiresFilterValue": false
            },
            {
                "value": "isAnyOf"
            }
        ],
        "field": "amount",
        "headerName": "Amount",
        "hasBeenResized": true,
        "computedWidth": 125
    },
    "cellMode": "edit",
    "hasFocus": false,
    "tabIndex": 0,
    "value": -16184.61,
    "formattedValue": "-$16,184.61",
    "isEditable": true,
    "api": {},
    "reason": "cellFocusOut"
}
     */