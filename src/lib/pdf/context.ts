/**
 * Page context windowing utilities
 * 
 * Manages the extraction of relevant page content based on
 * the user's current reading position.
 */

import type { PDFPage, PageContext } from '@/types/pdf';

/**
 * Default context window size (pages before and after current page)
 */
export const DEFAULT_CONTEXT_WINDOW = 2;

/**
 * Get pages within the context window of the current page
 */
export function getContextPages(
  pages: PDFPage[],
  currentPage: number,
  windowSize: number = DEFAULT_CONTEXT_WINDOW
): PDFPage[] {
  const startPage = Math.max(1, currentPage - windowSize);
  const endPage = Math.min(pages.length, currentPage + windowSize);

  return pages.filter(
    (page) => page.pageNumber >= startPage && page.pageNumber <= endPage
  );
}

/**
 * Create a PageContext object
 */
export function createPageContext(
  pages: PDFPage[],
  currentPage: number,
  windowSize: number = DEFAULT_CONTEXT_WINDOW
): PageContext {
  return {
    currentPage,
    contextPages: getContextPages(pages, currentPage, windowSize),
    windowSize,
  };
}

/**
 * Format page context as a string for AI prompts (windowed, ±N pages)
 */
export function formatContextForPrompt(context: PageContext): string {
  return context.contextPages
    .map((page) => `[Page ${page.pageNumber}]\n${page.text}`)
    .join('\n\n---\n\n');
}

/**
 * Format the FULL document text for AI chat prompts.
 * Sends ALL pages so the AI can find information anywhere in the PDF,
 * with a marker indicating which page the user is currently viewing.
 */
export function formatFullDocumentContext(
  pages: PDFPage[],
  currentPage: number
): string {
  if (pages.length === 0) return '';

  return pages
    .map((page) => {
      const marker = page.pageNumber === currentPage ? ' (currently viewing)' : '';
      return `[Page ${page.pageNumber}${marker}]\n${page.text}`;
    })
    .join('\n\n---\n\n');
}

/**
 * Calculate the total token estimate for context pages
 * (rough estimate: ~4 chars per token)
 */
export function estimateContextTokens(context: PageContext): number {
  const totalChars = context.contextPages.reduce(
    (sum, page) => sum + page.text.length,
    0
  );
  return Math.ceil(totalChars / 4);
}

