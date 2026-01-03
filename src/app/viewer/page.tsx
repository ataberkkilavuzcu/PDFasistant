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

import { useEffect, useState, useCallback, useMemo, Suspense, useRef } from 'react';
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
  const [searchQuery, setSearchQuery] = useState<string>('');
  // Keep track of the current blob URL to properly revoke it
  const blobUrlRef = useRef<string | null>(null);

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

  // Reset PDF.js state when component unmounts to ensure clean state on navigation back to main page
  useEffect(() => {
    return () => {
      // Reset PDF.js when leaving viewer to avoid state corruption on main page
      import('@/lib/pdf/init').then(({ resetPDFJS }) => {
        resetPDFJS();
      });
    };
  }, []);

  // Load PDF blob for viewing once document is loaded
  useEffect(() => {
    const loadPDFBlob = async () => {
      if (!documentId || !document) return;

      // Revoke previous blob URL before creating a new one
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }

      // First check if document has blob inline
      if (document.pdfBlob) {
        const blobUrl = URL.createObjectURL(document.pdfBlob);
        blobUrlRef.current = blobUrl;
        setPdfFileUrl(blobUrl);
        return;
      }

      // Otherwise try to get it from DB
      const blob = await getPDFBlob(documentId);
      if (blob) {
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;
        setPdfFileUrl(blobUrl);
      }
    };

    loadPDFBlob();

    // Cleanup blob URL on unmount
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
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

  // Handle search (for results dropdown - debounced)
  const handleSearch = useCallback(
    (query: string) => {
      if (!pages.length) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      // Note: searchQuery is already updated via onQueryChange for real-time highlighting
      const results = query.trim() ? searchPages(pages, query) : [];
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
      <div className="flex items-center justify-center h-screen bg-neutral-950">
        <div className="text-center card p-8 max-w-md mx-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-neutral-800 flex items-center justify-center border border-neutral-700">
            <svg className="w-8 h-8 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-neutral-100 mb-2">No document loaded</h3>
          <p className="text-sm text-neutral-400 mb-6">Upload a PDF to get started</p>
          <button
            onClick={() => router.push('/')}
            className="btn-primary"
          >
            Upload a PDF
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-neutral-950 overflow-hidden">
      {/* Left side - PDF Viewer */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Top Bar: Back button, Title, Search */}
        <div className="h-16 bg-neutral-900/80 backdrop-blur-xl border-b border-neutral-800 flex items-center px-4 z-20 gap-4">
          {/* Back button */}
          <button
            onClick={() => router.push('/')}
            className="p-2 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
            title="Back to documents"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>

          {/* Document title */}
          <div className="flex-shrink-0 max-w-[200px]">
            <h1 className="text-sm font-medium text-neutral-100 truncate" title={document?.metadata.title}>
              {document?.metadata.title || 'Loading...'}
            </h1>
            {document && (
              <p className="text-xs text-neutral-500">{document.metadata.pageCount} pages</p>
            )}
          </div>

          {/* Search */}
          <div className="flex-1 max-w-xl">
            <SearchBar
              onSearch={handleSearch}
              results={searchResults}
              isSearching={isSearching}
              onResultClick={handlePageClick}
              onQueryChange={setSearchQuery}
            />
          </div>
        </div>

        {/* PDF Viewer Container */}
        <div className="flex-1 overflow-hidden relative bg-neutral-950">
          {isPDFLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-neutral-800 border-t-accent-500 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-sm text-neutral-400">Loading document...</p>
              </div>
            </div>
          ) : pdfFileUrl ? (
            <PDFViewer
              file={pdfFileUrl}
              currentPage={currentPage}
              onPageChange={handlePageChange}
              onDocumentLoad={handleDocumentLoad}
              searchQuery={searchQuery}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-neutral-400">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-neutral-900 flex items-center justify-center border border-neutral-800">
                  <svg className="w-8 h-8 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-lg font-medium text-neutral-300 mb-1">Loading PDF...</p>
                <p className="text-sm text-neutral-500">Please wait while we prepare your document</p>
              </div>
            </div>
          )}
        </div>

        {/* Floating Page Navigator */}
        {totalPages > 0 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
            <div className="glass-panel rounded-2xl px-4 py-2 shadow-2xl">
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
      <div className="w-[400px] flex-shrink-0 border-l border-neutral-800 bg-neutral-900/30 backdrop-blur-sm flex flex-col">
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
      <div className="flex items-center justify-center h-screen bg-neutral-950">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-neutral-800 border-t-accent-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-neutral-400">Loading viewer...</p>
        </div>
      </div>
    }>
      <ViewerContent />
    </Suspense>
  );
}
