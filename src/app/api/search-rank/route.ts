/**
 * Search Rank API Route - LLM-assisted search verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAIProvider } from '@/lib/ai/provider';
import { formatSearchRankRequest } from '@/lib/ai/prompts';
import type { SearchRankRequest, SearchRankResponse, ApiError } from '@/types/api';

export async function POST(request: NextRequest) {
  try {
    const body: SearchRankRequest = await request.json();
    const { query, candidates } = body;

    // Validate request
    if (!query || typeof query !== 'string') {
      return NextResponse.json<ApiError>(
        {
          error: 'Bad Request',
          message: 'Query is required',
          statusCode: 400,
        },
        { status: 400 }
      );
    }

    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      return NextResponse.json<ApiError>(
        {
          error: 'Bad Request',
          message: 'Candidates array is required',
          statusCode: 400,
        },
        { status: 400 }
      );
    }

    // Format the prompt
    const prompt = formatSearchRankRequest(query, candidates);

    // Get AI provider and generate ranking
    const aiProvider = getAIProvider();
    const response = await aiProvider.generateSearchRanking(prompt);

    // Parse LLM response to extract rankings
    let rankedResults: SearchRankResponse['rankedResults'] = [];

    try {
      // Try to parse JSON from the response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        rankedResults = parsed
          .map((item: { index?: number; pageNumber?: number; relevanceScore?: number }) => {
            const candidate = candidates[item.index ? item.index - 1 : 0];
            return {
              pageNumber: item.pageNumber || candidate?.pageNumber || 0,
              snippet: candidate?.snippet || '',
              relevanceScore: item.relevanceScore || 50,
            };
          })
          .sort((a: { relevanceScore: number }, b: { relevanceScore: number }) => 
            b.relevanceScore - a.relevanceScore
          );
      }
    } catch {
      // If parsing fails, return candidates in original order with default scores
      rankedResults = candidates.map((c, i) => ({
        pageNumber: c.pageNumber,
        snippet: c.snippet,
        relevanceScore: 100 - i * 10, // Decreasing scores
      }));
    }

    return NextResponse.json<SearchRankResponse>({
      rankedResults,
    });
  } catch (error) {
    console.error('Search rank API error:', error);

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
