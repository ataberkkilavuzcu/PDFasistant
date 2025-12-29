'use client';

/**
 * Landing page with PDF upload
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PDFUploader } from '@/components/pdf';
import { usePDF } from '@/hooks';
import { extractAllPages } from '@/lib/pdf/extractor';
import * as pdfjs from 'pdfjs-dist';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
}

export default function Home() {
  const router = useRouter();
  const { saveDocument } = usePDF();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = useCallback(
    async (file: File) => {
      setIsProcessing(true);
      setError(null);

      try {
        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();

        // Load PDF document
        const pdfDoc = await pdfjs.getDocument({ data: arrayBuffer }).promise;

        // Extract text from all pages
        const pages = await extractAllPages(pdfDoc);

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
        // In production, you'd use a more robust approach
        sessionStorage.setItem('pdfFile', URL.createObjectURL(file));

        // Navigate to viewer
        router.push(`/viewer?id=${documentId}`);
      } catch (err) {
        console.error('Error processing PDF:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to process PDF'
        );
        setIsProcessing(false);
      }
    },
    [saveDocument, router]
  );

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            PDF<span className="text-blue-600">asistant</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Your intelligent PDF reading companion. Upload a document and get
            instant, page-aware answers to your questions.
          </p>
        </div>

        {/* Upload section */}
        <div className="flex flex-col items-center">
          <PDFUploader onFileSelect={handleFileSelect} isLoading={isProcessing} />

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 max-w-xl">
              {error}
            </div>
          )}
        </div>

        {/* Features */}
        <div className="mt-24 grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-white/20">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Page-Aware Chat
            </h3>
            <p className="text-gray-600 text-sm">
              Ask questions and get answers with context from your current reading position.
            </p>
          </div>

          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-white/20">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Smart Search
            </h3>
            <p className="text-gray-600 text-sm">
              Find information across your entire document with intelligent keyword matching.
            </p>
          </div>

          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-white/20">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Privacy First
            </h3>
            <p className="text-gray-600 text-sm">
              Your documents stay in your browser. We never store your PDFs on our servers.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
