/**
 * PDF text extraction utilities using pdfjs-dist
 * Supports:
 * - Progress callbacks for UI feedback
 * - Chunked processing for large PDFs (50MB+)
 * - Memory-efficient page-by-page extraction
 */

import type { PDFPage, PDFMetadata, PDFDocument } from '@/types/pdf';

/** Chunk size for large PDF processing */
const CHUNK_SIZE = 10; // Process 10 pages at a time

/** Progress callback type */
export type ProgressCallback = (progress: ExtractionProgress) => void;

/** Extraction progress info */
export interface ExtractionProgress {
  currentPage: number;
  totalPages: number;
  percentage: number;
  phase: 'loading' | 'extracting' | 'complete';
  message: string;
}

/** PDF document interface for type safety */
export interface PDFDocumentProxy {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PDFPageProxy>;
}

/** PDF page interface for type safety */
export interface PDFPageProxy {
  getTextContent: () => Promise<PDFTextContent>;
  cleanup?: () => void;
}

/** Text content from PDF.js */
interface PDFTextContent {
  items: Array<{ str: string }>;
}

/**
 * Extract text content from a single PDF page
 */
export async function extractPageText(
  pdfDocument: PDFDocumentProxy,
  pageNumber: number
): Promise<string> {
  const page = await pdfDocument.getPage(pageNumber);
  const textContent = await page.getTextContent();
  const text = textContent.items.map((item) => item.str).join(' ');
  
  // Clean up page resources to free memory
  if (page.cleanup) {
    page.cleanup();
  }
  
  return text;
}

/**
 * Extract text from all pages of a PDF with progress reporting
 * Uses chunked processing for better memory management on large PDFs
 */
export async function extractAllPages(
  pdfDocument: PDFDocumentProxy,
  onProgress?: ProgressCallback
): Promise<PDFPage[]> {
  const totalPages = pdfDocument.numPages;
  const pages: PDFPage[] = [];

  // Report initial progress
  onProgress?.({
    currentPage: 0,
    totalPages,
    percentage: 0,
    phase: 'extracting',
    message: `Starting extraction of ${totalPages} pages...`,
  });

  // Process pages in chunks for memory efficiency
  for (let chunkStart = 1; chunkStart <= totalPages; chunkStart += CHUNK_SIZE) {
    const chunkEnd = Math.min(chunkStart + CHUNK_SIZE - 1, totalPages);
    
    // Process pages in current chunk
    for (let pageNum = chunkStart; pageNum <= chunkEnd; pageNum++) {
      const text = await extractPageText(pdfDocument, pageNum);
      pages.push({
        pageNumber: pageNum,
        text,
      });

      // Report progress
      const percentage = Math.round((pageNum / totalPages) * 100);
      onProgress?.({
        currentPage: pageNum,
        totalPages,
        percentage,
        phase: 'extracting',
        message: `Extracting page ${pageNum} of ${totalPages}...`,
      });
    }

    // Allow UI to update between chunks (prevents blocking)
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  // Report completion
  onProgress?.({
    currentPage: totalPages,
    totalPages,
    percentage: 100,
    phase: 'complete',
    message: 'Extraction complete!',
  });

  return pages;
}

/**
 * Extract pages with streaming/chunked approach for very large PDFs
 * Yields pages one at a time for immediate storage
 */
export async function* extractPagesStream(
  pdfDocument: PDFDocumentProxy,
  onProgress?: ProgressCallback
): AsyncGenerator<PDFPage, void, unknown> {
  const totalPages = pdfDocument.numPages;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const text = await extractPageText(pdfDocument, pageNum);
    
    const percentage = Math.round((pageNum / totalPages) * 100);
    onProgress?.({
      currentPage: pageNum,
      totalPages,
      percentage,
      phase: 'extracting',
      message: `Extracting page ${pageNum} of ${totalPages}...`,
    });

    yield {
      pageNumber: pageNum,
      text,
    };

    // Allow UI to update
    if (pageNum % CHUNK_SIZE === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  onProgress?.({
    currentPage: totalPages,
    totalPages,
    percentage: 100,
    phase: 'complete',
    message: 'Extraction complete!',
  });
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

