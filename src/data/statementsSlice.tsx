import { createSlice, createAsyncThunk, createEntityAdapter, createSelector } from '@reduxjs/toolkit';

import { RootState } from '../store';
import { AZURE_STORAGE_WRAPPER, DeleteStatementProps, DownloadFileProps, DownloadStatementDetailsProps, LoadStatementsListProps } from '../client/AzureStorageClientWrapper';
import { selectCurrentClient } from './clientsSlice';
import { LOCAL_STORAGE_CLIENT } from '../client/LocalStorageClient';
import { BankStatementDetails, BankStatementInfo } from '../model/statementModel';
import { RequiresMSAL } from '../client/AzureFunctionClientWrapper';

const statementsAdapter = createEntityAdapter<BankStatementInfo>();

export const fetchStatements = createAsyncThunk(
    'statements/fetch',
    async (props: LoadStatementsListProps, { getState }) => {
        const currentClient = selectCurrentClient(getState() as RootState)
        let statements = !props.forceRefresh && LOCAL_STORAGE_CLIENT.getStatements(currentClient)
        if (!statements) {
            statements = await AZURE_STORAGE_WRAPPER.loadStatementsList(currentClient, props.msal);
            LOCAL_STORAGE_CLIENT.storeStatements(currentClient, statements)
        }
        return {
            statements: statements.sort((stmt1, stmt2) => new Date(stmt1.date).getTime() - new Date(stmt2.date).getTime()),
            lastSynced: LOCAL_STORAGE_CLIENT.getStatementsLastSyncedTime(currentClient),
        }
    }
);

export const deleteStatementThunk = createAsyncThunk(
    'statements/delete',
    async (props: RequiresMSAL, { getState }) => {
        const currentClient = selectCurrentClient(getState() as RootState)
        const selected = (getState() as RootState).statements.selected
        const promises = selected.map((filename) => AZURE_STORAGE_WRAPPER.deleteStatement(currentClient, filename, props.msal))
        await Promise.all(promises)
    }
);

const statementsSlice = createSlice({
    name: 'statements',
    initialState: statementsAdapter.getInitialState({
        loading: {} as Record<string, boolean>,
        selected: [] as string[],
        lastSynced: null as number | null,
        files: {} as Record<string, File>,
    }),
    reducers: {
        updateStatement: (state, action: { payload: Partial<BankStatementInfo> & {id: string} }) => {
            statementsAdapter.updateOne(state, {
                id: action.payload.id,
                changes: action.payload
            })
        },
        setSelectedStatements: (state, action: {payload: string[]}) => {
            state.selected = action.payload
        },
    },
    extraReducers: (builder) => {
        builder
            // FETCH FILES
            .addCase(fetchStatements.pending, (state) => {
                state.loading[fetchStatements.name] = true;
            })
            .addCase(fetchStatements.fulfilled, (state, action) => {
                state.loading[fetchStatements.name] = false;
                statementsAdapter.setAll(state, action.payload.statements);
                state.lastSynced = action.payload.lastSynced;
            })
            .addCase(fetchStatements.rejected, (state, action) => {
                state.loading[fetchStatements.name] = false;
            })
            
            // DELETE STATEMENT
            .addCase(deleteStatementThunk.pending, (state) => {
                state.loading[deleteStatementThunk.name] = true;
            })
            .addCase(deleteStatementThunk.fulfilled, (state, action) => {
                state.loading[deleteStatementThunk.name] = false;
                statementsAdapter.removeMany(state, state.selected);
                state.selected = []
            })
            .addCase(deleteStatementThunk.rejected, (state, action) => {
                state.loading[deleteStatementThunk.name] = false;
            })
    },
});

export default statementsSlice.reducer;

export const {
    selectAll: selectAllStatements,
    selectById: selectStatementById,
  } = statementsAdapter.getSelectors((state: RootState) => state.statements)

export const {
    setSelectedStatements
} = statementsSlice.actions

export const selectAllSelectedStatements = createSelector(
    (state: RootState) => state.statements.selected,
    (state: RootState) => state.statements,
    (selected, statements) => selected.map(filename => selectStatementById({ statements } as RootState, filename))
);

export const selectStatementsLastSyncedTime = createSelector(
    (state: RootState) => state.statements.lastSynced,
    (lastSynced) => lastSynced ? new Date(lastSynced) : null
);

export const selectStatementDetailsLastSyncedTime = (filename: string) => createSelector(
    (state: RootState) => LOCAL_STORAGE_CLIENT.getStatementDetailsLastSynced(selectCurrentClient(state), filename),
    (lastSynced) => lastSynced ? new Date(lastSynced) : null
);

export const selectFileForStatement = (id: string) => (state: RootState) => state.statements.files[id]

export const selectStatementsAreLoading = createSelector(
    (state: RootState) => state.statements.loading,
    (loading: Record<string, boolean>) => Object.values(loading).includes(true)
)