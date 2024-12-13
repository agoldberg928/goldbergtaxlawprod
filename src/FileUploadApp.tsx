import React, { IframeHTMLAttributes, useState, ChangeEvent, useRef } from 'react';
import { unstable_batchedUpdates } from 'react-dom'
import { AzureStorageClientWrapper } from './client/AzureStorageClientWrapper';
import { AnalyzeStage, UploadStatus } from './model/enums';
import { FileStatusTable } from './react_components/FileUploadTable'
import { AnalyzeDocumentCustomStatus, AnalyzeDocumentProgress, AnalyzeDocumentResult, AzureFunctionClientWrapper, DocumentStatus, FinalStatus, WriteCsvSummaryResult } from './client/AzureFunctionClientWrapper';
import "./util/custom_typings/extensions"
import { LoadingButton } from '@mui/lab';
import { CloudUpload, OpenInNew, SendAndArchiveOutlined } from '@mui/icons-material';
import { Box, Button, ButtonGroup } from '@mui/material';
import { LinearProgressWithLabel, VisuallyHiddenInput } from './react_components/CustomMuiComponents';
// import { AnalyzeDocumentsProgressModel } from './react_components/AnalyzeDocumentProgressModal';
import { AnalyzeDocumentProgressBar, AnalyzeDocumentProgressInfo } from './react_components/AnalyzeDocumentProgressBar';
import { ProcessingStatus } from './model/interfaces';
import Dashboard from './dashboard/Dashboard';
import { GOOGLE_API_WRAPPER } from './client/googleApiClient';

export interface PdfView {
  file: File
  page: number
}

