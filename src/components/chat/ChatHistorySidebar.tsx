'use client';

/**
 * Chat history sidebar component
 * Shows conversation history for the current document
 */

import { useState, useMemo } from 'react';
import type { ChatMessage } from '@/types/chat';

interface Conversation {
  id: string;
  firstMessage: string;
  timestamp: Date;
  messageCount: number;
}

interface ChatHistorySidebarProps {
  messages: ChatMessage[];
  isOpen: boolean;
  onClose: () => void;
  onClearHistory: () => void;
  onLoadConversation?: (conversationId: string) => void;
  onDeleteConversation?: (conversationId: string) => void;
  currentConversationId?: string | null;
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
  onLoadConversation,
  onDeleteConversation,
  currentConversationId,
}: ChatHistorySidebarProps) {
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);

  // Group messages into conversations
  const conversations = useMemo<Conversation[]>(() => {
    const conversationMap = new Map<string, ChatMessage[]>();
    
    messages.forEach((msg) => {
      const convId = msg.conversationId;
      if (!conversationMap.has(convId)) {
        conversationMap.set(convId, []);
      }
      conversationMap.get(convId)!.push(msg);
    });

    return Array.from(conversationMap.entries())
      .map(([id, msgs]) => {
        const firstUserMessage = msgs.find(m => m.role === 'user');
        return {
          id,
          firstMessage: firstUserMessage?.content || 'New conversation',
          timestamp: msgs[0].timestamp,
          messageCount: msgs.length,
        };
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [messages]);

  // Group conversations by date
  const conversationGroups = useMemo(() => {
    const groups: Map<string, Conversation[]> = new Map();
    
    conversations.forEach((conv) => {
      const dateKey = formatDate(new Date(conv.timestamp));
      const existing = groups.get(dateKey) || [];
      existing.push(conv);
      groups.set(dateKey, existing);
    });
    
    return Array.from(groups.entries()).map(([date, convs]) => ({
      date,
      conversations: convs,
    }));
  }, [conversations]);

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

  const handleConversationClick = (conversationId: string) => {
    if (onLoadConversation) {
      onLoadConversation(conversationId);
      onClose();
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation(); // Prevent triggering the conversation click
    
    if (onDeleteConversation) {
      setDeletingConversationId(conversationId);
      try {
        await onDeleteConversation(conversationId);
      } finally {
        setDeletingConversationId(null);
      }
    }
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
            <span className="text-gray-400">Conversations</span>
            <span className="text-white font-medium">{conversations.length}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-gray-400">Total messages</span>
            <span className="text-white font-medium">{messages.length}</span>
          </div>
        </div>

        {/* Conversation groups */}
        <div className="flex-1 overflow-y-auto">
          {conversationGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
              <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-sm text-center">No chat history yet</p>
              <p className="text-xs text-gray-600 mt-1">Start asking questions!</p>
            </div>
          ) : (
            conversationGroups.map((group) => (
              <div key={group.date} className="border-b border-white/5 last:border-b-0">
                <div className="px-4 py-2 bg-white/5 sticky top-0">
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    {group.date}
                  </span>
                </div>
                <div className="py-1">
                  {group.conversations.map((conversation) => {
                    const isActive = conversation.id === currentConversationId;
                    const isDeleting = deletingConversationId === conversation.id;
                    return (
                      <div
                        key={conversation.id}
                        className={`relative group/item hover:bg-white/5 transition-colors ${
                          isActive ? 'bg-emerald-500/10 border-l-2 border-emerald-500' : ''
                        }`}
                      >
                        <button
                          onClick={() => handleConversationClick(conversation.id)}
                          className="w-full px-4 py-2.5 text-left"
                          disabled={isDeleting}
                        >
                          <div className="flex items-start gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              isActive 
                                ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' 
                                : 'bg-gradient-to-br from-primary-500 to-primary-600'
                            }`}>
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm line-clamp-2 ${isActive ? 'text-emerald-100' : 'text-gray-200'} ${isDeleting ? 'opacity-50' : ''}`}>
                                {truncateText(conversation.firstMessage, 100)}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-xs text-gray-500 ${isDeleting ? 'opacity-50' : ''}`}>
                                  {new Date(conversation.timestamp).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                                <span className="text-xs text-gray-600">•</span>
                                <span className={`text-xs text-gray-500 ${isDeleting ? 'opacity-50' : ''}`}>
                                  {conversation.messageCount} {conversation.messageCount === 1 ? 'message' : 'messages'}
                                </span>
                              </div>
                            </div>
                            {isActive && !isDeleting && (
                              <div className="flex-shrink-0">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              </div>
                            )}
                            {isDeleting && (
                              <div className="flex-shrink-0 flex items-center">
                                <svg className="w-4 h-4 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </button>
                        {onDeleteConversation && !isDeleting && (
                          <button
                            onClick={(e) => handleDeleteConversation(e, conversation.id)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg opacity-0 group-hover/item:opacity-100 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-all"
                            title="Delete conversation"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    );
                  })}
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
