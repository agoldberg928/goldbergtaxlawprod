import "../custom_typings/extensions"

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

Map.prototype.filter = function<K, V>(filterFunc: (key: K, value: V, idx: number) => boolean) {
    return new Map([...this].filter((entry, idx)=> filterFunc(entry[0], entry[1], idx)))
}

Map.prototype.map = function <K, V, T>(mapperFunc: (key: K, value: V, idx: number) => T): Array<T> {
    return Array.from(this).map(([key, value], idx) => mapperFunc(key, value, idx));
};

// if there are duplicate values, it will take the second
Map.prototype.concat = function<K, V>(other: Map<K, V>) {
    return new Map([...this, ...other])
}

Array.prototype.remove = function(idx: number) {
    if (Number.isNaN(idx) || typeof idx !== 'number' || idx < 0) {
        return this
    }
    return this.slice(0,idx).concat(this.slice(idx + 1))
}

Array.prototype.removeItem = function(item: any) {
    return this.filter((i) => i !== item)
}

Array.prototype.last = function() {
    return this[this.length - 1]
}

Array.prototype.mapNotNull = function<T, R>(mapperFunc: (item: T, idx: number) => R | null | undefined): Array<R> {
    return this.reduce(function(result, curr, idx) {
        const item = mapperFunc(curr, idx)
        if (item !== null && item !== undefined) {
            result.push(item)
        }
        return result
      }, []);
}

FileList.prototype.forEach = function(func: (file: File, idx: number) => void) {
    for (let index = 0; index < this.length; index++) {
        func(this[index], index)
    }
}

Number.prototype.asCurrency = function() {
    return this.toLocaleString('en-US', { style: 'currency', currency: 'USD',})
}

Number.prototype.round = function(digits = 2) {
    return Number(this.toFixed(digits))
}

String.prototype.asCurrency = function() {
    return Number(this).asCurrency()
}

String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1)
}

String.prototype.addSpacesBeforeCapitalLetters = function() {
    return this.replace(/([A-Z])/g, " $1").trim()
}


// FileList.prototype.asMap = function() {
//     const ret = new Map()
//     for (let index = 0; index < this.length; index++) {
//         ret.set(index, this[index])
//     }
//     return ret
// }