export default function FileUploadApp() {
  // map of filename to file
  const [selectedFiles, setSelectedFiles] = useState<Map<string, File>>(new Map<string, File>());
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | undefined>(undefined);
  const [previousStatuses, setPreviousStatuses] = useState<ProcessingStatus[]>([])
  const [spreadsheetId, setSpreadsheetId] = useState<string | undefined>(undefined)
  const [viewing, setViewing] = useState<PdfView | undefined>(undefined)

  const functionWrapperRef = useRef(new AzureFunctionClientWrapper(process.env.REACT_APP_AZURE_FUNCTION_BASE_URL!))
  const AZURE_FUNCTION_WRAPPER = functionWrapperRef.current

  const storageWrapperRef = useRef(new AzureStorageClientWrapper(AZURE_FUNCTION_WRAPPER, process.env.REACT_APP_STORAGE_ACCOUNT!))
  const AZURE_STORAGE_WRAPPER = storageWrapperRef.current
  
  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.value == null) return
    const newSelectedFiles = new Map(selectedFiles)
    e.target.files?.forEach((file, _) => {
      // if upload is already success, don't do anything. Customer needs to remove it first
      if (newSelectedFiles.get(file.name)?.uploadStatus === UploadStatus.SUCCESS) {
        return
      }
      newSelectedFiles.set(file.name, file)
    });
    e.target.value = ""
    setSelectedFiles(newSelectedFiles);
  };

  function handleRemoveClick(filename: string) {
    if (viewing?.file.name === filename) {
      setViewing(undefined)
    }
    setSelectedFiles(selectedFiles.remove(filename))
  }

  function handleViewClick(file: File, page: number) {
    if (viewing?.file == file && viewing?.page === page){
      setViewing(undefined)
    } else {
      setViewing({file: file, page: page})
    }
  }  

  function getObjectUrl(pdfView: PdfView): string {
    const pageSuffix = pdfView.page ? `#page=${pdfView.page}` : "";
    return URL.createObjectURL(pdfView.file).concat(pageSuffix)
  }

  function handleProcessingError(err: any) {
    setProcessingStatus((currentStatus) => {
      const updatedStatus = { ...currentStatus, statusMessage: err } as ProcessingStatus;
      setPreviousStatuses((prev) => ([updatedStatus, ...prev]));
      return undefined;
    });
    alert(err);
  }

  async function main() {
    if (selectedFiles.size === 0) {
      return
    }
    setProcessingStatus({stage: AnalyzeStage.UPLOADING});

    try {
      // step 1: download metadata
      await downloadMetadata()
      // step 2: upload remaining files
      await uploadFilesToAzure()
      // step 3: call analyze documents
      const statements = await analyzeDocuments()
      if (statements.keys.length > 0) {
          // step 4: prepare csv
          prepareCsv(statements.values.flatMap((val) => val))
      }
    } catch(error: any) {
      handleProcessingError(error)
    }
  }

  async function downloadMetadata(): Promise<Map<string, File>> {
    // step 1: download metadata for files that already exist and update files
    const newSelectedFiles = new Map(selectedFiles)
    for (const [filename, file] of newSelectedFiles) {
      // don't process already completed files
      if (file.uploadStatus === UploadStatus.SUCCESS) {
        continue
      }
      file.uploadStatus = UploadStatus.UPLOADING
      const metadata = await AZURE_STORAGE_WRAPPER.downloadMetadataIfExists(file.name)
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
      newSelectedFiles.set(filename, file)
    }
    
    setSelectedFiles(newSelectedFiles)
    return newSelectedFiles
  }

  async function uploadFilesToAzure() {
    // step 2: upload remaining files 
    const filesToUpload = selectedFiles.filter((_, file)=> file.uploadStatus !== UploadStatus.SUCCESS)
    const uploadFailures = new Map<string, any>()
    for (const [filename, file] of filesToUpload) {
      try {
        await AZURE_STORAGE_WRAPPER.uploadFile(file);
        console.log(`${filename} finished uploading with SUCCESS`);
        file.uploadStatus = UploadStatus.SUCCESS;
        file.statusMessage = undefined;
        setSelectedFiles(selectedFiles.update(filename, file));
      } catch (error: any) {
        console.log(`${filename} finished uploading with FAILED: ${error}`);
        uploadFailures.set(filename, error)
        file.uploadStatus = UploadStatus.FAILED;
        file.statusMessage = error.message;
        setSelectedFiles(selectedFiles.update(filename, file));
      }
    }

    // exit early if there are any upload failures
    if (uploadFailures.size > 0) {
      throw Error(uploadFailures.map((filename, error) => `${filename} finished uploading with FAILED: ${error}`).toString())
    }
  };

  async function analyzeDocuments(): Promise<AnalyzeDocumentResult> {
    const uploadedFiles: Map<string, File> = selectedFiles.filter((_, file)=> file.uploadStatus === UploadStatus.SUCCESS)
    
    setProcessingStatus((curr) => ({...curr, stage: AnalyzeStage.VERIFYING_DOCUMENTS}));
    const statements = await AZURE_FUNCTION_WRAPPER.analyzeDocuments([...uploadedFiles.keys()], updateStatus)
    console.log(`final result: ${statements}`)
    return statements
  }

  function updateStatus(progress: AnalyzeDocumentProgress) {
      const status = progress.status
      status?.documents?.forEach((documentStatus: DocumentStatus) => {
        const file = selectedFiles.get(documentStatus.fileName)!
        
        file.pagesAnalyzed = documentStatus.pagesCompleted
        file.totalPages = documentStatus.totalPages
      })
      if (status) {
        unstable_batchedUpdates(() =>{
          setProcessingStatus({stage: status.stage as AnalyzeStage, progress: progress})
          setSelectedFiles(new Map(selectedFiles))
        })
      }
  }

  async function prepareCsv(statements: string[]) {
    setProcessingStatus((prev) => ({...prev, stage: AnalyzeStage.CREATING_CSV}))

    const csvSummaryFiles = await AZURE_FUNCTION_WRAPPER.writeCsv(statements)
    const csvFiles = await AZURE_STORAGE_WRAPPER.loadCsvFiles(csvSummaryFiles)
    setSpreadsheetId(await GOOGLE_API_WRAPPER.createGoogleSpreadSheet(csvFiles))
  }


  async function testButton() {
    try {
      const value = (document.getElementById("testInput") as HTMLInputElement).value
      const metadata = await AZURE_STORAGE_WRAPPER.downloadMetadataIfExists(value)
      console.log(metadata)
    } catch(error: any) {
      console.log(error)
    }
  }

  return (
    <div>
      <div>
        <h2>Analyze Documents</h2>
        
        <ButtonGroup variant='contained'>
          {/* File Input + Label */}
          <Button
            color='secondary'
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
          <input type="string" id='testInput'/>
          <Button onClick={testButton}>
            Test Button
          </Button>
        </ButtonGroup>

        {/* Progress Bar */}
        <Box>
          
          { processingStatus && 
            <>
              <h4>Current Run</h4>
              <AnalyzeDocumentProgressBar {...processingStatus} />
            </>
          }
          <Box>
            {spreadsheetId && 
              <Button variant='contained' size='large' color='primary' endIcon={<OpenInNew />} 
                href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`} target='_blank'
              >
                Open in Google Sheets
              </Button>
            }
          </Box>
        </Box>
        {/* Previous Run */}
        <Box>
          
          { previousStatuses.length > 0 && 
            <>
              <h4>Previous Run</h4>
              <AnalyzeDocumentProgressInfo stage={previousStatuses[0].stage} statusMessage={previousStatuses[0].statusMessage} progress={previousStatuses[0].progress} />
            </> 
          }
        </Box>
      </div>
      <div>
        {/* Selected Files Table */}
        <h3>Selected Files</h3>
        <FileStatusTable files={selectedFiles} handleRemoveClick={handleRemoveClick} handleViewClick={handleViewClick}/>

        {/* PDF Display iFrame */}
        <div className='pdf-display-container'>
          {
            viewing && 
            <iframe id="pdfDisplay" src={getObjectUrl(viewing)!}/>
          }
        </div>
      </div>
    </div>
  );
};