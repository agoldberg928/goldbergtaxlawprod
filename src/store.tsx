import { configureStore } from '@reduxjs/toolkit'
import clientsSlice from './data/clientsSlice'
import uploadedFilesSlice from './data/uploadedFilesSlice'
import analyzeDocumentsStatusSlice from './data/analyzeDocumentsStatusSlice'
import statementsSlice from './data/statementsSlice'
import transactionsSlice from './data/transactionsSlice'
import errorsSlice from './data/errorsSlice'
import changesSlice from './data/changesSlice'

const store = configureStore({
  reducer: {
    clients: clientsSlice,
    uploadedFiles: uploadedFilesSlice,
    status: analyzeDocumentsStatusSlice,
    statements: statementsSlice,
    transactions: transactionsSlice,
    errors: errorsSlice,
    changes: changesSlice
  },
})

export default store

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
