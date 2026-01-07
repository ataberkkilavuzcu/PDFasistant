'use client';

/**
 * Main chat panel component
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import type { ChatMessage } from '@/types/chat';

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  onSendMessage: (message: string) => void;
  onPageClick?: (page: number) => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onOpenHistory?: () => void;
  onNewChat?: () => void;
  /** Text selected from PDF to add to chat */
  selectedText?: string;
  /** Clear the selected text after it's been used */
  onClearSelectedText?: () => void;
}

export function ChatPanel({
  messages,
  isLoading,
  error,
  onSendMessage,
  onPageClick,
  onEditMessage,
  onDeleteMessage,
  onOpenHistory,
  onNewChat,
  selectedText,
  onClearSelectedText,
}: ChatPanelProps) {
  const [prefillText, setPrefillText] = useState('');
  const inputRef = useRef<{ focus: () => void; setValue: (text: string) => void } | null>(null);

  // When selected text changes, add it to input
  useEffect(() => {
    if (selectedText && selectedText.trim()) {
      setPrefillText(selectedText);
      onClearSelectedText?.();
      // Focus the input after a small delay
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [selectedText, onClearSelectedText]);

  const handleSend = useCallback((message: string) => {
    onSendMessage(message);
    setPrefillText('');
  }, [onSendMessage]);

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Header */}
      <div className="px-4 md:px-6 py-3 md:py-4 border-b border-white/10 bg-gradient-to-r from-white/5 to-white/[0.02] backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base md:text-lg font-semibold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse-glow"></span>
              AI Assistant
            </h2>
            <p className="text-xs text-gray-400 ml-4 hidden md:block">Ask questions about your PDF</p>
          </div>
          <div className="flex items-center gap-1">
            {/* New Chat Button */}
            {onNewChat && (
              <button
                onClick={onNewChat}
                className="p-2 rounded-lg hover:bg-emerald-500/10 text-gray-400 hover:text-emerald-400 transition-colors group"
                title="Start new chat"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
            {/* History Button */}
            {onOpenHistory && (
              <button
                onClick={onOpenHistory}
                className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                title="View chat history"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Empty State for New Chat */}
      {messages.length === 0 && !isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 flex items-center justify-center border border-emerald-500/20">
            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Start a Conversation</h3>
          <p className="text-sm text-gray-400 max-w-xs">
            Ask questions about your document. I can help you understand, summarize, or find specific information.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <SuggestionChip onClick={() => handleSend("Summarize this document")}>
              📝 Summarize
            </SuggestionChip>
            <SuggestionChip onClick={() => handleSend("What are the key points?")}>
              🎯 Key Points
            </SuggestionChip>
            <SuggestionChip onClick={() => handleSend("Explain this in simple terms")}>
              💡 Simplify
            </SuggestionChip>
          </div>
        </div>
      )}

      {/* Messages */}
      {messages.length > 0 && (
        <div className="flex-1 overflow-hidden">
          <MessageList
            messages={messages}
            isLoading={isLoading}
            onPageClick={onPageClick}
            onEditMessage={onEditMessage}
            onDeleteMessage={onDeleteMessage}
          />
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 backdrop-blur-sm">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-white/10 bg-gradient-to-t from-white/5 to-white/[0.02] backdrop-blur-sm">
        <ChatInput 
          ref={inputRef}
          onSend={handleSend} 
          isDisabled={isLoading} 
          initialValue={prefillText}
          onValueChange={setPrefillText}
        />
      </div>
    </div>
  );
}

interface SuggestionChipProps {
  children: React.ReactNode;
  onClick: () => void;
}

function SuggestionChip({ children, onClick }: SuggestionChipProps) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 text-xs font-medium rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/30 text-gray-300 hover:text-white transition-all duration-200"
    >
      {children}
    </button>
  );
}
