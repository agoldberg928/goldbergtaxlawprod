import { UploadStatus } from "../../model/enums"
declare global {
    interface Map<K, V> {
        map<T>(mapperFunc: (key: K, value: V) => T): Array<T>
        filter(mapperFunc: (key: K, value: V) => boolean): Map<K, V>
        remove<K>(key: K): Map<K, V>
        update<K>(key: K, value: V): Map<K, V>
    }

    interface Array<T> {
        toMap<K, V>(): Map<K, V>
    }

    interface File {
        uploadStatus: UploadStatus
        pagesAnalyzed: number | undefined
        totalPages: number | undefined
        statusMessage: string | undefined
        statements: Array<string> | undefined
    }

    interface FileList {
        forEach(mapperFunc: (file: File, idx: number) => void)
    }
    declare namespace google.accounts.oauth2 {
        interface TokenResponse {
          id_token: string;
        }
      }
}


export {}