import React, { useState } from "react";
import { Box, Button, Chip, Grid2, IconButton, Stack, Typography } from "@mui/material";
import { TransactionsGrid } from "./TransactionsGrid";
import { EditableField, EditableFieldProps, StringOrNumber } from "./EditableField";
import { Redo, Refresh, Save, Undo } from "@mui/icons-material";
import { useDispatch, useSelector } from "react-redux";
import { selectDetails, selectNetTransactions, selectOriginalDetailsHash, updateDetails, selectExpectedValue, calculateSuspiciousReasons, selectLatestDetailsHash, selectLatestTransactionsHash, selectOriginalTransactionsHash } from "../../data/transactionsSlice";
import { AppDispatch } from "../../store";
import { reportError } from "../../data/errorsSlice";
import { redoTransactionThunk, undoTransactionThunk } from "../../data/changeFunctions";
import { selectCanRedo, selectCanUndo } from "../../data/changesSlice";
import { PutDocumentDataModelForm } from "../api_helper/PutDocumentDataModelForm";
import { selectCurrentClient } from "../../data/clientsSlice";
var hash = require('object-hash');

export function DetailsGrid() {
    const dispatch = useDispatch<AppDispatch>()
    const statementDetails = useSelector(selectDetails)
    const netTransactions = useSelector(selectNetTransactions)
    const currentClient = useSelector(selectCurrentClient)

    const suspiciousReasons = useSelector(calculateSuspiciousReasons)

    const detailsAreEqual = useSelector(selectLatestDetailsHash) === useSelector(selectOriginalDetailsHash) 
    const transactionsAreEqual = useSelector(selectLatestTransactionsHash) !== useSelector(selectOriginalTransactionsHash)
    const hasEdits = !detailsAreEqual || !transactionsAreEqual

    function handleSubmit() {
        console.log("handling form submission", statementDetails)
        if (suspiciousReasons.length > 0) {
            dispatch(reportError({message: "Suspicious reasons detected: " + suspiciousReasons.join("\n")}))
        }
    }

    function currencyFormatter(value: StringOrNumber) {
        return Number(value).asCurrency()
    }

    const expected = useSelector(selectExpectedValue)
    const netTransactionsColor = Number.isNaN(expected) ? 'warning' : expected === netTransactions ? 'success' : 'error'

    const canUndo = useSelector(selectCanUndo)
    const canRedo = useSelector(selectCanRedo)

    function handleKeyDown(evt: React.KeyboardEvent) {
        if (evt.key === 'Z' && (evt.ctrlKey || evt.metaKey) && evt.shiftKey && canRedo) {
            console.log("redo detected")
        } else if (evt.key === 'Z' && (evt.ctrlKey || evt.metaKey) && canUndo) {
            console.log("undo detected")
        }
    }

    return (
        <Box display="flex" flexDirection="column" gap={2} onKeyDown={handleKeyDown}>
            <Typography variant="h5">Statement Details</Typography>
            <Grid2 container spacing={2} columns={12} width="100%" sx={{ mb: (theme) => theme.spacing(2) }}>
                <Grid2 size={{xs: 12, md: 6}}>
                    <Stack direction='row'>
                        <IconButton size="small" onClick={() => dispatch(undoTransactionThunk)} disabled={!canUndo}><Undo /></IconButton>
                        <IconButton size="small" onClick={() => dispatch(redoTransactionThunk)} disabled={!canRedo}><Redo /></IconButton>
                        {/* <IconButton size="small" onClick={() => dispatch(undoTransactionThunk)} disabled={inputValue === originalValue}><Refresh /></IconButton> */}
                        <Button size='small' sx={{minWidth:40}} variant="contained" onClick={handleSubmit} disabled={!hasEdits} endIcon={<Save/>}>
                            Save Changes
                        </Button>
                    </Stack>
                    <EditableField keyName="classification" type="string"/>
                    <EditableField keyName="statementDate" type="string"/>
                    <EditableField keyName="accountNumber" type="string"/>
                    
                    <Stack direction='column'>
                        <EditableField keyName="beginningBalance" valueFormatter={currencyFormatter} type="number"/>
                        <EditableField keyName="endingBalance" valueFormatter={currencyFormatter} type="number"/>
                        <EditableField keyName="interestCharged" valueFormatter={currencyFormatter} type="number"/>
                        <EditableField keyName="feesCharged" valueFormatter={currencyFormatter} type="number"/>

                        <Stack direction='row'>
                            <Typography> Expected: {expected.asCurrency()}</Typography>
                            <Typography><Chip label={`Net Transactions: ${netTransactions.asCurrency()}`} color={netTransactionsColor}/></Typography>
                        </Stack>
                    </Stack>
                </Grid2>
                <Grid2 size={{xs: 12, md: 6}}>
                    <PutDocumentDataModelForm currentClient={currentClient} filename={statementDetails.filename}/>
                </Grid2>
            </Grid2>

            <TransactionsGrid />

        </Box>
    );
}