import { CheckBox, FileCopySharp, PlusOne } from '@mui/icons-material'
import { Button, Checkbox, FormControlLabel, Grid2, Stack, TextField } from '@mui/material'
import { Box } from '@mui/system'
import { DataGrid, GridActionsCellItem, gridClasses, GridColDef, GridDeleteIcon, GridEditCellProps, GridFilterModel, GridFilterOperator, GridPreProcessEditCellProps, GridRowClassNameParams, GridRowId, GridRowParams, GridState, GridToolbar, GridValidRowModel } from '@mui/x-data-grid'
import { DatePicker } from '@mui/x-date-pickers'
import dayjs, { Dayjs } from 'dayjs'
import { enqueueSnackbar } from 'notistack'
import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import CustomDatePicker from '../../appskeleton/components/CustomDatePicker'
import { DEFAULT_DATA_GRID_PROPS } from '../../appskeleton/components/CustomizedDataGrid'
import { deleteTransactionThunk, duplicateTransactionThunk, newTransactionThunk, updateTransactionThunk } from '../../data/changeFunctions'
import { reportError } from '../../data/errorsSlice'
import { generateHashId, selectAllTransactions, TransactionGridRecord } from '../../data/transactionsSlice'
import { AppDispatch, RootState } from '../../store'
import { StringOrNumber } from './EditableField'

