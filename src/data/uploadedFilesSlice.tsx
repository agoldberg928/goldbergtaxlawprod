import { createSlice, createAsyncThunk, createEntityAdapter, Update, createSelector, PayloadAction } from '@reduxjs/toolkit';

import { RootState } from '../store';
import { AZURE_STORAGE_WRAPPER, DownladAllMetadataProps, DownladMetadataProps, DownloadFileProps, LoadUploadedFilesProps, UpdateMetadataProps, UploadFileProps, UploadFilesProps } from '../client/AzureStorageClientWrapper';
import { selectCurrentClient } from './clientsSlice';
import { LOCAL_STORAGE_CLIENT } from '../client/LocalStorageClient';
import { UploadStatus } from '../model/analyzeDocumentApiModel';
import { pollAnalyzeDocumentsStatusThunk } from './analyzeDocumentsStatusSlice';
import { deleteCookie } from '../client/CookieWrapper';
import { BlobContainerName } from '../model/blobContainerName';

export interface UploadedFile {
    id: string,
    name: string,
    fileObjectUrl?: string,
    uploadStatus: UploadStatus
    pagesAnalyzed?: number | undefined
    totalPages?: number | undefined
    statements?: Array<string> | undefined
}

const uploadedFilesAdapter = createEntityAdapter<UploadedFile>();

export const fetchUploadedFiles = createAsyncThunk(
    'files/fetch',
    async (props: LoadUploadedFilesProps, { getState }) => {
        const currentClient = selectCurrentClient(getState() as RootState)
        if (props.forceRefresh) deleteCookie(BlobContainerName.forClient(currentClient, BlobContainerName.INPUT))
        let uploadedFiles = (!props.forceRefresh && LOCAL_STORAGE_CLIENT.getUploadedFiles(currentClient))
        if (!uploadedFiles) {
            uploadedFiles = await AZURE_STORAGE_WRAPPER.loadUploadedFilesList(currentClient, props.msal);
            LOCAL_STORAGE_CLIENT.storeUploadedFiles(currentClient, uploadedFiles)
        }
        return {
            uploadedFiles: uploadedFiles.sort((file1, file2) => file1.name.localeCompare(file2.name)),
            lastSynced: LOCAL_STORAGE_CLIENT.getUploadedFilesLastSyncedTime(currentClient),
        }
    }
);

export const downloadMetadataThunk = createAsyncThunk(
    'files/downloadMetadata',
    async (props: DownladMetadataProps, { getState }) => {
        const state = getState() as RootState
        const currentClient = selectCurrentClient(state)
        return await AZURE_STORAGE_WRAPPER.downloadMetadataIfExists(currentClient, props.filename, props.msal)
    }
)

export const updateMetadataThunk = createAsyncThunk(
    'files/updateMetadata',
    async (props: UpdateMetadataProps, { getState }) => {
        const state = getState() as RootState
        const currentClient = selectCurrentClient(state)
        await AZURE_STORAGE_WRAPPER.updateInputMetadata(currentClient, props.filename, props.metadata, props.msal)
        return props.metadata
    }
)

export const uploadFileThunk = createAsyncThunk(
    'files/upload',
    async (props: UploadFileProps, { getState }) => {
        const state = getState() as RootState
        const currentClient = selectCurrentClient(state)
        const fileObj = await fetch(props.file.fileObjectUrl!).then(r => r.blob()).then(blob => new File([blob], props.file.name, { type: "application/pdf" }));
        await AZURE_STORAGE_WRAPPER.uploadFile(currentClient, fileObj, props.msal);
    }
)


