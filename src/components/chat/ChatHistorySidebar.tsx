'use client';

/**
 * Chat history sidebar component
 * Shows conversation history for the current document
 */

import { useState, useMemo } from 'react';
import type { ChatMessage } from '@/types/chat';

interface ChatHistorySidebarProps {
  messages: ChatMessage[];
  isOpen: boolean;
  onClose: () => void;
  onClearHistory: () => void;
  onJumpToMessage?: (messageId: string) => void;
}

interface MessageGroup {
  date: string;
  messages: ChatMessage[];
}

function formatDate(date: Date): string {
  const today = new Date();
  const messageDate = new Date(date);
  
  // Reset time for comparison
  today.setHours(0, 0, 0, 0);
  messageDate.setHours(0, 0, 0, 0);
  
  const diffDays = Math.floor((today.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  
  return messageDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: messageDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

export function ChatHistorySidebar({
  messages,
  isOpen,
  onClose,
  onClearHistory,
}: ChatHistorySidebarProps) {
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  // Group messages by date
  const messageGroups = useMemo<MessageGroup[]>(() => {
    const groups: Map<string, ChatMessage[]> = new Map();
    
    // Only show user messages in the history (as conversation starters)
    const userMessages = messages.filter((m) => m.role === 'user');
    
    userMessages.forEach((message) => {
      const dateKey = formatDate(new Date(message.timestamp));
      const existing = groups.get(dateKey) || [];
      existing.push(message);
      groups.set(dateKey, existing);
    });
    
    return Array.from(groups.entries()).map(([date, msgs]) => ({
      date,
      messages: msgs.reverse(), // Most recent first within each group
    }));
  }, [messages]);

  const handleClearClick = () => {
    setShowConfirmClear(true);
  };

  const handleConfirmClear = () => {
    onClearHistory();
    setShowConfirmClear(false);
  };

  const handleCancelClear = () => {
    setShowConfirmClear(false);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed right-0 top-0 h-full w-80 bg-gradient-to-b from-[#0f1419] to-[#0a0a0b] border-l border-white/10 z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Chat History
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stats */}
        <div className="px-4 py-3 bg-white/5 border-b border-white/10">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Total messages</span>
            <span className="text-white font-medium">{messages.length}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-gray-400">Questions asked</span>
            <span className="text-white font-medium">
              {messages.filter((m) => m.role === 'user').length}
            </span>
          </div>
        </div>

        {/* Message groups */}
        <div className="flex-1 overflow-y-auto">
          {messageGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
              <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-sm text-center">No chat history yet</p>
              <p className="text-xs text-gray-600 mt-1">Start asking questions!</p>
            </div>
          ) : (
            messageGroups.map((group) => (
              <div key={group.date} className="border-b border-white/5 last:border-b-0">
                <div className="px-4 py-2 bg-white/5 sticky top-0">
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    {group.date}
                  </span>
                </div>
                <div className="py-1">
                  {group.messages.map((message) => (
                    <div
                      key={message.id}
                      className="px-4 py-2.5 hover:bg-white/5 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-200 line-clamp-2">
                            {truncateText(message.content, 100)}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500">
                              {new Date(message.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            {message.pageContext && (
                              <span className="text-xs text-emerald-500/70">
                                Page {message.pageContext}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer with clear button */}
        {messages.length > 0 && (
          <div className="px-4 py-3 border-t border-white/10">
            {showConfirmClear ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-400 text-center">Clear all chat history?</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleCancelClear}
                    className="flex-1 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmClear}
                    className="flex-1 px-3 py-2 text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleClearClick}
                className="w-full px-3 py-2 text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear Chat History
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

