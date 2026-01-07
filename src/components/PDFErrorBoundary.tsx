'use client';

import React, { type ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

interface PDFErrorBoundaryProps {
  children: ReactNode;
}

/**
 * Specialized error boundary for PDF-related errors
 */
export function PDFErrorBoundary({ children }: PDFErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={
        <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-4">
          <div className="max-w-lg w-full">
            <div className="relative bg-gradient-to-br from-[#0f1419] to-[#0a0a0b] rounded-2xl p-8 border border-red-500/20">
              {/* PDF Error Icon */}
              <div className="w-16 h-16 bg-red-500/10 rounded-xl flex items-center justify-center mb-6 mx-auto border border-red-500/20">
                <svg
                  className="w-8 h-8 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>

              {/* Error Title */}
              <h2 className="text-2xl font-bold text-white text-center mb-3">
                PDF Viewer Error
              </h2>

              {/* Error Message */}
              <p className="text-gray-400 text-center mb-6">
                We encountered an issue while loading or displaying your PDF document.
                This could be due to:
              </p>

              {/* Possible Causes */}
              <ul className="text-sm text-gray-400 space-y-2 mb-6 list-disc list-inside">
                <li>Corrupted or invalid PDF file</li>
                <li>Browser compatibility issues</li>
                <li>Memory limitations</li>
                <li>Protected or encrypted PDF</li>
              </ul>

              {/* Actions */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 rounded-lg text-red-300 font-medium transition-all duration-200"
                >
                  Reload Page
                </button>
                <button
                  onClick={() => window.location.href = '/'}
                  className="px-4 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/30 rounded-lg text-emerald-300 font-medium transition-all duration-200"
                >
                  Try Another PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      }
      onError={(error, errorInfo) => {
        console.error('PDF Error:', error);
        console.error('Component Stack:', errorInfo.componentStack);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

