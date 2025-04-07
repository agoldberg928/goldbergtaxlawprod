import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { AZURE_FUNCTION_WRAPPER, ListClientsProps, NewClientProps } from '../client/AzureFunctionClientWrapper';
import { getCookie, setCookie, STATIC_COOKIE_KEYS } from '../client/CookieWrapper';
import { LOCAL_STORAGE_CLIENT } from '../client/LocalStorageClient';
import { RootState } from '../store';


interface ClientsState {
    clients: string[];
    currentClient: string;
    lastSynced: number | null;
    loading: boolean;
    error: string | null;
}

const initialState: ClientsState = {
    clients: [],
    currentClient: getCookie(STATIC_COOKIE_KEYS.CURRENT_CLIENT) || '',
    lastSynced: LOCAL_STORAGE_CLIENT.getClientsLastSyncedTime(),
    loading: false,
    error: null,
};

export const fetchClients = createAsyncThunk('clients/fetch', async (props: ListClientsProps) => {
    const clients = await AZURE_FUNCTION_WRAPPER.listClients(props.forceRefresh, props.msal);
    return {
        clients,
        lastSynced: LOCAL_STORAGE_CLIENT.getClientsLastSyncedTime() || null,
    }
});

export const newClient = createAsyncThunk('clients/new', async (props: NewClientProps) => {
    // TODO: validate client name
    await AZURE_FUNCTION_WRAPPER.newClient(props.clientName, props.msal);
    return props.clientName
});


const clientsSlice = createSlice({
    name: 'clients',
    initialState,
    reducers: {
        changeCurrentClient(state, action) {
            setCookie(STATIC_COOKIE_KEYS.CURRENT_CLIENT, action.payload)
            state.currentClient = action.payload;
        }
    },
    extraReducers: (builder) => {
        builder
            // FETCH CLIENTS
            .addCase(fetchClients.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchClients.fulfilled, (state, action) => {
                state.loading = false;
                state.clients = action.payload.clients;
                state.lastSynced = action.payload.lastSynced;
            })
            .addCase(fetchClients.rejected, (state, action) => {
                state.loading = false;
                state.error = `Failed to load clients: ${action.error.message}`;
            })

            // ADD CLIENT
            .addCase(newClient.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(newClient.fulfilled, (state, action) => {
                state.loading = false;
                state.clients.push(action.payload);
            })
            .addCase(newClient.rejected, (state, action) => {
                state.loading = false;
                state.error = `Failed to add client: ${action.error.message}`;
            })
    },
});

export const { changeCurrentClient } = clientsSlice.actions;


export default clientsSlice.reducer;

export const selectCurrentClient = (state: RootState) => state.clients.currentClient

export const selectClientsLastSyncedTime = createSelector(
    (state: RootState) => state.clients.lastSynced,
    (lastSynced) => lastSynced ? new Date(lastSynced) : null
)

export const selectClientsLoading = (state: RootState) => state.clients.loading