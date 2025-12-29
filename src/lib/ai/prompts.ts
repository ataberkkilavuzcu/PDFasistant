/**
 * System prompts for AI interactions
 */

/**
 * System prompt for page-aware chat
 */
export const PAGE_AWARE_CHAT_PROMPT = `You are a helpful AI assistant helping a user read and understand a PDF document.

IMPORTANT RULES:
1. Answer questions using ONLY the provided page content.
2. Always cite page numbers explicitly when referencing information (e.g., "On page 5...").
3. If the answer cannot be found in the provided context, say so clearly.
4. Keep responses concise and focused on the user's question.
5. Use clear formatting with bullet points or numbered lists when appropriate.

The user is currently reading the document, and you have access to the pages around their current position.`;

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
 */
export function formatUserMessage(
  userQuery: string,
  pageContext: string,
  currentPage: number
): string {
  return `The user is currently on page ${currentPage}.

DOCUMENT CONTEXT:
${pageContext}

USER QUESTION:
${userQuery}`;
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

