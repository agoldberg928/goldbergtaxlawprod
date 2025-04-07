import { useMsal } from '@azure/msal-react';
import { ClearRounded, SendAndArchiveOutlined } from '@mui/icons-material';
import { LoadingButton } from '@mui/lab';
import { Autocomplete, Button, Paper, Stack, TextField, Typography } from '@mui/material'
import { enqueueSnackbar } from 'notistack';
import React, { useState } from 'react'
import { useDispatch } from 'react-redux';
import { AZURE_FUNCTION_WRAPPER } from '../../client/AzureFunctionClientWrapper';
import { reportError } from '../../data/errorsSlice';
import { UploadedFile } from '../../data/uploadedFilesSlice'
import { ClassificationOverride } from '../../model/analyzeDocumentApiModel';
import { AppDispatch } from '../../store';

interface AnalyzePageFormProps {
    currentClient: string, 
    files: UploadedFile[],
    filename?: undefined
}
interface AnalyzePageFormPropsInd {
    currentClient: string, 
    filename: string
    files?: undefined
}

export function AnalyzePageForm({currentClient, files, filename}: AnalyzePageFormProps | AnalyzePageFormPropsInd) {
    const msal = useMsal()
    const dispatch = useDispatch<AppDispatch>()

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null)
    const [selectedFile, setSelectedFile] = useState<string | undefined>(filename)
    const [selectedPage, setSelectedPage] = useState<number | null>(null)
    const [classificationOverride, setClassificationOverride] = useState<ClassificationOverride | null>(null)

    const allFilenames = files?.map((file) => file.name)
    const maxPages = files?.find((file) => file.name == selectedFile)?.totalPages

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

    async function analyzePage() {
        if (selectedFile == null || selectedPage == null) {
            enqueueSnackbar("Please select a file and page to get the data model")
            return
        }
        try {
            setLoading(true);
            const response = await AZURE_FUNCTION_WRAPPER.analyzePage(currentClient, selectedFile, [selectedPage], classificationOverride, msal);
            setResult(response);
        } catch (error) {
            dispatch(reportError(error));
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <Paper sx={{ p: 2 }}>
            <Typography variant="h6">AnalyzePage</Typography>
            {/* Filename */}
            <Autocomplete disablePortal options={allFilenames ?? [filename]} value={selectedFile}
                renderInput={(params) => <TextField {...params} label="File" />}
                onChange={(_, value) => setSelectedFile(value ?? undefined)}
            />
            {/* Page */}
            <TextField label="Page" type="number" fullWidth value={selectedPage} onChange={(e) => setSelectedPage(Number(e.target.value))} slotProps={{
                input: { inputProps: { min: 1, max: maxPages }}
            }} />
            {/* Classification */}
            <Autocomplete disablePortal options={Object.values(ClassificationOverride).filter((item) => isNaN(Number(item)))}
                renderInput={(params) => <TextField {...params} label="ClassificationOverride" />}
                onChange={(_, value) => setClassificationOverride(value as ClassificationOverride)}
            />
            <LoadingButton
                loadingPosition="end" variant="contained" endIcon={<SendAndArchiveOutlined />}
                onClick={analyzePage} loading={loading}
                disabled={loading || selectedFile == null || selectedPage == null}
            >
            Analyze Page
            </LoadingButton>
            {result &&
            <>
                <Stack direction="row" spacing={2}>
                    <Button size="small" onClick={() => handleCopyToClipboard(prettyPrintObj(result))}>
                        Copy to Clipboard
                    </Button>

                    <Button size="small" onClick={() => handleCopyToClipboard(prettyPrintObj(result.model?.statementDataModel || result.model?.checkDataModel || result.model?.extraPageDataModel))}>
                        Copy model only to Clipboard
                    </Button>
                    <Button endIcon={<ClearRounded/>} onClick={() => setResult(null)} sx={{ ml: "auto" }}>Clear</Button>
                </Stack>
                <pre>{prettyPrintObj(result)}</pre>
            </>
            }
        </Paper>
    )
}