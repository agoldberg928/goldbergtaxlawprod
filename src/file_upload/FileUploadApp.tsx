import React, { IframeHTMLAttributes, useState, ChangeEvent, useRef, useEffect } from 'react';
import Grid from '@mui/material/Grid2';
import { unstable_batchedUpdates } from 'react-dom'
import { AzureStorageClientWrapper } from '../client/AzureStorageClientWrapper';
import { FileStatusTable } from './FileUploadTable'
import { AnalyzeDocumentCustomStatus, AnalyzeDocumentProgress, AnalyzeDocumentResult, AzureFunctionClientWrapper, DocumentStatus, FinalStatus, WriteCsvSummaryResult } from '../client/AzureFunctionClientWrapper';
import "../util/custom_typings/extensions"
import { LoadingButton } from '@mui/lab';
import { Cached, CloudUpload, OpenInNew, Refresh, SendAndArchiveOutlined } from '@mui/icons-material';
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, ButtonGroup, Card, Chip, IconButton, Paper, SelectChangeEvent, Stack, Typography } from '@mui/material';
// import { AnalyzeDocumentsProgressModel } from './react_components/AnalyzeDocumentProgressModal';
import { AnalyzeDocumentProgressCard } from './AnalyzeDocumentProgressCard';
import { ProcessingRun, AnalyzeStage, UploadStatus } from '../model/documentAnalysis';
import { GOOGLE_API_WRAPPER } from '../client/GoogleApiClient';
import { useMsal } from '@azure/msal-react';
import { GridCallbackDetails, GridRowSelectionModel } from '@mui/x-data-grid';
import { PdfView, PdfViewContainer } from './PdfViewContainer';
import { LOCAL_STORAGE_CLIENT } from '../client/LocalStorageClient';
import styled from '@emotion/styled';
import { getCookie, setCookie, STATIC_COOKIE_KEYS } from '../client/CookieWrapper';
import { ClientDropdown } from './ClientDropdown';

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

export function getLastSyncColor(lastSyncTime: Date | null): "success" | "warning" | "error" {
  const hoursSinceSync = lastSyncTime == null ? 0 : (new Date().getTime() - lastSyncTime.getTime()) / (1000 * 60 * 60)
  let lastSyncColor: "success" | "warning" | "error"
  if (hoursSinceSync < 24) lastSyncColor = "success"
  else if (hoursSinceSync < 24 * 7) lastSyncColor = "warning"
  else lastSyncColor = "error"
  return lastSyncColor
}

