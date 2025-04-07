import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AppDispatch, RootState } from '../store';
import { TransactionGridRecord, updateTransaction, updateDetails, TransactionStatementDetails, selectDetails } from "./transactionsSlice"
import { StringOrNumber } from '../pages/statementDetails/EditableField';

export type TransactionGridChange = {
    oldRow?: TransactionGridRecord
    newRow?: TransactionGridRecord
}

export type FieldChange = {
    key: string,
    oldValue: StringOrNumber,
    newValue: StringOrNumber
}

export function isTransactionGridChange(change: ChangeEvent): change is TransactionGridChange {
    return (change as TransactionGridChange).oldRow !== undefined || (change as TransactionGridChange).newRow !== undefined;
}

export function isFieldChange(change: ChangeEvent): change is FieldChange {
    const fieldChange = change as FieldChange
    return fieldChange.key !== undefined 
        && (fieldChange.oldValue !== undefined || fieldChange.newValue !== undefined);
}

export type ChangeEvent = FieldChange | TransactionGridChange

interface ChangesState {
    changes: ChangeEvent[]
    currentPosition: number
}


const changesSlice = createSlice({
    name: 'changes',
    initialState: {
        changes: [],
        currentPosition: -1
    } as ChangesState,
    reducers: {
        newChange: (state, action: PayloadAction<ChangeEvent>) => {
            state.currentPosition += 1
            state.changes = [...state.changes.slice(0, state.currentPosition), action.payload]
        },
        undoChange: (state) => {
            if (state.changes.length === 0 || state.currentPosition < 0) return
            state.currentPosition = state.currentPosition - 1
        },
        redoChange: (state) => {
            if (state.changes.length === 0 || state.currentPosition === state.changes.length - 1) return
            state.currentPosition = state.currentPosition + 1
        },
    }
});

export const { undoChange, redoChange, newChange } = changesSlice.actions;

export default changesSlice.reducer;

export const selectCurrentChange = (state: RootState) => state.changes.changes[state.changes.currentPosition]
export const selectNextChange = (state: RootState) => state.changes.changes[state.changes.currentPosition + 1]
export const selectCanUndo = (state: RootState) => state.changes.currentPosition >= 0
export const selectCanRedo = (state: RootState) => state.changes.currentPosition < state.changes.changes.length - 1