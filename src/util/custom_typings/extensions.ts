import "../custom_typings/extensions"
import { RunStatus, UploadStatus } from "../../model/enums"

// Map.prototype.add = function<K, V>(key: K, value: V) {
//     return new Map([...this].concat(Array([key, value])))
// }

Map.prototype.remove = function<K>(key: K) {
    if (this.has(key)) {
        const ret = new Map([...this])
        ret.delete(key)
        return ret
    }
    return this
}

Map.prototype.update = function<K, V>(key: K, value: V) {
    return new Map([...this]).set(key, value)
}

Map.prototype.filter = function<K, V>(filterFunc: (key: K, value: V) => boolean) {
    return new Map([...this].filter((entry, idx)=> filterFunc(entry[0], entry[1])))
}

Map.prototype.map = function <K, V, T>(mapperFunc: (key: K, value: V) => T): Array<T> {
    return Array.from(this).map(([key, value]) => mapperFunc(key, value));
};


Array.prototype.toMap = function() {
    return new Map(this)
}

FileList.prototype.forEach = function(func: (file: File, idx: number) => void) {
    for (let index = 0; index < this.length; index++) {
        func(this[index], index)
    }
}

// FileList.prototype.asMap = function() {
//     const ret = new Map()
//     for (let index = 0; index < this.length; index++) {
//         ret.set(index, this[index])
//     }
//     return ret
// }

File.prototype.uploadStatus = UploadStatus.PENDING
