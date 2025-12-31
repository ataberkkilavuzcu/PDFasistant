'use client';

/**
 * PDF Viewer component using react-pdf
 * Re-export the client-only wrapper with zoom and page tracking
 */

export { PDFViewerClient as PDFViewer } from './PDFViewerClient';

export type { PDFViewerProps, ZoomMode } from './PDFViewerClient';
