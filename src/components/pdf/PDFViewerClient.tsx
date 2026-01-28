'use client';

/**
 * Client-only PDF Viewer with zoom controls and page tracking
 * Features:
 * - Zoom controls (in, out, fit width, fit page)
 * - Scroll-based page detection
 * - Keyboard navigation support
 * - Dark theme styling
 */

import { useState, useCallback, useEffect, useRef, useMemo, memo } from 'react';
import type React from 'react';
import { initializePDFJS, getPDFJS } from '@/lib/pdf/init';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

/**
 * Platform detection utility for macOS/Safari compatibility
 */
function isMacOS(): boolean {
  if (typeof window === 'undefined') return false;
  return /^Mac/.test(navigator.platform);
}

function isSafari(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  return /^((?!chrome|android).)*safari/i.test(ua);
}

function shouldUseCustomDropdown(): boolean {
  // Use custom dropdown on macOS or Safari to avoid native select rendering issues
  return isMacOS() || isSafari();
}

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
  highlightedPages?: number[]; // Pages to highlight (e.g., referenced by AI)
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

  return <PDFViewerImpl Document={Document} Page={Page} pdfjs={pdfjs} {...props} />;
}

interface PDFViewerImplProps extends PDFViewerProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Document: React.ComponentType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Page: React.ComponentType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdfjs: any;
}

