'use client';

/**
 * PDF Viewer page with chat interface
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PDFViewer, PageNavigator } from '@/components/pdf';
import { ChatPanel } from '@/components/chat';
import { SearchBar } from '@/components/search';
import { usePDF, useChat, usePageContext } from '@/hooks';
import { searchPages } from '@/lib/search/keyword';
import type { SearchResult } from '@/lib/search/keyword';

export default function ViewerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const documentId = searchParams.get('id');

  const { document, loadDocument, isLoading: isPDFLoading } = usePDF();
  const { messages, isLoading: isChatLoading, error: chatError, sendMessage, loadHistory } = useChat();
  
  const [pdfFile] = useState<File | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const pages = useMemo(() => document?.pages || [], [document?.pages]);
  const {
    currentPage,
    totalPages,
    contextString,
    setCurrentPage,
  } = usePageContext(pages);

  // Load document if ID is provided
  useEffect(() => {
    if (documentId) {
      loadDocument(documentId);
      loadHistory(documentId);
    }
  }, [documentId, loadDocument, loadHistory]);

  // Handle page change from viewer
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, [setCurrentPage]);

  // Handle sending a message
  const handleSendMessage = useCallback(
    async (message: string) => {
      if (!documentId || !contextString) return;
      await sendMessage(documentId, message, contextString, currentPage);
    },
    [documentId, contextString, currentPage, sendMessage]
  );

  // Handle search
  const handleSearch = useCallback(
    (query: string) => {
      if (!pages.length) return;
      setIsSearching(true);
      const results = searchPages(pages, query);
      setSearchResults(results);
      setIsSearching(false);
    },
    [pages]
  );

  // Handle clicking a page reference
  const handlePageClick = useCallback(
    (page: number) => {
      setCurrentPage(page);
    },
    [setCurrentPage]
  );

  // Redirect if no document
  if (!documentId && !pdfFile) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No document loaded</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Upload a PDF
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left side - PDF Viewer */}
      <div className="flex-1 flex flex-col">
        {/* Search bar */}
        <div className="p-4 bg-white border-b">
          <SearchBar
            onSearch={handleSearch}
            results={searchResults}
            isSearching={isSearching}
            onResultClick={handlePageClick}
          />
        </div>

        {/* PDF Viewer */}
        <div className="flex-1 overflow-hidden">
          {isPDFLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <PDFViewer
              file={pdfFile}
              currentPage={currentPage}
              onPageChange={handlePageChange}
            />
          )}
        </div>

        {/* Page navigator */}
        {totalPages > 0 && (
          <div className="p-4 bg-white border-t flex justify-center">
            <PageNavigator
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </div>

      {/* Right side - Chat Panel */}
      <div className="w-96 flex-shrink-0">
        <ChatPanel
          messages={messages}
          isLoading={isChatLoading}
          error={chatError}
          onSendMessage={handleSendMessage}
          onPageClick={handlePageClick}
        />
      </div>
    </div>
  );
}

