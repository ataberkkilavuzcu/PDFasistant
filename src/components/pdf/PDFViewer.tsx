'use client';

/**
 * PDF Viewer component using react-pdf
 */

import { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
}

interface PDFViewerProps {
  file: File | string | null;
  currentPage: number;
  onPageChange?: (page: number) => void;
  onDocumentLoad?: (numPages: number) => void;
}

export function PDFViewer({
  file,
  currentPage,
  onPageChange: _onPageChange,
  onDocumentLoad,
}: PDFViewerProps) {
  // Note: onPageChange is available for future scroll-based page detection
  void _onPageChange;
  const [numPages, setNumPages] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleDocumentLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setNumPages(numPages);
      setIsLoading(false);
      setError(null);
      onDocumentLoad?.(numPages);
    },
    [onDocumentLoad]
  );

  const handleDocumentLoadError = useCallback((err: Error) => {
    setError(err.message);
    setIsLoading(false);
  }, []);

  if (!file) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        No PDF loaded
      </div>
    );
  }

  return (
    <div className="pdf-viewer flex flex-col h-full">
      <div className="flex-1 overflow-auto flex justify-center bg-gray-100">
        <Document
          file={file}
          onLoadSuccess={handleDocumentLoadSuccess}
          onLoadError={handleDocumentLoadError}
          loading={
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          }
          error={
            <div className="text-red-500 p-4">
              Failed to load PDF: {error}
            </div>
          }
          className="pdf-document"
        >
          <Page
            pageNumber={currentPage}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            className="shadow-lg"
          />
        </Document>
      </div>

      {/* Page info */}
      {!isLoading && numPages > 0 && (
        <div className="text-center py-2 text-sm text-gray-600 bg-white border-t">
          Page {currentPage} of {numPages}
        </div>
      )}
    </div>
  );
}
