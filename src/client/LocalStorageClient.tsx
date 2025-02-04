import { BankStatementDetails, BankStatementInfo } from "../model/statement_model"

const STATIC_LOCAL_STORAGE_KEYS = {
    CLIENTS: "clients",
    CLIENTS_LAST_SYNCED: "clientsLastSynced",
}

const LOCAL_STORAGE_KEYS = {
    INPUT_FILES: "IF",
    INPUT_FILES_LAST_SYNCED: "IFLastSynced",
    STATEMENTS: "stmts",
    STATEMENTS_LAST_SYNCED: "stmtsLastSynced",
    INDIVIDUAL_STATEMENT: (filename: string) => `indStmt-${filename}`,
    INDIVIDUAL_STATEMENT_LAST_SYNCED: (filename: string) => `indStmtLastSynced-${filename}`,
}

export type LocalStorageKeySuffix = typeof LOCAL_STORAGE_KEYS[keyof typeof LOCAL_STORAGE_KEYS];

namespace LocalStorageKey {
    export function forClient(clientName: string, key: LocalStorageKeySuffix): string {
        return `${clientName}-${key}`
    }
}

class LocalStorageClient {
    getUploadedFiles(clientName: string): UploadedFile[] | null {
        const storedData = localStorage.getItem(LocalStorageKey.forClient(clientName, LOCAL_STORAGE_KEYS.INPUT_FILES))
        if (!storedData) return null
        return JSON.parse(storedData) as UploadedFile[]
    }

    getUploadedFilesLastSyncedTime(clientName: string): Date | null {
        const storedData = localStorage.getItem(LocalStorageKey.forClient(clientName, LOCAL_STORAGE_KEYS.INPUT_FILES_LAST_SYNCED)) 
        if (!storedData) return null
        return new Date(Number(storedData))
    }

    storeUploadedFiles(clientName: string, files: UploadedFile[]) {
        localStorage.setItem(LocalStorageKey.forClient(clientName, LOCAL_STORAGE_KEYS.INPUT_FILES), JSON.stringify(files, uploadedFileReplacer)) 
        localStorage.setItem(LocalStorageKey.forClient(clientName, LOCAL_STORAGE_KEYS.INPUT_FILES_LAST_SYNCED), new Date().getTime().toString()) 
    }

    getStatements(clientName: string): BankStatementInfo[] | null {
        const storedData = localStorage.getItem(LocalStorageKey.forClient(clientName, LOCAL_STORAGE_KEYS.STATEMENTS))
        if (!storedData) return null
        return JSON.parse(storedData) as BankStatementInfo[]
    }

    getStatementsLastSyncedTime(clientName: string): Date | null {
        const storedData = localStorage.getItem(LocalStorageKey.forClient(clientName, LOCAL_STORAGE_KEYS.STATEMENTS_LAST_SYNCED)) 
        if (!storedData) return null
        return new Date(Number(storedData))
    }

    storeStatements(clientName: string, statements: BankStatementInfo[]) {
        localStorage.setItem(LocalStorageKey.forClient(clientName, LOCAL_STORAGE_KEYS.STATEMENTS), JSON.stringify(statements, statementDetailsReplacer)) 
        localStorage.setItem(LocalStorageKey.forClient(clientName, LOCAL_STORAGE_KEYS.STATEMENTS_LAST_SYNCED), new Date().getTime().toString())
    }

    getStatementDetails(clientName: string, filename: string): BankStatementDetails | null {
        const storedData = localStorage.getItem(LocalStorageKey.forClient(clientName, LOCAL_STORAGE_KEYS.INDIVIDUAL_STATEMENT(filename))) 
        if (!storedData) return null
        return JSON.parse(storedData) as BankStatementDetails
    }
    
    getStatementDetailsLastSynced(clientName: string, filename: string): Date | null {
        const storedData = localStorage.getItem(LocalStorageKey.forClient(clientName, LOCAL_STORAGE_KEYS.INDIVIDUAL_STATEMENT_LAST_SYNCED(filename))) 
        if (!storedData) return null
        return new Date(Number(storedData))
    }

    storeStatementDetails(clientName: string, filename: string, statementDetails: BankStatementDetails) {
        localStorage.setItem(LocalStorageKey.forClient(clientName, LOCAL_STORAGE_KEYS.INDIVIDUAL_STATEMENT(filename)), JSON.stringify(statementDetails)) 
        localStorage.setItem(LocalStorageKey.forClient(clientName, LOCAL_STORAGE_KEYS.INDIVIDUAL_STATEMENT_LAST_SYNCED(filename)), new Date().getTime().toString())
    }

    getClients(): string[] | null {
        const storedData = localStorage.getItem(STATIC_LOCAL_STORAGE_KEYS.CLIENTS)
        if (!storedData) return null
        return JSON.parse(storedData) as string[]
    }

    getClientsLastSyncedTime(): Date | null {
        const storedData = localStorage.getItem(STATIC_LOCAL_STORAGE_KEYS.CLIENTS_LAST_SYNCED) 
        if (!storedData) return null
        return new Date(Number(storedData))
    }

    storeClients(clients: string[]) {
        localStorage.setItem(STATIC_LOCAL_STORAGE_KEYS.CLIENTS, JSON.stringify(clients))
        localStorage.setItem(STATIC_LOCAL_STORAGE_KEYS.CLIENTS_LAST_SYNCED, new Date().getTime().toString())
    }
}

export const LOCAL_STORAGE_CLIENT = new LocalStorageClient()

// TODO: remove File from uploaded files and statement details from statement JSON.stringify
function uploadedFileReplacer(key: string, value: any) {
    if (key === "selected" || key === "file") {
      return undefined;
    }
    return value;
}

function statementDetailsReplacer(key: string, value: any) {
    if (key === "details") {
      return undefined;
    }
    return value;
}