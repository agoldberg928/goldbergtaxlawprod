import React from 'react';

export interface PdfView {
    file: File
    page?: number
  }

function getObjectUrl(pdfView: PdfView): string {
    const pageSuffix = pdfView.page ? `#page=${pdfView.page}` : "";
    return URL.createObjectURL(pdfView.file).concat(pageSuffix)
}
export function PdfViewContainer({file, page}: PdfView) {
        
    if (file) {
        return (<iframe id="pdfDisplay" src={getObjectUrl({file, page})!}/>)
    } else {
        return (<></>)
    }
}