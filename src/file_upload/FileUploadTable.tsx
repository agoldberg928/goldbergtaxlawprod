import { GridCallbackDetails, GridColDef, GridRowSelectionModel } from '@mui/x-data-grid';
import React from 'react';
import '../util/custom_typings/extensions';
import { Alert, Chip, ChipOwnProps, IconButton } from '@mui/material';
import { DeleteForeverOutlined, Preview } from '@mui/icons-material';
import CustomizedDataGrid from '../dashboard/components/CustomizedDataGrid';
import VirtualElementPopover from './VirtualElementPopover';
import { transformStatementsField } from '../util/util';
import { UploadStatus } from '../model/documentAnalysis';

export function FileStatusTable({files, handleRemoveClick, handleViewClick, onRowSelectionModelChange, selectedFiles}: FileStatusTableProps) {

    const rows = files.map((filename: string, file: UploadedFile) => {
        return {
            id: filename,
            file: file,
            uploadStatus: file,
            pagesProcessed: file.totalPages ? `${file.pagesAnalyzed ?? 0}/${file.totalPages}` : "",
            statements: `${file.statements ?? ""}`,
            statusMessage: file.statusMessage,
            remove: file
          }
    })

    const columns: GridColDef[] = [
        { field: 'file', headerName: 'Filename', minWidth: 500, maxWidth: 800, renderCell: (params) => {
            return (
                <span>
                    <IconButton sx={{border: "none"}} className='view' onClick={() => handleViewClick(params.value)}><Preview /></IconButton> <VirtualElementPopover>{params.value.name}</VirtualElementPopover>
                </span>
            )
        } },
        { field: 'uploadStatus', headerName: 'Status', width: 160, renderCell: (params) => renderStatus(params.value as UploadedFile)},
        { field: 'pagesProcessed', headerName: 'Pages', width: 100 },
        { field: 'statements', headerName: 'Statements', width: 200, renderCell: (params) => {
            if (params.value) {
                return (
                    <span><VirtualElementPopover>{transformStatementsField(params.value)}</VirtualElementPopover></span>
                )
            } else {
                return (<></>)
            }
        } },
        { field: 'statusMessage', headerName: 'Status Message', width: 200, renderCell: (params) => {
            if (params.value) {
                return (
                    <span><VirtualElementPopover><Alert severity='error'>{params.value}</Alert></VirtualElementPopover></span>
                )
            } else {
                return (<></>)
            }
        } },
        { field: 'remove', headerName: '', sortable: false, disableColumnMenu: true, display: 'flex', width: 50, resizable: false, renderCell: (params) => {
            const file: UploadedFile = params.value
            return file.uploadStatus == UploadStatus.SUCCESS ? (<></>) : (
                <IconButton sx={{border: "none"}} aria-label="remove" onClick={() => handleRemoveClick(file.name)}><DeleteForeverOutlined color='error' /></IconButton>
            )
        } }
      ];

    return (
        <CustomizedDataGrid rows={rows} columns={columns} onRowSelectionModelChange={onRowSelectionModelChange} selectedRows={selectedFiles} />
    )
}
interface FileStatusTableProps {
    files: Map<string, UploadedFile>,
    handleRemoveClick: Function, 
    handleViewClick: Function,
    onRowSelectionModelChange?: (rowSelectionModel: GridRowSelectionModel, details: GridCallbackDetails) => void
    selectedFiles: string[]
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

  
