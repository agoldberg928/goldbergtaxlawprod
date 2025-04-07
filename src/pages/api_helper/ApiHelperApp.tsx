import React, { useEffect, useState } from "react";
import { Autocomplete, Box, Button, Checkbox, Grid2, MenuItem, Paper, Select, Stack, TextareaAutosize, TextField, Typography } from "@mui/material";
import { ClientDropdown } from "../components/ClientDropdown";
import { ErrorDisplay } from "../components/ErrorDisplay";
import { useDispatch, useSelector } from "react-redux";
import { selectCurrentClient } from "../../data/clientsSlice";
import { AZURE_FUNCTION_WRAPPER } from "../../client/AzureFunctionClientWrapper";
import { useMsal } from "@azure/msal-react";
import { AppDispatch } from "../../store";
import { reportError } from "../../data/errorsSlice";
import { fetchUploadedFiles, selectAllFiles, selectFilesAreLoading, selectFilesLastSyncedTime } from "../../data/uploadedFilesSlice";
import { enqueueSnackbar, SnackbarProvider } from "notistack";
import { LastSyncTimeLabel } from "../components/LastSyncTimeLabel";
import { AZURE_STORAGE_WRAPPER, InputFileMetadata } from "../../client/AzureStorageClientWrapper";
import { GetDocumentDataModelForm } from "./GetDocumentDataModelForm";
import { UpdateMetadataForm } from "./UpdateMetadataForm";
import { AnalyzePageForm } from "./AnalyzePageForm";
import { PdfDocumentPageMetadata, TransactionHistoryPageMetadata } from "../../model/statementModel";
import { PutDocumentDataModelForm } from "./PutDocumentDataModelForm";

interface Results {
    getDocumentDataModel: string | null;
    putDocumentDataModel: any;
    analyzePage: string | null;
    metadata: {
        filename: string,
        data: InputFileMetadata | null
    } | null
}

export default function ApiHelperApp() {
    const msal = useMsal();
    const currentClient = useSelector(selectCurrentClient);
    const dispatch = useDispatch<AppDispatch>();
    const files = useSelector(selectAllFiles)
    const uploadedFileslastSyncedTime = useSelector(selectFilesLastSyncedTime)

    const fileLoader = async (forceRefresh: boolean) => {
        dispatch(fetchUploadedFiles({forceRefresh: forceRefresh, msal}));
    }
    
    useEffect(() => {
        fileLoader(false);
    }, [currentClient]);

    return (
        <SnackbarProvider>
            <Box width="100%">
                <ErrorDisplay />
                
                <Box>
                    {/* CLIENTS */}
                    <ClientDropdown />
                </Box>
            </Box>
            <h3 style={{marginTop: 3}}>
                Files <LastSyncTimeLabel lastSyncTime={uploadedFileslastSyncedTime} handleClick={() => { fileLoader(true) }} loading={useSelector(selectFilesAreLoading)}/>
            </h3>
            <Grid2 container spacing={2} columns={12} width="100%" sx={{ mb: (theme) => theme.spacing(2) }}>
                <Grid2 size={{xs: 12, md: 8}}>
                    <GetDocumentDataModelForm files={files} currentClient={currentClient}/>
                </Grid2>
                <Grid2 size={{xs: 12, md: 4}}>
                    <UpdateMetadataForm files={files} currentClient={currentClient} />
                </Grid2>
                <Grid2 size={{xs: 12, md: 6}}>
                    <PutDocumentDataModelForm currentClient={currentClient} files={files} />
                </Grid2>
                <Grid2 size={{xs: 12, md: 6}}>
                    <AnalyzePageForm currentClient={currentClient} files={files} />
                </Grid2>
            </Grid2>
        </SnackbarProvider>
  );
}