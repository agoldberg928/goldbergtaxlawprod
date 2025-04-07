import React, { useEffect, useRef, useState } from 'react';
import Grid from '@mui/material/Grid2';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Copyright from '../../appskeleton/components/Copyright';
import { useMsal } from '@azure/msal-react';
import { StatementsDashboardTable } from './StatementsDashboardTable';
import { BankStatementInfo } from '../../model/statementModel';
import OutflowByMonthChart from './charts/OutflowByMonthChart';
import NumberOfTransactionsChart from './charts/NumberOfTransactionsChart';
import MissingStatementsChart from './charts/MissingStatementsChart';
import { AccountsDashboardTable } from './AccountsTable';
import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Backdrop, Button, Chip, CircularProgress, SelectChangeEvent, Tab, Tabs } from '@mui/material';
import { Cached, Create, Delete, OpenInNew, RemoveCircle } from '@mui/icons-material';
import InflowByMonthChart from './charts/InflowByMonthChart';
import { LOCAL_STORAGE_CLIENT } from '../../client/LocalStorageClient';
import { ClientDropdown } from '../components/ClientDropdown';
import { StatementDetails } from '../statementDetails/StatementDetails';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { selectCurrentClient } from '../../data/clientsSlice';
import { deleteStatementThunk, fetchStatements, selectAllSelectedStatements, selectAllStatements, selectFileForStatement, selectStatementsAreLoading, selectStatementsLastSyncedTime } from '../../data/statementsSlice';
import { prepareCsv } from '../../data/analyzeDocumentFunctions';
import { LastSyncTimeLabel } from '../components/LastSyncTimeLabel';
import { ErrorDisplay } from '../components/ErrorDisplay';

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
  const msal = useMsal();
  const dispatch = useDispatch<AppDispatch>()
  // const rootState: RootState = useSelector((state: RootState) => state)

  const currentClient = useSelector(selectCurrentClient)
  const statements = useSelector(selectAllStatements)
  const selectedStatements = useSelector(selectAllSelectedStatements)
  const statementsLastSyncTime = useSelector(selectStatementsLastSyncedTime)
  const isLoading = useSelector(selectStatementsAreLoading)

  const [spreadsheetId, setSpreadsheetId] = useState<string | undefined>(undefined)

  const [currentTab, setCurrentTab] = useState<string>("statements")
  const [tabs, setTabs] = useState<Map<string, BankStatementInfo>>(new Map())

  const statementsLoader = async (forceRefresh: boolean) => {
    dispatch(fetchStatements({forceRefresh: forceRefresh, msal}))
  }

  useEffect(() => {
    statementsLoader(false)
  }, [currentClient])

  function handleTabChange(event: React.SyntheticEvent, value: any) {
    setCurrentTab(value)
  }

  function handleRemoveTab(filename: string) {
    setTabs(tabs.remove(filename))
    setCurrentTab("statements")
  }

  // TODO: extract this out into a separate file
  async function createSheet() {
    const spreadsheetId = await prepareCsv(currentClient, selectedStatements.map(stmt => stmt.stmtFilename), `${currentClient} Transactions`, msal)
    setSpreadsheetId(spreadsheetId)
  }

  return (
      <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
        <Backdrop sx={(theme) => ({ color: '#fff', zIndex: theme.zIndex.drawer + 1 })} open={isLoading}>
          <CircularProgress color="inherit" />
        </Backdrop>
        <ErrorDisplay />
        <ClientDropdown />
        <TabContext value={currentTab}>
          <TabList onChange={handleTabChange}>
            <Tab value='statements' label='Statement Info'/>
            <Tab value='accounts' label='Account Info'/>
            {tabs.map((filename, stmt) => <Tab value={filename} label={filename} icon={<RemoveCircle onClick={() => handleRemoveTab(filename)}/>} iconPosition='end'/>)}
          </TabList>
          
          <TabPanel value='statements' sx={{padding:0, paddingTop:1}}>
            <LastSyncTimeLabel lastSyncTime={statementsLastSyncTime} handleClick={() => statementsLoader(true)} loading={isLoading}/>
            {/* cards */}
            {/* <Grid
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
            </Grid> */}
            <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
              Individual Statement Details
            </Typography>
            <Box sx={{mb: 2}}>
              <Button 
                disabled={selectedStatements.length === 0}
                onClick={createSheet}
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
              <Button 
                disabled={selectedStatements.length === 0}
                onClick={() => dispatch(deleteStatementThunk({msal}))}
                variant='contained'
                endIcon={<Delete/>}
                sx= {{ml: "auto"}}
              >
                Delete Statements
              </Button>
              
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Select Statements and click "Create Spreadsheet" to generate a spreadsheet with the selected statements.
                </Typography>
              </Box>
            </Box>
            <Grid container spacing={2} columns={12}>
              <Grid size={{ xs: 12 }}>
                <StatementsDashboardTable />
              </Grid>
            </Grid>
            
          </TabPanel>
          <TabPanel value='accounts' sx={{padding:0, paddingTop:1}}>
          <LastSyncTimeLabel lastSyncTime={statementsLastSyncTime} handleClick={() => statementsLoader(true)} loading={isLoading}/>
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
            return (
              <TabPanel value={filename} id={filename}>
                <StatementDetails stmtId={filename} />
              </TabPanel>
            )
          })}
          <Copyright sx={{ my: 4 }} />
        </TabContext>
      </Box>
  );
}
