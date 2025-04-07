import { createSlice, createAsyncThunk, createEntityAdapter, Update, ThunkDispatch, UnknownAction, createSelector, PayloadAction } from '@reduxjs/toolkit';

import { selectCurrentClient } from './clientsSlice';
import { AnalyzeStage, ProcessingRun } from '../model/analyzeDocumentApiModel';
import { AZURE_FUNCTION_WRAPPER, PollForStatusProps, RequiresMSAL } from '../client/AzureFunctionClientWrapper';
import { AnalyzeDocumentProgress, DocumentStatus } from '../model/analyzeDocumentApiModel';
import { selectAllSelectedFiles, updateFile } from './uploadedFilesSlice';
import { RootState } from '../store';


const analyzeDocumentStatusAdapter = createEntityAdapter<ProcessingRun>();

export const submitAnalyzeDocumentsThunk = createAsyncThunk(
    'analyzeDocuments/submit',
    async (props: RequiresMSAL, { getState }) => {
        const state = getState() as RootState
        const currentClient = selectCurrentClient(state)
        const selectedFiles = selectAllSelectedFiles(state)

        const requestURL = await AZURE_FUNCTION_WRAPPER.initAnalyzeDocuments(currentClient, selectedFiles.map(file => file.name), props.msal)

        console.log('requestURL: ', requestURL)
        
        return requestURL;
    }
)

function statusPollerFunc(progress: AnalyzeDocumentProgress, dispatch: ThunkDispatch<unknown, unknown, UnknownAction>) {
    const status = progress.status
    status?.documents?.forEach((documentStatus: DocumentStatus) => {
        dispatch(updateFile({
            id: documentStatus.fileName,
            pagesAnalyzed: documentStatus.pagesCompleted,
            totalPages: documentStatus.totalPages,
        }))
    })

    dispatch(updateRunStatus({stage: status.stage as AnalyzeStage, progress: progress}))
}

export const pollAnalyzeDocumentsStatusThunk = createAsyncThunk(
    'analyzeDocuments/pollForUpdates',
    async (props: PollForStatusProps, { getState, dispatch }) => {        
        const result = await AZURE_FUNCTION_WRAPPER.pollForStatus(props.requestUrl, (progress: AnalyzeDocumentProgress) => statusPollerFunc(progress, dispatch), props.msal)
        
        return result;
    }
)

const analyzeDocumentsStatusSlice = createSlice({
    name: 'analyzeDocuments',
    initialState: analyzeDocumentStatusAdapter.getInitialState({
        loading: false,
        inProgress: false,
        latestRunId: null as string | null,
        error: null as string | null,
    }),
    reducers: {
        startRun(state, action: { payload: { files: string[], currentClient: string } }) {
            const run: ProcessingRun = {
                id: Date.now().valueOf().toString(),
                stage: AnalyzeStage.UPLOADING,
                inputFiles: action.payload.files,
                client: action.payload.currentClient
            }
            analyzeDocumentStatusAdapter.addOne(state, run)
            state.latestRunId = run.id;
            state.inProgress = true;
        },
        updateRunStatus(state, action: PayloadAction<Partial<ProcessingRun>>) {
            if (!state.latestRunId || !state.inProgress) {
                return // this should never happen
            }
            analyzeDocumentStatusAdapter.updateOne(state, {
                id: state.latestRunId!,
                changes: action.payload
            })
        },
        completeRunSuccess(state, action: PayloadAction<Partial<ProcessingRun>>) {
            if (state.latestRunId) {
                analyzeDocumentStatusAdapter.updateOne(state, {
                    id: state.latestRunId!,
                    changes: { ...action.payload, 
                        stage: AnalyzeStage.COMPLETE
                    }
                })
            }
            state.inProgress = false;
        },
        completeRunFailed(state, action: PayloadAction<string>) {
            if (state.latestRunId) {
                analyzeDocumentStatusAdapter.updateOne(state, {
                    id: state.latestRunId!,
                    changes: {error: action.payload}
                })
            }
            state.inProgress = false;
        },
    },
    // TODO: do I need to play with "error" and "loading" state in every case?
    extraReducers: (builder) => {
        builder
            // INITIAL UPDATE
            .addCase(submitAnalyzeDocumentsThunk.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(submitAnalyzeDocumentsThunk.fulfilled, (state, action) => {
                state.loading = false;
                if (!state.latestRunId) { 
                    return // this should never happen
                }
                action.payload
            })
            .addCase(submitAnalyzeDocumentsThunk.rejected, (state, action) => {
                state.loading = false;
                state.error = `Submit Analyze Documents failed:  ${action.error.message}`;
            })

            // POLL FOR UPDATES
            .addCase(pollAnalyzeDocumentsStatusThunk.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(pollAnalyzeDocumentsStatusThunk.fulfilled, (state, action) => {
                state.loading = false;
                if (!state.latestRunId) { 
                    return // this should never happen
                }
                analyzeDocumentStatusAdapter.updateOne(state, {
                    id: state.latestRunId!,
                    changes: { 
                        result: action.payload,
                        stage: AnalyzeStage.CREATING_CSV
                    },
                })
            })
            .addCase(pollAnalyzeDocumentsStatusThunk.rejected, (state, action) => {
                state.loading = false;
                state.error = `Analyze Documents failed:  ${action.error.message}`;
            })
    },
});

export default analyzeDocumentsStatusSlice.reducer;

export const {
    selectAll: selectAllProcessingRuns,
    selectById: selectProcessingRunById
  } = analyzeDocumentStatusAdapter.getSelectors((state: RootState) => state.status)

export const {
    startRun,
    completeRunSuccess,
    completeRunFailed,
    updateRunStatus
} = analyzeDocumentsStatusSlice.actions

export const selectRunInProgress = (state: RootState) => state.status.inProgress;
export const selectLatestRun = (state: RootState) => state.status.latestRunId ? selectProcessingRunById(state, state.status.latestRunId) : null;

export const selectPreviousRuns = createSelector(
    selectAllProcessingRuns, 
    selectLatestRun, // Input selectors
    (allRuns, latestRunId) => allRuns.filter(run => run && run.id !== latestRunId?.id) // Output selector
)