export default function FileUploadApp() {
  const [clients, setClients] = useState<string[]>([])
  const [currentClient, setCurrentClient] = useState<string>(getCookie(STATIC_COOKIE_KEYS.CURRENT_CLIENT) ?? "test")
  const [processingStatus, setProcessingStatus] = useState<ProcessingRun | undefined>(undefined);
  const [previousStatuses, setPreviousStatuses] = useState<ProcessingRun[]>([])
  const [viewing, setViewing] = useState<PdfView | undefined>(undefined)

  const [files, setFiles] = useState<Map<string, UploadedFile>>(new Map<string, UploadedFile>())

  const selectedFiles = files.filter((filename, file) => file.selected ?? false)

  const fileLoader = async (forceRefresh: Boolean) => {
    const results = await AZURE_STORAGE_WRAPPER.loadUploadedFilesList(currentClient, forceRefresh)
    setFiles(new Map(results.sort((file1, file2) => file1.name.localeCompare(file2.name)).map((file) => [file.name, file])))
  }

  const clientLoader = async (forceRefresh: Boolean) => {
    const clients = await AZURE_FUNCTION_WRAPPER.listClients(forceRefresh)
    setClients(clients)
  }

  useEffect(() => {
    clientLoader(false)
  }, [])

  useEffect(() => {
    fileLoader(false)
  }, [currentClient])

  const functionWrapperRef = useRef(new AzureFunctionClientWrapper(process.env.REACT_APP_AZURE_FUNCTION_BASE_URL!, useMsal()))
  const AZURE_FUNCTION_WRAPPER = functionWrapperRef.current

  const storageWrapperRef = useRef(new AzureStorageClientWrapper(AZURE_FUNCTION_WRAPPER, process.env.REACT_APP_STORAGE_ACCOUNT!))
  const AZURE_STORAGE_WRAPPER = storageWrapperRef.current
  
  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.value == null) return
    const newSelectedFiles = new Map<string, UploadedFile>()
    e.target.files?.forEach((file, _) => {
      // if upload is already success, don't do anything. Customer needs to remove it first
      if (files.get(file.name)?.uploadStatus === UploadStatus.SUCCESS) {
        return
      }
      newSelectedFiles.set(file.name, {
        name: file.name,
        file: file,
        uploadStatus: UploadStatus.PENDING,
        selected: true
      })
    });
    e.target.value = ""
    setFiles(newSelectedFiles.concat(files));
  };

  // TODO: handle deletion
  function handleRemoveClick(filename: string) {
    if (viewing?.file.name === filename) {
      setViewing(undefined)
    }
    setFiles(files.remove(filename))
  }

  async function handleViewClick(file: UploadedFile, page: number) {
    if (!file.file) {
      file.file = await AZURE_STORAGE_WRAPPER.downloadInputFile(currentClient, file.name)
      setFiles(files.update(file.name, file))
    }
    if (viewing?.file == file.file && viewing?.page === page){
      setViewing(undefined)
    } else {
      setViewing({file: file.file!, page: page})
    }
  }

  // TODO: move state to a reducer
  async function main() {
    if (files.size === 0) {
      return
    }
    setProcessingStatus({inputFiles: [...selectedFiles.keys()], stage: AnalyzeStage.UPLOADING});

    try {
      // step 1: download metadata
      await downloadMetadata()
      // step 2: upload remaining files
      await uploadFilesToAzure()
      // step 3: call analyze documents
      const statements = await analyzeDocuments()
      unstable_batchedUpdates(() => {
        setProcessingStatus((prev) => ({...prev, stage: AnalyzeStage.CREATING_CSV, result: statements} as ProcessingRun))
        Object.keys(statements).forEach(filename => {
          files.get(filename)!.statements = statements[filename]
        });
        setFiles(new Map(files))
      })
      if (Object.keys(statements).length > 0) {
          // step 4: prepare csv
          const spreadsheetId = await prepareCsv(Object.values(statements).flatMap((val) => val))
          setProcessingStatus((currentStatus) => {
            const updatedStatus = { ...currentStatus, stage: AnalyzeStage.COMPLETE, spreadsheetId: spreadsheetId } as ProcessingRun;
            setPreviousStatuses((prev) => ([updatedStatus, ...prev]));
            return undefined;
          });
      }
    } catch(err: any) {
      setProcessingStatus((currentStatus) => {
        const updatedStatus = { ...currentStatus, statusMessage: err } as ProcessingRun;
        setPreviousStatuses((prev) => ([updatedStatus, ...prev]));
        return undefined;
      });
      console.log(err)
      alert(err);
    } finally {
      // TODO: how to access for sure latest value?
      // LOCAL_STORAGE_CLIENT.storeUploadedFiles([...files.filter((filename, file) => file.uploadStatus === UploadStatus.SUCCESS).values()])
    }
  }

  async function downloadMetadata() {
    // step 1: download metadata for files that already exist and update files
    for (const [filename, file] of selectedFiles) {
      // don't process already completed files
      if (file.uploadStatus === UploadStatus.SUCCESS) {
        continue
      }
      file.uploadStatus = UploadStatus.UPLOADING
      const metadata = await AZURE_STORAGE_WRAPPER.downloadMetadataIfExists(currentClient, file.name)
      // if the metadata exists, the file has been uploaded already.  Also update the data
      if (metadata) {
        file.uploadStatus = UploadStatus.SUCCESS
        if (metadata.totalpages) {
          file.totalPages = Number(metadata.totalpages)
          file.pagesAnalyzed = Boolean(metadata.analyzed) ? file.totalPages : 0
        }
        if (metadata.statements) {
          file.statements = metadata.statements.split(", ")
        }
      }
      setFiles(new Map(files))
    }
  }

  async function uploadFilesToAzure() {
    // step 2: upload remaining files 
    const filesToUpload = selectedFiles.filter((_, file)=> file.uploadStatus !== UploadStatus.SUCCESS)
    const uploadFailures = new Map<string, any>()
    for (const [filename, file] of filesToUpload) {
      try {
        await AZURE_STORAGE_WRAPPER.uploadFile(currentClient, file.file!);
        console.log(`${filename} finished uploading with SUCCESS`);
        file.uploadStatus = UploadStatus.SUCCESS;
        file.statusMessage = undefined;
        setFiles(files.update(filename, file));
      } catch (error: any) {
        console.log(`${filename} finished uploading with FAILED: ${error}`);
        uploadFailures.set(filename, error)
        file.uploadStatus = UploadStatus.FAILED;
        file.statusMessage = error.message;
        setFiles(files.update(filename, file));
      }
    }

    // exit early if there are any upload failures
    if (uploadFailures.size > 0) {
      throw Error(uploadFailures.map((filename, error) => `${filename} finished uploading with FAILED: ${error}`).toString())
    }
  };

  async function analyzeDocuments(): Promise<AnalyzeDocumentResult> {
    setProcessingStatus((curr) => ({...curr, stage: AnalyzeStage.VERIFYING_DOCUMENTS} as ProcessingRun));
    const statements = await AZURE_FUNCTION_WRAPPER.analyzeDocuments(currentClient, [...selectedFiles.keys()], updateStatus)
    console.log(`final result: ${JSON.stringify(statements)}`)
    return statements
  }

  function updateStatus(progress: AnalyzeDocumentProgress) {
      const status = progress.status
      status?.documents?.forEach((documentStatus: DocumentStatus) => {
        const file = files.get(documentStatus.fileName)!
        
        file.pagesAnalyzed = documentStatus.pagesCompleted
        file.totalPages = documentStatus.totalPages
      })
      if (status) {
        unstable_batchedUpdates(() =>{
          setProcessingStatus((curr) => ({...curr, stage: status.stage as AnalyzeStage, progress: progress} as ProcessingRun))
          setFiles(new Map(files))
        })
      }
  }

  async function prepareCsv(statements: string[]): Promise<string> {
    const csvSummaryFiles = await AZURE_FUNCTION_WRAPPER.writeCsv(currentClient, statements)
    const csvFiles = await AZURE_STORAGE_WRAPPER.loadCsvFiles(currentClient, csvSummaryFiles)

    // TODO: add client name when it's available
    return await GOOGLE_API_WRAPPER.createGoogleSpreadSheet(`Transactions ${processingStatus?.progress?.requestId ?? previousStatuses[0]?.progress?.requestId}`, csvFiles)
  }


  async function testButton() {
    try {
      const value = (document.getElementById("testInput") as HTMLInputElement).value
      const metadata = await AZURE_STORAGE_WRAPPER.downloadMetadataIfExists(currentClient, value)
      console.log(metadata)
    } catch(error: any) {
      console.log(error)
    }
  }


  function toggleLoading() {
    unstable_batchedUpdates(() => {
      // setProcessingStatus((curr) => {if (curr) {return undefined } else {return status} })
      // setPreviousStatuses((curr) => {if (curr.length > 0) {return [] } else {return prev} })
    })
  }

  function handleClientChange(event: SelectChangeEvent<string>) {
    setCookie(STATIC_COOKIE_KEYS.CURRENT_CLIENT, event.target.value)
    setCurrentClient(event.target.value)
  }

  async function handleNewClient(clientName: string) {
    await AZURE_FUNCTION_WRAPPER.newClient(clientName)
    await clientLoader(true)
    unstable_batchedUpdates(() => {
      setCurrentClient(clientName)
      setCookie(STATIC_COOKIE_KEYS.CURRENT_CLIENT, clientName)
    })
  }

  function onRowSelectionModelChange(rowSelectionModel: GridRowSelectionModel, details: GridCallbackDetails) {
    files.forEach((file, filename) => file.selected = rowSelectionModel.includes(filename))
    setFiles(new Map(files))
  }

  const currentRun = processingStatus ?? previousStatuses[0]
  const showPrevious = currentRun === previousStatuses[0] ? previousStatuses.slice(1) : previousStatuses

  const uploadedFileslastSyncedTime = LOCAL_STORAGE_CLIENT.getUploadedFilesLastSyncedTime(currentClient)
  const uploadedFilesLastSyncColor = getLastSyncColor(uploadedFileslastSyncedTime)
  
  return (
    <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
      <Box>
        <ClientDropdown clients={clients} currentClient={currentClient} handleChange={handleClientChange} handleSync={() => clientLoader(true)} handleNewClient={handleNewClient} />
        <Stack direction="row" sx={{ gap: 1, marginTop: 3, marginBottom: 3 }}>
          <Button
            color='inherit'
            disabled={processingStatus !== undefined}
            component="label"
            role={undefined}
            variant="contained"
            tabIndex={-1}
            startIcon={<CloudUpload />}
          >
            Select files
            <VisuallyHiddenInput
              type="file"
              onChange={handleFileChange}
              multiple
            />
          </Button>

          <LoadingButton
            size="large"
            color='primary'
            onClick={main}
            endIcon={<SendAndArchiveOutlined />}
            disabled={processingStatus !== undefined || selectedFiles.size == 0}
            loading={processingStatus !== undefined}
            loadingPosition="end"
            variant="contained"
          >
            Analyze
          </LoadingButton>
          
          {/* Test Button */}
          {/* <input type="string" id='testInput'/>
          <Button onClick={testButton}>
            Test Button
          </Button>
          <Button onClick={toggleLoading}> Toggle Loading </Button> */}
        </Stack>

        {/* Progress Bars */}
        <Grid
          container
          spacing={2}
          columns={12}
          sx={{ mb: (theme) => theme.spacing(2) }}
        >
          {/* Current Run */}
          <Grid size={{ xs: 12, sm: 6 }}>
              { currentRun && 
                <AnalyzeDocumentProgressCard {...currentRun} />
              }
          </Grid>
          
          {/* Previous Runs */}
          <Grid size={{ xs: 12, sm: 6}}>
            { showPrevious.length > 0 && 
                showPrevious.map((status: ProcessingRun, idx: Number) => {
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
        <Box>
          
        </Box>
      </Box>
      <Box>
        {/* Selected Files Table */}
        {/* {files.size > 0 && 
        <>
          <h3>Selected Files</h3>
          <FileStatusTable files={selectedFiles} handleRemoveClick={handleRemoveClick} handleViewClick={handleViewClick}/>
        </>
        } */}

        <h3 style={{marginTop: 3}}>
          Files  
          <Chip size="small" color={uploadedFilesLastSyncColor} label={`Last Synced: ${uploadedFileslastSyncedTime?.toLocaleString()}`} />
          <Button size='small' sx={{minWidth:40}} onClick={() => fileLoader(true)}><Cached/></Button>
        </h3>
        <FileStatusTable files={files} handleViewClick={handleViewClick} handleRemoveClick={handleRemoveClick} onRowSelectionModelChange={onRowSelectionModelChange} selectedFiles={[...selectedFiles.keys()]}/>

        {/* PDF Display iFrame */}
        <div className='pdf-display-container'>
          { viewing && <PdfViewContainer {...viewing}/> }
        </div>
      </Box>
    </Box>
  );
};