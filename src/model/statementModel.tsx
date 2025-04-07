export interface BankStatementInfo {
    id: string
    stmtFilename: string
    account: string
    bankName: string
    date: string
    totalSpending: number
    totalIncomeCredits: number
    numTransactions: number
    bankType: string
    verifiedInfo: {
        suspicious: boolean
        missingChecks: boolean
        manuallyVerified: boolean
    }
    inputFileInfo: {
        name: string
        startPage: number
        endPage: number
    }
}

let a = {
    id: '1',
    stmtFilename: 'file.pdf',
    account: '',
    bankName: 'Bank of America',
}

export interface BankStatementDetails {
    id: string,
    filename: string,
    classification: string,
    date: string,
    accountNumber: string,
    bankIdentifier: string,
    beginningBalance: number,
    endingBalance: number,
    interestCharged: number,
    feesCharged: number,
    transactions: TransactionHistoryRecord[],
    pages: TransactionHistoryPageMetadata[],
    netTransactions: number,
    suspiciousReasons: string[]
}

export interface TransactionHistoryRecord {
    date?: string,
    checkNumber?: number,
    description?: string,
    amount?: number,
    pageMetadata: TransactionHistoryPageMetadata,
    checkDataModel?: CheckDataModel
}

export interface TransactionHistoryPageMetadata {
    filename: string,
    filePageNumber: number,
    batesStamp: string, 
    date: string,
    statementPageNum: number,
}

export interface CheckDataModel {
    accountNumber: string,
    checkNumber: number,
    to: string,
    description: string,
    date: string,
    amount: number,
    batesStamp: string,
    pageMetadata: PdfDocumentPageMetadata
}

export interface PdfDocumentPageMetadata {
    filename: string,
    page: number,
    classification: string
}