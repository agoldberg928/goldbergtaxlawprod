import { UploadedFile } from "../data/uploadedFilesSlice";
import { BankStatementDetails, BankStatementInfo } from "../model/statementModel"
import { FUNCTION_NAME_KEY, logResult } from "../util/decorators/LogResultDecorator";

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

export class LocalStorageClient {
    @logResultLocalStorage()
    getUploadedFiles(clientName: string): UploadedFile[] | null {
        const storedData = localStorage.getItem(LocalStorageKey.forClient(clientName, LOCAL_STORAGE_KEYS.INPUT_FILES))
        if (!storedData) return null
        return JSON.parse(storedData) as UploadedFile[]
    }

    getUploadedFilesLastSyncedTime(clientName: string): number | null {
        const storedData = localStorage.getItem(LocalStorageKey.forClient(clientName, LOCAL_STORAGE_KEYS.INPUT_FILES_LAST_SYNCED)) 
        if (!storedData) return null
        return Number(storedData)
    }

    storeUploadedFiles(clientName: string, files: UploadedFile[], skipSync: boolean = false) {
        localStorage.setItem(LocalStorageKey.forClient(clientName, LOCAL_STORAGE_KEYS.INPUT_FILES), JSON.stringify(files, uploadedFileReplacer)) 
        if (!skipSync) {
            localStorage.setItem(LocalStorageKey.forClient(clientName, LOCAL_STORAGE_KEYS.INPUT_FILES_LAST_SYNCED), new Date().getTime().toString()) 
        }
    }

    @logResultLocalStorage()
    getStatements(clientName: string): BankStatementInfo[] | null {
        const storedData = localStorage.getItem(LocalStorageKey.forClient(clientName, LOCAL_STORAGE_KEYS.STATEMENTS))
        if (!storedData) return null
        return JSON.parse(storedData) as BankStatementInfo[]
    }

    getStatementsLastSyncedTime(clientName: string): number | null {
        const storedData = localStorage.getItem(LocalStorageKey.forClient(clientName, LOCAL_STORAGE_KEYS.STATEMENTS_LAST_SYNCED)) 
        if (!storedData) return null
        return Number(storedData)
    }

    storeStatements(clientName: string, statements: BankStatementInfo[]) {
        localStorage.setItem(LocalStorageKey.forClient(clientName, LOCAL_STORAGE_KEYS.STATEMENTS), JSON.stringify(statements, statementDetailsReplacer)) 
        localStorage.setItem(LocalStorageKey.forClient(clientName, LOCAL_STORAGE_KEYS.STATEMENTS_LAST_SYNCED), new Date().getTime().toString())
    }

    @logResultLocalStorage({useArgs: {"filename": 1}})
    getStatementDetails(clientName: string, filename: string): BankStatementDetails | null {
        const storedData = localStorage.getItem(LocalStorageKey.forClient(clientName, LOCAL_STORAGE_KEYS.INDIVIDUAL_STATEMENT(filename))) 
        if (!storedData) return null
        return JSON.parse(storedData) as BankStatementDetails
    }
    
    getStatementDetailsLastSynced(clientName: string, filename: string): number | null {
        const storedData = localStorage.getItem(LocalStorageKey.forClient(clientName, LOCAL_STORAGE_KEYS.INDIVIDUAL_STATEMENT_LAST_SYNCED(filename))) 
        if (!storedData) return null
        return Number(storedData)
    }

    storeStatementDetails(clientName: string, filename: string, statementDetails: BankStatementDetails) {
        localStorage.setItem(LocalStorageKey.forClient(clientName, LOCAL_STORAGE_KEYS.INDIVIDUAL_STATEMENT(filename)), JSON.stringify(statementDetails)) 
        localStorage.setItem(LocalStorageKey.forClient(clientName, LOCAL_STORAGE_KEYS.INDIVIDUAL_STATEMENT_LAST_SYNCED(filename)), new Date().getTime().toString())
    }

    @logResultLocalStorage()
    getClients(): string[] | null {
        const storedData = localStorage.getItem(STATIC_LOCAL_STORAGE_KEYS.CLIENTS)
        if (!storedData) return null
        return JSON.parse(storedData) as string[]
    }

    getClientsLastSyncedTime(): number | null {
        const storedData = localStorage.getItem(STATIC_LOCAL_STORAGE_KEYS.CLIENTS_LAST_SYNCED) 
        if (!storedData) return null
        return Number(storedData)
    }

    storeClients(clients: string[]) {
        localStorage.setItem(STATIC_LOCAL_STORAGE_KEYS.CLIENTS, JSON.stringify(clients))
        localStorage.setItem(STATIC_LOCAL_STORAGE_KEYS.CLIENTS_LAST_SYNCED, new Date().getTime().toString())
    }
}

export const LOCAL_STORAGE_CLIENT = new LocalStorageClient()

// TODO: remove File from uploaded files and statement details from statement JSON.stringify
function uploadedFileReplacer(key: string, value: any) {
    if (key === "file") {
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

function logResultLocalStorage(options?: {useArgs?: Record<string, number>}) {
    return logResult({
        message: `Loaded ${FUNCTION_NAME_KEY} from local storage`, 
        useArgs: options?.useArgs, 
        functionNameTransform: (name: string) => name.replace("get", "")
    })
}
