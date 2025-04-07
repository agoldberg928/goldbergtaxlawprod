import React, { ReactNode } from 'react'
import { createEntityAdapter, createSlice, PayloadAction, SerializedError } from '@reduxjs/toolkit';
import { RootState } from '../store';
import { pollAnalyzeDocumentsStatusThunk, submitAnalyzeDocumentsThunk } from './analyzeDocumentsStatusSlice';
import { newClient, fetchClients } from './clientsSlice';
import { deleteStatementThunk, fetchStatements } from './statementsSlice';
import { fetchUploadedFiles } from './uploadedFilesSlice';
import { downloadStatementDetailsThunk as transactionsThunk } from "./transactionsSlice"

interface ErrorState {
    id: string,
    time: string,
    message: string
}

export interface ErrorNode {
    id: string,
    message: ReactNode
}

const errorsAdaptor = createEntityAdapter<ErrorState>();

export const reportError = (error: any) => errorSlice.actions.reportError({
    id: crypto.randomUUID(),
    time: new Date().toLocaleTimeString(),
    message: error.message
})

const errorSlice = createSlice({
    name: 'errors',
    initialState: errorsAdaptor.getInitialState(),
    reducers: {
        reportError: (state, action: PayloadAction<ErrorState>) => {
            errorsAdaptor.addOne(state, action.payload)
        },
        removeError: (state, action: PayloadAction<string>) => {
            errorsAdaptor.removeOne(state, action.payload)
        },
        clearErrors: (state) => {
            errorsAdaptor.removeAll(state)
        },
    },
    extraReducers: (builder) => {
        [
            fetchClients, 
            newClient, 
            submitAnalyzeDocumentsThunk,
            pollAnalyzeDocumentsStatusThunk,
            fetchUploadedFiles,
            fetchStatements,
            deleteStatementThunk,
            transactionsThunk,
        ].forEach((thunk) => builder.addCase(thunk.rejected, (state, action) => {
            const id = crypto.randomUUID()
            const message = getCustomerFacingMessage(thunk.typePrefix, action.meta.arg, action.error)
            errorsAdaptor.addOne(state, {id, message, time: new Date().toLocaleTimeString()})
        }))    
    }
});


export const {
    selectAll: selectAllErrors,
    selectById: selectErrorById
} = errorsAdaptor.getSelectors((state: RootState) => state.errors)

export const { removeError, clearErrors } = errorSlice.actions;

export default errorSlice.reducer;

/** 
 * Auxiliary Functions 
*/
export function replaceLineBreaksWithReactNode(str: string): ReactNode {
    const parts = str.split("\n")
    return parts.map((line, idx) => (<>{line}{idx < parts.length - 1 ? <br/> : ''}</>) )
}

function getCustomerFacingMessage(action: string, args: any, error: SerializedError){
    const nonRelevantArgs = ["msal", "forceRefresh"]
    const relevantArgs = Object.entries(args).filter(([argName]) => !nonRelevantArgs.includes(argName))
    const argMessage = relevantArgs.length ? ` for [${relevantArgs.map(([argName, argValue]) => `${argName}: ${argValue}`).join(" ,")}]` : ''
    return `Action ${action} failed${argMessage}: ${error.message}`
}