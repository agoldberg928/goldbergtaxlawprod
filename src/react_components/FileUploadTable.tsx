import { DataGrid, GridCellEditStopReasons, GridColDef, GridDeleteIcon, GridRowModel, GridRowsProp } from '@mui/x-data-grid';
import { styled } from '@mui/material/styles';
import React from 'react';
import '../util/custom_typings/extensions';
import { Button, IconButton } from '@mui/material';
import { DeleteForeverOutlined, Preview, PreviewOutlined } from '@mui/icons-material';

export function FileStatusTable({files, handleRemoveClick, handleViewClick}: FileStatusTableProps) {

    const rows = files.map((filename: string, file: File) => {
        return {
            id: filename,
            file: file,
            uploadStatus: file.uploadStatus,
            pagesProcessed: `${file.totalPages ? file.pagesAnalyzed ?? 0 + "/" + file.totalPages : ""}`,
            statusMessage: file.statusMessage,
            statements: `${file.statements ?? ""}`,
            remove: filename
          }
    })

    const columns: GridColDef[] = [
        { field: 'file', headerName: 'Filename', width: 800, renderCell: (params) => {
            return (
                <span>
                    <IconButton className='view' onClick={() => handleViewClick(params.value)}><Preview /></IconButton> {params.value.name}
                </span>
            )
        } },
        { field: 'uploadStatus', headerName: 'Upload Status', width: 160 },
        { field: 'pagesProcessed', headerName: 'Pages', width: 200 },
        { field: 'statusMessage', headerName: 'Status Message', width: 200 },
        { field: 'statements', headerName: 'Statements', width: 200 },
        { field: 'remove', headerName: '', sortable: false, disableColumnMenu: true, display: 'flex', width: 50, resizable: false, renderCell: (params) => {
            return (
                <IconButton aria-label="remove" onClick={() => handleRemoveClick(params.value)}><DeleteForeverOutlined color='error' /></IconButton>
            )
        } }
      ];

    return (
        <DataGrid rows={rows} columns={columns} />
    )
}
interface FileStatusTableProps {
    files: Map<string, File>,
    handleRemoveClick: Function, 
    handleViewClick: Function
}