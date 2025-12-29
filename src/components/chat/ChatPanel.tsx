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
    <div className="flex flex-col h-full bg-white border-l">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-800">AI Assistant</h2>
        <p className="text-xs text-gray-500">Ask questions about your PDF</p>
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
        <div className="px-4 py-2 bg-red-50 border-t border-red-200">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Input */}
      <div className="border-t">
        <ChatInput onSend={onSendMessage} isDisabled={isLoading} />
      </div>
    </div>
  );
}

