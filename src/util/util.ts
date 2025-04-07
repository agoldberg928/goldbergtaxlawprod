// has format like 9652:CITI CC:9_7_2023.json
export function transformStatementsField(statements: string) {
    return statements.replaceAll(".json", "").replaceAll("_", "/")
}

export function groupStatements(statements: string): { [key: string]: string[] } {
    const result = statements.split(",").reduce((res: { [key: string]: string[] }, stmt) => {
        const [account, bank, date] = stmt.split(":");
        const accountBank = `${bank}-${account}`;
        (res[accountBank] = res[accountBank] || []).push(date);

        return res;
    }, {});

    return result
}

export function groupStatementsIntoString(statements: string): string {
    const result = groupStatements(transformStatementsField(statements));
    return Object.keys(result).map(key => `${key}:[${result[key]}]`).join("\n")
}

export function areObjectUrlsForSameFile(url1: string, url2: string | undefined): boolean {
    const url1Main = url1.split("?")[0]
    const url2Main = url2?.split("?")[0]
    return url1Main === url2Main
}