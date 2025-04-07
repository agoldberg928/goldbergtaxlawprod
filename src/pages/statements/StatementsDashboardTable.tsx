
import React from "react";
import { Preview } from "@mui/icons-material";
import { Chip, IconButton } from "@mui/material";
import { DataGrid, GridActionsCellItem, GridCallbackDetails, GridColDef, GridRowParams, GridRowSelectionModel, GridToolbar } from "@mui/x-data-grid";
import { BankStatementInfo } from "../../model/statementModel";
import { BankStatementFileMetadata } from "../../client/AzureStorageClientWrapper";
import CustomizedDataGrid, { DEFAULT_DATA_GRID_PROPS } from "../../appskeleton/components/CustomizedDataGrid";
import VirtualElementPopover from "../components/VirtualElementPopover";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch } from "../../store";
import { selectAllSelectedStatements, selectAllStatements, setSelectedStatements } from "../../data/statementsSlice";

export function StatementsDashboardTable() {
    const dispatch = useDispatch<AppDispatch>()

    const statements = useSelector(selectAllStatements)
    const selectedStatements = useSelector(selectAllSelectedStatements).map(stmt => stmt.id)
    const rows = statements.map((statement) => ({...statement, account: `${statement.bankName} - ${statement.account}`}))

    const columns: GridColDef[] = [
        { field: "previewAction", type: 'actions', width: 5, getActions: (params: GridRowParams) => [
            <GridActionsCellItem sx={{border: "none"}} icon={<Preview />} label="Preview" 
            onClick={() => window.open(`./statement?stmtId=${params.row.stmtFilename}`, '_blank')?.focus()}/>,
        ]},
        { field: 'account', headerName: 'Account', minWidth: 175 },
        { field: 'date', headerName: 'Date', minWidth: 125, sortComparator: stringDateSortComparator },
        { field: 'totalSpending', headerName: 'Total Spending', minWidth: 125, valueFormatter: (val: number) => val?.asCurrency() },
        { field: 'totalIncomeCredits', headerName: 'Total Income/Payments/Credits', minWidth: 125, valueFormatter: (val: number) => val?.asCurrency() },
        { field: 'numTransactions', headerName: 'Transactions', minWidth: 100 },
        { field: 'bankType', headerName: 'Bank Type', minWidth: 125 },
        { field: 'verifiedInfo', headerName: 'Verified', minWidth: 200, sortable: false, renderCell: (params) => {
            const val = params.value as BankStatementFileMetadata
            const verifiedChip = !val.suspicious || val.manuallyVerified ? <Chip label="Statement" color="success" size="small" /> : <Chip label="Suspicious" color="error" size="small" />
            const missingChecksChip = !val.missingChecks ? <Chip label="Checks" color="success" size="small" /> : <Chip label="Missing Checks" color="error" size="small" />
            
            return (<>{verifiedChip} {missingChecksChip}</>)
        } },
        { field: 'inputFileInfo', headerName: 'Source', minWidth: 300, valueGetter: (value: any) => `${value.name}[${value.startPage} - ${value.endPage}]`, renderCell: (params) => {
            return (
                <span>
                    <VirtualElementPopover>{params.value}</VirtualElementPopover>
                </span>
            )
        } },
      ];

    function onRowSelectionModelChange(rowSelectionModel: GridRowSelectionModel, details: GridCallbackDetails) {
        dispatch(setSelectedStatements(rowSelectionModel as string[]))
    }

    return (
        <DataGrid 
            {...DEFAULT_DATA_GRID_PROPS}
            rows={rows} columns={columns} onRowSelectionModelChange={onRowSelectionModelChange} rowSelectionModel={selectedStatements} 
            slots={{ toolbar: GridToolbar }}
            slotProps={{
                ...DEFAULT_DATA_GRID_PROPS.slotProps,
                toolbar: {
                    showQuickFilter: true,
                },
            }}
        />
    )
}

function stringDateSortComparator(v1: string, v2: string){
    return new Date(v1).getTime() - new Date(v2).getTime()
}