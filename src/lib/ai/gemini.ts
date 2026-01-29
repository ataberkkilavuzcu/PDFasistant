/**
 * Gemini AI API client
 *
 * @deprecated This file is deprecated. Use `src/lib/ai/providers/gemini.ts` instead.
 * This file is kept for backward compatibility but will be removed in a future version.
 * Please update imports to use `GeminiProvider` from `@/lib/ai/providers/gemini`.
 *
 * Server-side only - handles communication with Google's Gemini API
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { PAGE_AWARE_CHAT_PROMPT, SEARCH_RANK_PROMPT } from './prompts';
import type { StreamChunk } from '@/lib/api/streaming';

/**
 * Get the Gemini API client instance
 */
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  return new GoogleGenerativeAI(apiKey);
}

/**
 * Get the Gemini Pro model for chat
 */
export function getChatModel() {
  const client = getGeminiClient();
  return client.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: PAGE_AWARE_CHAT_PROMPT,
  });
}

/**
 * Get the Gemini Pro model for search ranking
 */
export function getSearchModel() {
  const client = getGeminiClient();
  return client.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: SEARCH_RANK_PROMPT,
  });
}

/**
 * Generate a chat response
 */
export async function generateChatResponse(
  prompt: string,
  conversationHistory?: Array<{ role: 'user' | 'model'; parts: string }>
): Promise<string> {
  const model = getChatModel();

  if (conversationHistory && conversationHistory.length > 0) {
    const chat = model.startChat({
      history: conversationHistory.map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.parts }],
      })),
    });
    const result = await chat.sendMessage(prompt);
    return result.response.text();
  }

  const result = await model.generateContent(prompt);
  return result.response.text();
}

/**
 * Generate a streaming chat response
 */
export async function* generateChatResponseStream(
  prompt: string,
  conversationHistory?: Array<{ role: 'user' | 'model'; parts: string }>
): AsyncGenerator<StreamChunk> {
  const model = getChatModel();
  const pageRefRegex = /page\s+(\d+)/gi;
  const pageReferences: number[] = [];

  try {
    let result: Awaited<ReturnType<typeof model.generateContentStream>>;

    if (conversationHistory && conversationHistory.length > 0) {
      const chat = model.startChat({
        history: conversationHistory.map((msg) => ({
          role: msg.role,
          parts: [{ text: msg.parts }],
        })),
      });
      result = await chat.sendMessageStream(prompt);
    } else {
      result = await model.generateContentStream(prompt);
    }

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield { type: 'content', data: text };
      }
    }

    // Extract page references from the complete response
    const finalResponse = await result.response;
    const fullText = finalResponse.text();
    let match;
    while ((match = pageRefRegex.exec(fullText)) !== null) {
      const pageNum = parseInt(match[1], 10);
      if (!pageReferences.includes(pageNum)) {
        pageReferences.push(pageNum);
      }
    }

    yield {
      type: 'done',
      pageReferences: pageReferences.length > 0 ? pageReferences : undefined,
    };
  } catch (error) {
    yield {
      type: 'error',
      error: error instanceof Error ? error.message : 'Generation failed',
    };
  }
}

/**
 * Generate search ranking
 */
export async function generateSearchRanking(prompt: string): Promise<string> {
  const model = getSearchModel();
  const result = await model.generateContent(prompt);
  return result.response.text();
}


