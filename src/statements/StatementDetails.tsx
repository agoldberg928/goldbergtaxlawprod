import { GridColDef, GridValidRowModel } from "@mui/x-data-grid";
import React from "react";
import CustomizedDataGrid from "../dashboard/components/CustomizedDataGrid";
import { BankStatementInfo } from "../model/statement_model";

interface StatementDetailsProps {
    stmt: BankStatementInfo
}

export function StatementDetails({stmt}: StatementDetailsProps) {
    const rows: GridValidRowModel[] = stmt.details?.transactions.map((transaction, idx) => {
        return {
            id: idx,
            date: transaction.date,
            description: transaction.description,
            amount: transaction.amount,
            batesStamp: transaction.pageMetadata.batesStamp,
            source: `${transaction.pageMetadata.filename}[${transaction.pageMetadata.filePageNumber}]`
        }
    }) ?? []

    const cols: GridColDef[] = [
        { field: 'date', headerName: 'Date', minWidth: 125, editable: true },
        { field: 'description', headerName: 'Description', minWidth: 200, editable: true },
        { field: 'amount', headerName: 'Amount', minWidth: 125, editable: true, valueFormatter: (val: number) => val.asCurrency() },
        { field: 'batesStamp', headerName: 'Bates Stamp', minWidth: 125, editable: true },
        { field: 'source', headerName: 'Source', minWidth: 200 }
    ]

    /**
     * 
     * {
    "id": 0,
    "field": "amount",
    "row": {
        "id": 0,
        "date": "12/10/2021",
        "description": "Transfer PAYPAL",
        "amount": -16184.61,
        "batesStamp": "MH003130",
        "source": "12_22_21 2.pdf[3]"
    },
    "rowNode": {
        "id": 0,
        "depth": 0,
        "parent": "auto-generated-group-node-root",
        "type": "leaf",
        "groupingKey": null
    },
    "colDef": {
        "width": 100,
        "minWidth": 125,
        "maxWidth": null,
        "hideable": true,
        "sortable": true,
        "resizable": true,
        "filterable": true,
        "groupable": true,
        "pinnable": true,
        "aggregable": true,
        "editable": true,
        "type": "string",
        "align": "left",
        "filterOperators": [
            {
                "value": "contains"
            },
            {
                "value": "doesNotContain"
            },
            {
                "value": "equals"
            },
            {
                "value": "doesNotEqual"
            },
            {
                "value": "startsWith"
            },
            {
                "value": "endsWith"
            },
            {
                "value": "isEmpty",
                "requiresFilterValue": false
            },
            {
                "value": "isNotEmpty",
                "requiresFilterValue": false
            },
            {
                "value": "isAnyOf"
            }
        ],
        "field": "amount",
        "headerName": "Amount",
        "hasBeenResized": true,
        "computedWidth": 125
    },
    "cellMode": "edit",
    "hasFocus": false,
    "tabIndex": 0,
    "value": -16184.61,
    "formattedValue": "-$16,184.61",
    "isEditable": true,
    "api": {},
    "reason": "cellFocusOut"
}
     */
    function onCellEditStop(params: any) {
        console.log(params)
    }

    return (
        <>
            <h4>accountNumber: {stmt.details?.accountNumber}</h4>
            <h4>beginningBalance: {stmt.details?.beginningBalance.asCurrency()}</h4>
            <h4>endingBalance: {stmt.details?.endingBalance.asCurrency()}</h4>
            <h4>classification: {stmt.details?.classification}</h4>
            <h4>feesCharged: {stmt.details?.feesCharged}</h4>
            <h4>interestCharged: {stmt.details?.interestCharged}</h4>
            <h4>pages: {stmt.details?.pages.map((page) => page.filePageNumber).join(",")}</h4>
            <h4>suspiciousReasons: {stmt.details?.suspiciousReasons}</h4>
            <h4>Net Transactions: {stmt.details?.transactions.reduce((total, transaction) => total + transaction.amount, 0).asCurrency()}</h4>
            <CustomizedDataGrid 
                rows={rows}
                columns={cols}
                onCellEditStop={(params) => onCellEditStop(params)}
            />
        </>
    )
}