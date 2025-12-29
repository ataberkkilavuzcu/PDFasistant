/**
 * PDF text extraction utilities using pdfjs-dist
 */

import type { PDFPage, PDFMetadata, PDFDocument } from '@/types/pdf';

/**
 * Extract text content from a single PDF page
 */
export async function extractPageText(
  pdfDocument: { getPage: (num: number) => Promise<unknown> },
  pageNumber: number
): Promise<string> {
  const page = await pdfDocument.getPage(pageNumber);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const textContent = await (page as any).getTextContent();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const text = textContent.items.map((item: any) => item.str).join(' ');
  return text;
}

/**
 * Extract text from all pages of a PDF
 */
export async function extractAllPages(
  pdfDocument: { numPages: number; getPage: (num: number) => Promise<unknown> }
): Promise<PDFPage[]> {
  const pages: PDFPage[] = [];

  for (let i = 1; i <= pdfDocument.numPages; i++) {
    const text = await extractPageText(pdfDocument, i);
    pages.push({
      pageNumber: i,
      text,
    });
  }

  return pages;
}

/**
 * Generate a unique document ID
 */
export function generateDocumentId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a PDFDocument object from extracted data
 */
export function createPDFDocument(
  id: string,
  metadata: PDFMetadata,
  pages: PDFPage[]
): PDFDocument {
  return {
    id,
    metadata,
    pages,
  };
}

