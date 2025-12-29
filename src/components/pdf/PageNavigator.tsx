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
    <div className="flex items-center gap-3 p-2 bg-white border rounded-lg shadow-sm">
      <button
        onClick={handlePrevious}
        disabled={currentPage <= 1}
        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label="Previous page"
      >
        ← Prev
      </button>

      <form onSubmit={handleInputSubmit} className="flex items-center gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          className="w-12 px-2 py-1 text-center text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Page number"
        />
        <span className="text-sm text-gray-500">/ {totalPages}</span>
      </form>

      <button
        onClick={handleNext}
        disabled={currentPage >= totalPages}
        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label="Next page"
      >
        Next →
      </button>
    </div>
  );
}
