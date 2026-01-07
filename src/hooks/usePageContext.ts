'use client';

/**
 * Custom hook for tracking current page and managing context window
 * Supports scroll-based page tracking
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { PDFPage, PageContext } from '@/types/pdf';
import {
  createPageContext,
  formatContextForPrompt,
  DEFAULT_CONTEXT_WINDOW,
} from '@/lib/pdf/context';

interface ScrollTrackingOptions {
  /** Enable automatic page tracking based on scroll position */
  enabled: boolean;
  /** Threshold percentage (0-1) for when to consider a page as "current" */
  threshold?: number;
  /** Debounce delay in ms for scroll events */
  debounceMs?: number;
}

interface UsePageContextReturn {
  currentPage: number;
  totalPages: number;
  pageContext: PageContext | null;
  contextString: string;
  scrollPosition: number;
  setCurrentPage: (page: number) => void;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  goToPage: (page: number) => void;
  /** Set up scroll tracking on a container element */
  setupScrollTracking: (container: HTMLElement | null, options?: ScrollTrackingOptions) => void;
  /** Clean up scroll tracking */
  cleanupScrollTracking: () => void;
}

/**
 * Hook for managing page context and navigation with scroll tracking
 */
export function usePageContext(
  pages: PDFPage[],
  windowSize: number = DEFAULT_CONTEXT_WINDOW
): UsePageContextReturn {
  const [currentPage, setCurrentPageState] = useState(1);
  const [scrollPosition, setScrollPosition] = useState(0);

  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollHandlerRef = useRef<(() => void) | null>(null);

  const totalPages = pages.length;

  const setCurrentPage = useCallback(
    (page: number) => {
      const validPage = Math.max(1, Math.min(page, totalPages));
      setCurrentPageState(validPage);
    },
    [totalPages]
  );

  const goToNextPage = useCallback(() => {
    setCurrentPage(currentPage + 1);
  }, [currentPage, setCurrentPage]);

  const goToPreviousPage = useCallback(() => {
    setCurrentPage(currentPage - 1);
  }, [currentPage, setCurrentPage]);

  const goToPage = useCallback(
    (page: number) => {
      setCurrentPage(page);
    },
    [setCurrentPage]
  );

  const pageContext = useMemo(() => {
    if (pages.length === 0) return null;
    return createPageContext(pages, currentPage, windowSize);
  }, [pages, currentPage, windowSize]);

  const contextString = useMemo(() => {
    if (!pageContext) return '';
    return formatContextForPrompt(pageContext);
  }, [pageContext]);

  /**
   * Set up scroll tracking on a container element
   */
  const setupScrollTracking = useCallback(
    (container: HTMLElement | null, options: ScrollTrackingOptions = { enabled: true }) => {
      if (!container || !options.enabled) return;

      const { threshold = 0.5, debounceMs = 150 } = options;
      scrollContainerRef.current = container;

      const handleScroll = () => {
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }

        scrollTimeoutRef.current = setTimeout(() => {
          if (!scrollContainerRef.current) return;

          const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
          const scrollPercent = scrollTop / (scrollHeight - clientHeight);
          
          setScrollPosition(scrollPercent);

          // Calculate which page is currently visible based on scroll position
          // Assuming pages are evenly distributed in the scroll area
          if (totalPages > 0) {
            const estimatedPage = Math.ceil(scrollPercent * totalPages) || 1;
            const clampedPage = Math.max(1, Math.min(estimatedPage, totalPages));
            
            // Only update if the page has changed and we've scrolled past the threshold
            if (clampedPage !== currentPage) {
              const pageThreshold = 1 / totalPages;
              if (Math.abs(scrollPercent - (clampedPage - 1) / totalPages) < pageThreshold * threshold) {
                setCurrentPageState(clampedPage);
              }
            }
          }
        }, debounceMs);
      };

      scrollHandlerRef.current = handleScroll;
      container.addEventListener('scroll', handleScroll, { passive: true });
    },
    [totalPages, currentPage]
  );

  /**
   * Clean up scroll tracking
   */
  const cleanupScrollTracking = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }

    if (scrollContainerRef.current && scrollHandlerRef.current) {
      scrollContainerRef.current.removeEventListener('scroll', scrollHandlerRef.current);
    }

    scrollContainerRef.current = null;
    scrollHandlerRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupScrollTracking();
    };
  }, [cleanupScrollTracking]);

  return {
    currentPage,
    totalPages,
    pageContext,
    contextString,
    scrollPosition,
    setCurrentPage,
    goToNextPage,
    goToPreviousPage,
    goToPage,
    setupScrollTracking,
    cleanupScrollTracking,
  };
}

