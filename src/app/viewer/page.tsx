'use client';

// Disable SSR for this page since it uses PDF components
export const dynamic = 'force-dynamic';

/**
 * PDF Viewer page with chat interface
 * Features:
 * - PDF viewing with zoom controls
 * - Page navigation with keyboard support
 * - Scroll-based page tracking
 * - Search functionality
 * - AI chat with page context
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

  const { document, loadDocument, isLoading: isPDFLoading, getPDFBlob } = usePDF();
  const { messages, isLoading: isChatLoading, error: chatError, sendMessage, loadHistory } = useChat();
  
  const [pdfFileUrl, setPdfFileUrl] = useState<string | null>(null);
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

  // Load PDF blob for viewing once document is loaded
  useEffect(() => {
    let blobUrl: string | null = null;

    const loadPDFBlob = async () => {
      if (!documentId || !document) return;
      
      // First check if document has blob inline
      if (document.pdfBlob) {
        blobUrl = URL.createObjectURL(document.pdfBlob);
        setPdfFileUrl(blobUrl);
        return;
      }
      
      // Otherwise try to get it from DB
      const blob = await getPDFBlob(documentId);
      if (blob) {
        blobUrl = URL.createObjectURL(blob);
        setPdfFileUrl(blobUrl);
      }
    };

    loadPDFBlob();

    // Cleanup blob URL on unmount or when deps change
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [documentId, document, getPDFBlob]);

  // Handle page change from viewer or navigator
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

  // Handle clicking a page reference (from search or chat)
  const handlePageClick = useCallback(
    (page: number) => {
      setCurrentPage(page);
    },
    [setCurrentPage]
  );

  // Handle document load from PDFViewer
  const handleDocumentLoad = useCallback((numPages: number) => {
    console.log(`PDF loaded: ${numPages} pages`);
  }, []);

  // Redirect if no document
  if (!documentId) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-foreground">
        <div className="text-center glass-panel p-8 rounded-2xl">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
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
        {/* Top Bar: Back button, Title, Search */}
        <div className="h-14 bg-[#1e1e1e] border-b border-white/10 flex items-center px-4 z-20 gap-4">
          {/* Back button */}
          <button
            onClick={() => router.push('/')}
            className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title="Back to documents"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>

          {/* Document title */}
          <div className="flex-shrink-0 max-w-[200px]">
            <h1 className="text-sm font-medium text-white truncate" title={document?.metadata.title}>
              {document?.metadata.title || 'Loading...'}
            </h1>
            {document && (
              <p className="text-xs text-gray-500">{document.metadata.pageCount} pages</p>
            )}
          </div>

          {/* Search */}
          <div className="flex-1 max-w-xl">
            <SearchBar
              onSearch={handleSearch}
              results={searchResults}
              isSearching={isSearching}
              onResultClick={handlePageClick}
            />
          </div>
        </div>

        {/* PDF Viewer Container */}
        <div className="flex-1 overflow-hidden relative">
          {isPDFLoading ? (
            <div className="flex items-center justify-center h-full bg-[#1a1a1a]">
              <div className="text-center">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-4 border-white/10 border-t-primary-500 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
                  </div>
                </div>
                <p className="mt-4 text-gray-400 text-sm">Loading document...</p>
              </div>
            </div>
          ) : pdfFileUrl ? (
            <PDFViewer
              file={pdfFileUrl}
              currentPage={currentPage}
              onPageChange={handlePageChange}
              onDocumentLoad={handleDocumentLoad}
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-[#1a1a1a] text-gray-400">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-lg">Loading PDF...</p>
                <p className="text-sm text-gray-500 mt-1">Please wait while we prepare your document</p>
              </div>
            </div>
          )}
        </div>

        {/* Floating Page Navigator */}
        {totalPages > 0 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
            <div className="glass-panel rounded-2xl px-4 py-2 shadow-2xl border border-white/10">
              <PageNavigator
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                showKeyboardHints
              />
            </div>
          </div>
        )}
      </div>

      {/* Right side - Chat Panel */}
      <div className="w-[400px] flex-shrink-0 border-l border-white/10 bg-[#1e1e1e] flex flex-col">
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
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-white/10 border-t-primary-500 animate-spin mx-auto" />
          <p className="mt-4 text-gray-400 text-sm">Loading viewer...</p>
        </div>
      </div>
    }>
      <ViewerContent />
    </Suspense>
  );
}
