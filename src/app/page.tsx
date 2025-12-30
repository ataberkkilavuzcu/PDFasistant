'use client';

// Disable SSR for this page since it uses pdfjs-dist
export const dynamic = 'force-dynamic';

/**
 * Landing page with PDF upload
 * Modern, Dark, Animated Design
 * Features:
 * - PDF validation (type, size, magic bytes)
 * - Progress tracking during extraction
 * - Chunked processing for large PDFs
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PDFUploader } from '@/components/pdf';
import { usePDF } from '@/hooks';
import { extractAllPages, type ExtractionProgress, type PDFDocumentProxy } from '@/lib/pdf/extractor';
import { initializePDFJS, getPDFJS } from '@/lib/pdf/init';

interface ProcessingState {
  isProcessing: boolean;
  progress: ExtractionProgress | null;
}

export default function Home() {
  const router = useRouter();
  const { saveDocument } = usePDF();
  const [processingState, setProcessingState] = useState<ProcessingState>({
    isProcessing: false,
    progress: null,
  });
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = useCallback(
    async (file: File) => {
      setProcessingState({ isProcessing: true, progress: null });
      setError(null);

      try {
        // Update progress: Loading
        setProcessingState({
          isProcessing: true,
          progress: {
            currentPage: 0,
            totalPages: 0,
            percentage: 0,
            phase: 'loading',
            message: 'Loading PDF document...',
          },
        });

        // Initialize PDF.js (ensures worker is configured)
        await initializePDFJS();
        
        // Get PDF.js module (already initialized)
        const pdfjs = await getPDFJS();

        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();

        // Load PDF document with error handling
        let pdfDoc;
        try {
          pdfDoc = await pdfjs.getDocument({ 
            data: arrayBuffer,
            // Add error handling options
            verbosity: 0, // Suppress console warnings
          }).promise;
        } catch (loadError) {
          // Provide more specific error messages
          if (loadError instanceof Error) {
            if (loadError.message.includes('password')) {
              throw new Error('This PDF is password-protected. Please remove the password and try again.');
            } else if (loadError.message.includes('Invalid PDF')) {
              throw new Error('This file is not a valid PDF or is corrupted.');
            }
          }
          throw loadError;
        }

        // Validate PDF is readable (catches password-protected or corrupted PDFs)
        if (pdfDoc.numPages === 0) {
          throw new Error('PDF has no pages or could not be read');
        }

        // Update progress: Starting extraction
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

        // Extract text from all pages with progress callback
        const pages = await extractAllPages(
          pdfDoc as unknown as PDFDocumentProxy,
          (progress) => {
            setProcessingState({
              isProcessing: true,
              progress,
            });
          }
        );

        // Update progress: Saving
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

        // Save document to IndexedDB
        const documentId = await saveDocument(
          {
            title: file.name.replace('.pdf', ''),
            pageCount: pdfDoc.numPages,
            uploadDate: new Date(),
            fileSize: file.size,
          },
          pages
        );

        // Store file in sessionStorage for viewer (temporary solution)
        sessionStorage.setItem('pdfFile', URL.createObjectURL(file));

        // Navigate to viewer
        router.push(`/viewer?id=${documentId}`);
      } catch (err) {
        console.error('Error processing PDF:', err);
        
        // Provide user-friendly error messages
        let errorMessage = 'Failed to process PDF';
        if (err instanceof Error) {
          const errorMsg = err.message.toLowerCase();
          
          if (errorMsg.includes('password')) {
            errorMessage = 'This PDF is password-protected. Please remove the password and try again.';
          } else if (errorMsg.includes('invalid pdf') || errorMsg.includes('corrupted')) {
            errorMessage = 'This file is not a valid PDF or is corrupted.';
          } else if (errorMsg.includes('object.defineproperty') || errorMsg.includes('non-object')) {
            errorMessage = 'PDF processing failed to initialize. Please refresh the page and try again.';
            console.error('PDF.js initialization error - this may require a page refresh');
          } else if (errorMsg.includes('worker')) {
            errorMessage = 'PDF worker failed to load. Please check your internet connection and try again.';
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
    <main className="min-h-screen relative overflow-hidden bg-background text-foreground selection:bg-primary-500/30">
      {/* Animated Background Blobs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-500/20 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-pink-500/20 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      <div className="container mx-auto px-4 py-16 relative z-10">
        {/* Header */}
        <div className="text-center mb-20 animate-float">
          <div className="inline-block mb-4 px-4 py-1.5 rounded-full border border-primary-500/30 bg-primary-500/10 text-primary-400 text-sm font-medium backdrop-blur-sm">
            🚀 Next-Gen PDF Experience
          </div>
          <h1 className="text-6xl md:text-7xl font-bold mb-6 tracking-tight">
            PDF<span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-purple-500 text-glow">assistant</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Your intelligent reading companion. Upload a document and experience 
            <span className="text-primary-400"> context-aware</span> answers powered by AI.
          </p>
        </div>

        {/* Upload section */}
        <div className="flex flex-col items-center max-w-4xl mx-auto mb-32 perspective-1000">
          <div className="w-full transform transition-all duration-500 hover:scale-[1.01] hover:shadow-2xl shadow-primary-500/10">
            <div className="glass-panel rounded-2xl p-1">
              <div className="bg-black/40 rounded-xl p-8 md:p-12 border border-white/5">
                <PDFUploader onFileSelect={handleFileSelect} isLoading={isProcessing} />
                
                {isProcessing && (
                  <div className="mt-8 text-center space-y-4">
                    {/* Progress bar */}
                    <div className="relative w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                      {progress ? (
                        <div 
                          className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary-500 to-purple-500 transition-all duration-300 ease-out"
                          style={{ width: `${progress.percentage}%` }}
                        />
                      ) : (
                        <div className="absolute top-0 left-0 h-full w-1/3 bg-gradient-to-r from-transparent via-primary-500 to-transparent animate-[shimmer_1.5s_infinite]" />
                      )}
                    </div>
                    
                    {/* Progress details */}
                    <div className="space-y-1">
                      <p className="text-primary-400 text-sm font-medium">
                        {progress?.message || 'Initializing...'}
                      </p>
                      {progress && progress.totalPages > 0 && (
                        <p className="text-gray-500 text-xs">
                          {progress.phase === 'extracting' && (
                            <>Page {progress.currentPage} of {progress.totalPages} ({progress.percentage}%)</>
                          )}
                          {progress.phase === 'loading' && 'Loading document...'}
                          {progress.phase === 'complete' && 'Finalizing...'}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 backdrop-blur-sm animate-fade-in">
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </span>
            </div>
          )}
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <FeatureCard 
            icon={
              <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            }
            title="Page-Aware Chat"
            description="Ask questions and get answers with precise context from your current reading position."
            delay="0"
          />

          <FeatureCard 
            icon={
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
            title="Smart Search"
            description="Find information across your entire document with intelligent keyword matching and highlighting."
            delay="100"
          />

          <FeatureCard 
            icon={
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            }
            title="Privacy First"
            description="Your documents stay in your browser. We never store your PDFs on our servers."
            delay="200"
          />
        </div>
      </div>
    </main>
  );
}

function FeatureCard({ icon, title, description, delay }: { icon: React.ReactNode, title: string, description: string, delay: string }) {
  return (
    <div 
      className="group perspective-1000"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="glass-panel rounded-2xl p-8 h-full transform transition-all duration-300 hover:-translate-y-2 hover:bg-white/10 border-white/5 hover:border-primary-500/30">
        <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 ring-1 ring-white/10 group-hover:ring-primary-500/50">
          {icon}
        </div>
        <h3 className="text-xl font-bold text-white mb-3 group-hover:text-primary-400 transition-colors">
          {title}
        </h3>
        <p className="text-gray-400 leading-relaxed text-sm">
          {description}
        </p>
      </div>
    </div>
  );
}
