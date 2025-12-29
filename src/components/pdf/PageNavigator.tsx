'use client';

/**
 * Page navigation controls for PDF viewer
 */

import { useState, useCallback } from 'react';

interface PageNavigatorProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function PageNavigator({
  currentPage,
  totalPages,
  onPageChange,
}: PageNavigatorProps) {
  const [inputValue, setInputValue] = useState(String(currentPage));

  const handlePrevious = useCallback(() => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
      setInputValue(String(currentPage - 1));
    }
  }, [currentPage, onPageChange]);

  const handleNext = useCallback(() => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
      setInputValue(String(currentPage + 1));
    }
  }, [currentPage, totalPages, onPageChange]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value);
    },
    []
  );

  const handleInputSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const page = parseInt(inputValue, 10);
      if (!isNaN(page) && page >= 1 && page <= totalPages) {
        onPageChange(page);
      } else {
        setInputValue(String(currentPage));
      }
    },
    [inputValue, totalPages, currentPage, onPageChange]
  );

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={handlePrevious}
        disabled={currentPage <= 1}
        className="p-2 text-white bg-white/10 rounded-full hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
        aria-label="Previous page"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <form onSubmit={handleInputSubmit} className="flex items-center gap-2 bg-black/20 rounded-lg px-3 py-1.5 border border-white/5">
        <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">Page</span>
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          className="w-12 px-1 py-0.5 text-center text-sm font-bold bg-transparent text-white border-b border-white/20 focus:border-primary-500 focus:outline-none transition-colors"
          aria-label="Page number"
        />
        <span className="text-sm text-gray-500 font-medium">/ {totalPages}</span>
      </form>

      <button
        onClick={handleNext}
        disabled={currentPage >= totalPages}
        className="p-2 text-white bg-white/10 rounded-full hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
        aria-label="Next page"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
