'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import type { DocumentSummary } from '@/hooks/usePDF';
import { usePDF } from '@/hooks';

interface DocumentListProps {
  documents: DocumentSummary[];
  lastOpenedDocumentId: string | null;
  onDocumentDeleted: (id: string) => void;
  onDocumentRenamed?: (id: string, newTitle: string) => void;
}

export function DocumentList({
  documents,
  lastOpenedDocumentId,
  onDocumentDeleted,
  onDocumentRenamed,
}: DocumentListProps) {
  const router = useRouter();
  const { deleteDocument, updateDocument } = usePDF();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const handleOpenDocument = useCallback(
    (id: string) => {
      router.push(`/viewer?id=${id}`);
    },
    [router]
  );

  const handleDelete = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (deletingId) return;

      setDeletingId(id);
      try {
        await deleteDocument(id);
        onDocumentDeleted(id);
      } catch (err) {
        console.error('Failed to delete document:', err);
      } finally {
        setDeletingId(null);
      }
    },
    [deleteDocument, deletingId, onDocumentDeleted]
  );

  const handleStartRename = useCallback((e: React.MouseEvent, doc: DocumentSummary) => {
    e.stopPropagation();
    setEditingId(doc.id);
    setEditTitle(doc.metadata.title);
  }, []);

  const handleSaveRename = useCallback(async (id: string) => {
    const trimmed = editTitle.trim();
    if (!trimmed || trimmed === documents.find(d => d.id === id)?.metadata.title) {
      setEditingId(null);
      return;
    }
    try {
      await updateDocument(id, { metadata: { title: trimmed } as never });
      onDocumentRenamed?.(id, trimmed);
    } catch (err) {
      console.error('Failed to rename:', err);
    }
    setEditingId(null);
  }, [editTitle, documents, updateDocument, onDocumentRenamed]);

  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveRename(id);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  }, [handleSaveRename]);

  // Focus the input when editing starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (documents.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2
          className="text-lg font-semibold text-white"
          style={{ fontFamily: 'Outfit, sans-serif' }}
        >
          Recent Documents
        </h2>
        <span className="text-sm text-gray-500">{documents.length} document{documents.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="space-y-2">
        {documents.map((doc) => {
          const isLastOpened = doc.id === lastOpenedDocumentId;
          const isDeleting = deletingId === doc.id;

          return (
            <button
              key={doc.id}
              onClick={() => handleOpenDocument(doc.id)}
              disabled={isDeleting}
              className={`
                w-full group relative p-4 rounded-xl text-left transition-all duration-300
                bg-gradient-to-br from-[#0f1419]/80 to-[#0a0a0b]/80 backdrop-blur-sm
                border border-white/5 hover:border-emerald-500/30
                hover:shadow-lg hover:shadow-emerald-500/5
                disabled:opacity-50 disabled:cursor-not-allowed
                ${isLastOpened ? 'ring-1 ring-emerald-500/20 border-emerald-500/20' : ''}
              `}
            >
              {/* Glow effect on hover */}
              <div className="absolute -inset-[1px] bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 rounded-xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />

              <div className="flex items-start gap-4">
                {/* Document Icon */}
                <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-emerald-500/20 to-teal-500/10 rounded-lg flex items-center justify-center border border-emerald-500/10">
                  <svg
                    className="w-5 h-5 text-emerald-400"
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

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {editingId === doc.id ? (
                      <input
                        ref={editInputRef}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={() => handleSaveRename(doc.id)}
                        onKeyDown={(e) => handleRenameKeyDown(e, doc.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm font-medium text-white bg-white/10 border border-emerald-500/30 rounded px-2 py-0.5 w-full outline-none focus:border-emerald-500/60"
                      />
                    ) : (
                      <h3
                        className="text-sm font-medium text-white truncate group-hover:text-emerald-50 transition-colors cursor-text"
                        onDoubleClick={(e) => handleStartRename(e, doc)}
                        title="Double-click to rename"
                      >
                        {doc.metadata.title}
                      </h3>
                    )}
                    {isLastOpened && editingId !== doc.id && (
                      <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20">
                        LAST
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span>{doc.metadata.pageCount} pages</span>
                    {doc.blobSize && (
                      <>
                        <span className="text-gray-600">•</span>
                        <span>{formatFileSize(doc.blobSize)}</span>
                      </>
                    )}
                    <span className="text-gray-600">•</span>
                    <span>
                      {formatDistanceToNow(new Date(doc.metadata.uploadDate), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>

                {/* Rename Button */}
                <button
                  onClick={(e) => handleStartRename(e, doc)}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white transition-all duration-200"
                  title="Rename document"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>

                {/* Delete Button */}
                <button
                  onClick={(e) => handleDelete(e, doc.id)}
                  disabled={isDeleting}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-all duration-200"
                  title="Delete document"
                >
                  {isDeleting ? (
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  )}
                </button>
              </div>

              {/* Hover arrow indicator */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                <svg
                  className="w-5 h-5 text-emerald-400/50"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

