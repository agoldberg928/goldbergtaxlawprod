import { StringOrNumber } from "../pages/statementDetails/EditableField"
import { AppDispatch, RootState } from "../store"
import { isFieldChange, isTransactionGridChange, newChange, redoChange, selectCurrentChange, selectNextChange, TransactionGridChange, undoChange } from "./changesSlice"
import { addTransaction, deleteTransaction, generateHashId, selectDetails, selectTransactionById, TransactionGridRecord, TransactionStatementDetails, updateDetails, updateTransaction } from "./transactionsSlice"


export const undoTransactionThunk = (dispatch: AppDispatch, getState: () => RootState) => {
    const change = selectCurrentChange(getState())

    if (!change) return
    
    if (isTransactionGridChange(change)) {
        if (change.oldRow && change.newRow) {
            // undo update == update
            dispatch(updateTransaction(change.oldRow))
        } else if (change.oldRow) {
            // old row only means we deleted.  Undo delete == add
            dispatch(addTransaction(change.oldRow))
        } else if (change.newRow) {
            // new row only means we added.  Undo add == delete 
            dispatch(deleteTransaction(change.newRow.id))
        } else {
            // invalid change
            return
        }
    } else if (isFieldChange(change)) {
        dispatch(updateDetails({[change.key]: change.oldValue}))
    } else {
        return
    }
    dispatch(undoChange())
}

export const redoTransactionThunk = (dispatch: AppDispatch, getState: () => RootState) => {
    const change = selectNextChange(getState())

    if (!change) return
    
    if (isTransactionGridChange(change)) {
        if (change.newRow && change.oldRow) {
            // update
            dispatch(updateTransaction(change.newRow))
        } else if (change.newRow) {
            // redo new only row == add
            dispatch(addTransaction(change.newRow))
        } else if (change.oldRow) {
            // redo old row only == delete
            dispatch(deleteTransaction(change.oldRow.id))
        } else {
            // invalid change
            return
        }
    } else if (isFieldChange(change)) {
        dispatch(updateDetails({[change.key]: change.newValue}))
    } else {
        return
    }
    dispatch(redoChange())
}

export const updateStatementFieldThunk = (key: keyof TransactionStatementDetails, newValue: StringOrNumber) => (dispatch: AppDispatch, getState: () => RootState) => {
    const oldValue = selectDetails(getState())[key]
    dispatch(updateDetails({ [key]: newValue }))
    dispatch(newChange({ key, newValue, oldValue }))
}

export const newTransactionThunk = (dispatch: AppDispatch, getState: () => RootState) => {
    const row = {id: crypto.randomUUID(), newRecord: true} as TransactionGridRecord
    dispatch(addTransaction(row as TransactionGridRecord)); 
    dispatch(newChange({ newRow: row }))
}

export const duplicateTransactionThunk = (id: string) => (dispatch: AppDispatch, getState: () => RootState) => {
    const existingTransaction = selectTransactionById(getState(), id);
    if (!existingTransaction) return;

    const duplicate = {...existingTransaction, newRecord: true, id: crypto.randomUUID(), originalHash: generateHashId(existingTransaction)}
    dispatch(addTransaction(duplicate));
    dispatch(newChange({ newRow: duplicate }))
}

export const updateTransactionThunk = (newRow: TransactionGridRecord, oldRow: TransactionGridRecord) => (dispatch: AppDispatch) => {
    console.log("handling row update [new, old]", newRow, oldRow)
    dispatch(updateTransaction(newRow))
    dispatch(newChange({ newRow, oldRow }))
}

export const deleteTransactionThunk = (id: string) => (dispatch: AppDispatch, getState: () => RootState) => {
    const existingTransaction = selectTransactionById(getState(), id);
    if (!existingTransaction) return;

    dispatch(deleteTransaction(id));
    dispatch(newChange({ oldRow: existingTransaction }));
}

export function logResult(options: {message: string, useArgs?: Record<string, number>, functionNameTransform?: (val: string) => string}) {
    return function(target: any, functionName: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = function (...args: any[]) {
            try {
                return originalMethod.apply(this, args);
            } catch(error: any) {

            }
        };

        return descriptor;
    }
}