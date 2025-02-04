import React, { useEffect, useRef, useState } from 'react';
import Grid from '@mui/material/Grid2';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Copyright from '../dashboard/internals/components/Copyright';
import { AzureFunctionClientWrapper } from '../client/AzureFunctionClientWrapper';
import { AzureStorageClientWrapper } from '../client/AzureStorageClientWrapper';
import { useMsal } from '@azure/msal-react';
import { StatementsDashboardTable } from './StatementsDashboardTable';
import { BankStatementInfo } from '../model/statement_model';
import OutflowByMonthChart from './OutflowByMonthChart';
import NumberOfTransactionsChart from './NumberOfTransactionsChart';
import MissingStatementsChart from './MissingStatementsChart';
import { AccountsDashboardTable } from './AccountsTable';
import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Button, Chip, SelectChangeEvent, Tab, Tabs } from '@mui/material';
import { Cached, Create, OpenInNew, RemoveCircle } from '@mui/icons-material';
import { PdfViewContainer } from '../file_upload/PdfViewContainer';
import InflowByMonthChart from './InflowByMonthChart';
import { LOCAL_STORAGE_CLIENT } from '../client/LocalStorageClient';
import { GOOGLE_API_WRAPPER } from '../client/GoogleApiClient';
import { GridCallbackDetails, GridRowSelectionModel } from '@mui/x-data-grid';
import { getCookie, setCookie, STATIC_COOKIE_KEYS } from '../client/CookieWrapper';
import { unstable_batchedUpdates } from 'react-dom';
import { ClientDropdown } from '../file_upload/ClientDropdown';
import { StatementDetails } from './StatementDetails';
import { getLastSyncColor } from '../file_upload/FileUploadApp';

export function getXAxisLabel(date: string): string {
  return _getXAxisLabel(new Date(date))
}

function _getXAxisLabel(date: Date): string {
  return date.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
  });
}

export function getMonthsForXAxis(statements: BankStatementInfo[]): string[] {
  const [firstDate, lastDate] = [statements[0].date, statements[statements.length - 1].date]
  
  return getMonthsBetween(firstDate, lastDate)
}

export function getMonthsBetween(firstDate: string, lastDate: string): string[] {
  let currentDate = new Date(firstDate)
  const lastDateObj = new Date(lastDate)
  const dates = []
  
  do {
    dates.push(_getXAxisLabel(currentDate))
    if (currentDate.getMonth() === 11) {
      currentDate = new Date(currentDate.getFullYear() + 1, 0)
    } else {
        currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1)
    }
  } while (currentDate < lastDateObj)

  return dates
}

