/**
 * Streaming response utilities for Next.js API routes
 * Provides Server-Sent Events (SSE) streaming and JSON response helpers
 */

import { NextResponse } from 'next/server';

export interface StreamChunk {
  type: 'content' | 'pageReference' | 'error' | 'done';
  data?: string;
  pageReferences?: number[];
  error?: string;
}

/**
 * Create a streaming response with Server-Sent Events
 */
export function streamResponse(
  stream: AsyncGenerator<StreamChunk>,
  requestId: string
): Response {
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const data = JSON.stringify(chunk);
          // SSE format: data: <json>\n\n
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));

          if (chunk.type === 'done' || chunk.type === 'error') {
            controller.close();
            return;
          }
        }
      } catch (error) {
        console.error(`Stream error [${requestId}]:`, error);
        const errorChunk: StreamChunk = {
          type: 'error',
          error: error instanceof Error ? error.message : 'Stream error',
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}

/**
 * Create a JSON response helper
 */
export function jsonResponse<T>(
  data: T,
  init?: ResponseInit
): NextResponse<T> {
  return NextResponse.json(data, init);
}

/**
 * Parse a Server-Sent Event chunk
 */
export function parseSSEChunk(chunk: string): StreamChunk | null {
  // SSE format: data: <json>\n\n
  const match = chunk.match(/^data: (.+)\n\n$/);
  if (!match) return null;

  try {
    return JSON.parse(match[1]) as StreamChunk;
  } catch {
    return null;
  }
}
