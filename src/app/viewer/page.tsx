'use client';

// Disable SSR for this page since it uses PDF components
export const dynamic = 'force-dynamic';

/**
 * PDF Viewer page with chat interface
 * Neural Intelligence Interface Design
 * Features:
 * - PDF viewing with zoom controls
 * - Page navigation with keyboard support
 * - Scroll-based page tracking
 * - Search functionality
 * - AI chat with page context
 */

import { useEffect, useState, useCallback, useMemo, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PDFViewer, PageNavigator, TextSelectionTooltip } from '@/components/pdf';
import { ChatPanel, ChatHistorySidebar } from '@/components/chat';
import { SearchBar } from '@/components/search';
import { PDFErrorBoundary, ChatErrorBoundary } from '@/components/error-boundaries';
import { usePDF, useChat, usePageContext } from '@/hooks';
import { useDebouncedChat } from '@/hooks/useDebouncedChat';
import { useDocumentStore } from '@/stores/documentStore';
import { searchPages } from '@/lib/search/keyword';
import { rankSearchResults } from '@/lib/api/search-client';
import type { SearchResult } from '@/lib/search/keyword';
import type { ChatMessage } from '@/types/chat';
import { SettingsModal } from '@/components/ui/SettingsModal';
import { KeyboardShortcutsModal } from '@/components/ui/KeyboardShortcutsModal';

// Minimum chat panel width in pixels
const MIN_CHAT_WIDTH = 300;
const MAX_CHAT_WIDTH = 600;
const DEFAULT_CHAT_WIDTH = 400;

function ViewerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const documentId = searchParams.get('id');

  const { document, loadDocument, isLoading: isPDFLoading, getPDFBlob } = usePDF();
  const chat = useChat();
  const {
    messages,
    allDocumentMessages,
    currentConversationId,
    isLoading: isChatLoading,
    error: chatError,
    sendMessage,
    loadHistory,
    loadConversation,
    createNewConversation,
    deleteConversation,
    editMessage,
    deleteMessage,
    clearHistory,
    exportConversation,
  } = useDebouncedChat(chat, { delay: 800 });
  const { setLastOpenedDocument, setCurrentPage: setStoreCurrentPage } = useDocumentStore();

  const [pdfFileUrl, setPdfFileUrl] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isRanking, setIsRanking] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [referencedPages, setReferencedPages] = useState<number[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedTextForChat, setSelectedTextForChat] = useState<string>('');
  const [chatPanelWidth, setChatPanelWidth] = useState(DEFAULT_CHAT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const blobUrlRef = useRef<string | null>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(DEFAULT_CHAT_WIDTH);
  
  // Session-based search cache (cleared on page refresh)
  const searchCacheRef = useRef<Map<string, SearchResult[]>>(new Map());

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
      // Update last opened document for state persistence
      setLastOpenedDocument(documentId);
    }
  }, [documentId, loadDocument, loadHistory, setLastOpenedDocument]);

  // Load PDF blob for viewing once document is loaded
  useEffect(() => {
    let isMounted = true;
    let previousBlobUrl: string | null = null;

    const loadPDFBlob = async () => {
      if (!documentId || !document) {
        if (blobUrlRef.current) {
          previousBlobUrl = blobUrlRef.current;
          blobUrlRef.current = null;
          setPdfFileUrl(null);
          setTimeout(() => {
            if (previousBlobUrl) {
              URL.revokeObjectURL(previousBlobUrl);
              previousBlobUrl = null;
            }
          }, 100);
        }
        return;
      }

      previousBlobUrl = blobUrlRef.current;

      if (document.pdfBlob) {
        const blobUrl = URL.createObjectURL(document.pdfBlob);
        if (isMounted) {
          blobUrlRef.current = blobUrl;
          setPdfFileUrl(blobUrl);
          if (previousBlobUrl) {
            setTimeout(() => {
              URL.revokeObjectURL(previousBlobUrl!);
            }, 100);
          }
        } else {
          URL.revokeObjectURL(blobUrl);
        }
        return;
      }

      const blob = await getPDFBlob(documentId);
      if (blob && isMounted) {
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;
        setPdfFileUrl(blobUrl);
        if (previousBlobUrl) {
          setTimeout(() => {
            URL.revokeObjectURL(previousBlobUrl!);
          }, 100);
        }
      } else if (blob && !isMounted) {
        URL.revokeObjectURL(URL.createObjectURL(blob));
      }
    };

    loadPDFBlob();

    return () => {
      isMounted = false;
      if (blobUrlRef.current) {
        const urlToRevoke = blobUrlRef.current;
        blobUrlRef.current = null;
        setTimeout(() => {
          URL.revokeObjectURL(urlToRevoke);
        }, 100);
      }
    };
  }, [documentId, document, getPDFBlob]);

  // Extract referenced pages from the latest assistant message
  useEffect(() => {
    const lastAssistant = messages.filter((m: ChatMessage) => m.role === 'assistant').pop();
    setReferencedPages(lastAssistant?.pageReferences || []);
  }, [messages]);

  const handlePageChange = useCallback((page: number) => {
    console.log('[ViewerPage] handlePageChange called', { page });
    setCurrentPage(page);
    setStoreCurrentPage(page);
  }, [setCurrentPage, setStoreCurrentPage]);

  const handleSendMessage = useCallback(
    async (message: string) => {
      if (!documentId || !contextString) return;
      await sendMessage(documentId, message, contextString, currentPage);
    },
    [documentId, contextString, currentPage, sendMessage]
  );

  const handleEditMessage = useCallback(
    async (messageId: string, newContent: string) => {
      if (!contextString) return;
      await editMessage(messageId, newContent, contextString, currentPage);
    },
    [contextString, currentPage, editMessage]
  );

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      await deleteMessage(messageId);
    },
    [deleteMessage]
  );

  const handleOpenHistory = useCallback(() => {
    setIsHistoryOpen(true);
  }, []);

  const handleCloseHistory = useCallback(() => {
    setIsHistoryOpen(false);
  }, []);

  const handleClearHistory = useCallback(async () => {
    if (documentId) {
      await clearHistory(documentId);
      setIsHistoryOpen(false);
    }
  }, [documentId, clearHistory]);

  // New chat handler - creates a new conversation without deleting history
  const handleNewChat = useCallback(() => {
    if (documentId) {
      createNewConversation(documentId);
    }
  }, [documentId, createNewConversation]);

  // Load a specific conversation
  const handleLoadConversation = useCallback(async (conversationId: string) => {
    await loadConversation(conversationId);
  }, [loadConversation]);

  // Handle text selected from PDF to add to chat
  const handleAddTextToChat = useCallback((text: string) => {
    // Format the text with quotes to indicate it's a quote from the document
    const formattedText = `Regarding this text: "${text.trim()}"\n\n`;
    setSelectedTextForChat(formattedText);
  }, []);

  const handleClearSelectedText = useCallback(() => {
    setSelectedTextForChat('');
  }, []);

  // Responsive design - detect mobile view
  useEffect(() => {
    const checkMobileView = () => {
      setIsMobileView(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setIsChatOpen(false);
      }
    };
    
    checkMobileView();
    window.addEventListener('resize', checkMobileView);
    return () => window.removeEventListener('resize', checkMobileView);
  }, []);

  // Keyboard shortcut: ? to toggle help modal
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '?') {
        setIsShortcutsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Split-pane resizing handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = chatPanelWidth;
  }, [chatPanelWidth]);

  useEffect(() => {
    if (!isResizing || typeof window === 'undefined') return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = resizeStartX.current - e.clientX;
      const newWidth = Math.min(MAX_CHAT_WIDTH, Math.max(MIN_CHAT_WIDTH, resizeStartWidth.current + delta));
      setChatPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.document.addEventListener('mousemove', handleMouseMove);
    window.document.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.document.removeEventListener('mousemove', handleMouseMove);
      window.document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          if (currentPage > 1) {
            handlePageChange(currentPage - 1);
          }
          break;
        case 'ArrowRight':
          if (currentPage < totalPages) {
            handlePageChange(currentPage + 1);
          }
          break;
        case ' ': // Spacebar
          e.preventDefault();
          if (e.shiftKey) {
            // Shift+Space = previous page
            if (currentPage > 1) {
              handlePageChange(currentPage - 1);
            }
          } else {
            // Space = next page
            if (currentPage < totalPages) {
              handlePageChange(currentPage + 1);
            }
          }
          break;
        case 'Home':
          handlePageChange(1);
          break;
        case 'End':
          handlePageChange(totalPages);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages, handlePageChange]);

  const handleSearch = useCallback(
    async (query: string) => {
      if (!pages.length) {
        setSearchResults([]);
        return;
      }

      const trimmedQuery = query.trim();
      if (!trimmedQuery) {
        setSearchResults([]);
        return;
      }

      // Check cache first
      const cacheKey = `${documentId || 'default'}-${trimmedQuery.toLowerCase()}`;
      const cachedResults = searchCacheRef.current.get(cacheKey);
      if (cachedResults) {
        setSearchResults(cachedResults);
        return;
      }

      setIsSearching(true);
      
      try {
        // Perform keyword search
        const keywordResults = searchPages(pages, trimmedQuery);
        
        // If 3+ results, use LLM-assisted ranking
        if (keywordResults.length >= 3) {
          setIsRanking(true);
          
          try {
            // Prepare candidates for ranking (limit to top 10 for performance)
            const candidates = keywordResults.slice(0, 10).map((r) => ({
              pageNumber: r.pageNumber,
              snippet: r.snippet,
            }));
            
            const { rankedResults } = await rankSearchResults(trimmedQuery, candidates);
            
            // Merge LLM rankings with original results
            const rankedMap = new Map(
              rankedResults.map((r) => [r.pageNumber, r.relevanceScore])
            );
            
            const enhancedResults: SearchResult[] = keywordResults.map((result) => ({
              ...result,
              relevanceScore: rankedMap.get(result.pageNumber),
              isLLMRanked: rankedMap.has(result.pageNumber),
            }));
            
            // Sort by relevance score (ranked results first), then by match count
            enhancedResults.sort((a, b) => {
              // Ranked results come first
              if (a.isLLMRanked && !b.isLLMRanked) return -1;
              if (!a.isLLMRanked && b.isLLMRanked) return 1;
              
              // Among ranked results, sort by relevance score
              if (a.isLLMRanked && b.isLLMRanked) {
                return (b.relevanceScore || 0) - (a.relevanceScore || 0);
              }
              
              // Among unranked results, sort by match count
              return b.matchCount - a.matchCount;
            });
            
            // Cache and set results
            searchCacheRef.current.set(cacheKey, enhancedResults);
            setSearchResults(enhancedResults);
          } catch (rankError) {
            console.error('LLM ranking failed, using keyword results:', rankError);
            // Fall back to keyword results on ranking failure
            searchCacheRef.current.set(cacheKey, keywordResults);
            setSearchResults(keywordResults);
          } finally {
            setIsRanking(false);
          }
        } else {
          // For fewer results, use keyword search directly
          searchCacheRef.current.set(cacheKey, keywordResults);
          setSearchResults(keywordResults);
        }
      } finally {
        setIsSearching(false);
      }
    },
    [pages, documentId]
  );

  const handlePageClick = useCallback(
    (page: number) => {
      console.log('[ViewerPage] handlePageClick called', { page });
      setCurrentPage(page);
      setStoreCurrentPage(page);
    },
    [setCurrentPage, setStoreCurrentPage]
  );

  const handleDocumentLoad = useCallback((numPages: number) => {
    console.log(`PDF loaded: ${numPages} pages`);
  }, []);

  // Redirect if no document
  if (!documentId) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0b]">
        <div className="text-center p-8 max-w-md mx-4">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center border border-emerald-500/20 ring-1 ring-emerald-500/10">
            <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-3" style={{ fontFamily: 'Outfit, sans-serif' }}>No document loaded</h3>
          <p className="text-sm text-gray-400 mb-8" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Upload a PDF to get started with intelligent analysis</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:from-emerald-400 hover:to-teal-400 transition-all duration-300 font-medium shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
            style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
          >
            Upload a PDF
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0a0a0b] overflow-hidden">
      {/* Google Fonts */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Left side - PDF Viewer */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Top Bar */}
        <div className="h-16 bg-gradient-to-r from-[#0f1419] to-[#0a0a0b] backdrop-blur-xl border-b border-white/5 flex items-center px-4 z-50 gap-4 relative">
          {/* Back button */}
          <button
            onClick={() => router.push('/')}
            className="p-2.5 rounded-xl hover:bg-white/5 text-gray-400 hover:text-emerald-400 transition-all duration-300 group"
            title="Back to documents"
          >
            <svg className="w-5 h-5 transition-transform duration-300 group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>

          {/* Divider */}
          <div className="h-8 w-px bg-white/10" />

          {/* Document title */}
          <div className="flex-shrink-0 max-w-[250px]">
            <h1
              className="text-sm font-semibold text-white truncate"
              title={document?.metadata.title}
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              {document?.metadata.title || 'Loading...'}
            </h1>
            {document && (
              <p className="text-xs text-gray-500" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                {document.metadata.pageCount} pages · {new Date(document.metadata.uploadDate).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Keyboard shortcuts button */}
          <button
            onClick={() => setIsShortcutsOpen(true)}
            className="p-2.5 rounded-xl hover:bg-white/5 text-gray-400 hover:text-emerald-400 transition-all duration-300"
            title="Keyboard shortcuts (?)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {/* Settings button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2.5 rounded-xl hover:bg-white/5 text-gray-400 hover:text-emerald-400 transition-all duration-300"
            title="Settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search */}
          <div className="flex-1 max-w-xl">
            <SearchBar
              onSearch={handleSearch}
              results={searchResults}
              isSearching={isSearching}
              isRanking={isRanking}
              onResultClick={handlePageClick}
              onQueryChange={setSearchQuery}
              documentId={documentId || undefined}
            />
          </div>
        </div>

        {/* PDF Viewer Container */}
        <div ref={pdfContainerRef} className="flex-1 overflow-hidden relative bg-[#0a0a0b]">
          {isPDFLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                {/* Enhanced Loading Spinner */}
                <div className="relative w-16 h-16 mx-auto mb-6">
                  <div className="absolute inset-0 rounded-full border-4 border-[#0f1419]" />
                  <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-emerald-500 animate-spin" />
                  <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-teal-500 animate-spin animation-delay-150" />
                  <div className="absolute inset-4 rounded-full border-4 border-transparent border-t-cyan-500 animate-spin animation-delay-300" />
                </div>
                <p className="text-sm text-gray-400" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Loading document...</p>
              </div>
            </div>
          ) : pdfFileUrl ? (
            <PDFErrorBoundary>
              <PDFViewer
                file={pdfFileUrl}
                currentPage={currentPage}
                onPageChange={handlePageChange}
                onDocumentLoad={handleDocumentLoad}
                searchQuery={searchQuery}
                highlightedPages={referencedPages}
              />
              {/* Text Selection Tooltip */}
              <TextSelectionTooltip
                containerRef={pdfContainerRef}
                onAddToChat={handleAddTextToChat}
              />
            </PDFErrorBoundary>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center border border-emerald-500/20 ring-1 ring-emerald-500/10">
                  <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-lg font-medium text-gray-300 mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>Loading PDF...</p>
                <p className="text-sm text-gray-500" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Please wait while we prepare your document</p>
              </div>
            </div>
          )}

          {/* Mobile Chat Toggle Button */}
          {isMobileView && (
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="fixed bottom-20 right-4 z-40 p-4 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all duration-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isChatOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                )}
              </svg>
            </button>
          )}
        </div>

        {/* Floating Page Navigator */}
        {totalPages > 0 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
            <div className="relative group">
              {/* Glow effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              {/* Navigator container */}
              <div className="relative bg-gradient-to-br from-[#0f1419] to-[#0a0a0b] rounded-2xl px-4 py-2.5 border border-white/5 shadow-2xl">
                <PageNavigator
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                  showKeyboardHints
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right side - Chat Panel with resizable width */}
      <div
        className={`
          flex-shrink-0 border-l border-white/5 bg-gradient-to-b from-[#0f1419]/50 to-[#0a0a0b]/30 backdrop-blur-sm flex flex-col
          transition-all duration-300 ease-out
          ${isMobileView ? 'fixed inset-y-0 right-0 z-50' : 'relative'}
          ${isMobileView && !isChatOpen ? 'translate-x-full' : 'translate-x-0'}
        `}
        style={{ width: isMobileView ? '100%' : `${chatPanelWidth}px`, maxWidth: isMobileView ? '100%' : MAX_CHAT_WIDTH }}
      >
        {/* Resize Handle */}
        {!isMobileView && (
          <div
            onMouseDown={handleResizeStart}
            className={`absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-emerald-500/50 transition-colors group ${isResizing ? 'bg-emerald-500/50' : 'bg-transparent'}`}
          >
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-white/10 group-hover:bg-emerald-500/50 transition-colors opacity-0 group-hover:opacity-100" />
          </div>
        )}

        <ChatErrorBoundary>
          <ChatPanel
            messages={messages}
            isLoading={isChatLoading}
            error={chatError}
            onSendMessage={handleSendMessage}
            onPageClick={handlePageClick}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
            onOpenHistory={handleOpenHistory}
            onNewChat={handleNewChat}
            onExportConversation={exportConversation}
            selectedText={selectedTextForChat}
            onClearSelectedText={handleClearSelectedText}
          />
        </ChatErrorBoundary>
      </div>

      {/* Mobile overlay backdrop */}
      {isMobileView && isChatOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsChatOpen(false)}
        />
      )}

      {/* Chat History Sidebar */}
      <ChatHistorySidebar
        messages={allDocumentMessages}
        currentConversationId={currentConversationId}
        isOpen={isHistoryOpen}
        onClose={handleCloseHistory}
        onClearHistory={handleClearHistory}
        onLoadConversation={handleLoadConversation}
        onDeleteConversation={deleteConversation}
      />

      {/* Settings Modal */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
    </div>
  );
}

export default function ViewerPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-[#0a0a0b]">
        <div className="text-center">
          {/* Enhanced Loading Spinner */}
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-[#0f1419]" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-emerald-500 animate-spin" />
            <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-teal-500 animate-spin animation-delay-150" />
            <div className="absolute inset-4 rounded-full border-4 border-transparent border-t-cyan-500 animate-spin animation-delay-300" />
          </div>
          <p className="text-sm text-gray-400" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Loading viewer...</p>
        </div>
      </div>
    }>
      <ViewerContent />
    </Suspense>
  );
}
