'use client';

/**
 * Search bar component for document-wide search
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { SearchResult } from '@/lib/search/keyword';

interface SearchBarProps {
  onSearch: (query: string) => void;
  results: SearchResult[];
  isSearching: boolean;
  onResultClick: (pageNumber: number) => void;
  onQueryChange?: (query: string) => void; // Real-time query updates for highlighting
}

export function SearchBar({
  onSearch,
  results,
  isSearching,
  onResultClick,
  onQueryChange,
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Handle real-time query changes for highlighting
  const handleQueryChange = useCallback(
    (newQuery: string) => {
      setQuery(newQuery);
      
      // Clear previous debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      // Update search query immediately for highlighting (no debounce)
      if (onQueryChange) {
        onQueryChange(newQuery);
      }
      
      // Debounce the full search (for results dropdown)
      debounceTimerRef.current = setTimeout(() => {
        if (newQuery.trim()) {
          onSearch(newQuery.trim());
          setIsOpen(true);
        } else {
          // Clear results when query is empty
          onSearch('');
          setIsOpen(false);
        }
      }, 300); // 300ms debounce for search results
    },
    [onSearch, onQueryChange]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      // Clear debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (query.trim()) {
        onSearch(query.trim());
        setIsOpen(true);
      } else {
        onSearch('');
        setIsOpen(false);
      }
    },
    [query, onSearch]
  );

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleResultClick = useCallback(
    (pageNumber: number) => {
      console.log('[SearchBar] Result clicked', { pageNumber });
      onResultClick(pageNumber);
      setIsOpen(false);
    },
    [onResultClick]
  );

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1 group">
          <div className="absolute inset-0 bg-gradient-to-r from-primary-500/20 to-accent-500/20 rounded-lg blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-300"></div>
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search in document..."
            className="relative w-full px-4 py-2 pl-10 bg-white/10 border border-white/10 text-white placeholder-gray-400 rounded-lg focus:outline-none focus:border-primary-500/50 focus:bg-white/15 transition-all shadow-lg"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary-400 transition-colors"
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
          className="px-6 py-2 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-500 hover:to-primary-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary-500/20 border border-white/5 font-medium backdrop-blur-sm premium-shadow hover:premium-shadow-lg disabled:hover:premium-shadow"
        >
          {isSearching ? (
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              Finding...
            </span>
          ) : 'Search'}
        </button>
      </form>

      {/* Results dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-3 bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl max-h-80 overflow-y-auto custom-scrollbar animate-fade-in premium-shadow-lg">
          <div className="sticky top-0 p-3 bg-[#1a1a1a]/95 backdrop-blur-xl border-b border-white/10 flex justify-between items-center z-10">
            <span className="text-xs font-medium text-primary-400 uppercase tracking-wider">
              {results.length} result{results.length !== 1 ? 's' : ''} found
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-2 space-y-1">
            {results.map((result, index) => (
              <button
                key={`${result.pageNumber}-${index}`}
                onClick={() => handleResultClick(result.pageNumber)}
                className="w-full px-4 py-3 text-left rounded-lg hover:bg-white/10 border border-transparent hover:border-white/5 transition-all group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-primary-400 group-hover:text-primary-300 transition-colors">
                    Page {result.pageNumber}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r from-primary-500/20 to-accent-500/20 text-gray-400 border border-primary-500/20">
                    {result.matchCount} match{result.matchCount !== 1 ? 'es' : ''}
                  </span>
                </div>
                <p className="text-sm text-gray-400 line-clamp-2 group-hover:text-gray-300 transition-colors">
                  {result.snippet}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {isOpen && results.length === 0 && !isSearching && query.trim() && (
        <div className="absolute z-50 w-full mt-3 bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-6 text-center animate-fade-in">
          <div className="w-12 h-12 bg-gradient-to-br from-primary-500/20 to-accent-500/10 rounded-full flex items-center justify-center mx-auto mb-3 ring-1 ring-primary-500/20">
             <svg className="w-6 h-6 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
             </svg>
          </div>
          <p className="text-gray-400">No results found for <span className="text-white font-medium">&ldquo;{query}&rdquo;</span></p>
        </div>
      )}
    </div>
  );
}
