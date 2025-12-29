'use client';

/**
 * Client-only PDF Viewer wrapper
 * This ensures pdfjs-dist only loads on the client side
 */

import { useState, useCallback, useEffect } from 'react';
import type React from 'react';
// Import CSS files (will be handled by Next.js)
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
export type PDFViewerProps = {
  file: File | string | null;
  currentPage: number;
  onPageChange?: (page: number) => void;
  onDocumentLoad?: (numPages: number) => void;
};

export function PDFViewerClient(props: PDFViewerProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [Document, setDocument] = useState<React.ComponentType<any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [Page, setPage] = useState<React.ComponentType<any> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const loadPDFComponents = async () => {
      try {
        // Configure worker first
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

        // Then load react-pdf components
        const reactPdf = await import('react-pdf');

        setDocument(() => reactPdf.Document);
        setPage(() => reactPdf.Page);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load PDF components:', err);
        setError(err instanceof Error ? err.message : 'Failed to load PDF viewer');
        setIsLoading(false);
      }
    };

    loadPDFComponents();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !Document || !Page) {
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        {error || 'PDF viewer failed to load'}
      </div>
    );
  }

  return <PDFViewerImpl Document={Document} Page={Page} {...props} />;
}

interface PDFViewerImplProps extends PDFViewerProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Document: React.ComponentType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Page: React.ComponentType<any>;
}

function PDFViewerImpl({
  Document,
  Page,
  file,
  currentPage,
  onPageChange: _onPageChange,
  onDocumentLoad,
}: PDFViewerImplProps) {
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

      {!isLoading && numPages > 0 && (
        <div className="text-center py-2 text-sm text-gray-600 bg-white border-t">
          Page {currentPage} of {numPages}
        </div>
      )}
    </div>
  );
}

