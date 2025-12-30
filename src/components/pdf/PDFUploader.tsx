'use client';

/**
 * PDF file upload component with comprehensive validation
 * - File type validation (MIME type + magic bytes)
 * - Size limit enforcement (50MB default, configurable)
 * - Drag & drop support with visual feedback
 */

import { useCallback, useState, useRef } from 'react';

/** PDF magic bytes signature */
const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46]; // %PDF

/** Default max file size: 50MB */
const DEFAULT_MAX_SIZE_MB = 50;

export interface PDFUploaderProps {
  onFileSelect: (file: File) => void;
  isLoading?: boolean;
  maxSizeMB?: number;
}

export interface PDFValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate PDF file by checking magic bytes (file signature)
 * This catches files with wrong extension or corrupted headers
 */
async function validatePDFMagicBytes(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const arr = new Uint8Array(reader.result as ArrayBuffer);
      const isPDF = PDF_MAGIC_BYTES.every((byte, i) => arr[i] === byte);
      resolve(isPDF);
    };
    reader.onerror = () => resolve(false);
    // Only read first 4 bytes for magic number check
    reader.readAsArrayBuffer(file.slice(0, 4));
  });
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PDFUploader({ 
  onFileSelect, 
  isLoading = false,
  maxSizeMB = DEFAULT_MAX_SIZE_MB 
}: PDFUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const validateFile = useCallback(async (file: File): Promise<PDFValidationResult> => {
    // Check MIME type first (fast check)
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return { valid: false, error: 'Please upload a PDF file' };
    }

    // Check file size
    if (file.size > maxSizeBytes) {
      return { 
        valid: false, 
        error: `File size (${formatFileSize(file.size)}) exceeds ${maxSizeMB}MB limit` 
      };
    }

    // Check if file is empty
    if (file.size === 0) {
      return { valid: false, error: 'File is empty' };
    }

    // Validate PDF magic bytes (catches corrupted or fake PDFs)
    const hasValidMagicBytes = await validatePDFMagicBytes(file);
    if (!hasValidMagicBytes) {
      return { valid: false, error: 'Invalid PDF file: corrupted or not a real PDF' };
    }

    return { valid: true };
  }, [maxSizeBytes, maxSizeMB]);

  const handleFile = useCallback(
    async (file: File) => {
      setIsValidating(true);
      setError(null);
      
      try {
        const result = await validateFile(file);
        
        if (!result.valid) {
          setError(result.error || 'Invalid file');
          return;
        }
        
        onFileSelect(file);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Validation failed');
      } finally {
        setIsValidating(false);
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
          ${isLoading || isValidating ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleInputChange}
          className="hidden"
        />

        {isLoading || isValidating ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full border-4 border-white/10 border-t-primary-500 animate-spin"></div>
            <p className="text-gray-400 animate-pulse">
              {isValidating ? 'Validating file...' : 'Processing PDF...'}
            </p>
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
