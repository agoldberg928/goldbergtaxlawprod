
import React from "react";
import { Preview } from "@mui/icons-material";
import { Chip, IconButton } from "@mui/material";
import { GridCallbackDetails, GridColDef, gridDateComparator, GridRowSelectionModel } from "@mui/x-data-grid";
import { BankStatementInfo } from "../model/statement_model";
import { BankStatementFileMetadata } from "../client/AzureStorageClientWrapper";
import CustomizedDataGrid from "../dashboard/components/CustomizedDataGrid";
import VirtualElementPopover from "../file_upload/VirtualElementPopover";

function accountStatementSortComparator(s1: BankStatementInfo, s2: BankStatementInfo) {
    return s2.bankType.localeCompare(s1.bankType) || s2.account.localeCompare(s1.account)
}

function stringDateSortComparator(v1: string, v2: string){
    return new Date(v1).getTime() - new Date(v2).getTime()
} 

export function StatementsDashboardTable({statements, handleViewClick, onRowSelectionModelChange, selectedStatements}: StatementsDashboardTableProps) {
    const rows = statements.map((statement) => ({...statement, account: statement, id: statement.stmtFilename}))

    const columns: GridColDef[] = [
        { field: 'account', headerName: 'Account', minWidth: 175, sortComparator: accountStatementSortComparator, renderCell: (params) => {
            const statement = params.value as BankStatementInfo
            return (
                <span>
                    <IconButton sx={{border: "none"}} className='view' onClick={() => handleViewClick(statement)}><Preview /></IconButton> {statement.bankName} - {statement.account}
                </span>
            )
        } },
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
        { field: 'inputFileInfo', headerName: 'Source', minWidth: 600, renderCell: (params) => {
            return (
                <span>
                    <VirtualElementPopover>{`${params.value.name}[${params.value.startPage} - ${params.value.endPage}]` }</VirtualElementPopover>
                </span>
            )
        } },
      ];

    return (
        <CustomizedDataGrid rows={rows} columns={columns} onRowSelectionModelChange={onRowSelectionModelChange} selectedRows={selectedStatements} />
    )
}

export interface StatementsDashboardTableProps {
    statements: BankStatementInfo[]
    handleViewClick: (statement: BankStatementInfo) => void
    onRowSelectionModelChange?: (rowSelectionModel: GridRowSelectionModel, details: GridCallbackDetails) => void
    selectedStatements: string[]
}