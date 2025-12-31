'use client';

/**
 * Enhanced page navigation controls for PDF viewer
 * Features:
 * - First/Previous/Next/Last navigation
 * - Jump to page input
 * - Page indicator
 * - Keyboard shortcuts info
 */

import { useState, useCallback, useEffect } from 'react';

interface PageNavigatorProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  showKeyboardHints?: boolean;
}

export function PageNavigator({
  currentPage,
  totalPages,
  onPageChange,
  showKeyboardHints = false,
}: PageNavigatorProps) {
  const [inputValue, setInputValue] = useState(String(currentPage));
  const [isEditing, setIsEditing] = useState(false);

  // Sync input value with currentPage when not editing
  useEffect(() => {
    if (!isEditing) {
      setInputValue(String(currentPage));
    }
  }, [currentPage, isEditing]);

  const handleFirst = useCallback(() => {
    onPageChange(1);
  }, [onPageChange]);

  const handlePrevious = useCallback(() => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  }, [currentPage, onPageChange]);

  const handleNext = useCallback(() => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  }, [currentPage, totalPages, onPageChange]);

  const handleLast = useCallback(() => {
    onPageChange(totalPages);
  }, [totalPages, onPageChange]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value);
    },
    []
  );

  const handleInputFocus = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleInputBlur = useCallback(() => {
    setIsEditing(false);
    // Reset to current page if invalid
    const page = parseInt(inputValue, 10);
    if (isNaN(page) || page < 1 || page > totalPages) {
      setInputValue(String(currentPage));
    }
  }, [inputValue, totalPages, currentPage]);

  const handleInputSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const page = parseInt(inputValue, 10);
      if (!isNaN(page) && page >= 1 && page <= totalPages) {
        onPageChange(page);
        setIsEditing(false);
      } else {
        setInputValue(String(currentPage));
      }
    },
    [inputValue, totalPages, currentPage, onPageChange]
  );

  return (
    <div className="flex items-center gap-2">
      {/* First page */}
      <button
        onClick={handleFirst}
        disabled={currentPage <= 1}
        className="p-2 text-white bg-white/10 rounded-lg hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
        aria-label="First page"
        title="First page (Home)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
        </svg>
      </button>

      {/* Previous page */}
      <button
        onClick={handlePrevious}
        disabled={currentPage <= 1}
        className="p-2 text-white bg-white/10 rounded-lg hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
        aria-label="Previous page"
        title="Previous page (←)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Page input */}
      <form onSubmit={handleInputSubmit} className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-1.5 border border-white/10">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          className="w-12 px-1 py-0.5 text-center text-sm font-bold bg-transparent text-white border-b border-white/20 focus:border-primary-500 focus:outline-none transition-colors"
          aria-label="Page number"
        />
        <span className="text-sm text-gray-500 font-medium">/ {totalPages}</span>
      </form>

      {/* Next page */}
      <button
        onClick={handleNext}
        disabled={currentPage >= totalPages}
        className="p-2 text-white bg-white/10 rounded-lg hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
        aria-label="Next page"
        title="Next page (→)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Last page */}
      <button
        onClick={handleLast}
        disabled={currentPage >= totalPages}
        className="p-2 text-white bg-white/10 rounded-lg hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
        aria-label="Last page"
        title="Last page (End)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
        </svg>
      </button>

      {/* Keyboard hints */}
      {showKeyboardHints && (
        <div className="ml-2 text-xs text-gray-500 hidden md:block">
          <span className="px-1.5 py-0.5 bg-white/5 rounded text-gray-400 mr-1">←</span>
          <span className="px-1.5 py-0.5 bg-white/5 rounded text-gray-400">→</span>
          <span className="ml-1">to navigate</span>
        </div>
      )}
    </div>
  );
}
