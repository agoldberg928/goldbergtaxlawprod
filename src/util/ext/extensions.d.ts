import { UploadStatus } from "../../model/enums"
declare global {
    interface Map<K, V> {
        map<T>(mapperFunc: (key: K, value: V, idx: number) => T): Array<T>
        filter(mapperFunc: (key: K, value: V, idx: number) => boolean): Map<K, V>
        concat(other: Map<K, V>)
        remove<K>(key: K): Map<K, V>
        update<K>(key: K, value: V): Map<K, V>
    }

    interface Array<T> {
        toMap<K, V>(): Map<K, V>
        uniq(): Array<T>
    }

    interface UploadedFile {
        name: string,
        file?: File,
        uploadStatus: UploadStatus
        pagesAnalyzed?: number | undefined
        totalPages?: number | undefined
        statusMessage?: string | undefined
        statements?: Array<string> | undefined
        selected?: boolean
    }

    export interface InputFileMetadata {
        split: string
        analyzed: string
        totalpages: string
        statements: string
    }

    interface FileList {
        forEach(mapperFunc: (file: File, idx: number) => void)
    }
    // declare namespace google.accounts.oauth2 {
    //     interface TokenResponse {
    //       id_token: string;
    //     }
    //   }

    interface Number {
        asCurrency(): string
    }
}


export {}