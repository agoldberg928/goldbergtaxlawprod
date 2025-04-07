import { useMsal } from '@azure/msal-react';
import { LoadingButton } from '@mui/lab';
import { Autocomplete, Button, Checkbox, Paper, Stack, TextField, Typography } from '@mui/material'
import { enqueueSnackbar } from 'notistack';
import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { AZURE_FUNCTION_WRAPPER } from '../../client/AzureFunctionClientWrapper';
import { AZURE_STORAGE_WRAPPER, InputFileMetadata } from '../../client/AzureStorageClientWrapper';
import { reportError } from '../../data/errorsSlice';
import { selectFilesAreLoading, updateMetadataThunk, UploadedFile } from '../../data/uploadedFilesSlice'
import { AppDispatch } from '../../store';

interface UpdateMetadataFormProps {
    currentClient: string, 
    files: UploadedFile[]
}

export function UpdateMetadataForm({currentClient, files}: UpdateMetadataFormProps) {
    const msal = useMsal()
    const dispatch = useDispatch<AppDispatch>()

    const loading = useSelector(selectFilesAreLoading)
    const [selectedFile, setSelectedFile] = useState<string | null>(null)
    const [clearAnalyzed, setClearAnalyzed] = useState<boolean>(false)
    const [clearStatements, setClearStatements] = useState<boolean>(false)

    const selectedUploadedFile = selectedFile ? files.find((file) => file.name == selectedFile) : undefined
    const metadataForFile = getMetadataForFile(selectedUploadedFile)

    function prettyPrintObj(obj: any) {
        return JSON.stringify(obj, null, 2)
    }

    function getMetadataForFile(file: UploadedFile | undefined): InputFileMetadata | null {
        if (file == null) return null
        return {
            totalpages: `${file.totalPages}`,
            analyzed: `${file.pagesAnalyzed == file.totalPages}`,
            split: `${file.totalPages !== undefined}`,
            statements: file.statements?.join(", ")
        }
    }

    function handleCopyToClipboard(str: string) {
        if (str) {
            try {
                return navigator.clipboard.writeText(str)
                    .then(() => enqueueSnackbar("Copied to clipboard!"))
            } catch(err) {
                dispatch(reportError(err));
            }
        }
    }

    async function updateMetadata() {
        try {
            if (!selectedFile) {
                return
            }
            if (metadataForFile == null) {
                enqueueSnackbar(`${selectedFile} already has no metadata`)
                return
            }
            const newMetadata = {...metadataForFile}
            if (clearAnalyzed) newMetadata.analyzed = "false"
            if (clearStatements) delete newMetadata.statements
            
            if (JSON.stringify(metadataForFile) == JSON.stringify(newMetadata)) {
                enqueueSnackbar(`No changes to metadata`)
                return
            }
            dispatch(updateMetadataThunk({filename: selectedFile, metadata: newMetadata, msal}))
        } catch (error) {
            dispatch(reportError(error));
        }
    }

    return (
        <Paper sx={{ p: 2 }}>
            {/* Update Metadata Form */}
            <Typography variant="h6">Update Metadata</Typography>
            <Autocomplete id="update-metadata" disablePortal options={files.map((file) => file.name)}
                renderInput={(params) => <TextField {...params} label="File" />}
                onChange={(_, value) => setSelectedFile(value)}
            />
            <Stack>
                <span><Checkbox onChange={(e) => setClearAnalyzed(Boolean(e.target.value))}/> Analyzed</span>
                <span><Checkbox onChange={(e) => setClearStatements(Boolean(e.target.value))} /> Clear Statements</span>
            </Stack>
            <LoadingButton loadingPosition="end" variant="contained" loading={loading} disabled={loading || selectedFile == null} onClick={updateMetadata}> Update Metadata </LoadingButton>
            {selectedFile &&
                <>
                    <br/> 
                    <Button variant="contained" size="small" onClick={() => handleCopyToClipboard(prettyPrintObj(metadataForFile))} style={{ marginTop: "8px" }}>
                        Copy to Clipboard
                    </Button>
                    <pre>{prettyPrintObj(metadataForFile)}</pre>
                </>
            }
        </Paper>
    )
}