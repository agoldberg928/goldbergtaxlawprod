import { UploadStatus } from "../../model/blobContainerName"
declare global {
    interface Map<K, V> {
        map<T>(mapperFunc: (key: K, value: V, idx: number) => T): Array<T>
        filter(mapperFunc: (key: K, value: V, idx: number) => boolean): Map<K, V>
        concat(other: Map<K, V>)
        remove<K>(key: K): Map<K, V>
        update<K>(key: K, value: V): Map<K, V>
    }

    interface Array<T> {
        // toMap<K, V>(): Map<K, V>
        // uniq(): Array<T>
        remove(idx: number): Array<T>
        removeItem(item: T): Array<T>
        mapNotNull<R>(mapperFunc: (item: T, idx: number) => R | null | undefined): Array<R>
        last(): T
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
        round(): number
    }

    interface String {
        capitalize(): string
        asCurrency(): string
        addSpacesBeforeCapitalLetters(): string
    }
}


export {}