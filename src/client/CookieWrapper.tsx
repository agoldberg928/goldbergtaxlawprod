import { ContainerClientName } from "../model/enums";


export function setCookie(cname: CookieKey, cvalue: string, seconds?: number) {
    if (seconds) {
        const d = new Date();
        d.setTime(d.getTime() + (seconds * 1000));
        // TODO: what is path?
        document.cookie = `${cname}=${cvalue}; expires=${d.toUTCString()};path=/`;
    } else {
        document.cookie = `${cname}=${cvalue}; path=/`;
    }
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

export const STATIC_COOKIE_KEYS = {
    GOOGLE_SESSION_TOKEN: "googleToken",
    GOOGLE_USER_NAME: "googleUserName",
    GOOGLE_USER_EMAIL: "googleUserEmail",
    CURRENT_CLIENT: "currentClient"
} as const;

export type DynamicCookieKey = ContainerClientName;

export type StaticCookieKey = typeof STATIC_COOKIE_KEYS[keyof typeof STATIC_COOKIE_KEYS];

export type CookieKey = StaticCookieKey | DynamicCookieKey;

// export function getDynamicCookieKey(containerName: BlobContainerName): string {
//     switch (containerName) {
//         case BlobContainerName.INPUT:
//             return "inputSas";
//         case BlobContainerName.STATEMENTS:
//             return "statementsSas";
//         case BlobContainerName.OUTPUT:
//             return "outputSas";
//         default:
//             throw new Error(`Unknown container name: ${containerName}`);
//     }
// }