import * as React from 'react';
import { DataGrid, GridCallbackDetails, GridColDef, GridRowSelectionModel, GridRowsProp } from '@mui/x-data-grid';

export interface CustomizedDataGridProps {
  rows: GridRowsProp, 
  columns: GridColDef[]
  onRowSelectionModelChange?: (rowSelectionModel: GridRowSelectionModel, details: GridCallbackDetails) => void
  selectedRows?: string[]
  onCellEditStop?: (params: any) => void
}

export default function CustomizedDataGrid({rows, columns, onRowSelectionModelChange, selectedRows, onCellEditStop}: CustomizedDataGridProps) {
  return (
    <DataGrid
      autoHeight
      onCellEditStop={onCellEditStop}
      checkboxSelection
      disableRowSelectionOnClick
      onRowSelectionModelChange={onRowSelectionModelChange}
      rowSelectionModel={selectedRows}
      rows={rows}
      columns={columns}
      getRowClassName={(params) =>
        params.indexRelativeToCurrentPage % 2 === 0 ? 'even' : 'odd'
      }
      initialState={{
        pagination: { paginationModel: { pageSize: 50 } },
      }}
      pageSizeOptions={[10, 20, 50]}
      density="compact"
      slotProps={{
        filterPanel: {
          filterFormProps: {
            logicOperatorInputProps: {
              variant: 'outlined',
              size: 'small',
            },
            columnInputProps: {
              variant: 'outlined',
              size: 'small',
              sx: { mt: 'auto' },
            },
            operatorInputProps: {
              variant: 'outlined',
              size: 'small',
              sx: { mt: 'auto' },
            },
            valueInputProps: {
              InputComponentProps: {
                variant: 'outlined',
                size: 'small',
              },
            },
          },
        },
      }}
    />
  );
}
