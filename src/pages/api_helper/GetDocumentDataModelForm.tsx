import { useMsal } from '@azure/msal-react';
import { ClearRounded } from '@mui/icons-material';
import { LoadingButton } from '@mui/lab';
import { Autocomplete, Button, Paper, Stack, TextField, Typography } from '@mui/material'
import { enqueueSnackbar } from 'notistack';
import React, { useState } from 'react'
import { useDispatch } from 'react-redux';
import { AZURE_FUNCTION_WRAPPER } from '../../client/AzureFunctionClientWrapper';
import { reportError } from '../../data/errorsSlice';
import { UploadedFile } from '../../data/uploadedFilesSlice'
import { AppDispatch } from '../../store';

interface GetDocumentDataModelFormProps {
    currentClient: string, 
    files: UploadedFile[]
}

export function GetDocumentDataModelForm({currentClient, files}: GetDocumentDataModelFormProps) {
    const msal = useMsal()
    const dispatch = useDispatch<AppDispatch>()

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null)
    const [selectedFile, setSelectedFile] = useState<string | null>(null)
    const [selectedPage, setSelectedPage] = useState<number | null>(null)

    const allFilenames = files.map((file) => file.name)
    const maxPages = files.find((file) => file.name == selectedFile)?.totalPages

    const canSubmit = !loading && selectedFile && selectedPage

    function prettyPrintObj(obj: any) {
        return JSON.stringify(obj, null, 2)
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

    async function getDocumentDataModel() {
        if (loading) return
        if (selectedFile == null || selectedPage == null) {
            enqueueSnackbar("Please select a file and page to get the data model", {variant:'error'})
            return
        }
        try {
            setLoading(true)
            const response = await AZURE_FUNCTION_WRAPPER.getDocumentDataModel(currentClient, selectedFile, selectedPage, msal);
            setResult(response);
        } catch (error) {
            dispatch(reportError(error));
        } finally {
            setLoading(false)
        }
    };
    
    return (
        <Paper sx={{ p: 2 }}>
            <Typography variant="h6">GetDocumentDataModel</Typography>
            <Autocomplete disablePortal options={allFilenames}
                renderInput={(params) => <TextField {...params} label="File" />}
                onChange={(_, value) => setSelectedFile(value)}
                onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => e.key === 'Enter' ? getDocumentDataModel() : ''}
            />
            <TextField label="Page" type="number" fullWidth value={selectedPage} 
                onChange={(e) => setSelectedPage(Number(e.target.value))} 
                slotProps={{ input: { inputProps: { min: 1, max: maxPages }}}} 
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' ? getDocumentDataModel() : ''}
            />
            <LoadingButton variant="contained" onClick={getDocumentDataModel} loading={loading} disabled={!canSubmit}>
                Fetch Data
            </LoadingButton>
            {result &&
            <>
                <Stack direction="row" spacing={2} sx={{mt: 3}}>
                    <Button size="small" onClick={() => handleCopyToClipboard(prettyPrintObj(result))}>
                        Copy to Clipboard
                    </Button>

                    <Button size="small" onClick={() => handleCopyToClipboard(prettyPrintObj(result.model?.statementDataModel || result.model?.checkDataModel || result.model?.extraPageDataModel))}>
                        Copy model only to Clipboard
                    </Button>
                    <Button size='small' endIcon={<ClearRounded/>} onClick={() => setResult(null)} sx={{ ml: "auto" }}>Clear </Button>
                </Stack>
                <pre>{prettyPrintObj(result)}</pre>
            </>
            }
        </Paper>
    )
}