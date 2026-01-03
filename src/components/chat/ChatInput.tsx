'use client';

/**
 * Chat input component
 */

import { useState, useCallback, useRef, useEffect } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  isDisabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  isDisabled = false,
  placeholder = 'Ask a question about your PDF...',
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [message]);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      
      const trimmed = message.trim();
      if (trimmed && !isDisabled) {
        onSend(trimmed);
        setMessage('');
        
        // Reset textarea height
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      }
    },
    [message, isDisabled, onSend]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <form onSubmit={handleSubmit} className="p-4">
      <div className="flex gap-3 items-end">
        <div className="flex-1 relative group">
          {/* Gradient border effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary-400/20 via-accent-400/20 to-primary-400/20 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 blur-sm" />

          <div className="relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isDisabled}
              rows={1}
              className="w-full px-5 py-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl resize-none focus:outline-none focus:border-primary-400/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400/70"
              style={{
                minHeight: '48px',
                maxHeight: '150px',
              }}
            />

            {/* Character count indicator */}
            {message.length > 0 && (
              <span className="absolute bottom-2 right-3 text-xs text-gray-400 dark:text-gray-500 pointer-events-none">
                {message.length}
              </span>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={isDisabled || !message.trim()}
          className="px-5 py-4 bg-gradient-to-br from-primary-500 to-emerald-600 text-white rounded-2xl hover:from-primary-400 hover:to-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 flex-shrink-0 shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 hover:scale-105 active:scale-95 disabled:hover:scale-100 disabled:hover:shadow-lg"
          aria-label="Send message"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </button>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 text-center flex items-center justify-center gap-1">
        <kbd className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">Enter</kbd>
        <span>to send</span>
        <span className="text-gray-300 dark:text-gray-600">•</span>
        <kbd className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">Shift+Enter</kbd>
        <span>for new line</span>
      </p>
    </form>
  );
}

