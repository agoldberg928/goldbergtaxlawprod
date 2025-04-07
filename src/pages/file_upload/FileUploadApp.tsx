import { useMsal } from '@azure/msal-react';
import styled from '@emotion/styled';
import { CloudUpload, SendAndArchiveOutlined } from '@mui/icons-material';
import { LoadingButton } from '@mui/lab';
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Stack } from '@mui/material';
import Grid from '@mui/material/Grid2';
import React, { ChangeEvent, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ClientDropdown } from '../components/ClientDropdown';
import { selectCurrentClient } from '../../data/clientsSlice';
import { FileUploadTable } from './FileUploadTable';
import { fetchUploadedFiles, newUploadedFile, removeFile, selectAllSelectedFiles, selectFilesAreLoading, selectFilesLastSyncedTime, UploadedFile } from '../../data/uploadedFilesSlice';
import { uploadAndAnalyzeDocuments } from '../../data/analyzeDocumentFunctions';
import { AnalyzeDocumentProgressCard } from './AnalyzeDocumentProgressCard';
import { selectRunInProgress as isRunInProgress, selectLatestRun, selectPreviousRuns } from '../../data/analyzeDocumentsStatusSlice';
import { AppDispatch } from '../../store';
import "../../util/custom_typings/extensions";
import { PdfView, PdfViewContainer } from '../components/PdfViewContainer';
import { ProcessingRun } from '../../model/analyzeDocumentApiModel';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { LastSyncTimeLabel } from '../components/LastSyncTimeLabel';
import { AZURE_STORAGE_WRAPPER } from '../../client/AzureStorageClientWrapper';
import { areObjectUrlsForSameFile } from '../../util/util';

export const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

export default function FileUploadApp() {
  const msal = useMsal()

  const dispatch = useDispatch<AppDispatch>()

  const currentClient: string = useSelector(selectCurrentClient)
  const selectedFiles = useSelector(selectAllSelectedFiles)
  const latestProcessingRun = useSelector(selectLatestRun)
  const previousProcessingRuns = useSelector(selectPreviousRuns)
  const isInProgress = useSelector(isRunInProgress)

  const [viewing, setViewing] = useState<PdfView | undefined>(undefined)
  

  const fileLoader = async (forceRefresh: boolean) => {
    dispatch(fetchUploadedFiles({forceRefresh: forceRefresh, msal}))
  }

  useEffect(() => {
    fileLoader(false)
  }, [currentClient])
  
  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.value == null) return
    e.target.files?.forEach((file, _) => {
      dispatch(newUploadedFile({ filename: file.name, fileObjectUrl: URL.createObjectURL(file) }))
    });
    e.target.value = ""
  };

  // TODO: should we allow deletion from the server?
  function handleRemoveClick(file: UploadedFile) {
    if (viewing?.fileObjectUrl === file.fileObjectUrl) {
      setViewing(undefined)
    }
    dispatch(removeFile(file.id))
  }

  async function handleViewClick(file: UploadedFile, page: number) {
    const fileObjectUrl = file.fileObjectUrl || await AZURE_STORAGE_WRAPPER.getInputBlobUrl(currentClient, file.name, msal)
    // if (!file.fileObjectUrl) {
    //   dispatch(downloadFileThunk({filename: file.name, msal: msal}))
    // }
    if (areObjectUrlsForSameFile(fileObjectUrl, viewing?.fileObjectUrl) && viewing?.page === page){
      setViewing(undefined)
    } else {
      setViewing({fileObjectUrl: fileObjectUrl, page: page})
    }
  }

  const uploadedFileslastSyncedTime = useSelector(selectFilesLastSyncedTime)

  
  return (
    <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
      <ErrorDisplay />
      {/* <Backdrop sx={(theme) => ({ color: '#fff', zIndex: theme.zIndex.drawer + 1 })} open={useSelector(selectRunInProgress)}>
        <CircularProgress color="inherit" />
      </Backdrop> */}
      <Box>
        {/* CLIENTS */}
        <ClientDropdown />
      </Box>

      <Box>
        {/* FILE STATUS TABLE */}
        <h3 style={{marginTop: 3}}>
          Files <LastSyncTimeLabel lastSyncTime={uploadedFileslastSyncedTime} handleClick={() => { fileLoader(true) }} loading={useSelector(selectFilesAreLoading)}/>
        </h3>
        
        {/* Progress Bars */}
        <Grid container spacing={2} columns={12} sx={{ mb: (theme) => theme.spacing(2) }}>
          {/* Current Run */}
          <Grid size={{ xs: 12, sm: 6 }}>
              { latestProcessingRun && 
                <AnalyzeDocumentProgressCard {...latestProcessingRun} />
              }
          </Grid>
          
          {/* Previous Runs */}
          <Grid size={{ xs: 12, sm: 6}}>
            { previousProcessingRuns.length > 0 && 
                previousProcessingRuns.map((status: ProcessingRun, idx: Number) => {
                  return (
                    <Accordion key={idx.toString()}>
                      <AccordionSummary>Run {status.progress?.requestId}</AccordionSummary>
                      <AccordionDetails>
                        <AnalyzeDocumentProgressCard {...status} />
                      </AccordionDetails>
                    </Accordion>
                  )
                })
            }
          </Grid>
        </Grid>

        {/* Select File & Upload Buttons */}
        <Stack direction="row" sx={{ gap: 1, marginTop: 3, marginBottom: 3 }}>
          <Button
            color='inherit' component="label" role={undefined} variant="contained" tabIndex={-1}
            disabled={isInProgress}
            startIcon={<CloudUpload />}
          >
            Select files
            <VisuallyHiddenInput type="file" onChange={handleFileChange} multiple accept="application/pdf" />
          </Button>

          <LoadingButton
            size="large" color='primary' loadingPosition="end" variant="contained" endIcon={<SendAndArchiveOutlined />}
            onClick={() => uploadAndAnalyzeDocuments(msal)}
            disabled={isInProgress || selectedFiles.length == 0}
            loading={isInProgress}
          >
            Analyze
          </LoadingButton>
        </Stack>

        <FileUploadTable handleViewClick={handleViewClick} handleRemoveClick={handleRemoveClick} />

        {/* PDF Display iFrame */}
        <div className='pdf-display-container'>
          { viewing && <PdfViewContainer {...viewing}/> }
        </div>
      </Box>
    </Box>
  );
};