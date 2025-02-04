// has format like 9652:CITI CC:9_7_2023.json
export function transformStatementsField(statements: string) {
    return statements.replaceAll(".json", "").replaceAll("_", "/")
}