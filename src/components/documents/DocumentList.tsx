'use client';

/**
 * Document list component for displaying and managing uploaded PDFs
 * Features:
 * - Display document metadata (title, page count, upload date, size)
 * - Delete documents
 * - Open documents in viewer
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DocumentSummary } from '@/hooks/usePDF';

interface DocumentListProps {
  documents: DocumentSummary[];
  onDelete: (id: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  isLoading?: boolean;
}

/**
 * Format bytes to human-readable size
 */
function formatFileSize(bytes?: number): string {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format date to readable string
 */
function formatDate(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return `Today at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else if (diffDays === 1) {
    return `Yesterday at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

export function DocumentList({ 
  documents, 
  onDelete, 
  onRefresh,
  isLoading = false 
}: DocumentListProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleOpen = useCallback((id: string) => {
    router.push(`/viewer?id=${id}`);
  }, [router]);

  const handleDeleteClick = useCallback((id: string) => {
    setConfirmDeleteId(id);
  }, []);

  const handleConfirmDelete = useCallback(async (id: string) => {
    setDeletingId(id);
    setConfirmDeleteId(null);
    try {
      await onDelete(id);
      await onRefresh();
    } catch (error) {
      console.error('Failed to delete document:', error);
    } finally {
      setDeletingId(null);
    }
  }, [onDelete, onRefresh]);

  const handleCancelDelete = useCallback(() => {
    setConfirmDeleteId(null);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 rounded-full border-4 border-white/10 border-t-primary-500 animate-spin" />
      </div>
    );
  }

  if (documents.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Recent Documents
        </h2>
        <span className="text-sm text-gray-500">{documents.length} document{documents.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="space-y-3">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className={`
              group relative bg-white/5 border border-white/10 rounded-xl p-4
              hover:bg-white/10 hover:border-primary-500/30 transition-all duration-200
              ${deletingId === doc.id ? 'opacity-50 pointer-events-none' : ''}
            `}
          >
            {/* Delete confirmation overlay */}
            {confirmDeleteId === doc.id && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-xl flex items-center justify-center z-10 animate-fade-in">
                <div className="text-center p-4">
                  <p className="text-white mb-3 text-sm">Delete this document?</p>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => handleConfirmDelete(doc.id)}
                      className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                    <button
                      onClick={handleCancelDelete}
                      className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-start gap-4">
              {/* PDF Icon */}
              <div className="flex-shrink-0 w-10 h-12 bg-gradient-to-br from-red-500/20 to-red-600/20 rounded-lg flex items-center justify-center border border-red-500/20">
                <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 13H10v3H8.5v-3zm2 0h1.5v3H10.5v-3zm2 0H14v3h-1.5v-3z" />
                </svg>
              </div>

              {/* Document Info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-medium truncate group-hover:text-primary-300 transition-colors">
                  {doc.metadata.title}
                </h3>
                <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {doc.metadata.pageCount} pages
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                    {formatFileSize(doc.blobSize || doc.metadata.fileSize)}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {formatDate(doc.metadata.uploadDate)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleOpen(doc.id)}
                  className="p-2 rounded-lg bg-primary-500/20 hover:bg-primary-500/30 text-primary-400 transition-colors"
                  title="Open document"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDeleteClick(doc.id)}
                  className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                  title="Delete document"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Click to open (full card) */}
            <button
              onClick={() => handleOpen(doc.id)}
              className="absolute inset-0 z-0"
              aria-label={`Open ${doc.metadata.title}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

