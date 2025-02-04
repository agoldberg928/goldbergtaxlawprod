
import { Box } from "@mui/system";
import React from 'react';
import Grid from '@mui/material/Grid2';
import { AnalyzeStage, ProcessingRun } from "../model/documentAnalysis";
import { Accordion, AccordionDetails, AccordionSummary, Alert, Button, Card, CardContent, LinearProgress, LinearProgressProps, List, ListItem, Stack, Typography } from "@mui/material";
import { OpenInNew } from "@mui/icons-material";



export function AnalyzeDocumentProgressCard({stage, inputFiles, statusMessage, progress, spreadsheetId, result}: ProcessingRun) {
    const lastStatus = progress?.status
    let percentComplete = 0
    if (lastStatus?.totalPages == 0) {
        percentComplete = 100
    } else if (lastStatus && lastStatus.totalPages) {
        percentComplete = lastStatus.pagesCompleted / lastStatus.totalPages * 100
    }

    return (
        <Card>
            <CardContent sx={{textAlign: 'center'}}>
                <Typography variant="h5" gutterBottom sx={{textDecoration: "underline"}}>Run {progress?.requestId}</Typography>
                {stage === AnalyzeStage.COMPLETE && <Alert severity="success">Complete</Alert>}
                { statusMessage &&
                    <Alert severity="error">{statusMessage.toString()}</Alert>
                }
                <Grid container columns={12} spacing={2} sx={{margin: 1}}>    
                    <Grid size={{xs: 12, sm: 6}}>
                        <Stack direction="column"> 
                            <Box><Typography variant="caption"><u>Started</u></Typography></Box>
                            <Box>{progress?.createdTime.toLocaleTimeString()}</Box>
                        </Stack>
                    </Grid>
                    <Grid size={{xs: 12, sm: 6}}>
                        <Stack direction="column"> 
                            <Box><Typography variant="caption"><u>Last Update</u></Typography></Box>
                            <Box>{progress?.lastUpdatedTime.toLocaleTimeString()}</Box>
                        </Stack>
                    </Grid>
                </Grid>
                <Accordion>
                    <AccordionSummary><Typography variant="h6">Files Submitted</Typography></AccordionSummary>
                    <AccordionDetails>
                        <List>
                            {inputFiles.map((filename) => <ListItem>{filename}</ListItem>)}
                        </List>
                    </AccordionDetails>
                </Accordion>
                {stage !== AnalyzeStage.COMPLETE && <LinearProgressWithLabel value={percentComplete} />}
                {stage !== AnalyzeStage.COMPLETE && <Box sx={{marginBottom: 2}}><i>{stage}...</i></Box>}
                {/* TODO: add files used and statements created */}
            {result && 
                <Accordion>
                    <AccordionSummary><Typography variant="h6" color="success">Statements</Typography></AccordionSummary>
                    <AccordionDetails>
                        <List>
                            {Object.values(result).flatMap((statements) => statements.map((stmt) => <ListItem>{stmt}</ListItem>))}
                        </List>
                    </AccordionDetails>
                </Accordion>
            }
            {spreadsheetId && 
                <Box sx={{mt: 2}}>
                    <Button variant='contained' size='small' color='info' endIcon={<OpenInNew />} 
                    href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`} target='_blank'
                    >
                    Open in Google Sheets
                    </Button>
                </Box>
                }
            </CardContent>

        </Card>
    )
}

function LinearProgressWithLabel(props: LinearProgressProps) {
    return (
        <>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Box sx={{ width: '100%', mr: 1 }}>
                    <LinearProgress variant="determinate" {...props} />
                </Box>
                <Box sx={{ minWidth: 35 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {`${Math.round(props.value ?? NaN)}%`}
                    </Typography>
                </Box>
            </Box>
        </>
    );
}