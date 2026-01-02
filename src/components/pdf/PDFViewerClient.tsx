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
    
    // Check for worker-related errors
    if (err.message.includes('worker') || err.message.includes('pdf.worker')) {
      errorMessage = 'PDF worker failed to load. Please refresh the page.';
    } else if (err.message.includes('password')) {
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

  // Text highlighting effect - browser Ctrl+F style: finds and highlights ALL matches
  // This effect properly restores text nodes before re-highlighting to ensure it works on every keystroke
  useEffect(() => {
    // Function to restore all text nodes from highlight spans
    // This merges adjacent text nodes back together for proper searching
    const restoreTextNodes = (textLayer: Element) => {
      const highlightSpans = textLayer.querySelectorAll('.pdf-search-highlight');
      
      // First, replace all highlight spans with text nodes
      highlightSpans.forEach((span) => {
        const textContent = span.textContent || '';
        const textNode = document.createTextNode(textContent);
        if (span.parentNode) {
          span.parentNode.replaceChild(textNode, span);
        }
      });
      
      // Then, merge adjacent text nodes that were split by highlighting
      // This ensures searches work correctly across what was previously highlighted text
      const allNodes = Array.from(textLayer.childNodes);
      let i = 0;
      while (i < allNodes.length - 1) {
        const node1 = allNodes[i];
        const node2 = allNodes[i + 1];
        
        // If both are text nodes and they're siblings, merge them
        if (node1 instanceof Text && node2 instanceof Text && 
            node1.parentNode === node2.parentNode) {
          const mergedText = node1.textContent + node2.textContent;
          const mergedNode = document.createTextNode(mergedText);
          if (node1.parentNode) {
            node1.parentNode.replaceChild(mergedNode, node1);
            node2.remove();
          }
          allNodes[i] = mergedNode;
          allNodes.splice(i + 1, 1);
        } else {
          i++;
        }
      }
    };

    // Function to get all text nodes (excluding those inside highlight spans)
    const getAllTextNodes = (textLayer: Element): Text[] => {
      const textNodes: Text[] = [];
      const walker = document.createTreeWalker(
        textLayer,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            // Reject nodes inside highlight spans
            let parent = node.parentElement;
            while (parent && parent !== textLayer) {
              if (parent.classList.contains('pdf-search-highlight')) {
                return NodeFilter.FILTER_REJECT;
              }
              parent = parent.parentElement;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      let node;
      while ((node = walker.nextNode())) {
        if (node instanceof Text && node.textContent) {
          textNodes.push(node);
        }
      }
      return textNodes;
    };

    // Clear highlights if query is empty
    if (!searchQuery || !searchQuery.trim()) {
      pageRefs.current.forEach((pageElement) => {
        const textLayer = pageElement.querySelector('.react-pdf__Page__textContent');
        if (textLayer) {
          restoreTextNodes(textLayer);
        }
      });
      highlightRefs.current.clear();
      return;
    }

    const normalizedQuery = searchQuery.toLowerCase().trim();
    if (normalizedQuery.length === 0) {
      pageRefs.current.forEach((pageElement) => {
        const textLayer = pageElement.querySelector('.react-pdf__Page__textContent');
        if (textLayer) {
          restoreTextNodes(textLayer);
        }
      });
      highlightRefs.current.clear();
      return;
    }

    const escapedQuery = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const queryRegex = new RegExp(`(${escapedQuery})`, 'gi');

    // Use a small delay to ensure text layer is ready, then use requestAnimationFrame for DOM sync
    const timeoutId = setTimeout(() => {
      // Step 1: Restore all text nodes from previous highlights FIRST (for all pages)
      pageRefs.current.forEach((pageElement) => {
        const textLayer = pageElement.querySelector('.react-pdf__Page__textContent');
        if (textLayer) {
          restoreTextNodes(textLayer);
        }
      });

      // Step 2: Wait for DOM to update after restoration, then highlight
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          pageRefs.current.forEach((pageElement, pageNum) => {
            const textLayer = pageElement.querySelector('.react-pdf__Page__textContent');
            if (!textLayer) return;
            // Step 3: Get fresh text nodes after restoration
            const textNodes = getAllTextNodes(textLayer);
            
            if (textNodes.length === 0) return;

            // Initialize highlights set for this page
            if (!highlightRefs.current.has(pageNum)) {
              highlightRefs.current.set(pageNum, new Set());
            }
            const highlights = highlightRefs.current.get(pageNum)!;
            highlights.clear(); // Clear old references

            // Step 4: Build combined text from all nodes to find matches across boundaries
            // Then process nodes to highlight matches
            const nodeTexts = textNodes.map(n => n.textContent || '');
            const combinedText = nodeTexts.join('');
            const allMatches = Array.from(combinedText.matchAll(queryRegex));
            
            if (allMatches.length === 0) return;

            // Track character offsets for each node
            let charOffset = 0;
            const nodeOffsets: Array<{ node: Text; start: number; end: number; text: string }> = [];
            
            textNodes.forEach((textNode) => {
              const text = textNode.textContent || '';
              const start = charOffset;
              const end = charOffset + text.length;
              nodeOffsets.push({ node: textNode, start, end, text });
              charOffset = end;
            });

            // Process matches and highlight them
            // We need to process all matches, but avoid processing the same node twice
            // So we'll collect all matches first, then process nodes once
            const nodeMatches = new Map<Text, Array<{ matchStart: number; matchEnd: number; nodeStart: number; nodeEnd: number }>>();
            
            allMatches.forEach((match) => {
              if (match.index === undefined) return;
              
              const matchStart = match.index;
              const matchEnd = match.index + match[0].length;
              
              // Find which nodes this match spans
              // Two intervals [matchStart, matchEnd) and [start, end) overlap if: matchStart < end && matchEnd > start
              const affectedNodes = nodeOffsets.filter(
                ({ start, end }) => matchStart < end && matchEnd > start
              );
              
              // Record this match for each affected node
              affectedNodes.forEach(({ node: textNode, start, end: nodeEnd }) => {
                if (!nodeMatches.has(textNode)) {
                  nodeMatches.set(textNode, []);
                }
                nodeMatches.get(textNode)!.push({
                  matchStart,
                  matchEnd,
                  nodeStart: start,
                  nodeEnd,
                });
              });
            });
            
            // Now process each node with all its matches
            nodeMatches.forEach((matches, textNode) => {
              if (!textNode.parentNode) return; // Node was already replaced
              
              const text = textNode.textContent || '';
              if (!text) return;
              
              // Sort matches by position
              matches.sort((a, b) => a.matchStart - b.matchStart);
              
              // Get the node's start position
              const nodeInfo = nodeOffsets.find(n => n.node === textNode);
              if (!nodeInfo) return;
              const { start: nodeStart } = nodeInfo;
              
              // Build fragment with all matches highlighted
              const fragment = document.createDocumentFragment();
              let lastIndex = 0;
              
              matches.forEach(({ matchStart, matchEnd }) => {
                const nodeMatchStart = Math.max(0, matchStart - nodeStart);
                const nodeMatchEnd = Math.min(text.length, matchEnd - nodeStart);
                
                // Add text before this match
                if (nodeMatchStart > lastIndex) {
                  fragment.appendChild(document.createTextNode(text.substring(lastIndex, nodeMatchStart)));
                }
                
                // Highlight the match
                if (nodeMatchEnd > nodeMatchStart) {
                  const highlightSpan = document.createElement('span');
                  highlightSpan.className = 'pdf-search-highlight';
                  highlightSpan.textContent = text.substring(nodeMatchStart, nodeMatchEnd);
                  fragment.appendChild(highlightSpan);
                  highlights.add(highlightSpan);
                }
                
                lastIndex = nodeMatchEnd;
              });
              
              // Add remaining text after last match
              if (lastIndex < text.length) {
                fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
              }
              
              // Replace the node
              if (fragment.childNodes.length > 0 && textNode.parentNode) {
                textNode.parentNode.replaceChild(fragment, textNode);
              }
            });

          });
        });
      });
    }, 100); // Small delay to ensure text layer is ready

    return () => clearTimeout(timeoutId);
  }, [searchQuery, numPages]);

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