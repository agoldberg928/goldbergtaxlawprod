import * as React from 'react';
import { DataGrid, DataGridProps, GridColDef } from '@mui/x-data-grid';

export const DEFAULT_DATA_GRID_PROPS: DataGridProps = {
  columns: {} as GridColDef[],
  checkboxSelection: true,
  autoHeight: true,
  disableRowSelectionOnClick: true,
  getRowClassName: (params) => params.indexRelativeToCurrentPage % 2 === 0 ? 'even' : 'odd',
  initialState: {
    pagination: { paginationModel: { pageSize: 100 } },
  },
  pageSizeOptions: [25, 50, 100],
  density: "compact",
  slotProps:{
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
  }
}

export default function CustomizedDataGrid({rows, columns, onRowSelectionModelChange, rowSelectionModel, onCellEditStop, editMode, processRowUpdate, onProcessRowUpdateError, loading}: DataGridProps) {
  return (
    <DataGrid
      onProcessRowUpdateError={onProcessRowUpdateError}
      processRowUpdate={processRowUpdate}
      editMode={editMode}
      loading={loading}
      autoHeight
      onCellEditStop={onCellEditStop}
      checkboxSelection
      disableRowSelectionOnClick
      onRowSelectionModelChange={onRowSelectionModelChange}
      rowSelectionModel={rowSelectionModel}
      rows={rows}
      columns={columns}
      getRowClassName={(params) =>
        params.indexRelativeToCurrentPage % 2 === 0 ? 'even' : 'odd'
      }
      initialState={{
        pagination: { paginationModel: { pageSize: 100 } },
      }}
      pageSizeOptions={[25, 50, 100]}
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