export default function StatementsDashboard() {
  const [clients, setClients] = useState<string[]>([])
  const [currentClient, setCurrentClient] = useState<string>(getCookie(STATIC_COOKIE_KEYS.CURRENT_CLIENT) ?? "test")
  const [statements, setStatements] = useState<BankStatementInfo[]>([])
  const [selectedStatements, setSelectedStatements] = useState<string[]>([])
  const [spreadsheetId, setSpreadsheetId] = useState<string | undefined>(undefined)

  const [currentTab, setCurrentTab] = useState<string>("statements")
  const [tabs, setTabs] = useState<Map<string, BankStatementInfo>>(new Map())
  const [files, setFiles] = useState<Map<string, File>>(new Map())

  const functionWrapperRef = useRef(new AzureFunctionClientWrapper(process.env.REACT_APP_AZURE_FUNCTION_BASE_URL!, useMsal()))
  const AZURE_FUNCTION_WRAPPER = functionWrapperRef.current

  const storageWrapperRef = useRef(new AzureStorageClientWrapper(AZURE_FUNCTION_WRAPPER, process.env.REACT_APP_STORAGE_ACCOUNT!))
  const AZURE_STORAGE_WRAPPER = storageWrapperRef.current

  const statementsLoader = async (forceRefresh: boolean) => {
    const results = await AZURE_STORAGE_WRAPPER.loadStatementsList(currentClient, forceRefresh)
    setStatements(results.sort((stmt1, stmt2) => new Date(stmt1.date).getTime() - new Date(stmt2.date).getTime()))
  }

  useEffect(() => {
    statementsLoader(false)
  }, [currentClient])

  const clientLoader = async (forceRefresh: Boolean) => {
    const clients = await AZURE_FUNCTION_WRAPPER.listClients(forceRefresh)
    setClients(clients)
  }

  useEffect(() => {
    clientLoader(false)
  }, [])

  async function handleViewClick(statement: BankStatementInfo) {
    if (!statement.details) {
      try {
        statement.details = await AZURE_STORAGE_WRAPPER.loadStatementDetails(currentClient, statement, true)
      } catch(error: any) {
        alert(error)
        console.log(error)
      }
    }
    if (!files.has(statement.stmtFilename)) {
      try {
        setFiles(new Map(files.set(statement.inputFileInfo.name, await AZURE_STORAGE_WRAPPER.downloadInputFile(currentClient, statement.inputFileInfo.name))))
      } catch(error: any) {
        alert(error)
        console.log(error)
      }
    }

    console.log(statement.details)
    setTabs(new Map(tabs.set(statement.stmtFilename, statement)))
    setCurrentTab(statement.stmtFilename)
  }

  function handleTabChange(event: React.SyntheticEvent, value: any) {
    setCurrentTab(value)
  }

  function handleClientChange(event: SelectChangeEvent<string>) {
    setCookie(STATIC_COOKIE_KEYS.CURRENT_CLIENT, event.target.value)
    setCurrentClient(event.target.value)
  }

  async function handleNewClient(clientName: string) {
    await AZURE_FUNCTION_WRAPPER.newClient(clientName)
    await clientLoader(true)
    unstable_batchedUpdates(() => {
      setCurrentClient(clientName)
      setCookie(STATIC_COOKIE_KEYS.CURRENT_CLIENT, clientName)
    })
  }

  const lastSyncedTime = LOCAL_STORAGE_CLIENT.getStatementsLastSyncedTime(currentClient)
  const hoursSinceSync = lastSyncedTime == null ? 0 : (new Date().getTime() - lastSyncedTime.getTime()) / (1000 * 60 * 60)
  let lastSyncColor: "success" | "warning" | "error"
  if (hoursSinceSync < 24) lastSyncColor = "success"
  else if (hoursSinceSync < 24 * 7) lastSyncColor = "warning"
  else lastSyncColor = "error"

  function handleRemoveTab(filename: string) {
    setTabs(tabs.remove(filename))
    setCurrentTab("statements")
  }

  function onRowSelectionModelChange(rowSelectionModel: GridRowSelectionModel, details: GridCallbackDetails) {
    setSelectedStatements(rowSelectionModel as string[])
  }

  // TODO: extract this out into a separate file
  async function prepareCsv() {
    const csvSummaryFiles = await AZURE_FUNCTION_WRAPPER.writeCsv(currentClient, selectedStatements)
    const csvFiles = await AZURE_STORAGE_WRAPPER.loadCsvFiles(currentClient, csvSummaryFiles)

    // TODO: add client name when it's available
    const spreadsheetId = await GOOGLE_API_WRAPPER.createGoogleSpreadSheet(`Transactions`, csvFiles)
    setSpreadsheetId(spreadsheetId)
  }

  return (
      <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
        <ClientDropdown clients={clients} currentClient={currentClient} handleChange={handleClientChange} handleSync={() => clientLoader(true)} handleNewClient={handleNewClient} />
        <TabContext value={currentTab}>
          <TabList onChange={handleTabChange}>
            <Tab value='statements' label='Statement Info'/>
            <Tab value='accounts' label='Account Info'/>
            {tabs.map((filename, stmt) => <Tab value={filename} label={filename} icon={<RemoveCircle onClick={() => handleRemoveTab(filename)}/>} iconPosition='end'/>)}
          </TabList>
          
          <TabPanel value='statements' sx={{padding:0, paddingTop:1}}>
          <Chip size="small" color={lastSyncColor} label={`Last Synced: ${lastSyncedTime?.toLocaleString()}`} />
          <Button size='small' sx={{minWidth:40}} onClick={() => statementsLoader(true)}><Cached/></Button>
            {/* cards */}
            <Grid
              container
              spacing={2}
              columns={12}
              sx={{ mb: (theme) => theme.spacing(2) }}
            >
              <Grid size={{ xs: 12 }}>
                {statements.length > 0 && 
                  <Stack>
                    <InflowByMonthChart statements={statements}/>
                    <OutflowByMonthChart statements={statements}/>
                    <NumberOfTransactionsChart statements={statements}/>
                  </Stack>
                }
              </Grid>
            </Grid>
            <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
              Individual Statement Details
            </Typography>
            <Box sx={{mb: 2}}>
              <Button 
                disabled={selectedStatements.length === 0}
                onClick={prepareCsv}
                variant='contained'
                endIcon={<Create/>}
              >
                Create Spreadsheet
              </Button>
              {spreadsheetId && 
                  <Button variant='contained' size='small' color='info' endIcon={<OpenInNew />} 
                  href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`} target='_blank'
                  >
                  Open in Google Sheets
                  </Button>
              }
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Select Statements and click "Create Spreadsheet" to generate a spreadsheet with the selected statements.
                </Typography>
              </Box>
            </Box>
            <Grid container spacing={2} columns={12}>
              <Grid size={{ xs: 12 }}>
                <StatementsDashboardTable statements={statements} handleViewClick={handleViewClick} onRowSelectionModelChange={onRowSelectionModelChange} selectedStatements={selectedStatements}/>
              </Grid>
            </Grid>
            
          </TabPanel>
          <TabPanel value='accounts' sx={{padding:0, paddingTop:1}}>
          <Chip size="small" color={lastSyncColor} label={`Last Synced: ${lastSyncedTime?.toLocaleString()}`} />
          <Button size='small' sx={{minWidth:40}} onClick={() => statementsLoader(true)}><Cached/></Button>
            <Grid container spacing={2} columns={12}>
              <Grid size={{ xs: 12 }}>
                {statements.length > 0 && 
                  <MissingStatementsChart statements={statements} />
                }
              </Grid>
              <Grid size={{ xs: 12 }}>
                {statements.length > 0 && 
                  <AccountsDashboardTable statements={statements} handleViewClick={() => {}}/>
                }
              </Grid>
            </Grid>
          </TabPanel>
          {tabs.map((filename, stmt) => {
            const indLastSyncedTime = LOCAL_STORAGE_CLIENT.getStatementDetailsLastSynced(currentClient, filename)
            const indLastSyncColor = getLastSyncColor(indLastSyncedTime)

            return (
              <TabPanel value={filename} id={filename}>
                <Chip size="small" color={indLastSyncColor} label={`Last Synced: ${indLastSyncedTime?.toLocaleString()}`} />
                {/* TODO: this needs to load the statement details again */}
                <Button size='small' sx={{minWidth:40}} onClick={() => statementsLoader(true)}><Cached/></Button>
                <div>
                  <StatementDetails stmt={stmt} />
                </div>

                <div className='pdf-display-container'>
                  {files.get(stmt.inputFileInfo.name) && <PdfViewContainer file={files.get(stmt.inputFileInfo.name)!} page={stmt.inputFileInfo.startPage}/>}
                </div>
              </TabPanel>
            )
          })}
          <Copyright sx={{ my: 4 }} />
        </TabContext>
      </Box>
  );
}
