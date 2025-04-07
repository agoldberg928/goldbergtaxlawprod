import { useMsal } from '@azure/msal-react';
import { AddCircle, Cancel } from '@mui/icons-material';
import { Button, InputLabel, MenuItem, Select, SelectChangeEvent, Stack, TextField } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { newClient, changeCurrentClient, fetchClients, selectClientsLastSyncedTime, selectClientsLoading, selectCurrentClient } from '../../data/clientsSlice';
import { AppDispatch, RootState } from '../../store';
import { LastSyncTimeLabel } from './LastSyncTimeLabel';

export function ClientDropdown() {
    const clients = useSelector((state: RootState) => state.clients.clients)
    const currentClient = useSelector((state: RootState) => selectCurrentClient(state))
    const clientsLastSyncedTime = useSelector((state: RootState) => selectClientsLastSyncedTime(state))
    const dispatch = useDispatch<AppDispatch>()
    const msal = useMsal()
    
    useEffect(() => {
        dispatch(fetchClients({forceRefresh: false, msal}))
    }, [])

    const handleChange = (event: SelectChangeEvent<string>) => {
        dispatch(changeCurrentClient(event.target.value));
    }

    return (
        <>
            <InputLabel id="client-select-label">
                <h3>
                    Select Client <LastSyncTimeLabel lastSyncTime={clientsLastSyncedTime} handleClick={() => { dispatch(fetchClients({forceRefresh: true, msal})) }} loading={useSelector(selectClientsLoading)}/>
                </h3>
            </InputLabel>
            <Stack direction="row" sx={{mb: 3}}>
                <Select labelId="client-select-label" value={currentClient || ''} onChange={handleChange} >
                    {clients.map((client) => (
                        <MenuItem key={client} value={client}>
                            {client}
                        </MenuItem>
                    ))}
                </Select>

                <NewClientForm />
            </Stack>
        </>
  );
}

export function NewClientForm(): JSX.Element {
    const [clientName, setClientName] = useState<string>("");
    const dispatch = useDispatch<AppDispatch>();

    const [isOpen, setIsOpen] = useState(false)
    const msal = useMsal()
    const handleNewClient = () => {
        dispatch(newClient({clientName: clientName.trim(), msal})).unwrap()
            .then(() => setClientName(""))
            .catch(() => {})
    }

    const toggleForm = () => {
        setIsOpen(prev => !prev);
    }

    return (
        <div>
            {isOpen && 
            (
                <>
                    <TextField label="New Client Name" variant="outlined" value={clientName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {setClientName(e.target.value)}}
                        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' ? handleNewClient() : ''}
                    />
                    <Button 
                        onClick={() => { handleNewClient() }}
                        variant="contained"  color="primary"  sx={{ ml: 2 }}
                        disabled={!clientName.trim()}
                    >
                        Create Client
                    </Button>
                </>
            )}
            <Button onClick={toggleForm} variant="contained" color={isOpen ? "error" : "primary"} size='small' sx={{ ml: 2 }}>
                {isOpen ? <Cancel/> : <AddCircle/>}
            </Button>
        </div>
    );
}