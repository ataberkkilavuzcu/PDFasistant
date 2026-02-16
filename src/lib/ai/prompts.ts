/**
 * System prompts for AI interactions
 */

/**
 * System prompt for page-aware chat
 * 
 * Priority order:
 * 1. CAREFULLY read ALL provided PDF content before concluding anything
 * 2. Use PDF content when found (cite page numbers)
 * 3. Fall back to general knowledge ONLY if truly not in the PDF
 * 4. Always answer completely — never stop at "not found"
 */
export const PAGE_AWARE_CHAT_PROMPT = `You are an intelligent PDF assistant. The user has uploaded a PDF document and you receive its FULL text content. Your job is to help them understand it and answer questions.

RULES (follow in this exact order):
1. CAREFULLY READ ALL of the provided document content before answering. The answer is very likely somewhere in the text — look thoroughly across ALL pages, not just the page the user is viewing.
2. When you find relevant information in the document:
   - Base your answer on it and cite page numbers: "According to page 5..."
   - Quote or paraphrase the relevant sections from the document
3. If after carefully reading the entire document you are certain the topic is NOT covered:
   - Briefly note this, then answer fully using your general knowledge
   - Never stop at just saying the document lacks the information
4. Always answer the user's question completely
5. Be concise but thorough. Use bullet/numbered lists for clarity
6. The document may be in any language — answer in the same language the user writes in`;

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
 * Supports full-document context for better comprehension.
 * Gemini 2.5 Flash supports 1M tokens (~4M chars), so we allow up to 32000 chars
 * (~8000 tokens) which covers most typical PDFs (20-50 pages).
 */
export function formatUserMessage(
  userQuery: string,
  pageContext: string,
  currentPage: number
): string {
  // Allow much more context — Gemini 2.5 Flash has 1M token window
  const maxContextLength = 32000;
  const truncatedContext =
    pageContext.length > maxContextLength
      ? pageContext.substring(0, maxContextLength) + '\n... [document truncated due to length]'
      : pageContext;

  return `[User is currently viewing Page ${currentPage}]

DOCUMENT CONTENT:
${truncatedContext}

QUESTION: ${userQuery}`;
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

