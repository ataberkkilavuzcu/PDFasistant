'use client';

/**
 * Search bar component for document-wide search
 */

import { useState, useCallback } from 'react';
import type { SearchResult } from '@/lib/search/keyword';

interface SearchBarProps {
  onSearch: (query: string) => void;
  results: SearchResult[];
  isSearching: boolean;
  onResultClick: (pageNumber: number) => void;
}

export function SearchBar({
  onSearch,
  results,
  isSearching,
  onResultClick,
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        onSearch(query.trim());
        setIsOpen(true);
      }
    },
    [query, onSearch]
  );

  const handleResultClick = useCallback(
    (pageNumber: number) => {
      onResultClick(pageNumber);
      setIsOpen(false);
    },
    [onResultClick]
  );

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search in document..."
            className="w-full px-4 py-2 pl-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <button
          type="submit"
          disabled={isSearching || !query.trim()}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          {isSearching ? 'Searching...' : 'Search'}
        </button>
      </form>

      {/* Results dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-10 w-full mt-2 bg-white border rounded-lg shadow-lg max-h-80 overflow-y-auto">
          <div className="p-2 text-xs text-gray-500 border-b">
            {results.length} result{results.length !== 1 ? 's' : ''} found
          </div>
          {results.map((result, index) => (
            <button
              key={`${result.pageNumber}-${index}`}
              onClick={() => handleResultClick(result.pageNumber)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-b-0 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-blue-600">
                  Page {result.pageNumber}
                </span>
                <span className="text-xs text-gray-400">
                  {result.matchCount} match{result.matchCount !== 1 ? 'es' : ''}
                </span>
              </div>
              <p className="text-sm text-gray-600 line-clamp-2">
                {result.snippet}
              </p>
            </button>
          ))}
        </div>
      )}

      {isOpen && results.length === 0 && !isSearching && query.trim() && (
        <div className="absolute z-10 w-full mt-2 bg-white border rounded-lg shadow-lg p-4 text-center text-gray-500">
          No results found for &ldquo;{query}&rdquo;
        </div>
      )}

      {/* Backdrop to close results */}
      {isOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

