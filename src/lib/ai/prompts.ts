/**
 * System prompts for AI interactions
 */

/**
 * System prompt for page-aware chat
 * Optimized for token efficiency (~50 tokens vs ~100)
 */
export const PAGE_AWARE_CHAT_PROMPT = `You help users understand PDFs using ONLY provided context.
RULES:
1. Cite page numbers: "On page 5..."
2. Say "not found in context" if answer unavailable
3. Be concise
4. Use bullet/numbered lists for clarity`;

/**
 * System prompt for search ranking
 */
export const SEARCH_RANK_PROMPT = `You are a search relevance expert. Given a user's search query and a list of text snippets from a PDF document, rank the snippets by relevance to the query.

IMPORTANT RULES:
1. Consider semantic meaning, not just keyword matching.
2. Rank snippets that directly answer or relate to the query higher.
3. Return results as a JSON array with relevance scores from 0-100.
4. Be objective and consistent in your rankings.`;

/**
 * Format user message with context
 * Optimized for token efficiency
 */
export function formatUserMessage(
  userQuery: string,
  pageContext: string,
  currentPage: number
): string {
  // Truncate page context if too long (>2000 chars ~500 tokens)
  const maxContextLength = 2000;
  const truncatedContext =
    pageContext.length > maxContextLength
      ? pageContext.substring(0, maxContextLength) + '...'
      : pageContext;

  return `Page ${currentPage}
${truncatedContext}

Q: ${userQuery}`;
}

/**
 * Format search ranking request
 */
export function formatSearchRankRequest(
  query: string,
  candidates: Array<{ pageNumber: number; snippet: string }>
): string {
  const formattedCandidates = candidates
    .map(
      (c, i) =>
        `[${i + 1}] Page ${c.pageNumber}:\n"${c.snippet.substring(0, 500)}..."`
    )
    .join('\n\n');

  return `SEARCH QUERY: "${query}"

CANDIDATE SNIPPETS:
${formattedCandidates}

Rank these snippets by relevance to the search query. Return as JSON array: [{ "index": number, "pageNumber": number, "relevanceScore": number }]`;
}