// Memoized page container to prevent re-renders when other pages become current
// Only re-renders when THIS page's isCurrent status changes
const PageContainer = memo(function PageContainer({
  pageNum,
  isCurrent,
  isHighlighted,
  setPageRef,
  children,
}: {
  pageNum: number;
  isCurrent: boolean;
  isHighlighted: boolean;
  setPageRef: (pageNum: number) => (el: HTMLDivElement | null) => void;
  children: React.ReactNode;
}) {
  console.log(`[PageContainer] Render page ${pageNum}, isCurrent: ${isCurrent}, isHighlighted: ${isHighlighted}`);

  return (
    <div
      key={`page_${pageNum}`}
      ref={setPageRef(pageNum)}
      className="relative shadow-2xl"
      data-page-num={pageNum}
    >
      {/* Current page indicator ring - only rendered when isCurrent changes */}
      {isCurrent && (
        <div className="absolute -inset-[2px] -z-10 rounded-lg ring-2 ring-accent-500/50 pointer-events-none" />
      )}
      {/* Referenced page indicator ring - shown for AI-referenced pages */}
      {isHighlighted && !isCurrent && (
        <div className="absolute -inset-[2px] -z-10 rounded-lg ring-2 ring-amber-500/40 pointer-events-none" />
      )}
      {children}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render when isCurrent or isHighlighted changes for THIS specific page
  const shouldReRender = 
    prevProps.isCurrent !== nextProps.isCurrent ||
    prevProps.isHighlighted !== nextProps.isHighlighted;

  if (shouldReRender) {
    console.log(`[PageContainer] Page ${nextProps.pageNum} will re-render: isCurrent: ${prevProps.isCurrent}→${nextProps.isCurrent}, isHighlighted: ${prevProps.isHighlighted}→${nextProps.isHighlighted}`);
  }

  // Return true to SKIP re-render, false to allow re-render
  return !shouldReRender;
});

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
  highlightedPages = [],
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

  /**
   * Custom Zoom Dropdown Component
   * Used on macOS/Safari to avoid native select rendering issues
   */
  const CustomZoomDropdown = memo(function CustomZoomDropdown({
    zoom,
    onZoomChange,
  }: {
    zoom: number;
    onZoomChange: (level: number) => void;
  }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
      }
    }, [isOpen]);

    return (
      <div ref={dropdownRef} className="relative" style={{ pointerEvents: 'auto' }}>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[Zoom] Dropdown toggle clicked, current state:', isOpen);
            setIsOpen((prev) => {
              console.log('[Zoom] Toggling dropdown from', prev, 'to', !prev);
              return !prev;
            });
          }}
          className="bg-neutral-800 text-neutral-300 text-sm font-medium px-2 py-1.5 rounded focus:outline-none focus:ring-1 focus:ring-accent-500/50 cursor-pointer border border-neutral-700/50 hover:border-neutral-600 transition-colors flex items-center gap-1 min-w-[70px]"
          style={{
            minWidth: '70px',
            paddingRight: '1.5rem',
            position: 'relative',
            WebkitAppearance: 'none',
            appearance: 'none',
            cursor: 'pointer',
            pointerEvents: 'auto',
            userSelect: 'none',
          }}
          title="Select zoom level"
        >
          <span>{Math.round(zoom * 100)}%</span>
          <svg
            className={`w-3 h-3 transition-transform absolute right-2 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            style={{ color: 'rgba(161, 161, 169, 0.7)' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div 
            className="absolute top-full left-0 mt-1 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl z-[100] min-w-[70px]"
            style={{ pointerEvents: 'auto' }}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <div className="py-1">
              {ZOOM_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('[Zoom] Dropdown option clicked:', level, 'current zoom:', zoom);
                    onZoomChange(level);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                    level === zoom
                      ? 'bg-accent-500/20 text-accent-400 font-medium'
                      : 'text-neutral-300 hover:bg-neutral-700'
                  }`}
                  style={{
                    WebkitAppearance: 'none',
                    appearance: 'none',
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                    userSelect: 'none',
                  }}
                >
                  {Math.round(level * 100)}%
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  });

  const [numPages, setNumPages] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(initialZoom);
  const [zoomMode, setZoomMode] = useState<ZoomMode>('custom');
  const [containerWidth, setContainerWidth] = useState(0);
  const [scrollingToPage, setScrollingToPage] = useState<number | null>(null);

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
  // Using a ref to track the latest target page and avoid race conditions
  const targetPageRef = useRef<number | null>(null);
  // Track if we're programmatically changing pages to prevent scroll handler interference
  const isProgrammaticScrollRef = useRef(false);

  useEffect(() => {
    console.log('[Navigation] useEffect triggered', { currentPage, numPages, pageRefsSize: pageRefs.current.size });

    // Don't scroll if same page is already being scrolled to (prevent redundant scrolls)
    if (targetPageRef.current === currentPage) {
      console.log('[Navigation] Skipping - same page');
      return;
    }

    targetPageRef.current = currentPage;
    isProgrammaticScrollRef.current = true;
    setScrollingToPage(currentPage);

    if (numPages > 0 && currentPage >= 1 && currentPage <= numPages) {
      // Retry logic to handle race condition where page refs aren't ready yet
      let attempts = 0;
      const maxAttempts = 20; // 20 attempts * 50ms = 1000ms max wait
      const retryDelay = 50; // 50ms between attempts

      const tryScroll = () => {
        const pageElement = pageRefs.current.get(currentPage);
        console.log(`[Navigation] Scroll attempt ${attempts + 1}/${maxAttempts} for page ${currentPage}`, {
          found: !!pageElement,
          availablePages: Array.from(pageRefs.current.keys()).sort((a, b) => a - b),
          totalPages: numPages
        });

        if (pageElement) {
          console.log(`[Navigation] ✓ Scrolling to page ${currentPage}`);
          pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          // Keep scrollingToPage set during smooth scroll animation to prevent scroll handler interference
          // Smooth scroll typically takes 300-500ms, so we wait 600ms to be safe
          setTimeout(() => {
            setScrollingToPage(null);
            targetPageRef.current = null;
            // Clear programmatic scroll flag after scroll completes
            setTimeout(() => {
              isProgrammaticScrollRef.current = false;
            }, 100);
          }, 600);
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(tryScroll, retryDelay);
        } else {
          // Max attempts reached, give up and clean up state
          console.error(`[Navigation] ✗ Could not scroll to page ${currentPage}: page element not found after ${maxAttempts} attempts`);
          console.error('[Navigation] Available pages:', Array.from(pageRefs.current.keys()).sort((a, b) => a - b));
          setScrollingToPage(null);
          targetPageRef.current = null;
          isProgrammaticScrollRef.current = false;
        }
      };

      // Start the first attempt immediately
      tryScroll();
    } else {
      console.log('[Navigation] Skipping scroll - invalid page or no pages', { currentPage, numPages });
      setScrollingToPage(null);
      targetPageRef.current = null;
      isProgrammaticScrollRef.current = false;
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
    console.log('[Zoom] handleZoomIn called');
    setZoomMode('custom');
    setZoom((prev) => {
      const newZoom = Math.min(prev + ZOOM_STEP, MAX_ZOOM);
      console.log('[Zoom] Zoom in: prev=', prev, 'new=', newZoom);
      onZoomChange?.(newZoom);
      return newZoom;
    });
  }, [onZoomChange]);

  const handleZoomOut = useCallback(() => {
    console.log('[Zoom] handleZoomOut called');
    setZoomMode('custom');
    setZoom((prev) => {
      const newZoom = Math.max(prev - ZOOM_STEP, MIN_ZOOM);
      console.log('[Zoom] Zoom out: prev=', prev, 'new=', newZoom);
      onZoomChange?.(newZoom);
      return newZoom;
    });
  }, [onZoomChange]);

  const handleZoomReset = useCallback(() => {
    console.log('[Zoom] handleZoomReset called');
    setZoomMode('custom');
    setZoom(DEFAULT_ZOOM);
    console.log('[Zoom] Zoom reset to:', DEFAULT_ZOOM);
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
        // Wait for canvas to be rendered and get valid dimensions
        const pageCanvas = pageElement.querySelector('canvas') as HTMLCanvasElement;
        if (!pageCanvas || pageCanvas.width === 0 || pageCanvas.height === 0) {
          // Canvas not ready, retry after delay
          setTimeout(() => processPage(pageNum), 100);
          return;
        }

        // Get text content with position information
        const textContent = await pdfPage.getTextContent();
        if (!textContent || !textContent.items) return;

        // Get the viewport to calculate scale
        const viewport = pdfPage.getViewport({ scale: 1 });

        // FIX: Use CSS display size instead of intrinsic canvas size for accurate scaling
        const canvasRect = pageCanvas.getBoundingClientRect();
        const actualScale = canvasRect.width / viewport.width;

        // Get the react-pdf Page wrapper
        const reactPdfPage = pageElement.querySelector('.react-pdf__Page') as HTMLElement;
        if (!reactPdfPage) {
          console.warn(`[Highlight] .react-pdf__Page wrapper not found for page ${pageNum}`);
          return;
        }

        // FIX: Position highlight layer inside .react-pdf__Page (not as sibling)
        let highlightLayer = reactPdfPage.querySelector('.pdf-highlight-layer') as HTMLElement;
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
          // Append as child of .react-pdf__Page to align with canvas
          reactPdfPage.appendChild(highlightLayer);
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

              // FIX: Use the PDF's own width measurements for accurate highlighting
              // The itemData.width is the actual width of this text item as reported by PDF.js
              // We calculate proportional widths based on this to match the actual PDF rendering
              const totalCharsInItem = itemData.text.length;
              const charWidth = itemData.width / totalCharsInItem;

              // Calculate offset and match width using the PDF's measurement
              // This works because PDF.js already accounts for the actual font used
              const offsetX = charsIntoItem * charWidth;
              const matchWidth = matchLengthInItem * charWidth;

              matchItems.push({
                x: itemData.x + offsetX,
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

    // Debounce scroll handler to avoid too frequent updates
    let scrollTimeout: NodeJS.Timeout | null = null;

    const handleScroll = () => {
      // Don't update page while we're scrolling programmatically (avoid interference)
      if (scrollingToPage !== null || isProgrammaticScrollRef.current) {
        return;
      }

      // Debounce scroll detection to avoid rapid updates during smooth scrolling
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      scrollTimeout = setTimeout(() => {
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

        // Only update if page actually changed and we're not programmatically scrolling
        if (closestPage !== currentPage && scrollingToPage === null && onPageChange) {
          onPageChange(closestPage);
        }
      }, 100); // 100ms debounce
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [numPages, currentPage, onPageChange, scrollingToPage]);

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
    console.log('[Zoom] handleZoomSelect called with level:', level);
    setZoomMode('custom');
    setZoom(level);
    onZoomChange?.(level);
    console.log('[Zoom] Zoom state updated to:', level);
  }, [onZoomChange]);

  const handleFitWidth = useCallback(() => {
    console.log('[Zoom] handleFitWidth called');
    setZoomMode('fit-width');
    console.log('[Zoom] Zoom mode set to fit-width');
  }, []);

  const handleFitPage = useCallback(() => {
    console.log('[Zoom] handleFitPage called');
    setZoomMode('fit-page');
    console.log('[Zoom] Zoom mode set to fit-page');
  }, []);

  // Register page ref
  const setPageRef = useCallback((pageNum: number) => (el: HTMLDivElement | null) => {
    if (el) {
      pageRefs.current.set(pageNum, el);
      console.log(`[PageRef] Registered page ${pageNum}, total refs: ${pageRefs.current.size}`);
    } else {
      pageRefs.current.delete(pageNum);
      console.log(`[PageRef] Unregistered page ${pageNum}, total refs: ${pageRefs.current.size}`);
    }
  }, []);

  // Handle page load success to capture PDF page object for text content access
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlePageLoadSuccess = useCallback((page: any) => {
    // Store the PDF page object for later use in highlighting
    const pageNumber = page.pageNumber;
    pdfPageRefs.current.set(pageNumber, page);
  }, []);

  // Calculate width based on zoom mode
  const getPageWidth = useCallback(() => {
    if (zoomMode === 'fit-width' && containerWidth > 0) {
      return containerWidth - 48; // Account for padding
    }
    return undefined;
  }, [zoomMode, containerWidth]);

  const getPageScale = useCallback(() => {
    if (zoomMode === 'fit-page') {
      return undefined; // Let react-pdf auto-scale to fit
    }
    if (zoomMode === 'fit-width') {
      return undefined; // Width takes precedence
    }
    return zoom;
  }, [zoom, zoomMode]);

  // ============================================================
  // LAZY LOADING CONFIGURATION
  // ============================================================
  // Buffer size: number of pages to render before and after current page
  // Higher = smoother scrolling but more memory usage
  // Lower = less memory but may see placeholders when scrolling fast
  // Set to 5 to account for scroll detection debounce timing
  const BUFFER_SIZE = 5;

  // Calculate the range of pages that should be rendered based on current page
  const getVisiblePageRange = useCallback(() => {
    if (numPages === 0) return { start: 0, end: 0 };

    const start = Math.max(1, currentPage - BUFFER_SIZE);
    const end = Math.min(numPages, currentPage + BUFFER_SIZE);

    return { start, end };
  }, [currentPage, numPages]);

  // ============================================================
  // PAGE CACHING (LRU Cache)
  // ============================================================
  // Cache rendered page elements to avoid re-renders when scrolling back
  // This provides instant display when returning to previously viewed pages

  interface CacheEntry {
    element: React.ReactNode;
    timestamp: number;
  }

  // Store cache entries by page number
  const pageCache = useRef<Map<number, CacheEntry>>(new Map());

  // Maximum number of pages to cache
  const MAX_CACHE_SIZE = 10;

  // Get a page from cache, or null if not cached
  const getCachedPage = useCallback((pageNum: number): React.ReactNode | null => {
    const entry = pageCache.current.get(pageNum);
    if (entry) {
      // Update timestamp on access (LRU behavior)
      entry.timestamp = Date.now();
      console.log(`[PageCache] Cache hit for page ${pageNum}`);
      return entry.element;
    }
    console.log(`[PageCache] Cache miss for page ${pageNum}`);
    return null;
  }, []);

  // Add a page to cache with eviction if necessary
  const cachePage = useCallback((pageNum: number, element: React.ReactNode) => {
    // Evict oldest entry if cache is full
    if (pageCache.current.size >= MAX_CACHE_SIZE && !pageCache.current.has(pageNum)) {
      let oldestPage = pageNum;
      let oldestTime = Date.now();

      pageCache.current.forEach((entry, cachedPageNum) => {
        if (entry.timestamp < oldestTime) {
          oldestTime = entry.timestamp;
          oldestPage = cachedPageNum;
        }
      });

      pageCache.current.delete(oldestPage);
      console.log(`[PageCache] Evicted page ${oldestPage} from cache (LRU)`);
    }

    pageCache.current.set(pageNum, {
      element,
      timestamp: Date.now(),
    });
    console.log(`[PageCache] Cached page ${pageNum} (cache size: ${pageCache.current.size}/${MAX_CACHE_SIZE})`);
  }, [MAX_CACHE_SIZE]);

  // Clear cache when file changes to avoid stale data
  useEffect(() => {
    pageCache.current.clear();
    console.log('[PageCache] Cache cleared (file changed)');
  }, [file]);

  // Memoize page elements array with lazy loading optimization
  // Only render pages within the visible range (currentPage ± BUFFER_SIZE)
  // Pages outside this range get lightweight placeholders
  // Uses LRU cache to avoid re-rendering previously viewed pages
  const pageElements = useMemo(() => {
    console.log('[PageElements] Recomputing page elements with lazy loading and caching, zoom:', zoom, 'zoomMode:', zoomMode, 'highlightedPages:', highlightedPages);

    const { start: renderStart, end: renderEnd } = getVisiblePageRange();
    console.log(`[LazyLoading] Rendering pages ${renderStart}-${renderEnd} of ${numPages} (current: ${currentPage}, buffer: ${BUFFER_SIZE})`);

    return Array.from({ length: numPages }, (_, index) => {
      const pageNum = index + 1;
      const isCurrent = currentPage === pageNum;
      const isHighlighted = highlightedPages.includes(pageNum);
      const shouldRender = pageNum >= renderStart && pageNum <= renderEnd;

      // Check cache first for pages that should be rendered
      const cachedPage = shouldRender ? getCachedPage(pageNum) : null;

      // Create the rendered page element
      const createPageElement = (): React.ReactNode => (
        <>
          <Page
            pageNumber={pageNum}
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
            {pageNum}
          </div>
        </>
      );

      // If we have a cached version and should render, use it
      // Otherwise, create the element and cache it
      const pageContent = cachedPage || createPageElement();

      // Cache the newly created element for future use
      if (shouldRender && !cachedPage) {
        cachePage(pageNum, pageContent);
      }

      return (
        <PageContainer
          key={`page-${pageNum}-zoom-${zoom}-mode-${zoomMode}`}
          pageNum={pageNum}
          isCurrent={isCurrent}
          isHighlighted={isHighlighted}
          setPageRef={setPageRef}
        >
          {shouldRender ? (
            pageContent
          ) : (
            // Lightweight placeholder for off-screen pages
            <div
              className="bg-neutral-900 flex items-center justify-center min-h-[400px] min-w-[300px] border border-neutral-800"
              style={{ aspectRatio: '0.707' }} // A4 ratio
            >
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-neutral-800 flex items-center justify-center">
                  <svg className="w-6 h-6 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-sm text-neutral-600 font-medium">Page {pageNum}</p>
                <p className="text-xs text-neutral-700 mt-1">Scroll to load</p>
              </div>
            </div>
          )}
        </PageContainer>
      );
    });
  }, [numPages, currentPage, zoom, zoomMode, highlightedPages, getPageScale, getPageWidth, setPageRef, handlePageLoadSuccess, Page, getVisiblePageRange, getCachedPage, cachePage]);

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

  return (
    <div className="flex flex-col h-full bg-neutral-950">
      {/* Zoom Controls */}
      <div
        className="flex items-center justify-center gap-2 py-2 px-4 border-b border-neutral-800 relative z-10"
        style={{
          backgroundColor: 'rgba(23, 23, 26, 0.8)',
          // Fallback for browsers without backdrop-blur support
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          pointerEvents: 'auto',
          userSelect: 'none',
        }}
      >
        <div className="flex items-center gap-1 bg-neutral-800/50 rounded-lg p-1 border border-neutral-700/50" style={{ pointerEvents: 'auto' }}>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('[Zoom] Zoom out clicked, current zoom:', zoom);
              handleZoomOut();
            }}
            disabled={zoom <= MIN_ZOOM}
            className="p-1.5 rounded hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Zoom out (Ctrl+-)"
            style={{
              WebkitAppearance: 'none',
              appearance: 'none',
              cursor: zoom <= MIN_ZOOM ? 'not-allowed' : 'pointer',
              pointerEvents: 'auto',
              userSelect: 'none',
            }}
          >
            <svg className="w-4 h-4 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>

          {/* Conditional rendering: custom dropdown on macOS/Safari, native select on Windows */}
          {shouldUseCustomDropdown() ? (
            <CustomZoomDropdown zoom={zoom} onZoomChange={handleZoomSelect} />
          ) : (
            <select
              value={zoom}
              onChange={(e) => handleZoomSelect(parseFloat(e.target.value))}
              className="bg-neutral-800 text-neutral-300 text-sm font-medium px-2 py-1.5 rounded focus:outline-none focus:ring-1 focus:ring-accent-500/50 cursor-pointer border border-neutral-700/50 hover:border-neutral-600 transition-colors appearance-none pr-8 relative z-10 min-w-[70px]"
              style={{
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23a1a1aa9'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                backgroundSize: '1rem',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.5rem center',
                pointerEvents: 'auto',
                cursor: 'pointer',
                minWidth: '70px',
                paddingRight: '2rem',
              }}
            >
              {ZOOM_LEVELS.map((level) => (
                <option key={level} value={level} className="bg-neutral-900 text-neutral-100">
                  {Math.round(level * 100)}%
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('[Zoom] Zoom in clicked, current zoom:', zoom);
              handleZoomIn();
            }}
            disabled={zoom >= MAX_ZOOM}
            className="p-1.5 rounded hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Zoom in (Ctrl++)"
            style={{
              WebkitAppearance: 'none',
              appearance: 'none',
              cursor: zoom >= MAX_ZOOM ? 'not-allowed' : 'pointer',
              pointerEvents: 'auto',
              userSelect: 'none',
            }}
          >
            <svg className="w-4 h-4 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        <div className="w-px h-6 bg-neutral-700" />

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('[Zoom] Fit width clicked');
              handleFitWidth();
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              zoomMode === 'fit-width'
                ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30'
                : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
            }`}
            title="Fit to width"
            style={{
              WebkitAppearance: 'none',
              appearance: 'none',
              cursor: 'pointer',
              pointerEvents: 'auto',
              userSelect: 'none',
            }}
          >
            Fit Width
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('[Zoom] Fit page clicked');
              handleFitPage();
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              zoomMode === 'fit-page'
                ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30'
                : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
            }`}
            title="Fit page"
            style={{
              WebkitAppearance: 'none',
              appearance: 'none',
              cursor: 'pointer',
              pointerEvents: 'auto',
              userSelect: 'none',
            }}
          >
            Fit Page
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('[Zoom] Reset clicked');
              handleZoomReset();
            }}
            className="px-3 py-1.5 text-xs font-medium text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 rounded transition-colors"
            title="Reset zoom (Ctrl+0)"
            style={{
              WebkitAppearance: 'none',
              appearance: 'none',
              cursor: 'pointer',
              pointerEvents: 'auto',
              userSelect: 'none',
            }}
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
            {pageElements}
          </Document>
        )}
      </div>
    </div>
  );
}