const uploadedFilesSlice = createSlice({
    name: 'files',
    initialState: uploadedFilesAdapter.getInitialState({
        loading: {} as Record<string, boolean>,
        selected: [] as string[],
        lastSynced: null as number | null,
        statusMessage: {} as Record<string, string>,
    }),
    reducers: {
        addFile: uploadedFilesAdapter.addOne,
        newUploadedFile(state, action: PayloadAction<{filename: string, fileObjectUrl: string}>) {
            // if file is already included, don't do anything. Customer needs to remove it first
            if (state.ids.includes(action.payload.filename)) return
            
            uploadedFilesAdapter.addOne(state, {
                id: action.payload.filename,
                name: action.payload.filename,
                fileObjectUrl: action.payload.fileObjectUrl,
                uploadStatus: UploadStatus.PENDING,
            })
            state.selected.push(action.payload.filename)
        },
        removeFile:  (state, action: PayloadAction<string>) => {
            // need to assign the value because redux/immer doesn't recognize new array prototype methods, so need to code immutably
            state.selected = state.selected.removeItem(action.payload)
            uploadedFilesAdapter.removeOne(state, action.payload)
        },
        updateFile: (state, action: PayloadAction<Partial<UploadedFile> & {id: string}>) => {
            uploadedFilesAdapter.updateOne(state, {
                id: action.payload.id,
                changes: action.payload
            })
        },
        setSelectedFiles: (state, action: PayloadAction<string[]>) => {
            state.selected = action.payload
        },
    },
    extraReducers: (builder) => {
        // do the same thing for UPDATE METADATA and DOWNLOAD METADATA
        [updateMetadataThunk, downloadMetadataThunk].forEach((thunk) => {
            builder
                .addCase(thunk.pending, (state, action) => {
                    const id = action.meta.arg.filename
                    state.loading[`${thunk.name}/${id}`] = true;
                    delete state.statusMessage[id]
                })
                .addCase(thunk.fulfilled, (state, action) => {
                    const id = action.meta.arg.filename
                    state.loading[`${thunk.name}/${id}`] = false;
                    // if the metadata exists, the file has been uploaded already.  Also update the data
                    const metadata = action.payload
                    if (metadata) {
                        const change: Update<UploadedFile, string> = { id, changes: {} }
                        change.changes.uploadStatus = UploadStatus.SUCCESS
                        if (metadata.totalpages) {
                            change.changes.totalPages = Number(metadata.totalpages)
                            // we don't have partial analysis feature, so at this stage its either all analyzed or none
                            change.changes.pagesAnalyzed = Boolean(metadata.analyzed) ? change.changes.totalPages : 0
                        }
                        if (metadata.statements) {
                            change.changes.statements = metadata.statements.split(", ")
                        }
                        uploadedFilesAdapter.updateOne(state, change)
                    }
                    delete state.statusMessage[id]
                })
                .addCase(thunk.rejected, (state, action) => {
                    const id = action.meta.arg.filename
                    state.loading[`${thunk.name}/${id}`] = false;
                    state.statusMessage[id] = action.error.message || '';
                })
        })
        builder
            // FETCH FILES
            .addCase(fetchUploadedFiles.pending, (state) => {
                state.loading[fetchUploadedFiles.name] = true;
            })
            .addCase(fetchUploadedFiles.fulfilled, (state, action) => {
                state.loading[fetchUploadedFiles.name] = false;
                uploadedFilesAdapter.setAll(state, action.payload.uploadedFiles);
                state.lastSynced = action.payload.lastSynced;
            })
            .addCase(fetchUploadedFiles.rejected, (state, action) => {
                state.loading[fetchUploadedFiles.name] = false;
            })

            // UPLOAD FILE TO AZURE
            .addCase(uploadFileThunk.pending, (state, action) => {
                const id = action.meta.arg.file.id
                state.loading[`${uploadFileThunk.name}/${id}`] = true;
                delete state.statusMessage[id]
            })
            .addCase(uploadFileThunk.fulfilled, (state, action) => {
                const id = action.meta.arg.file.id
                state.loading[`${uploadFileThunk.name}/${id}`] = false;
                uploadedFilesAdapter.updateOne(state, { id, changes: { uploadStatus: UploadStatus.SUCCESS} })
                delete state.statusMessage[id]
            })
            .addCase(uploadFileThunk.rejected, (state, action) => {
                const id = action.meta.arg.file.id
                state.loading[`${uploadFileThunk.name}/${action.meta.arg.file.id}`] = false;
                state.statusMessage[id] = action.error.message || '';
                uploadedFilesAdapter.updateOne(state, { id, changes: { uploadStatus: UploadStatus.FAILED} })
                console.log(`Failed to upload file ${id}: ${action.error.message}`)
            })

            // when analyze documents is finished, update the files with the statements
            .addCase(pollAnalyzeDocumentsStatusThunk.fulfilled, (state, action) => {
                const changes = Object.entries(action.payload).mapNotNull(([filename, statements]) => {
                    const file = uploadedFilesAdapter.getSelectors().selectById(state, filename)
                    if (file) {
                        return { id: filename, changes: { statements: statements, pagesAnalyzed: file.totalPages! } } as any
                    } else {
                        return null
                    }
                });
                uploadedFilesAdapter.updateMany(state, changes)
            })
    },
});

export default uploadedFilesSlice.reducer;

export const {
    selectAll: selectAllFiles,
    selectById: selectFileById
  } = uploadedFilesAdapter.getSelectors((state: RootState) => state.uploadedFiles)

export const {
    addFile,
    newUploadedFile,
    removeFile,
    setSelectedFiles,
    updateFile
} = uploadedFilesSlice.actions

export const selectAllSelectedFiles = createSelector(
    (state: RootState) => state.uploadedFiles.selected,
    (state: RootState) => state.uploadedFiles,
    (selected, uploadedFiles) => selected.map(filename => selectFileById({ uploadedFiles } as RootState, filename))
);
export const selectSelectedNotUploadedFiles = createSelector(
    selectAllSelectedFiles,
    (selectedFiles) => selectedFiles.filter(file => file?.uploadStatus !== UploadStatus.SUCCESS)
);
export const selectFilesLastSyncedTime = createSelector(
    (state: RootState) => state.uploadedFiles.lastSynced,
    (lastSynced) => lastSynced ? new Date(lastSynced) : null
);

export const selectFilesAreLoading = createSelector(
    (state: RootState) => state.uploadedFiles.loading,
    (loading: Record<string, boolean>) => Object.values(loading).includes(true)
)

export const selectFileStatusMessages = (state: RootState) => state.uploadedFiles.statusMessage

export const selectFileFailures = (state: RootState) => state.uploadedFiles.statusMessage