/**
 * Gemini AI Provider
 * Implements AIProvider interface for Google Gemini API
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { PAGE_AWARE_CHAT_PROMPT, SEARCH_RANK_PROMPT } from '../prompts';
import type { AIProvider, ConversationMessage } from '../types';
import type { StreamChunk } from '@/lib/api/streaming';
import { QuotaExceededError, isQuotaExceeded } from '../types';

export class GeminiProvider implements AIProvider {
  private client: GoogleGenerativeAI;
  private chatModel: ReturnType<typeof this.getChatModel>;
  private searchModel: ReturnType<typeof this.getSearchModel>;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }

    this.client = new GoogleGenerativeAI(apiKey);
    this.chatModel = this.getChatModel();
    this.searchModel = this.getSearchModel();
  }

  private getChatModel() {
    return this.client.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: PAGE_AWARE_CHAT_PROMPT,
    });
  }

  private getSearchModel() {
    return this.client.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: SEARCH_RANK_PROMPT,
    });
  }

  async generateChatResponse(
    prompt: string,
    conversationHistory?: ConversationMessage[]
  ): Promise<string> {
    try {
      // Convert conversation history to Gemini format
      const geminiHistory = conversationHistory?.map((msg) => ({
        role: (msg.role === 'user' ? 'user' : 'model') as 'user' | 'model',
        parts: [{ text: msg.content }],
      }));

      if (geminiHistory && geminiHistory.length > 0) {
        const chat = this.chatModel.startChat({
          history: geminiHistory,
        });
        const result = await chat.sendMessage(prompt);
        return result.response.text();
      }

      const result = await this.chatModel.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      if (isQuotaExceeded(error)) {
        throw new QuotaExceededError(
          `Gemini quota exceeded: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      throw error;
    }
  }

  async* generateChatResponseStream(
    prompt: string,
    conversationHistory?: ConversationMessage[]
  ): AsyncGenerator<StreamChunk> {
    const pageRefRegex = /page\s+(\d+)/gi;
    const pageReferences: number[] = [];

    try {
      // Convert conversation history to Gemini format
      const geminiHistory = conversationHistory?.map((msg) => ({
        role: (msg.role === 'user' ? 'user' : 'model') as 'user' | 'model',
        parts: [{ text: msg.content }],
      }));

      let result: Awaited<ReturnType<typeof this.chatModel.generateContentStream>>;

      if (geminiHistory && geminiHistory.length > 0) {
        const chat = this.chatModel.startChat({
          history: geminiHistory,
        });
        result = await chat.sendMessageStream(prompt);
      } else {
        result = await this.chatModel.generateContentStream(prompt);
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
      if (isQuotaExceeded(error)) {
        yield {
          type: 'error',
          error: `Gemini quota exceeded: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
        throw new QuotaExceededError(
          `Gemini quota exceeded: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Generation failed',
      };
    }
  }

  async generateSearchRanking(prompt: string): Promise<string> {
    try {
      const result = await this.searchModel.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      if (isQuotaExceeded(error)) {
        throw new QuotaExceededError(
          `Gemini quota exceeded: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      throw error;
    }
  }
}

