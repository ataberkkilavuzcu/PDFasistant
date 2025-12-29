/**
 * PDF-related type definitions
 */

export interface PDFPage {
  pageNumber: number;
  text: string;
}

export interface PDFMetadata {
  title: string;
  pageCount: number;
  uploadDate: Date;
  fileSize?: number;
}

export interface PDFDocument {
  id: string;
  metadata: PDFMetadata;
  pages: PDFPage[];
}

export interface PageContext {
  currentPage: number;
  contextPages: PDFPage[];
  windowSize: number;
}

