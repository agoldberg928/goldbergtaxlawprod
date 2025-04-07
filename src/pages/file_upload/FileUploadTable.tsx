import { GridActionsCellItem, GridCallbackDetails, GridColDef, GridDeleteIcon, GridRowParams, GridRowSelectionModel } from '@mui/x-data-grid';
import React from 'react';
import '../../util/custom_typings/extensions';
import { Alert, Chip, ChipOwnProps, IconButton } from '@mui/material';
import { DeleteForeverOutlined, Preview } from '@mui/icons-material';
import CustomizedDataGrid from '../../appskeleton/components/CustomizedDataGrid';
import VirtualElementPopover from '../components/VirtualElementPopover';
import { groupStatementsIntoString } from '../../util/util';
import { UploadStatus } from '../../model/analyzeDocumentApiModel';
import { AppDispatch } from '../../store';
import { useDispatch, useSelector } from 'react-redux';
import { selectAllSelectedFiles, selectAllFiles, setSelectedFiles, selectFileStatusMessages, UploadedFile } from '../../data/uploadedFilesSlice';
import { selectRunInProgress } from '../../data/analyzeDocumentsStatusSlice';

interface FileStatusTableProps {
    handleRemoveClick: Function, 
    handleViewClick: Function,
}

export function FileUploadTable({handleRemoveClick, handleViewClick}: FileStatusTableProps) {
    const dispatch = useDispatch<AppDispatch>()
    const files = useSelector(selectAllFiles)
    const selectedFiles = useSelector(selectAllSelectedFiles).map(file => file.id)
    const statusMessages = useSelector(selectFileStatusMessages)
    const loading = useSelector(selectRunInProgress)
    const rows = files.map((file: UploadedFile) => {
        return {
            id: file.id,
            file: file,
            name: file.name,    
            uploadStatus: file,
            pagesProcessed: file.totalPages ? `${file.pagesAnalyzed ?? 0}/${file.totalPages}` : "",
            statements: `${file.statements ?? ""}`,
            statusMessage: statusMessages[file.name],
          }
    })

    const columns: GridColDef[] = [
        { field: "previewAction", type: 'actions', width: 5, getActions: (params: GridRowParams) => [
            <GridActionsCellItem sx={{border: "none"}} icon={<Preview />} label="Preview" onClick={() => handleViewClick(params.row.file as UploadedFile)}/>,
        ]},
        { field: 'name', headerName: 'Filename', minWidth: 500, maxWidth: 800, renderCell: (params) => {
            return (<VirtualElementPopover>{params.value}</VirtualElementPopover>)
        } },
        { field: 'uploadStatus', headerName: 'Status', width: 160, renderCell: (params) => renderStatus(params.value as UploadedFile)},
        { field: 'pagesProcessed', headerName: 'Pages Analyzed', width: 100 },
        { field: 'statements', headerName: 'Statements', width: 200, renderCell: (params) => {
            return params.value ? (<VirtualElementPopover>{groupStatementsIntoString(params.value)}</VirtualElementPopover>) : (<></>)
        } },
        { field: 'statusMessage', headerName: 'Status Message', width: 200, renderCell: (params) => {
            return params.value ? (<VirtualElementPopover><Alert severity='error'>{params.value}</Alert></VirtualElementPopover>) : (<></>)
        } },
        { field: "deleteActions", type: 'actions', width: 5, getActions: (params: GridRowParams) => params.row.file.uploadStatus != UploadStatus.SUCCESS ? 
                [<GridActionsCellItem icon={<DeleteForeverOutlined />} color="error" label="Delete" sx={{border: "none"}} onClick={() => handleRemoveClick(params.row.file as UploadedFile)}/>]
                : []
        },
    ];

    function onRowSelectionModelChange(rowSelectionModel: GridRowSelectionModel, details: GridCallbackDetails) {
        dispatch(setSelectedFiles(rowSelectionModel as string[]))
    }

    // TODO: remove customized data grid in favor of props
    return (
        <CustomizedDataGrid loading={loading} rows={rows} columns={columns} onRowSelectionModelChange={onRowSelectionModelChange} rowSelectionModel={selectedFiles} />
    )
}

function renderStatus(file: UploadedFile) {

    let label: string
    let status: ChipOwnProps["color"]
    
    if (file.statements) {
        label = "Statements Created"
        status = "success"
    } else if (file.totalPages && file.pagesAnalyzed === file.totalPages) {
        label = "Analyzed"
        status = "success"
    } else if (file.pagesAnalyzed != file.totalPages) {
        label = "Analysis Needed"
        status = "warning"
    } else {
        const colors = new Map<UploadStatus, ChipOwnProps["color"]>([
            [UploadStatus.PENDING, "default"],
            [UploadStatus.SUCCESS, "success"],
            [UploadStatus.FAILED, "error"],
            [UploadStatus.UPLOADING, "warning"],
          ]);
        
          [label, status] = [`Upload ${file.uploadStatus}`, colors.get(file.uploadStatus)]
    }
    
  
    return <Chip label={label} color={status} size="small" />;
  }

  
