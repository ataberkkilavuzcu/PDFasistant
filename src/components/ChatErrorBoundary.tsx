'use client';

import React, { type ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

interface ChatErrorBoundaryProps {
  children: ReactNode;
}

/**
 * Specialized error boundary for chat-related errors
 */
export function ChatErrorBoundary({ children }: ChatErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={
        <div className="h-full flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <div className="relative bg-gradient-to-br from-[#0f1419] to-[#0a0a0b] rounded-xl p-6 border border-yellow-500/20">
              {/* Chat Error Icon */}
              <div className="w-12 h-12 bg-yellow-500/10 rounded-lg flex items-center justify-center mb-4 mx-auto border border-yellow-500/20">
                <svg
                  className="w-6 h-6 text-yellow-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>

              {/* Error Title */}
              <h3 className="text-lg font-bold text-white text-center mb-2">
                Chat Temporarily Unavailable
              </h3>

              {/* Error Message */}
              <p className="text-sm text-gray-400 text-center mb-4">
                The chat interface encountered an error. Your conversation history is safe.
              </p>

              {/* Actions */}
              <button
                onClick={() => window.location.reload()}
                className="w-full px-4 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 hover:border-yellow-500/30 rounded-lg text-yellow-300 text-sm font-medium transition-all duration-200"
              >
                Reload Chat
              </button>
            </div>
          </div>
        </div>
      }
      onError={(error, errorInfo) => {
        console.error('Chat Error:', error);
        console.error('Component Stack:', errorInfo.componentStack);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

