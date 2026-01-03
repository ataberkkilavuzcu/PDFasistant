'use client';

/**
 * Main chat panel component
 */

import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import type { ChatMessage } from '@/types/chat';

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  onSendMessage: (message: string) => void;
  onPageClick?: (page: number) => void;
}

export function ChatPanel({
  messages,
  isLoading,
  error,
  onSendMessage,
  onPageClick,
}: ChatPanelProps) {
  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/10 bg-gradient-to-r from-white/5 to-white/[0.02] backdrop-blur-sm">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse-glow"></span>
          AI Assistant
        </h2>
        <p className="text-xs text-gray-400 ml-4">Ask questions about your PDF</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <MessageList
          messages={messages}
          isLoading={isLoading}
          onPageClick={onPageClick}
        />
      </div>

      {/* Error display */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 backdrop-blur-sm">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-white/10 p-4 bg-gradient-to-t from-white/5 to-white/[0.02] backdrop-blur-sm">
        <ChatInput onSend={onSendMessage} isDisabled={isLoading} />
      </div>
    </div>
  );
}
