'use client';

// Disable SSR for this page since it uses pdfjs-dist
export const dynamic = 'force-dynamic';

/**
 * Landing page with PDF upload
 * Neural Intelligence Interface Design
 * Features:
 * - PDF validation (type, size, magic bytes)
 * - Progress tracking during extraction
 * - Chunked processing for large PDFs
 * - Sophisticated animations and interactions
 */

import { useCallback, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PDFUploader } from '@/components/pdf';
import { DocumentList } from '@/components/documents';
import { usePDF } from '@/hooks';
import { useDocumentStore } from '@/stores/documentStore';
import { extractAllPages, type ExtractionProgress, type PDFDocumentProxy } from '@/lib/pdf/extractor';
import { initializePDFJS, getPDFJS } from '@/lib/pdf/init';

interface ProcessingState {
  isProcessing: boolean;
  progress: ExtractionProgress | null;
}

export default function Home() {
  const router = useRouter();
  const { saveDocument } = usePDF();
  const {
    recentDocuments,
    lastOpenedDocumentId,
    loadRecentDocuments,
    removeRecentDocument,
  } = useDocumentStore();
  const [processingState, setProcessingState] = useState<ProcessingState>({
    isProcessing: false,
    progress: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Pre-initialize PDF.js on page load
  useEffect(() => {
    let mounted = true;

    const initPDF = async () => {
      try {
        setIsInitializing(true);
        // Always reset PDF.js state before initialization to ensure clean state
        const { resetPDFJS } = await import('@/lib/pdf/init');
        resetPDFJS();
        // Small delay to ensure cleanup completes
        await new Promise(resolve => setTimeout(resolve, 50));

        await initializePDFJS();
        if (mounted) {
          setIsInitializing(false);
          console.log('PDF.js pre-initialized successfully');
        }
      } catch (err) {
        if (mounted) {
          console.error('Failed to pre-initialize PDF.js:', err);
          setIsInitializing(false);
        }
      }
    };

    initPDF();

    return () => {
      mounted = false;
      import('@/lib/pdf/init').then(({ resetPDFJS }) => {
        resetPDFJS();
      });
    };
  }, []);

  // Handle document deletion - refresh recent documents list
  const handleDocumentDeleted = useCallback(
    (id: string) => {
      removeRecentDocument(id);
      loadRecentDocuments();
    },
    [removeRecentDocument, loadRecentDocuments]
  );

  const handleFileSelect = useCallback(
    async (file: File) => {
      setProcessingState({ isProcessing: true, progress: null });
      setError(null);

      try {
        setProcessingState({
          isProcessing: true,
          progress: {
            currentPage: 0,
            totalPages: 0,
            percentage: 0,
            phase: 'loading',
            message: 'Initializing PDF processor...',
          },
        });

        let pdfjs;
        try {
          await initializePDFJS();
          pdfjs = await getPDFJS();
        } catch {
          const { resetPDFJS } = await import('@/lib/pdf/init');
          resetPDFJS();
          await new Promise(resolve => setTimeout(resolve, 100));
          await initializePDFJS();
          pdfjs = await getPDFJS();
        }

        if (!pdfjs) {
          throw new Error('Failed to initialize PDF.js');
        }

        const arrayBuffer = await file.arrayBuffer();

        if (arrayBuffer.byteLength === 0) {
          throw new Error('PDF file is empty or could not be read');
        }

        await new Promise(resolve => setTimeout(resolve, 50));

        let pdfDoc;
        let loadAttempt = 0;
        const maxLoadAttempts = 2;

        while (loadAttempt < maxLoadAttempts) {
          try {
            pdfDoc = await pdfjs.getDocument({
              data: arrayBuffer,
              verbosity: 0,
              useSystemFonts: true,
              useWorkerFetch: true,
            }).promise;
            break;
          } catch (loadError: unknown) {
            loadAttempt++;

            if (loadAttempt >= maxLoadAttempts) {
              if (loadError instanceof Error) {
                const errorMsg = loadError.message.toLowerCase();

                if (errorMsg.includes('password') || errorMsg.includes('encrypted')) {
                  throw new Error('This PDF is password-protected. Please remove the password and try again.');
                } else if (errorMsg.includes('invalid pdf') || errorMsg.includes('not a pdf') || errorMsg.includes('pdf header')) {
                  throw new Error('This file is not a valid PDF or is corrupted. Please try a different file.');
                } else if (errorMsg.includes('worker') || errorMsg.includes('canvas')) {
                  throw new Error('PDF.js worker error: ' + loadError.message + '. Please refresh the page and try again.');
                } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
                  throw new Error('Network error loading PDF. Please check your connection and try again.');
                }
              }
              throw new Error(
                loadError instanceof Error
                  ? `Failed to load PDF: ${loadError.message}`
                  : 'Failed to load PDF. The file may be corrupted.'
              );
            }

            console.warn(`PDF load attempt ${loadAttempt} failed, retrying...`, loadError);
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        if (pdfDoc.numPages === 0) {
          throw new Error('PDF has no pages or could not be read');
        }

        setProcessingState({
          isProcessing: true,
          progress: {
            currentPage: 0,
            totalPages: pdfDoc.numPages,
            percentage: 0,
            phase: 'extracting',
            message: `Preparing to extract ${pdfDoc.numPages} pages...`,
          },
        });

        const pages = await extractAllPages(
          pdfDoc as unknown as PDFDocumentProxy,
          (progress) => {
            setProcessingState({
              isProcessing: true,
              progress,
            });
          }
        );

        setProcessingState({
          isProcessing: true,
          progress: {
            currentPage: pdfDoc.numPages,
            totalPages: pdfDoc.numPages,
            percentage: 100,
            phase: 'complete',
            message: 'Saving to local storage...',
          },
        });

        const documentId = await saveDocument(
          {
            title: file.name.replace('.pdf', ''),
            pageCount: pdfDoc.numPages,
            uploadDate: new Date(),
            fileSize: file.size,
          },
          pages,
          file
        );

        router.push(`/viewer?id=${documentId}`);
      } catch (err) {
        console.error('Error processing PDF:', err);

        let errorMessage = 'Failed to process PDF';

        if (err instanceof Error) {
          const errorMsg = err.message.toLowerCase();

          if (errorMsg.includes('password')) {
            errorMessage = 'This PDF is password-protected. Please remove the password and try again.';
          } else if (errorMsg.includes('invalid pdf') || errorMsg.includes('corrupted')) {
            errorMessage = 'This file is not a valid PDF or is corrupted.';
          } else if (
            errorMsg.includes('object.defineproperty') ||
            errorMsg.includes('non-object') ||
            errorMsg.includes('initialization failed') ||
            errorMsg.includes('globalworkeroptions')
          ) {
            errorMessage = 'PDF processor failed to initialize. Please refresh the page and try again.';
            console.error('PDF.js initialization error - user should refresh the page');
          } else if (errorMsg.includes('worker')) {
            errorMessage = 'PDF worker failed to load. Please check your internet connection and try again.';
          } else if (errorMsg.includes('failed to initialize')) {
            errorMessage = 'PDF processor initialization failed. Please refresh the page and try again.';
          } else {
            errorMessage = err.message || 'An unexpected error occurred while processing the PDF.';
          }
        } else if (typeof err === 'string') {
          errorMessage = err;
        }

        setError(errorMessage);
        setProcessingState({ isProcessing: false, progress: null });
      }
    },
    [saveDocument, router]
  );

  const { isProcessing, progress } = processingState;

  return (
    <main className="min-h-screen relative overflow-hidden bg-[#0a0a0b] text-white selection:bg-emerald-500/30">
      {/* Google Fonts */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Sophisticated Background */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Base gradient mesh */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0b] via-[#0f1419] to-[#0a0a0b]" />

        {/* Animated gradient orbs */}
        <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] bg-teal-500/10 rounded-full blur-[120px] animate-pulse-slow animation-delay-2000" />
        <div className="absolute bottom-[-10%] left-[30%] w-[40%] h-[40%] bg-cyan-500/8 rounded-full blur-[100px] animate-pulse-slow animation-delay-4000" />

        {/* Subtle hexagonal grid pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60 4.02 45V15z' fill='none' stroke='white' stroke-width='0.5'/%3E%3C/svg%3E")`,
          backgroundSize: '60px 60px',
        }} />

        {/* Noise texture overlay */}
        <div className="absolute inset-0 opacity-[0.015]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }} />

        {/* Gradient line decorations */}
        <div className="absolute top-[20%] left-0 w-[300px] h-[1px] bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
        <div className="absolute top-[40%] right-0 w-[200px] h-[1px] bg-gradient-to-l from-transparent via-teal-500/20 to-transparent" />
        <div className="absolute bottom-[30%] left-[10%] w-[150px] h-[1px] bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
      </div>

      <div className="container mx-auto px-4 py-16 relative z-10 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-16 md:mb-24 animate-fade-in">
          <div className="inline-block mb-6 px-5 py-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 backdrop-blur-sm">
            <span className="text-sm font-medium text-emerald-400 tracking-wide">
              Neural PDF Intelligence
            </span>
          </div>

          <h1 className="text-6xl md:text-8xl font-bold mb-6 tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
            <span className="block text-white">PDF</span>
            <span className="block bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
              assistant
            </span>
          </h1>

          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            Upload a PDF. Ask questions. Get precise, context-aware answers powered by AI.
            <br />
            <span className="text-gray-500">Your documents stay in your browser. Always.</span>
          </p>
        </div>

        {/* Upload Section */}
        <div className="flex flex-col items-center max-w-3xl mx-auto mb-20">
          <div className="w-full transform transition-all duration-500 hover:scale-[1.01]">
            <div className="relative group">
              {/* Glow effect on hover */}
              <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative bg-gradient-to-br from-[#0f1419] to-[#0a0a0b] rounded-3xl p-1 border border-white/5">
                <div className="bg-[#0a0a0b]/50 backdrop-blur-sm rounded-2xl p-8 md:p-12">
                  <PDFUploader
                    onFileSelect={handleFileSelect}
                    isLoading={isProcessing || isInitializing}
                  />

                  {isInitializing && !isProcessing && (
                    <div className="mt-6 text-center">
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-sm text-gray-400">Initializing processor...</span>
                      </div>
                    </div>
                  )}

                  {isProcessing && (
                    <div className="mt-10 space-y-4">
                      {/* Enhanced Progress Bar */}
                      <div className="relative h-1.5 bg-[#0f1419] rounded-full overflow-hidden">
                        {progress ? (
                          <div
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 transition-all duration-300 ease-out rounded-full shadow-[0_0_20px_rgba(16,185,129,0.5)]"
                            style={{ width: `${progress.percentage}%` }}
                          />
                        ) : (
                          <div className="absolute top-0 left-0 h-full w-1/3 bg-gradient-to-r from-transparent via-emerald-500 to-transparent animate-shimmer" />
                        )}
                      </div>

                      {/* Progress Details */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-emerald-400 font-medium">
                          {progress?.message || 'Processing...'}
                        </span>
                        {progress && progress.totalPages > 0 && (
                          <span className="text-gray-500">
                            {progress.phase === 'extracting' && (
                              <>{progress.currentPage} / {progress.totalPages} pages</>
                            )}
                            {progress.phase === 'loading' && 'Loading...'}
                            {progress.phase === 'complete' && 'Finalizing...'}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-6 w-full animate-fade-in">
              <div className="relative bg-red-500/5 border border-red-500/10 rounded-xl p-5 backdrop-blur-sm">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-red-300 font-medium mb-2">{error}</p>
                    {(error.includes('refresh') || error.includes('initialization')) && (
                      <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 text-sm font-medium bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors text-red-300"
                      >
                        Refresh Page
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recent Documents List */}
          {recentDocuments.length > 0 && !isProcessing && (
            <div className="mt-8 w-full animate-fade-in">
              <DocumentList
                documents={recentDocuments}
                lastOpenedDocumentId={lastOpenedDocumentId}
                onDocumentDeleted={handleDocumentDeleted}
              />
            </div>
          )}
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <FeatureCard
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            }
            title="Page-Aware Chat"
            description="Ask questions and get answers with precise context from your current reading position."
            accent="emerald"
            delay={0}
          />

          <FeatureCard
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
            title="Smart Search"
            description="Find information across your entire document with intelligent keyword matching."
            accent="teal"
            delay={100}
          />

          <FeatureCard
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            }
            title="Privacy First"
            description="Your documents stay in your browser. We never store your PDFs on our servers."
            accent="cyan"
            delay={200}
          />
        </div>
      </div>

    </main>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: 'emerald' | 'teal' | 'cyan';
  delay: number;
}

function FeatureCard({ icon, title, description, accent, delay }: FeatureCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      { threshold: 0.1 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const accentColors = {
    emerald: {
      bg: 'bg-emerald-500/10',
      border: 'group-hover:border-emerald-500/30',
      text: 'text-emerald-400',
      shadow: 'group-hover:shadow-emerald-500/10',
    },
    teal: {
      bg: 'bg-teal-500/10',
      border: 'group-hover:border-teal-500/30',
      text: 'text-teal-400',
      shadow: 'group-hover:shadow-teal-500/10',
    },
    cyan: {
      bg: 'bg-cyan-500/10',
      border: 'group-hover:border-cyan-500/30',
      text: 'text-cyan-400',
      shadow: 'group-hover:shadow-cyan-500/10',
    },
  };

  const colors = accentColors[accent];

  return (
    <div
      ref={cardRef}
      className="group relative transition-all duration-700 ease-out"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
        transitionDelay: `${delay}ms`,
      }}
    >
      <div className="relative h-full">
        {/* Hover glow */}
        <div className={`absolute -inset-1 bg-gradient-to-br from-${accent}-500/20 to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

        {/* Card */}
        <div className={`relative h-full bg-gradient-to-br from-[#0f1419] to-[#0a0a0b] rounded-2xl p-8 border border-white/5 transition-all duration-300 ${colors.border} group-hover:-translate-y-1`}>
          {/* Icon */}
          <div className={`w-14 h-14 ${colors.bg} rounded-xl flex items-center justify-center mb-6 transition-all duration-300 group-hover:scale-110 ring-1 ring-white/5 group-hover:ring-${accent}-500/20`}>
            <div className={colors.text}>{icon}</div>
          </div>

          {/* Content */}
          <h3 className="text-xl font-bold text-white mb-3 transition-colors duration-300 group-hover:text-gray-100" style={{ fontFamily: 'Outfit, sans-serif' }}>
            {title}
          </h3>
          <p className="text-gray-400 leading-relaxed text-sm" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

