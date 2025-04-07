import React from 'react';

export interface PdfView {
    fileObjectUrl: string | undefined
    page?: number
  }

function getObjectUrl(fileObjectUrl: string, page?: number): string {
    const pageSuffix = page ? `#page=${page}` : "";
    return fileObjectUrl.concat(pageSuffix)
}
export function PdfViewContainer({fileObjectUrl, page}: PdfView) {
        
    if (fileObjectUrl) {
        return (<iframe id="pdfDisplay" src={getObjectUrl(fileObjectUrl, page)!}/>)
    } else {
        return (<></>)
    }
}