export function TransactionsGrid() {
    const dispatch = useDispatch<AppDispatch>()
    const transactions = useSelector(selectAllTransactions)
    const rows: GridValidRowModel[] = [...transactions]

    const [showNewOnly, setShowNewOnly] = useState(false);
    const [showInvalidOnly, setShowInvalidOnly] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [startDate, setStartDate] = useState<Dayjs | null>(transactions[0] ? dayjs(transactions[0].date).subtract(1, 'month') : null);
    const [endDate, setEndDate] = useState<Dayjs | null>(transactions.last() ? dayjs(transactions.last().date) : null);

    function testValidator(params: GridPreProcessEditCellProps): GridEditCellProps {
        console.log("validating parameters", params)
        if (params.hasChanged) {
            console.log("param is changing", params.props.value)
        }
        return {...params.props}
    }

    function handleRowUpdate(newRow: any, oldRow: any) {
        if (generateHashId(newRow) === generateHashId(oldRow)) {
            console.log("no change detected")
        } else {
            dispatch(updateTransactionThunk(newRow, oldRow))
        }
        return newRow
    }

    function handleRowUpdateError(error: any) {
        dispatch(reportError(error))
    }
    
    // const state = useSelector((state: RootState) => state); // Get the whole state

    function handleDuplicateTransaction(id: string) {
        dispatch(duplicateTransactionThunk(id));
        enqueueSnackbar("Successfully duplicated transaction", {
            autoHideDuration: 3000,
            variant: 'success'
        })
    }

    function handleRemoveTransaction(id: string) {
        dispatch(deleteTransactionThunk(id))
        enqueueSnackbar("Successfully deleted transaction", {
            autoHideDuration: 3000,
            // variant: 'success'
        })
    }

    function handleAddNewTransaction() {
        dispatch(newTransactionThunk)
    }

    const cols: GridColDef[] = [
        { field: 'date', headerName: 'Date', type: 'date', minWidth: 125, editable: true, valueGetter: (d) => d ? new Date(d) : null, preProcessEditCellProps: testValidator, sortComparator: (d1, d2) => new Date(d1).getTime() - new Date(d2).getTime() },
        { field: 'description', headerName: 'Description', minWidth: 200, preProcessEditCellProps: testValidator, editable: true },
        { field: 'amount', headerName: 'Amount', type: 'number', minWidth: 125, editable: true, preProcessEditCellProps: testValidator, valueFormatter: (val: StringOrNumber | null) => val ? val.asCurrency() : null },
        { field: 'batesStamp', headerName: 'Bates Stamp', minWidth: 125, preProcessEditCellProps: testValidator, editable: true },
        { field: 'filePageNumber', headerName: 'File Page #', minWidth: 75, editable: true, preProcessEditCellProps: testValidator },
        { field: 'statementPageNumber', headerName: 'Stmt Page #', minWidth: 75, editable: true, preProcessEditCellProps: testValidator },
        // { field: 'allocation', headerName: 'Allocation', preProcessEditCellProps: testValidator },
        { field: "actions", type: 'actions', getActions: (params: GridRowParams) => [
            <GridActionsCellItem icon={<FileCopySharp />} sx={{border: "none"}} label="Duplicate"
              onClick={() => handleDuplicateTransaction(params.id as string)}
            />,
            <GridActionsCellItem icon={<GridDeleteIcon />} sx={{border: "none"}} color="error" label="Delete"
              onClick={() => handleRemoveTransaction(params.id as string)}
            />,
          ]}
    ]
    return (
        <Box sx={{
            [`.${gridClasses.cell}.new-record`]: {
              backgroundColor: 'red'
            },
            [`.${gridClasses.cell}.edited`]: {
              backgroundColor: 'yellow'
            },
          }}>
            <Grid2 container columns={12} spacing={2}> 
                <Grid2 size={4}>
                    <Button variant='contained' size='small' onClick={handleAddNewTransaction} endIcon={<PlusOne/>} >New Transaction</Button>
                </Grid2>
                <Grid2 size={8}>
                    {/* Filter controls */}
                    <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                        <FormControlLabel
                            control={<Checkbox checked={showNewOnly} onChange={() => setShowNewOnly(!showNewOnly)} />}
                            label="Show New Only"
                        />
                        <FormControlLabel
                            control={<Checkbox checked={showInvalidOnly} onChange={() => setShowInvalidOnly(!showInvalidOnly)} />}
                            label="Show Invalid Only"
                        />
                        <TextField
                            label="Search"
                            variant="outlined"
                            size="small"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <CustomDatePicker label="Start Date" value={startDate} handleChange={(date) => setStartDate(date)} />
                        <CustomDatePicker label="End Date" value={endDate} handleChange={(date) => setEndDate(date)} />
                    </Stack>
                </Grid2>
                <Grid2 size={12}>
                    <DataGrid
                        style={{maxWidth: 1400}}
                        {...DEFAULT_DATA_GRID_PROPS}
                        // filterModel={getFilterModel(showNewOnly, showInvalidOnly, searchQuery, startDate, endDate)}
                        rows={rows}
                        columns={cols}
                        editMode="row"
                        processRowUpdate={handleRowUpdate}
                        onProcessRowUpdateError={handleRowUpdateError}
                        getRowClassName={handleRowClassName}
                        slots={{ toolbar: GridToolbar }}
                        slotProps={{
                            ...DEFAULT_DATA_GRID_PROPS.slotProps,
                            toolbar: {
                                showQuickFilter: true,
                            },
                        }}
                    />
                </Grid2>
            </Grid2>
        </Box>
    )
}

function handleRowClassName(params: GridRowClassNameParams): string {
    if (params.row.newRecord) {
        return "new-record"
    } else if (generateHashId(params.row) !== params.row.originalHash) {
        return "edited"
    } else {
        return ""
    }
}

export interface TransactionsGridProps {
    handleCellEditStop: (params: any) => void,
}



// const customFilterOperator: GridFilterOperator<any, TransactionGridRecord>[] = [
//     {
//       label: 'Filtered',
//       value: 'filtered',
//       getApplyFilterFn: (filterItem) => {
//         if (!filterItem.field || !filterItem.value || !filterItem.operator) {
//           return null;
//         }
//         return (value) => {
//           return filterItem.value && isCustomFiltered(value);
//         };
//       },
//     //   InputComponent: RatingInputValue,
//     //   InputComponentProps: { type: 'number' },
//     //   getValueAsString: (value: number) => `${value} Stars`,
//     },
// ];

function getFilterModel(showNewOnly: boolean, showInvalidOnly: boolean, startDate: Dayjs | null, endDate: Dayjs | null): GridFilterModel {
    // Construct filter model dynamically
    return {
        items: [
            // Filter by newRecord
            ...(showNewOnly ? [{ field: "newRecord", operator: "equals", value: true }] : []),
        ],
    };
}