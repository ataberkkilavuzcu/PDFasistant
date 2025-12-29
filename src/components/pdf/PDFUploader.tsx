'use client';

/**
 * PDF file upload component
 */

import { useCallback, useState, useRef } from 'react';

interface PDFUploaderProps {
  onFileSelect: (file: File) => void;
  isLoading?: boolean;
}

export function PDFUploader({ onFileSelect, isLoading = false }: PDFUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): boolean => {
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return false;
    }

    // 50MB limit
    if (file.size > 50 * 1024 * 1024) {
      setError('File size must be less than 50MB');
      return false;
    }

    setError(null);
    return true;
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      if (validateFile(file)) {
        onFileSelect(file);
      }
    },
    [validateFile, onFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="w-full">
      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative border-2 border-dashed rounded-xl p-16 text-center cursor-pointer
          transition-all duration-300 ease-in-out group
          ${isDragging
            ? 'border-primary-500 bg-primary-500/10 scale-[1.02]'
            : 'border-white/10 hover:border-primary-500/50 hover:bg-white/5'
          }
          ${isLoading ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleInputChange}
          className="hidden"
        />

        {isLoading ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full border-4 border-white/10 border-t-primary-500 animate-spin"></div>
            <p className="text-gray-400 animate-pulse">Processing PDF...</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-6 relative z-10">
              <div className={`
                w-20 h-20 rounded-2xl flex items-center justify-center
                bg-gradient-to-br from-primary-500/20 to-purple-500/20
                border border-white/10 shadow-xl shadow-primary-500/5
                group-hover:scale-110 transition-transform duration-300
              `}>
                <svg
                  className="w-10 h-10 text-primary-400 group-hover:text-primary-300 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <div className="space-y-2">
                <p className="text-xl font-medium text-white group-hover:text-primary-200 transition-colors">
                  Drop your PDF here
                </p>
                <p className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
                  or click to browse <span className="px-2 py-0.5 rounded bg-white/10 text-xs">MAX 50MB</span>
                </p>
              </div>
            </div>
            
            {/* Background glow effect on hover */}
            <div className="absolute inset-0 bg-gradient-to-tr from-primary-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl pointer-events-none"></div>
          </>
        )}
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-400 text-center animate-fade-in flex items-center justify-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
          {error}
        </p>
      )}
    </div>
  );
}
