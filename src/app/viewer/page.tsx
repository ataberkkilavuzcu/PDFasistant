'use client';

// Disable SSR for this page since it uses PDF components
export const dynamic = 'force-dynamic';

/**
 * PDF Viewer page with chat interface
 * Modern Dark Theme Implementation
 */

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PDFViewer, PageNavigator } from '@/components/pdf';
import { ChatPanel } from '@/components/chat';
import { SearchBar } from '@/components/search';
import { usePDF, useChat, usePageContext } from '@/hooks';
import { searchPages } from '@/lib/search/keyword';
import type { SearchResult } from '@/lib/search/keyword';

function ViewerContent() {
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
      <div className="flex items-center justify-center h-screen bg-background text-foreground">
        <div className="text-center glass-panel p-8 rounded-2xl">
          <p className="text-gray-400 mb-4 text-lg">No document loaded</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-500 transition-colors shadow-lg shadow-primary-500/20 font-medium"
          >
            Upload a PDF
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden selection:bg-primary-500/30">
      {/* Left side - PDF Viewer */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Top Bar: Search & Title */}
        <div className="h-16 bg-white/5 border-b border-white/10 backdrop-blur-md flex items-center px-4 z-20">
          <div className="flex-1 max-w-2xl mx-auto">
            <SearchBar
              onSearch={handleSearch}
              results={searchResults}
              isSearching={isSearching}
              onResultClick={handlePageClick}
            />
          </div>
        </div>

        {/* PDF Viewer Container */}
        <div className="flex-1 overflow-hidden relative bg-[#1a1a1a]">
          {isPDFLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="relative">
                 <div className="w-12 h-12 rounded-full border-4 border-white/10 border-t-primary-500 animate-spin"></div>
                 <div className="absolute inset-0 flex items-center justify-center">
                   <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse"></div>
                 </div>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-auto custom-scrollbar">
              <PDFViewer
                file={pdfFile}
                currentPage={currentPage}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </div>

        {/* Floating Page Navigator */}
        {totalPages > 0 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
            <div className="glass-panel rounded-full px-6 py-2 shadow-2xl">
              <PageNavigator
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          </div>
        )}
      </div>

      {/* Right side - Chat Panel */}
      <div className="w-[400px] flex-shrink-0 border-l border-white/10 bg-white/5 backdrop-blur-sm flex flex-col">
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

export default function ViewerPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="w-12 h-12 rounded-full border-4 border-white/10 border-t-primary-500 animate-spin"></div>
      </div>
    }>
      <ViewerContent />
    </Suspense>
  );
}
