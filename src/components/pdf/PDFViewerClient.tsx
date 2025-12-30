'use client';

/**
 * Client-only PDF Viewer with zoom controls and page tracking
 * Features:
 * - Zoom controls (in, out, fit width, fit page)
 * - Scroll-based page detection
 * - Keyboard navigation support
 * - Dark theme styling
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type React from 'react';
import { initializePDFJS } from '@/lib/pdf/init';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

/** Zoom level presets */
const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
const DEFAULT_ZOOM = 1;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

export type ZoomMode = 'custom' | 'fit-width' | 'fit-page';

export interface PDFViewerProps {
  file: File | string | null;
  currentPage: number;
  onPageChange?: (page: number) => void;
  onDocumentLoad?: (numPages: number) => void;
  onZoomChange?: (zoom: number) => void;
  initialZoom?: number;
}

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
        await initializePDFJS();
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
      <div className="flex items-center justify-center h-full bg-[#1a1a1a]">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-white/10 border-t-primary-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading PDF viewer...</p>
        </div>
      </div>
    );
  }

  if (error || !Document || !Page) {
    return (
      <div className="flex items-center justify-center h-full bg-[#1a1a1a] text-red-400">
        <div className="text-center p-8">
          <svg className="w-16 h-16 mx-auto mb-4 text-red-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-lg font-medium mb-2">Failed to load PDF viewer</p>
          <p className="text-sm text-gray-500">{error || 'Unknown error occurred'}</p>
        </div>
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
  onPageChange,
  onDocumentLoad,
  onZoomChange,
  initialZoom = DEFAULT_ZOOM,
}: PDFViewerImplProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(initialZoom);
  const [zoomMode, setZoomMode] = useState<ZoomMode>('custom');
  const [containerWidth, setContainerWidth] = useState(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Update container width on resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Scroll to page when currentPage changes
  useEffect(() => {
    if (numPages > 0 && currentPage >= 1 && currentPage <= numPages) {
      const pageElement = pageRefs.current.get(currentPage);
      if (pageElement) {
        pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [currentPage, numPages]);

  // Document load handlers
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
    console.error('PDF load error:', err);
    let errorMessage = 'Failed to load PDF';
    
    if (err.message.includes('password')) {
      errorMessage = 'This PDF is password-protected';
    } else if (err.message.includes('Invalid')) {
      errorMessage = 'Invalid or corrupted PDF file';
    } else if (err.message.includes('Missing')) {
      errorMessage = 'PDF file not found';
    }
    
    setError(errorMessage);
    setIsLoading(false);
  }, []);

  // Zoom handlers (defined before useEffect that uses them)
  const handleZoomIn = useCallback(() => {
    setZoomMode('custom');
    setZoom((prev) => {
      const newZoom = Math.min(prev + ZOOM_STEP, MAX_ZOOM);
      onZoomChange?.(newZoom);
      return newZoom;
    });
  }, [onZoomChange]);

  const handleZoomOut = useCallback(() => {
    setZoomMode('custom');
    setZoom((prev) => {
      const newZoom = Math.max(prev - ZOOM_STEP, MIN_ZOOM);
      onZoomChange?.(newZoom);
      return newZoom;
    });
  }, [onZoomChange]);

  const handleZoomReset = useCallback(() => {
    setZoomMode('custom');
    setZoom(DEFAULT_ZOOM);
    onZoomChange?.(DEFAULT_ZOOM);
  }, [onZoomChange]);

  // Scroll-based page detection
  useEffect(() => {
    const container = containerRef.current;
    if (!container || numPages === 0) return;

    const handleScroll = () => {
      const containerRect = container.getBoundingClientRect();
      const containerCenter = containerRect.top + containerRect.height / 3;

      let closestPage = currentPage;
      let closestDistance = Infinity;

      pageRefs.current.forEach((element, pageNum) => {
        const rect = element.getBoundingClientRect();
        const pageCenter = rect.top + rect.height / 2;
        const distance = Math.abs(pageCenter - containerCenter);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestPage = pageNum;
        }
      });

      if (closestPage !== currentPage && onPageChange) {
        onPageChange(closestPage);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [numPages, currentPage, onPageChange]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
        case 'PageUp':
          if (currentPage > 1 && onPageChange) {
            onPageChange(currentPage - 1);
          }
          break;
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          if (currentPage < numPages && onPageChange) {
            onPageChange(currentPage + 1);
            e.preventDefault(); // Prevent page scroll on space
          }
          break;
        case 'Home':
          if (onPageChange) onPageChange(1);
          break;
        case 'End':
          if (onPageChange) onPageChange(numPages);
          break;
        case '+':
        case '=':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleZoomIn();
          }
          break;
        case '-':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleZoomOut();
          }
          break;
        case '0':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleZoomReset();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, numPages, onPageChange, handleZoomIn, handleZoomOut, handleZoomReset]);

  const handleZoomSelect = useCallback((level: number) => {
    setZoomMode('custom');
    setZoom(level);
    onZoomChange?.(level);
  }, [onZoomChange]);

  const handleFitWidth = useCallback(() => {
    setZoomMode('fit-width');
  }, []);

  const handleFitPage = useCallback(() => {
    setZoomMode('fit-page');
  }, []);

  // Register page ref
  const setPageRef = useCallback((pageNum: number) => (el: HTMLDivElement | null) => {
    if (el) {
      pageRefs.current.set(pageNum, el);
    } else {
      pageRefs.current.delete(pageNum);
    }
  }, []);

  if (!file) {
    return (
      <div className="flex items-center justify-center h-full bg-[#1a1a1a] text-gray-400">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p>No PDF loaded</p>
        </div>
      </div>
    );
  }

  // Calculate width based on zoom mode
  const getPageWidth = () => {
    if (zoomMode === 'fit-width' && containerWidth > 0) {
      return containerWidth - 48; // Account for padding
    }
    return undefined;
  };

  const getPageScale = () => {
    if (zoomMode === 'fit-page') {
      return undefined; // Let react-pdf auto-scale to fit
    }
    if (zoomMode === 'fit-width') {
      return undefined; // Width takes precedence
    }
    return zoom;
  };

  return (
    <div className="flex flex-col h-full bg-[#1a1a1a]">
      {/* Zoom Controls */}
      <div className="flex items-center justify-center gap-2 py-2 px-4 bg-[#252525] border-b border-white/10">
        <div className="flex items-center gap-1 bg-black/30 rounded-lg p-1">
          <button
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Zoom out (Ctrl+-)"
          >
            <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          
          <select
            value={zoom}
            onChange={(e) => handleZoomSelect(parseFloat(e.target.value))}
            className="bg-transparent text-gray-300 text-sm font-medium px-2 py-1 focus:outline-none cursor-pointer"
          >
            {ZOOM_LEVELS.map((level) => (
              <option key={level} value={level} className="bg-[#252525] text-white">
                {Math.round(level * 100)}%
              </option>
            ))}
          </select>
          
          <button
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Zoom in (Ctrl++)"
          >
            <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        <div className="w-px h-6 bg-white/10" />

        <div className="flex items-center gap-1">
          <button
            onClick={handleFitWidth}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              zoomMode === 'fit-width' 
                ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30' 
                : 'text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
            title="Fit to width"
          >
            Fit Width
          </button>
          <button
            onClick={handleFitPage}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              zoomMode === 'fit-page' 
                ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30' 
                : 'text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
            title="Fit page"
          >
            Fit Page
          </button>
          <button
            onClick={handleZoomReset}
            className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:bg-white/10 hover:text-white rounded transition-colors"
            title="Reset zoom (Ctrl+0)"
          >
            Reset
          </button>
        </div>

        {/* Page info */}
        {!isLoading && numPages > 0 && (
          <>
            <div className="w-px h-6 bg-white/10" />
            <span className="text-xs text-gray-500">
              Page {currentPage} of {numPages}
            </span>
          </>
        )}
      </div>

      {/* PDF Document */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto custom-scrollbar"
      >
        {error ? (
          <div className="flex items-center justify-center h-full text-red-400">
            <div className="text-center p-8">
              <svg className="w-16 h-16 mx-auto mb-4 text-red-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-lg font-medium mb-2">{error}</p>
              <p className="text-sm text-gray-500">Please try uploading a different file</p>
            </div>
          </div>
        ) : (
          <Document
            file={file}
            onLoadSuccess={handleDocumentLoadSuccess}
            onLoadError={handleDocumentLoadError}
            loading={
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full border-4 border-white/10 border-t-primary-500 animate-spin mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">Loading document...</p>
                </div>
              </div>
            }
            className="flex flex-col items-center py-6 gap-6"
          >
            {Array.from({ length: numPages }, (_, index) => (
              <div
                key={`page_${index + 1}`}
                ref={setPageRef(index + 1)}
                className={`relative shadow-2xl ${
                  currentPage === index + 1 ? 'ring-2 ring-primary-500/50' : ''
                }`}
              >
                <Page
                  pageNumber={index + 1}
                  scale={getPageScale()}
                  width={getPageWidth()}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  loading={
                    <div className="flex items-center justify-center bg-gray-800 min-h-[400px] min-w-[300px]">
                      <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-primary-500 animate-spin" />
                    </div>
                  }
                  className="bg-white"
                />
                {/* Page number overlay */}
                <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 rounded text-xs text-white/70">
                  {index + 1}
                </div>
              </div>
            ))}
          </Document>
        )}
      </div>
    </div>
  );
}
