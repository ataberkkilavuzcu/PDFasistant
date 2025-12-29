/**
 * Chat API Route - Page-aware conversational queries
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateChatResponse } from '@/lib/ai/gemini';
import { formatUserMessage } from '@/lib/ai/prompts';
import type { ChatRequest, ChatResponse, ApiError } from '@/types/api';

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { message, pageContext, conversationHistory } = body;

    // Validate request
    if (!message || typeof message !== 'string') {
      return NextResponse.json<ApiError>(
        {
          error: 'Bad Request',
          message: 'Message is required',
          statusCode: 400,
        },
        { status: 400 }
      );
    }

    if (!pageContext || typeof pageContext !== 'string') {
      return NextResponse.json<ApiError>(
        {
          error: 'Bad Request',
          message: 'Page context is required',
          statusCode: 400,
        },
        { status: 400 }
      );
    }

    // Extract current page from context (assumes format includes page numbers)
    const pageMatch = pageContext.match(/\[Page (\d+)\]/);
    const currentPage = pageMatch ? parseInt(pageMatch[1], 10) : 1;

    // Format the prompt
    const prompt = formatUserMessage(message, pageContext, currentPage);

    // Convert conversation history to Gemini format
    const geminiHistory = conversationHistory?.map((msg) => ({
      role: (msg.role === 'user' ? 'user' : 'model') as 'user' | 'model',
      parts: msg.content,
    }));

    // Generate response
    const response = await generateChatResponse(prompt, geminiHistory);

    // Extract page references from response
    const pageReferences: number[] = [];
    const pageRefRegex = /page\s+(\d+)/gi;
    let match;
    while ((match = pageRefRegex.exec(response)) !== null) {
      const pageNum = parseInt(match[1], 10);
      if (!pageReferences.includes(pageNum)) {
        pageReferences.push(pageNum);
      }
    }

    return NextResponse.json<ChatResponse>({
      response,
      pageReferences: pageReferences.length > 0 ? pageReferences : undefined,
    });
  } catch (error) {
    console.error('Chat API error:', error);

    return NextResponse.json<ApiError>(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
      },
      { status: 500 }
    );
  }
}
