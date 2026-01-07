'use client';

/**
 * Chat input component
 */

import { useState, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  isDisabled?: boolean;
  placeholder?: string;
  initialValue?: string;
  onValueChange?: (value: string) => void;
}

export interface ChatInputRef {
  focus: () => void;
  setValue: (text: string) => void;
}

export const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(function ChatInput({
  onSend,
  isDisabled = false,
  placeholder = 'Ask a question about your PDF...',
  initialValue = '',
  onValueChange,
}, ref) {
  const [message, setMessage] = useState(initialValue);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const shortcutsRef = useRef<HTMLDivElement>(null);

  // Sync with initial value when it changes
  useEffect(() => {
    if (initialValue && initialValue !== message) {
      setMessage(initialValue);
    }
  }, [initialValue]); // eslint-disable-line react-hooks/exhaustive-deps

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    focus: () => {
      textareaRef.current?.focus();
    },
    setValue: (text: string) => {
      setMessage(text);
      onValueChange?.(text);
    },
  }), [onValueChange]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [message]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);
    onValueChange?.(value);
  }, [onValueChange]);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      
      const trimmed = message.trim();
      if (trimmed && !isDisabled) {
        onSend(trimmed);
        setMessage('');
        onValueChange?.('');
        
        // Reset textarea height
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      }
    },
    [message, isDisabled, onSend, onValueChange]
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

  // Close shortcuts popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (shortcutsRef.current && !shortcutsRef.current.contains(event.target as Node)) {
        setShowShortcuts(false);
      }
    };

    if (showShortcuts) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showShortcuts]);

  return (
    <form onSubmit={handleSubmit} className="p-3 md:p-4">
      <div className="flex gap-2 md:gap-3 items-end">
        <div className="flex-1 relative group">
          {/* Gradient border effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary-400/20 via-accent-400/20 to-primary-400/20 rounded-xl md:rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 blur-sm" />

          <div className="relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isDisabled}
              rows={1}
              className="w-full px-3 md:px-5 py-3 md:py-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-xl md:rounded-2xl resize-none focus:outline-none focus:border-primary-400/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm text-sm md:text-base text-gray-700 dark:text-gray-200 placeholder:text-gray-400/70"
              style={{
                minHeight: '44px',
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
          data-no-tooltip="true"
          className="px-4 md:px-5 py-3 md:py-4 bg-gradient-to-br from-primary-500 to-emerald-600 text-white rounded-xl md:rounded-2xl hover:from-primary-400 hover:to-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 flex-shrink-0 shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 hover:scale-105 active:scale-95 disabled:hover:scale-100 disabled:hover:shadow-lg"
          ref={(btn) => {
            if (btn) {
              // Remove any attributes that could cause tooltips
              btn.removeAttribute('title');
              btn.removeAttribute('aria-label');
              // Also remove from SVG
              const svg = btn.querySelector('svg');
              if (svg) {
                svg.removeAttribute('title');
                svg.removeAttribute('aria-label');
              }
            }
          }}
          onMouseEnter={(e) => {
            // Force remove any tooltip attributes that might have been added
            const btn = e.currentTarget;
            btn.removeAttribute('title');
            btn.removeAttribute('aria-label');
          }}
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

      <div className="mt-2 md:mt-3 text-center flex items-center justify-center gap-1 relative">
        {/* Info icon with shortcuts popover */}
        <div ref={shortcutsRef} className="relative">
          <button
            type="button"
            onClick={() => setShowShortcuts(!showShortcuts)}
            className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-300 dark:hover:text-gray-400 transition-colors rounded-full hover:bg-white/5 dark:hover:bg-gray-800/50"
            aria-label="Show keyboard shortcuts"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>

          {/* Shortcuts Popover */}
          {showShortcuts && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-[#0f1419] border border-white/10 rounded-lg p-3 shadow-xl z-50 animate-fade-in">
              <div className="text-xs font-medium text-gray-300 mb-2">Keyboard Shortcuts</div>
              <div className="space-y-1.5 text-xs text-gray-400">
                <div className="flex items-center justify-between">
                  <span>Send message</span>
                  <kbd className="px-1.5 py-0.5 text-[10px] font-medium bg-white/10 rounded border border-white/20">Enter</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>New line</span>
                  <kbd className="px-1.5 py-0.5 text-[10px] font-medium bg-white/10 rounded border border-white/20">Shift+Enter</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Next page</span>
                  <kbd className="px-1.5 py-0.5 text-[10px] font-medium bg-white/10 rounded border border-white/20">Space</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Navigate pages</span>
                  <div className="flex gap-1">
                    <kbd className="px-1.5 py-0.5 text-[10px] font-medium bg-white/10 rounded border border-white/20">←</kbd>
                    <kbd className="px-1.5 py-0.5 text-[10px] font-medium bg-white/10 rounded border border-white/20">→</kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span>First/Last page</span>
                  <div className="flex gap-1">
                    <kbd className="px-1.5 py-0.5 text-[10px] font-medium bg-white/10 rounded border border-white/20">Home</kbd>
                    <kbd className="px-1.5 py-0.5 text-[10px] font-medium bg-white/10 rounded border border-white/20">End</kbd>
                  </div>
                </div>
              </div>
              {/* Arrow */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[#0f1419]" />
            </div>
          )}
        </div>

        {/* Enter to send text */}
        <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">Enter</kbd>
          <span>to send</span>
          <span className="text-gray-300 dark:text-gray-600 hidden md:inline">•</span>
          <span className="hidden md:inline">
            <kbd className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">Shift+Enter</kbd>
            <span> for new line</span>
          </span>
        </p>
      </div>
    </form>
  );
});
