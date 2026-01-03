'use client';

/**
 * Message list component for displaying chat history
 */

import { useRef, useEffect } from 'react';
import type { ChatMessage } from '@/types/chat';

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onPageClick?: (page: number) => void;
}

interface MessageBubbleProps {
  message: ChatMessage;
  onPageClick?: (page: number) => void;
}

function MessageBubble({ message, onPageClick }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  // Parse page references from content (e.g., "page 5" or "Page 5")
  const parsePageReferences = (content: string) => {
    const regex = /page\s+(\d+)/gi;
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(content.slice(lastIndex, match.index));
      }

      // Add clickable page reference
      const pageNum = parseInt(match[1], 10);
      parts.push(
        <button
          key={`page-${match.index}`}
          onClick={() => onPageClick?.(pageNum)}
          className="text-primary-600 hover:text-primary-700 underline font-medium transition-colors"
        >
          page {pageNum}
        </button>
      );

      lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex));
    }

    return parts.length > 0 ? parts : content;
  };

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-gradient-to-br from-primary-600 to-primary-700 text-white rounded-br-md premium-shadow'
            : 'bg-gradient-to-br from-gray-100 to-gray-50 text-gray-800 rounded-bl-md shadow-lg'
        }`}
      >
        {/* Page context indicator for user messages */}
        {isUser && message.pageContext && (
          <div className="text-xs text-primary-200 mb-1">
            Asked on page {message.pageContext}
          </div>
        )}

        {/* Message content */}
        <div className="text-sm whitespace-pre-wrap leading-relaxed">
          {isUser ? message.content : parsePageReferences(message.content)}
        </div>

        {/* Timestamp */}
        <div
          className={`text-xs mt-2 ${
            isUser ? 'text-primary-200' : 'text-gray-400'
          }`}
        >
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    </div>
  );
}

function LoadingIndicator() {
  return (
    <div className="flex justify-start mb-4">
      <div className="bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl rounded-bl-md px-4 py-3 shadow-lg">
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-accent-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

export function MessageList({ messages, isLoading, onPageClick }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
        <div className="w-16 h-16 mb-4 rounded-full bg-gradient-to-br from-primary-500/20 to-accent-500/10 flex items-center justify-center ring-1 ring-primary-500/20">
          <svg className="w-8 h-8 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <p className="text-center text-sm">
          Ask a question about your PDF document
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto p-4 scroll-smooth"
    >
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          onPageClick={onPageClick}
        />
      ))}
      {isLoading && <LoadingIndicator />}
    </div>
  );
}

