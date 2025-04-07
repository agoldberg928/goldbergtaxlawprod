import { createSlice, createAsyncThunk, createEntityAdapter, createSelector, PayloadAction } from '@reduxjs/toolkit';

import { AppDispatch, RootState } from '../store';
import { AZURE_STORAGE_WRAPPER, DownloadFileProps, DownloadStatementDetailsProps, LoadStatementsListProps } from '../client/AzureStorageClientWrapper';
import { selectCurrentClient } from './clientsSlice';
import { LOCAL_STORAGE_CLIENT } from '../client/LocalStorageClient';
var hash = require('object-hash');

export interface TransactionGridRecord {
    id: string,
    date?: string,
    description?: string,
    amount?: number,
    batesStamp?: string,
    filePageNumber: number,
    statementPageNumber?: number,
    // checkBatesStamp?: string,
    originalHash: string
    newRecord?: boolean
}

const RECORD_REQUIRED_KEYS: (keyof TransactionGridRecord)[] = ["amount", "date", "description", "batesStamp", "filePageNumber"]

export interface TransactionStatementDetails {
    filename: string,
    classification: string,
    statementDate?: string,
    accountNumber?: string,
    beginningBalance?: number,
    endingBalance?: number,
    interestCharged?: number,
    feesCharged?: number,
}

const DETAILS_REQUIRED_KEYS: (keyof TransactionStatementDetails)[] = ["filename", "classification", "statementDate", "accountNumber", "beginningBalance", "endingBalance"]

const KEYS_NOT_TO_INCLUDE_IN_HASH: (keyof TransactionGridRecord)[] = ["id", "originalHash", "newRecord"]

const transactionsAdapter = createEntityAdapter<TransactionGridRecord>();

export const downloadStatementDetailsThunk = createAsyncThunk(
    'transactions/downloadStatementDetails',
    async (props: DownloadStatementDetailsProps, { getState }) => {
        const state = getState() as RootState
        const currentClient = selectCurrentClient(state)
        let details = !props.forceRefresh && LOCAL_STORAGE_CLIENT.getStatementDetails(currentClient, props.filename)
        if (!details) {
            details = await AZURE_STORAGE_WRAPPER.loadStatementDetails(currentClient, props.filename, props.msal, true)
            LOCAL_STORAGE_CLIENT.storeStatementDetails(currentClient, props.filename, details)
        }
        // TODO: need to return the full state here
        const transactions: TransactionGridRecord[] = details.transactions.map((record) => {
            const newRecord: TransactionGridRecord = {
                id: crypto.randomUUID(),
                date: record.date,
                description: record.description,
                amount: record.amount,
                batesStamp: record.pageMetadata.batesStamp,
                filePageNumber: record.pageMetadata.filePageNumber,
                statementPageNumber: record.pageMetadata.statementPageNum,
                originalHash: '',
                // checkBatesStamp: record.checkDataModel?.batesStamp,
                newRecord: false
            }
            newRecord.originalHash = generateHashId(newRecord)
            return newRecord as TransactionGridRecord
        })

        const transactionDetails: TransactionStatementDetails = {
            filename: details.filename,
            classification: details.classification,
            statementDate: details.date,
            accountNumber: details.accountNumber,
            beginningBalance: details.beginningBalance,
            endingBalance: details.endingBalance,
            interestCharged: details.interestCharged,
            feesCharged: details.feesCharged,
        }
        return {
            transactions,
            transactionDetails,
            suspiciousReasons: details.suspiciousReasons,
            lastSynced: LOCAL_STORAGE_CLIENT.getStatementDetailsLastSynced(currentClient, props.filename)
        }
    }
);

const transactionsSlice = createSlice({
    name: 'transactions',
    initialState: transactionsAdapter.getInitialState({
        details: { filename: '', classification: ''} as TransactionStatementDetails,
        originalDetailsHash: '' as string,
        originalTransactionsHash: '' as string,
        suspiciousReasons: [] as string[], // TODO: should I calculate this on this end?
        // newDetails: emptyDetails as BankStatementDetails,
        // originalDetails: emptyDetails as BankStatementDetails,
        loading: false,
        selected: [] as string[],
        lastSynced: null as number | null,
    }),
    reducers: {
        updateDetails(state, action: PayloadAction<Partial<TransactionStatementDetails>>) {
            state.details = {...state.details, ...action.payload}
        },
        addTransaction: (state, action: PayloadAction<TransactionGridRecord>) => {
            transactionsAdapter.addOne(state, {...action.payload, newRecord: true})
        },
        updateTransaction: (state, action: PayloadAction<Partial<TransactionGridRecord> & {id: string}>) => {
            transactionsAdapter.updateOne(state, {
                id: action.payload.id,
                changes: action.payload
            })
        },
        deleteTransaction: (state, action: PayloadAction<string>) => {
            transactionsAdapter.removeOne(state, action.payload)
        },
        setSelectedTransactions: (state, action: PayloadAction<string[]>) => {
            state.selected = action.payload
        },
    },
    extraReducers: (builder) => {
        builder
            // DOWNLOAD STATEMENT DETAILS
            .addCase(downloadStatementDetailsThunk.pending, (state) => {
                state.loading = true;
            })
            .addCase(downloadStatementDetailsThunk.fulfilled, (state, action: PayloadAction<{transactions: TransactionGridRecord[], transactionDetails: TransactionStatementDetails, suspiciousReasons: string[], lastSynced: number | null}>) => {
                state.loading = false;
                state.details = action.payload.transactionDetails
                state.lastSynced = action.payload.lastSynced
                state.originalDetailsHash = hash(action.payload.transactionDetails)
                state.originalTransactionsHash = hash(action.payload.transactions)
                state.suspiciousReasons = action.payload.suspiciousReasons

                transactionsAdapter.setAll(state, Object.values(state.entities).filter((record) => record.newRecord).concat(action.payload.transactions))
            })
            .addCase(downloadStatementDetailsThunk.rejected, (state, action) => {
                state.loading = false;
            })
    },
});


