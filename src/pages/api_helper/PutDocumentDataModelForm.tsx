import { useMsal } from '@azure/msal-react';
import { useTheme } from '@emotion/react';
import { ClearRounded } from '@mui/icons-material';
import { LoadingButton } from '@mui/lab';
import { Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Grid2, Paper, Stack, TextareaAutosize, TextField, ToggleButton, ToggleButtonGroup, Typography, useMediaQuery } from '@mui/material'
import { enqueueSnackbar } from 'notistack';
import React, { useState } from 'react'
import { useDispatch } from 'react-redux';
import { AZURE_FUNCTION_WRAPPER } from '../../client/AzureFunctionClientWrapper';
import { reportError } from '../../data/errorsSlice';
import { UploadedFile } from '../../data/uploadedFilesSlice'
import { PdfDocumentPageMetadata } from '../../model/statementModel';
import { AppDispatch } from '../../store';
import JsonDiffViewer from './JsonDiffViewer';

interface PutDocumentDataModelFormProps {
    currentClient: string, 
    files: UploadedFile[],
    filename?: undefined
}

interface PutDocumentDataModelFormPropsInd {
    currentClient: string, 
    filename: string
    files?: undefined
}

enum StatementType {
    STATEMENT = "statementDataModel",
    CHECK = "checkDataModel",
    EXTRA_PAGES = "extraPageDataModel",
}

export function PutDocumentDataModelForm({currentClient, files, filename}: PutDocumentDataModelFormProps | PutDocumentDataModelFormPropsInd) {
    const msal = useMsal()
    const dispatch = useDispatch<AppDispatch>()

    const [loading, setLoading] = useState(false);
    const [preValidated, setPreValidated] = useState(false);
    const [currentDataModel, setCurrentDataModel] = useState<string | null>(null)

    const [selectedFile, setSelectedFile] = useState<string | undefined>(filename)
    const [selectedPage, setSelectedPage] = useState<number | undefined>(undefined)
    const [data, setData] = useState<string>("")
    const [statementType, setStatementType] = useState<StatementType>(StatementType.STATEMENT)

    const allFilenames = files?.map((file) => file.name)
    const maxPages = files?.find((file) => file.name == selectedFile)?.totalPages

    const canSubmit = !loading && selectedFile && selectedPage

    function prettyPrintObj(obj: any): string {
        
        return JSON.stringify(obj instanceof String ? checkValidJson(obj as string) : obj, null, 2)
    }

    function checkValidJson(str: string): any | null {
        try {
            return JSON.parse(str)
        } catch (error) {
            dispatch(reportError(error));
            return null
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

    async function loadCurrentModel() {
        await getDocumentDataModel(true)
    }

    async function getDocumentDataModel(overrideData: boolean = false) {
        if (loading) return
        if (selectedFile == null || selectedPage == null) {
            enqueueSnackbar("Please select a file and page to get the data model", {variant:'error'})
            return
        }
        try {
            setLoading(true)
            const response = await AZURE_FUNCTION_WRAPPER.getDocumentDataModel(currentClient, selectedFile, selectedPage, msal);
            const value = response?.model?.statementDataModel || response?.model?.checkDataModel || response?.model?.extraPageDataModel
            setCurrentDataModel(prettyPrintObj(value));
            if (overrideData) setData(prettyPrintObj(value))
            return response
        } catch (error) {
            dispatch(reportError(error));
        } finally {
            setLoading(false)
        }
    };

    async function putDocumentDataModelPreValidate() {
        if (loading) return

        try {
            const json = checkValidJson(data)
            if (!json) {
                enqueueSnackbar("JSON is invalid", {variant:'error'})
                return
            }
            const pageMetadata = json?.pageMetadata as PdfDocumentPageMetadata
            if (!pageMetadata || pageMetadata.filename != selectedFile || pageMetadata.page != selectedPage) {
                enqueueSnackbar("filename and page must equal what's in the pageMetadata", {variant:'error'})
                return
            }

            await getDocumentDataModel()

            setPreValidated(true)
        } catch (error) {
            dispatch(reportError(error));
        }
    };

    async function putDocumentDataModel() {
        if (!preValidated) return
        try {
            setLoading(true)
            await AZURE_FUNCTION_WRAPPER.putDocumentDataModel(currentClient, selectedFile!, selectedPage!, statementType, checkValidJson(data), msal);
            setData("")
            enqueueSnackbar("Put new model successfully", {variant: "success"})
        } catch (error) {
            enqueueSnackbar("Unable to put new model", {variant: "error"})
            dispatch(reportError(error));
        } finally {
            setPreValidated(false)
            setLoading(false)
        }
    }
    
    return (
        <Paper sx={{ p: 2 }}>
            <Typography variant="h6">PutDocumentDataModel</Typography>
            {/* File */}
            <Autocomplete disablePortal options={allFilenames ?? [filename]} value={selectedFile}
                disabled={filename !== undefined}
                renderInput={(params) => <TextField {...params} label="File" />}
                onChange={(_, value) => setSelectedFile(value ?? undefined)}
                onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => e.key === 'Enter' ? putDocumentDataModelPreValidate() : ''}
            />
            {/* Page */}
            <TextField label="Page" type="number" fullWidth value={selectedPage} 
                onChange={(e) => setSelectedPage(Number(e.target.value))} 
                slotProps={{ input: { inputProps: { min: 1, max: maxPages }}}} 
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' ? putDocumentDataModelPreValidate() : ''}
            />
            {/* Statement Type */}
            <ToggleButtonGroup value={statementType} exclusive onChange={(e, value) => setStatementType(value)} sx={{ mb: 2 }} >
                <ToggleButton value="statementDataModel">Statement</ToggleButton>
                <ToggleButton value="checkDataModel">Check</ToggleButton>
                <ToggleButton value="extraPageDataModel">Extra Pages</ToggleButton>
            </ToggleButtonGroup>
            {/* Data */}
            <TextareaAutosize minRows={3} wrap="off" style={{width: "100%"}} onChange={(e) => setData(e.target.value)} value={data} />
            
            <LoadingButton variant="contained" onClick={putDocumentDataModelPreValidate} loading={loading} disabled={!canSubmit}>
                Submit Model
            </LoadingButton>

            <LoadingButton onClick={(loadCurrentModel)} loading={loading} disabled={!canSubmit}>
                Load Current Model
            </LoadingButton>

            {/* Diff Modal */}
            <Dialog fullScreen={true} open={preValidated} onClose={() => setPreValidated(false)} aria-labelledby="submit-data-model">
                <DialogTitle id="submit-data-model"> Validate Diff </DialogTitle>
                <DialogContent>
                    {preValidated && currentDataModel && data && 
                        <JsonDiffViewer originalData={currentDataModel} newData={prettyPrintObj(checkValidJson(data))} />
                    }
                </DialogContent>
                <DialogActions>
                    <Button autoFocus onClick={() => setPreValidated(false)}> Cancel </Button>
                    <Button onClick={putDocumentDataModel} autoFocus> Submit </Button>
                </DialogActions>
            </Dialog>
        </Paper>
    )
}