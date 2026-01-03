'use client';

/**
 * Client-only PDF Viewer with zoom controls and page tracking
 * Features:
 * - Zoom controls (in, out, fit width, fit page)
 * - Scroll-based page detection
 * - Keyboard navigation support
 * - Dark theme styling
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type React from 'react';
import { initializePDFJS, getPDFJS } from '@/lib/pdf/init';
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
  searchQuery?: string; // Search query to highlight in the PDF
}

export function PDFViewerClient(props: PDFViewerProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [Document, setDocument] = useState<React.ComponentType<any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [Page, setPage] = useState<React.ComponentType<any> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdfjs, setPdfjs] = useState<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const loadPDFComponents = async () => {
      try {
        // Ensure PDF.js is initialized and available globally
        await initializePDFJS();
        
        // Get the PDF.js module
        const pdfjsModule = await getPDFJS();
        
        // Configure worker BEFORE importing react-pdf
        const workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs';
        
        // Set on the module we got
        if (pdfjsModule.GlobalWorkerOptions) {
          pdfjsModule.GlobalWorkerOptions.workerSrc = workerSrc;
        }
        
        // Set on window.pdfjsLib as well
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const windowPdfjs = (window as any).pdfjsLib;
        if (windowPdfjs?.GlobalWorkerOptions) {
          windowPdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
        }
        
        console.log('PDF.js worker configured:', pdfjsModule.GlobalWorkerOptions?.workerSrc);
        
        // Now import react-pdf
        const reactPdf = await import('react-pdf');
        
        // Verify and re-set worker after react-pdf imports (it might reset it)
        if (pdfjsModule.GlobalWorkerOptions) {
          pdfjsModule.GlobalWorkerOptions.workerSrc = workerSrc;
        }
        if (windowPdfjs?.GlobalWorkerOptions) {
          windowPdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
        }
        
        setPdfjs(pdfjsModule);
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
      <div className="flex items-center justify-center h-full bg-neutral-950">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-neutral-800 border-t-accent-500 animate-spin mx-auto mb-4" />
          <p className="text-neutral-400 text-sm">Loading PDF viewer...</p>
        </div>
      </div>
    );
  }

  if (error || !Document || !Page) {
    return (
      <div className="flex items-center justify-center h-full bg-neutral-950 text-red-400">
        <div className="text-center p-8">
          <svg className="w-16 h-16 mx-auto mb-4 text-red-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-lg font-medium mb-2 text-red-300">Failed to load PDF viewer</p>
          <p className="text-sm text-neutral-500">{error || 'Unknown error occurred'}</p>
        </div>
      </div>
    );
  }

  return <PDFViewerImpl Document={Document} Page={Page} pdfjs={pdfjs} searchQuery={props.searchQuery} {...props} />;
}

interface PDFViewerImplProps extends PDFViewerProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Document: React.ComponentType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Page: React.ComponentType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdfjs: any;
  searchQuery?: string;
}

function PDFViewerImpl({
  Document,
  Page,
  pdfjs,
  file,
  currentPage,
  onPageChange,
  onDocumentLoad,
  onZoomChange,
  initialZoom = DEFAULT_ZOOM,
  searchQuery,
}: PDFViewerImplProps) {
  // Configure options to pass pdfjs and explicitly disable fake worker
  const documentOptions = useMemo(() => {
    const workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs';
    
    // Ensure worker is set on the pdfjs instance
    if (pdfjs?.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
    }
    
    return {
      // Pass the configured pdfjs instance
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.296/cmaps/',
      cMapPacked: true,
      // Explicitly set worker source
      workerSrc,
      // Disable standard font data to reduce load
      standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.296/standard_fonts/',
    };
  }, [pdfjs]);

  const [numPages, setNumPages] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(initialZoom);
  const [zoomMode, setZoomMode] = useState<ZoomMode>('custom');
  const [containerWidth, setContainerWidth] = useState(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const highlightRefs = useRef<Map<number, Set<HTMLElement>>>(new Map());
  // Store PDF page objects for text content access
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfPageRefs = useRef<Map<number, any>>(new Map());

  // Reset state when file changes to ensure clean loading
  useEffect(() => {
    if (file) {
      setNumPages(0);
      setIsLoading(true);
      setError(null);
      // Clear page refs when file changes
      pageRefs.current.clear();
      highlightRefs.current.clear();
      pdfPageRefs.current.clear();
    }
  }, [file]);

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
    
    // Check for worker-related errors - these might be transient during file switches
    if (err.message.includes('worker') || err.message.includes('pdf.worker') || err.message.includes('sendWithPromise')) {
      // For worker errors, try to recover by waiting a bit
      // This often happens when switching between PDFs quickly
      console.warn('PDF worker error detected, may be transient:', err.message);
      // Don't show error immediately - might resolve on retry
      // The Document component will retry automatically
      return;
    } else if (err.message.includes('password')) {
      errorMessage = 'This PDF is password-protected';
    } else if (err.message.includes('Invalid')) {
      errorMessage = 'Invalid or corrupted PDF file';
    } else if (err.message.includes('Missing') || err.message.includes('ERR_FILE_NOT_FOUND')) {
      errorMessage = 'PDF file not found. Please try uploading again.';
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

  // Text highlighting effect using PDF.js TextContent API
  // This approach creates absolute positioned overlay highlights based on text positions
  useEffect(() => {
    // Clear all existing highlights
    highlightRefs.current.forEach((highlights) => {
      highlights.forEach((el) => el.remove());
    });
    highlightRefs.current.clear();

    // Clear highlights if query is empty
    if (!searchQuery || !searchQuery.trim()) {
      return;
    }

    const normalizedQuery = searchQuery.toLowerCase().trim();
    if (normalizedQuery.length === 0) {
      return;
    }

    // Process each page that has been loaded
    const processPage = async (pageNum: number) => {
      const pdfPage = pdfPageRefs.current.get(pageNum);
      const pageElement = pageRefs.current.get(pageNum);
      if (!pdfPage || !pageElement) return;

      try {
        // Get text content with position information
        const textContent = await pdfPage.getTextContent();
        if (!textContent || !textContent.items) return;

        // Get the viewport to calculate scale
        const viewport = pdfPage.getViewport({ scale: 1 });
        const pageCanvas = pageElement.querySelector('canvas');
        if (!pageCanvas) return;

        // Calculate the actual scale being used
        const actualScale = pageCanvas.width / viewport.width;

        // Get or create highlight layer for this page
        let highlightLayer = pageElement.querySelector('.pdf-highlight-layer') as HTMLElement;
        if (!highlightLayer) {
          highlightLayer = document.createElement('div');
          highlightLayer.className = 'pdf-highlight-layer';
          highlightLayer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 10;
          `;
          // Insert after the canvas but before page number overlay
          const pageChild = pageElement.querySelector('.react-pdf__Page');
          if (pageChild && pageChild.nextSibling) {
            pageChild.parentNode?.insertBefore(highlightLayer, pageChild.nextSibling);
          } else {
            pageElement.appendChild(highlightLayer);
          }
        }

        // Clear existing highlights for this page
        highlightLayer.innerHTML = '';
        const highlights = new Set<HTMLElement>();

        // Build full text from all items and map each item to its position in the text
        const itemTexts: Array<{ text: string; width: number; height: number; x: number; y: number; item: unknown }> = [];
        const fullTextBuilder: string[] = [];

        for (const item of textContent.items) {
          const textItem = item as { str?: string; width?: number; height?: number; transform?: number[] };
          if (!textItem.str || textItem.str.trim() === '') continue;

          const transform = textItem.transform || [1, 0, 0, 1, 0, 0];
          const [, , , , x, y] = transform;
          const height = textItem.height || Math.abs(transform[3]) || 12;
          const width = textItem.width || (textItem.str.length * height * 0.5);

          itemTexts.push({
            text: textItem.str,
            width,
            height,
            x,
            y,
            item: textItem
          });
          fullTextBuilder.push(textItem.str);
        }

        const fullText = fullTextBuilder.join('');
        const escapedQuery = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const queryRegex = new RegExp(`(${escapedQuery})`, 'gi');

        // Find all matches
        const matches = Array.from(fullText.matchAll(queryRegex)) as RegExpExecArray[];
        if (matches.length === 0) return;

        // Find which items each match covers and create highlights
        for (const match of matches) {
          if (match.index === undefined) continue;

          const matchStart = match.index;
          const matchEnd = match.index + (match[0]?.length || 0);

          // Find items that are part of this match
          let currentPos = 0;
          const matchItems: Array<{ x: number; y: number; width: number; height: number }> = [];

          for (const itemData of itemTexts) {
            const itemStart = currentPos;
            const itemEnd = currentPos + itemData.text.length;

            // Check if this item overlaps with the match
            const overlapStart = Math.max(matchStart, itemStart);
            const overlapEnd = Math.min(matchEnd, itemEnd);

            if (overlapStart < overlapEnd) {
              // This item is part of the match
              const charsIntoItem = Math.max(0, overlapStart - itemStart);
              const matchLengthInItem = overlapEnd - overlapStart;

              // Calculate width for the portion of text that matches
              const charWidth = itemData.width / itemData.text.length;
              const matchWidth = matchLengthInItem * charWidth;

              matchItems.push({
                x: itemData.x + (charsIntoItem * charWidth),
                y: itemData.y,
                width: matchWidth,
                height: itemData.height
              });
            }

            currentPos = itemEnd;

            // Stop if we've passed the match end
            if (currentPos >= matchEnd) break;
          }

          // Create highlights for this match
          for (const item of matchItems) {
            const highlight = document.createElement('div');
            highlight.className = 'pdf-search-highlight';
            // PDF coordinates: (0,0) is bottom-left, need to flip Y for CSS
            // CSS: (0,0) is top-left
            const cssTop = viewport.height * actualScale - item.y * actualScale - item.height * actualScale;

            highlight.style.cssText = `
              position: absolute;
              left: ${item.x * actualScale}px;
              top: ${cssTop}px;
              height: ${item.height * actualScale}px;
              width: ${item.width * actualScale}px;
              background-color: rgba(251, 191, 36, 0.5);
              pointer-events: none;
              mix-blend-mode: multiply;
            `;

            highlightLayer.appendChild(highlight);
            highlights.add(highlight);
          }
        }

        // Store highlights for cleanup
        highlightRefs.current.set(pageNum, highlights);
      } catch (error) {
        console.error(`Error highlighting page ${pageNum}:`, error);
      }
    };

    // Process all pages
    const timeoutId = setTimeout(() => {
      pageRefs.current.forEach((_, pageNum) => {
        processPage(pageNum);
      });
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, numPages, zoom]);

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

  // Handle page load success to capture PDF page object for text content access
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlePageLoadSuccess = useCallback((page: any) => {
    // Store the PDF page object for later use in highlighting
    const pageNumber = page.pageNumber;
    pdfPageRefs.current.set(pageNumber, page);
  }, []);

  if (!file) {
    return (
      <div className="flex items-center justify-center h-full bg-neutral-950 text-neutral-400">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    <div className="flex flex-col h-full bg-neutral-950">
      {/* Zoom Controls */}
      <div className="flex items-center justify-center gap-2 py-2 px-4 bg-neutral-900/80 backdrop-blur-sm border-b border-neutral-800">
        <div className="flex items-center gap-1 bg-neutral-800/50 rounded-lg p-1 border border-neutral-700/50">
          <button
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="p-1.5 rounded hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Zoom out (Ctrl+-)"
          >
            <svg className="w-4 h-4 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>

          <select
            value={zoom}
            onChange={(e) => handleZoomSelect(parseFloat(e.target.value))}
            className="bg-transparent text-neutral-300 text-sm font-medium px-2 py-1 focus:outline-none cursor-pointer"
          >
            {ZOOM_LEVELS.map((level) => (
              <option key={level} value={level} className="bg-neutral-800 text-neutral-100">
                {Math.round(level * 100)}%
              </option>
            ))}
          </select>

          <button
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="p-1.5 rounded hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Zoom in (Ctrl++)"
          >
            <svg className="w-4 h-4 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        <div className="w-px h-6 bg-neutral-700" />

        <div className="flex items-center gap-1">
          <button
            onClick={handleFitWidth}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              zoomMode === 'fit-width'
                ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30'
                : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
            }`}
            title="Fit to width"
          >
            Fit Width
          </button>
          <button
            onClick={handleFitPage}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              zoomMode === 'fit-page'
                ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30'
                : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
            }`}
            title="Fit page"
          >
            Fit Page
          </button>
          <button
            onClick={handleZoomReset}
            className="px-3 py-1.5 text-xs font-medium text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 rounded transition-colors"
            title="Reset zoom (Ctrl+0)"
          >
            Reset
          </button>
        </div>

        {/* Page info */}
        {!isLoading && numPages > 0 && (
          <>
            <div className="w-px h-6 bg-neutral-700" />
            <span className="text-xs text-neutral-500">
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
              <p className="text-lg font-medium mb-2 text-red-300">{error}</p>
              <p className="text-sm text-neutral-500">Please try uploading a different file</p>
            </div>
          </div>
        ) : (
          <Document
            key={typeof file === 'string' ? file : file?.name || 'pdf-document'}
            file={file}
            onLoadSuccess={handleDocumentLoadSuccess}
            onLoadError={handleDocumentLoadError}
            options={documentOptions}
            loading={
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full border-4 border-neutral-800 border-t-accent-500 animate-spin mx-auto mb-3" />
                  <p className="text-neutral-400 text-sm">Loading document...</p>
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
                  currentPage === index + 1 ? 'ring-2 ring-accent-500/50' : ''
                }`}
              >
                <Page
                  pageNumber={index + 1}
                  scale={getPageScale()}
                  width={getPageWidth()}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  onLoadSuccess={handlePageLoadSuccess}
                  loading={
                    <div className="flex items-center justify-center bg-neutral-800 min-h-[400px] min-w-[300px]">
                      <div className="w-8 h-8 rounded-full border-2 border-neutral-700 border-t-accent-500 animate-spin" />
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