/**
 * Search Rank API Client
 * Handles communication with the LLM-assisted search ranking endpoint
 */

import type { SearchRankRequest, SearchRankResponse, ApiError } from '@/types/api';

/**
 * Request LLM-assisted ranking for search results
 */
export async function rankSearchResults(
  query: string,
  candidates: Array<{ pageNumber: number; snippet: string }>
): Promise<SearchRankResponse> {
  const request: SearchRankRequest = {
    query,
    candidates,
  };

  const response = await fetch('/api/search-rank', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData: ApiError = await response.json().catch(() => ({
      error: 'Unknown Error',
      message: `HTTP ${response.status}`,
      statusCode: response.status,
    }));
    throw new Error(errorData.message || 'Failed to rank search results');
  }

  return response.json();
}

