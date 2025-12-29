/**
 * Client-side keyword search utilities
 */

import type { PDFPage } from '@/types/pdf';

export interface SearchResult {
  pageNumber: number;
  snippet: string;
  matchCount: number;
  matchPositions: number[];
}

/**
 * Normalize text for search (lowercase, remove extra whitespace)
 */
function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Find all occurrences of a query in text
 */
function findMatches(text: string, query: string): number[] {
  const positions: number[] = [];
  const normalizedText = normalizeText(text);
  const normalizedQuery = normalizeText(query);

  let pos = 0;
  while ((pos = normalizedText.indexOf(normalizedQuery, pos)) !== -1) {
    positions.push(pos);
    pos += 1;
  }

  return positions;
}

/**
 * Extract a snippet around a match position
 */
function extractSnippet(
  text: string,
  position: number,
  snippetLength: number = 200
): string {
  const halfLength = Math.floor(snippetLength / 2);
  const start = Math.max(0, position - halfLength);
  const end = Math.min(text.length, position + halfLength);

  let snippet = text.substring(start, end);

  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  return snippet.trim();
}

/**
 * Search across all pages for a query
 */
export function searchPages(
  pages: PDFPage[],
  query: string
): SearchResult[] {
  const results: SearchResult[] = [];

  for (const page of pages) {
    const matches = findMatches(page.text, query);

    if (matches.length > 0) {
      results.push({
        pageNumber: page.pageNumber,
        snippet: extractSnippet(page.text, matches[0]),
        matchCount: matches.length,
        matchPositions: matches,
      });
    }
  }

  // Sort by match count (most matches first)
  return results.sort((a, b) => b.matchCount - a.matchCount);
}

/**
 * Categorize search results for intelligent handling
 */
export function categorizeResults(results: SearchResult[]): {
  category: 'none' | 'few' | 'many';
  results: SearchResult[];
} {
  if (results.length === 0) {
    return { category: 'none', results: [] };
  }

  if (results.length <= 2) {
    return { category: 'few', results };
  }

  return { category: 'many', results };
}