export function generateHashId(row: TransactionGridRecord) {
    const clone = {...row}

    KEYS_NOT_TO_INCLUDE_IN_HASH.forEach((key) => delete clone[key])

    return hash(clone)
}

export default transactionsSlice.reducer;

export const {
    selectAll: selectAllTransactions,
    selectById: selectTransactionById,
  } = transactionsAdapter.getSelectors((state: RootState) => state.transactions)

export const {
    updateDetails,
    updateTransaction,
    addTransaction,
    deleteTransaction,
    setSelectedTransactions
} = transactionsSlice.actions

export const selectSuspiciousReasons = (state: RootState) => state.transactions.suspiciousReasons
export const selectDetails = (state: RootState) => state.transactions.details
export const selectValueFromDetails = (key: keyof TransactionStatementDetails) => createSelector(
    selectDetails,
    (details: TransactionStatementDetails) => details[key]
)
export const selectOriginalDetailsHash = (state: RootState) => state.transactions.originalDetailsHash
export const selectLatestDetailsHash = createSelector(
    selectDetails,
    (details) => hash(details)
)
export const selectOriginalTransactionsHash = (state: RootState) => state.transactions.originalTransactionsHash
export const selectLatestTransactionsHash = createSelector(
    selectAllTransactions,
    (transactions) => hash(transactions)
)

export const selectTransactionsLastSyncedTime = createSelector(
    (state: RootState) => state.transactions.lastSynced,
    (lastSynced) => lastSynced ? new Date(lastSynced) : null
);

export const selectFirstPageOfFile = createSelector(
    selectAllTransactions,
    (transactions: TransactionGridRecord[]) => transactions.sort((a,b) => a.filePageNumber - b.filePageNumber)[0]?.filePageNumber,
)

export const selectTransactionsAreLoading = (state: RootState) => state.transactions.loading

export const selectNetTransactions = createSelector(
    selectAllTransactions,
    (transactions) => transactions.reduce((total, transaction) => total + (transaction.amount || 0), 0).round()
)

export const selectExpectedValue = createSelector(
    selectValueFromDetails("beginningBalance"),
    selectValueFromDetails("endingBalance"),
    selectValueFromDetails("classification"),
    (beginningBalance, endingBalance, classification) => {
        if (beginningBalance !== undefined && endingBalance !== undefined) {
            return (classification && ((classification as string).includes("CC") )
                ? (beginningBalance as number) - (endingBalance as number)
                : (endingBalance as number) - (beginningBalance as number) ).round()
        } else {
            return NaN
        }
    }
)

export const calculateSuspiciousReasons = createSelector(
    selectAllTransactions,
    selectDetails,
    selectExpectedValue,
    selectNetTransactions,
    (transactions, statementDetails, expectedValue, netTransactions) => {
        const suspiciousReasons: string[] = []
        // TODO: maybe move this as it is a warning only, it is possible to have a statement with no transactions
        if (transactions.length === 0) {
            suspiciousReasons.push("No transactions found")
        }

        if (detailsHasMissingFields(statementDetails)) {
            suspiciousReasons.push("Statement details are missing required fields")
        }
        
        if (expectedValue !== netTransactions) {
            suspiciousReasons.push("BeginningBalance - EndingBalance != Net Transactions")
        }

        if (transactions.some(recordHasMissingFields)) {
            suspiciousReasons.push("Some transactions are missing required fields")
        }

        if (transactions.some((record) => dateOutOfRange(statementDetails.statementDate, record))) {
            suspiciousReasons.push("Some transactions are outside the statement date range")
        }

        return suspiciousReasons
        
    }
)

export const selectTransactionsWithErrors = createSelector(
    selectAllTransactions,
    selectValueFromDetails("statementDate"),
    (transactions, statementDate) => transactions.filter((record) => recordHasMissingFields(record) || dateOutOfRange(statementDate as string, record))
)


/**
 * AUXILIARY FUNCTIONS
 */
function recordHasMissingFields(record: TransactionGridRecord) {
    return RECORD_REQUIRED_KEYS.some((key) => record[key] === undefined)
}

function detailsHasMissingFields(details: TransactionStatementDetails) {
    return DETAILS_REQUIRED_KEYS.some((key) => details[key] === undefined)
}

function dateOutOfRange(statementDateString: string | undefined, record: TransactionGridRecord) {
    const statementDate = statementDateString ? new Date(statementDateString) : null
    const transactionDate = record.date ? new Date(record.date) : null
    if (statementDate && transactionDate) {
        return isMoreThanOneMonthApart(statementDate, transactionDate);
    }
    return true
}

function isMoreThanOneMonthApart(date1: Date, date2: Date): boolean {
    const yearDiff = date2.getFullYear() - date1.getFullYear();
    const monthDiff = date2.getMonth() - date1.getMonth();

    return yearDiff * 12 + monthDiff > 1;
}
