'use client';

/**
 * PDF file upload component with comprehensive validation
 * - File type validation (MIME type + magic bytes)
 * - Size limit enforcement (50MB default, configurable)
 * - Drag & drop support with visual feedback
 */

import { useCallback, useState, useRef, useEffect } from 'react';

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
async function validatePDFMagicBytes(file: File): Promise<{ valid: boolean; reason?: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const arr = new Uint8Array(reader.result as ArrayBuffer);

        // Check if we have enough bytes
        if (arr.length < 4) {
          resolve({ valid: false, reason: 'File too small to be a valid PDF' });
          return;
        }

        // Check for PDF magic bytes
        const hasMagicBytes = PDF_MAGIC_BYTES.every((byte, i) => arr[i] === byte);

        if (!hasMagicBytes) {
          // Log what we actually found for debugging
          const header = Array.from(arr.slice(0, 4))
            .map(b => b.toString(16).padStart(2, '0'))
            .join(' ');
          console.warn(`Invalid PDF header. Expected: 25 50 44 46, Found: ${header}`);
          resolve({ valid: false, reason: `File does not have PDF header (found: ${header})` });
          return;
        }

        resolve({ valid: true });
      } catch (error) {
        console.error('Error validating PDF magic bytes:', error);
        resolve({ valid: false, reason: 'Error reading file header' });
      }
    };
    reader.onerror = () => resolve({ valid: false, reason: 'Error reading file' });
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
  const hasInteractedRef = useRef(false);

  // Reset file input on mount and when page becomes visible/focused
  // This handles navigation back from the viewer page
  useEffect(() => {
    const resetInput = () => {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

    // Reset on mount
    resetInput();

    // Reset when window regains focus (user returns from another tab)
    const handleFocus = () => {
      resetInput();
    };

    // Reset when page becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !hasInteractedRef.current) {
        resetInput();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

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
    const magicBytesResult = await validatePDFMagicBytes(file);
    if (!magicBytesResult.valid) {
      return {
        valid: false,
        error: magicBytesResult.reason || 'Invalid PDF file: corrupted or not a real PDF'
      };
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
          // Reset input on validation error
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          return;
        }

        onFileSelect(file);
        // Reset input after successful file selection
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Validation failed');
        // Reset input on error
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
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
    // Reset input before opening file dialog
    // This ensures the onChange event fires even if selecting the same file
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
          relative border-2 border-dashed rounded-2xl p-12 md:p-16 text-center cursor-pointer
          transition-all duration-300 ease-out group
          ${isDragging
            ? 'border-primary-500 bg-primary-500/5 scale-[1.01] premium-shadow-lg'
            : 'border-neutral-700 hover:border-primary-500/50 hover:bg-neutral-800/30 hover:premium-shadow'
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
            <div className="w-16 h-16 border-4 border-neutral-700 border-t-primary-500 rounded-full animate-spin"></div>
            <p className="text-neutral-400 animate-pulse">
              {isValidating ? 'Validating file...' : 'Processing PDF...'}
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-6 relative z-10">
              <div className={`
                w-20 h-20 rounded-2xl flex items-center justify-center
                bg-gradient-to-br from-primary-500/20 to-accent-500/10
                border border-neutral-700 shadow-lg
                group-hover:scale-110 group-hover:border-primary-500/50 transition-all duration-300
              `}>
                <svg
                  className="w-10 h-10 text-primary-400 transition-colors"
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
              <div className="space-y-3">
                <p className="text-xl font-semibold text-neutral-100 group-hover:text-neutral-50 transition-colors">
                  Drop your PDF here
                </p>
                <p className="text-sm text-neutral-400 group-hover:text-neutral-300 transition-colors">
                  or click to browse
                </p>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-800/50 border border-neutral-700/50">
                  <svg className="w-4 h-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs text-neutral-400">Max {maxSizeMB}MB</span>
                </div>
              </div>
            </div>

            {/* Subtle background effect on hover */}
            <div className="absolute inset-0 bg-gradient-to-tr from-primary-500/0 via-primary-500/[0.02] to-accent-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl pointer-events-none"></div>
          </>
        )}
      </div>

      {error && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-red-400 animate-slide-down">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
