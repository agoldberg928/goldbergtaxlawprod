import { Cached } from '@mui/icons-material';
import { Select, MenuItem, FormControl, InputLabel, SelectChangeEvent, Button, TextField, Chip, Stack } from '@mui/material';
import React, { useState } from 'react';
import { LOCAL_STORAGE_CLIENT } from '../client/LocalStorageClient';
import { getLastSyncColor } from './FileUploadApp';

interface ClientDropdownProps {
    clients: string[],
    currentClient: string,
    handleChange: (event: SelectChangeEvent<string>) => void,
    handleSync: (force: boolean) => void,
    handleNewClient: (clientName: string) => void
}

export function ClientDropdown({ clients, currentClient, handleChange, handleSync, handleNewClient }: ClientDropdownProps) {
    const clientsLastSyncedTime = LOCAL_STORAGE_CLIENT.getClientsLastSyncedTime()
    const clientsLastSyncColor = getLastSyncColor(clientsLastSyncedTime)
    return (
        <>
            {/* <FormControl fullWidth> */}
            <InputLabel id="client-select-label">
                <h4>
                    Select Client 
                    <Chip size="small" color={clientsLastSyncColor} label={`Last Synced: ${clientsLastSyncedTime?.toLocaleString()}`} />
                    <Button size='small' sx={{minWidth:40}} onClick={() => handleSync(true)}><Cached/></Button>
                </h4>
            </InputLabel>
            <Stack direction="row">
                <Select
                    labelId="client-select-label"
                    value={currentClient} // Ensure there's always a valid value
                    onChange={handleChange}
                >
                    {clients.map((client) => (
                    <MenuItem key={client} value={client}>
                        {client}
                    </MenuItem>
                    ))}
                </Select>
                <NewClientForm handleNewClient={handleNewClient}/>
            </Stack>
            {/* </FormControl> */}
        </>
  );
}

interface NewClientFormProps {
    handleNewClient: (clientName: string) => void
}

export function NewClientForm({handleNewClient}: NewClientFormProps): JSX.Element {
    const [clientName, setClientName] = useState<string>("");

    return (
        <div>
            <TextField
                label="New Client Name"
                variant="outlined"
                value={clientName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {setClientName(e.target.value)}}
            />
            <Button 
                onClick={() => {
                    handleNewClient(clientName)
                    setClientName("")
                }}
                variant="contained" 
                color="primary" 
                sx={{ ml: 2 }}
            >
                Create Client
            </Button>
        </div>
    );
}