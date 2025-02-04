
import React from "react";
import { Filter, Filter1Sharp, FilterAlt } from "@mui/icons-material";
import { IconButton } from "@mui/material";
import { GridColDef } from "@mui/x-data-grid";
import { BankStatementInfo } from "../model/statement_model";
import CustomizedDataGrid from "../dashboard/components/CustomizedDataGrid";
import { getMonthsBetween, getXAxisLabel } from "./StatementsDashboard";
import VirtualElementPopover from "../file_upload/VirtualElementPopover";

export function AccountsDashboardTable({statements, handleViewClick}: AccountsDashboardTableProps) {
    const accountMap: Map<string, BankStatementInfo[]> = statements.reduce((map, stmt) => {
        const account = `${stmt.bankName} - ${stmt.account}`;
        
        if (!map.has(account)) {
            map.set(account, []);
        }
        
        map.get(account).push(stmt);
        
        return map;
    }, new Map());
    const rows = accountMap.map((account, stmts) => {
        const monthsInRange: string[] = getMonthsBetween(stmts[0].date, stmts[stmts.length - 1].date)
        const months = stmts.map((stmt) => getXAxisLabel(stmt.date))
        const totalSpending = stmts.reduce((prev, stmt) => (prev + stmt.totalSpending), 0)
        const totalIncome = stmts.reduce((prev, stmt) => (prev + stmt.totalIncomeCredits), 0)
        return {
            id: account,
            account: account,
            numTransactions: stmts.reduce((prev, stmt) => (prev + stmt.numTransactions), 0),
            totalSpending: totalSpending,
            totalIncome: totalIncome,
            netIncome: totalIncome - totalSpending,
            bankType: stmts[0].bankType,
            statementRange: `${getXAxisLabel(stmts[0].date)} - ${getXAxisLabel(stmts[stmts.length - 1].date)}`,
            missingStatements: monthsInRange.filter((month) => !months.includes(month)).join(", "),
        }
    })  

    const columns: GridColDef[] = [
        { field: 'account', headerName: 'Account', minWidth: 200, maxWidth: 800, renderCell: (params) => {
            return (
                <span>
                    <IconButton sx={{border: "none"}} className='view' onClick={() => handleViewClick(params.value)}><FilterAlt /></IconButton> {params.value}
                </span>
            )
        } },
        { field: 'bankType', headerName: 'Bank Type', width: 175 },
        { field: 'numTransactions', headerName: 'Transactions', width: 100 },
        { field: 'totalSpending', headerName: 'Total Spending', width: 125, valueGetter: (val: number) => val.asCurrency() },
        { field: 'totalIncome', headerName: 'Total Income/Credits', width: 125, valueGetter: (val: number) => val.asCurrency() },
        { field: 'netIncome', headerName: 'Net Income', width: 125, valueGetter: (val: number) => val.asCurrency() },
        { field: 'statementRange', headerName: 'Statements Range', width: 175 },
        { field: 'missingStatements', headerName: 'Missing Statements', width: 300, renderCell: (params) => {
            return ( <span><VirtualElementPopover>{params.value}</VirtualElementPopover></span> )
        } },
      ];

    return (
        <CustomizedDataGrid rows={rows} columns={columns} />
    )
}

export interface AccountsDashboardTableProps {
    statements: BankStatementInfo[]
    handleViewClick: Function
}