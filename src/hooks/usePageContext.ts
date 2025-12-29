'use client';

/**
 * Custom hook for tracking current page and managing context window
 */

import { useState, useCallback, useMemo } from 'react';
import type { PDFPage, PageContext } from '@/types/pdf';
import {
  createPageContext,
  formatContextForPrompt,
  DEFAULT_CONTEXT_WINDOW,
} from '@/lib/pdf/context';

interface UsePageContextReturn {
  currentPage: number;
  totalPages: number;
  pageContext: PageContext | null;
  contextString: string;
  setCurrentPage: (page: number) => void;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  goToPage: (page: number) => void;
}

/**
 * Hook for managing page context and navigation
 */
export function usePageContext(
  pages: PDFPage[],
  windowSize: number = DEFAULT_CONTEXT_WINDOW
): UsePageContextReturn {
  const [currentPage, setCurrentPageState] = useState(1);

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

  return {
    currentPage,
    totalPages,
    pageContext,
    contextString,
    setCurrentPage,
    goToNextPage,
    goToPreviousPage,
    goToPage,
  };
}

