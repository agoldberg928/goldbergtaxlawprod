import { BlobContainerName } from "../model/enums";


export function setCookie(cname: CookieKey, cvalue: string, seconds: number) {
    const d = new Date();
    d.setTime(d.getTime() + (seconds * 1000));
    // TODO: what is path?
    document.cookie = `${cname}=${cvalue}; expires=${d.toUTCString()};path=/`;
    return getCookieMap()
}

function getCookieMap(): Map<CookieKey, string> {
    if (document.cookie.length == 0) {
        return new Map()
    }
    return new Map(document.cookie.split(';').map((cookie) => cookie.split(/=(.*)/s)).map((entry) => [entry[0].trim() as CookieKey, entry[1]]))
}

export function getCookie(cname: CookieKey): string | undefined {
    return getCookieMap().get(cname);
}

export function hasCookie(cname: CookieKey): boolean {
    return getCookieMap().has(cname);
}

export function deleteCookie(cname: CookieKey) {
    document.cookie = `${cname}=; expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/`;
}

(window as any).setCookie = setCookie;
(window as any).getCookieMap = getCookieMap;
(window as any).getCookie = getCookie;
(window as any).hasCookie = hasCookie;
(window as any).deleteCookie = deleteCookie;

export enum CookieKey {
    INPUT_SAS_TOKEN = "inputSas",
    OUTPUT_SAS_TOKEN = "outputSas",
    // TODO: should this be stored in one cookie?
    GOOGLE_SESSION_TOKEN = "googleToken",
    GOOGLE_USER_NAME = "googleUserName",
    GOOGLE_USER_EMAIL = "googleUserEmail",
}

export namespace CookieKey {
    export function forBlobContainer(containerName: BlobContainerName): CookieKey {
        switch(containerName) {
            case BlobContainerName.INPUT: return CookieKey.INPUT_SAS_TOKEN
            case BlobContainerName.OUTPUT: return CookieKey.OUTPUT_SAS_TOKEN
        }
    }
}