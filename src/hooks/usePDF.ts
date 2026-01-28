'use client';

/**
 * Custom hook for PDF state management
 * Handles:
 * - Loading documents from IndexedDB
 * - Saving new documents with metadata, pages, and PDF blob
 * - PDF blob storage for viewing
 * - Document deletion functionality
 * - Error handling for storage operations
 * - Compression support for page text (Phase 7.2)
 * - Cleanup utilities for old documents (Phase 7.2)
 */

import { useState, useCallback } from 'react';
import type { PDFDocument, PDFPage, PDFMetadata } from '@/types/pdf';
import { db } from '@/lib/db';
import { generateDocumentId, createPDFDocument } from '@/lib/pdf/extractor';
import { calculateFileHash } from '@/lib/utils/hash';
import { compressIfNeeded, decompressIfNeeded, getTextSize } from '@/lib/db/compression';
import {
  cleanupOldDocuments,
  getDatabaseSize,
  getDocumentsBySize,
  type StorageStats,
} from '@/lib/db/cleanup';

/** Document summary for list display (without pages/blob for performance) */
export interface DocumentSummary {
  id: string;
  contentHash?: string;
  metadata: PDFMetadata;
  blobSize?: number;
  title?: string;
  uploadDate?: Date;
  fileSize?: number;
}

interface UsePDFState {
  document: PDFDocument | null;
  isLoading: boolean;
  error: string | null;
}

interface UsePDFReturn extends UsePDFState {
  loadDocument: (id: string) => Promise<void>;
  saveDocument: (metadata: PDFMetadata, pages: PDFPage[], pdfBlob?: Blob) => Promise<string>;
  saveDocumentStreaming: (metadata: PDFMetadata, pages: PDFPage[], pdfBlob?: Blob, documentId?: string) => Promise<string>;
  updateDocument: (id: string, updates: Partial<Pick<PDFDocument, 'metadata'>>) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  clearDocument: () => void;
  getAllDocuments: () => Promise<PDFDocument[]>;
  getDocumentSummaries: () => Promise<DocumentSummary[]>;
  getPDFBlob: (id: string) => Promise<Blob | null>;
  getDocumentById: (id: string) => Promise<PDFDocument | null>;
  // Phase 7.2: Cleanup and storage management methods
  cleanupOldDocuments: (daysOld: number) => Promise<{ deletedCount: number; freedSpace: string }>;
  getStorageStats: () => Promise<StorageStats>;
  getLargestDocuments: (limit?: number) => Promise<Array<{ id: string; title: string; uploadDate: Date; totalSize: string }>>;
}

/**
 * Hook for managing PDF document state and IndexedDB storage
 */
export function usePDF(): UsePDFReturn {
  const [state, setState] = useState<UsePDFState>({
    document: null,
    isLoading: false,
    error: null,
  });

  /**
   * Load a document from IndexedDB by ID
   * Phase 7.2: Handles decompression of page text
   */
  const loadDocument = useCallback(async (id: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const doc = await db.documents.get(id);

      if (!doc) {
        throw new Error('Document not found in local storage');
      }

      // Decompress page text if compressed (Phase 7.2)
      if (doc.pages && doc.pages.length > 0) {
        type CompressedPDFPage = typeof doc.pages[number] & { _compressed?: boolean };

        const decompressedPages = doc.pages.map((page) => {
          const pageWithCompressionFlag = page as CompressedPDFPage;

          if (pageWithCompressionFlag.text && pageWithCompressionFlag._compressed) {
            return {
              ...pageWithCompressionFlag,
              text: decompressIfNeeded(pageWithCompressionFlag.text, true),
            };
          }

          return pageWithCompressionFlag;
        });
        const decompressedDoc = { ...doc, pages: decompressedPages };

        setState({
          document: decompressedDoc,
          isLoading: false,
          error: null,
        });
      } else {
        setState({
          document: doc,
          isLoading: false,
          error: null,
        });
      }
    } catch (err) {
      console.error('Failed to load document:', err);
      setState({
        document: null,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load document',
      });
    }
  }, []);

  /**
   * Save a new document to IndexedDB
   * Optionally stores the original PDF blob for viewing
   * Returns the generated document ID
   * Implements deduplication: if a PDF with the same content already exists,
   * returns the existing document ID instead of creating a duplicate.
   *
   * Phase 7.2: Compresses page text and adds flat properties for indexing
   */
  const saveDocument = useCallback(
    async (metadata: PDFMetadata, pages: PDFPage[], pdfBlob?: Blob): Promise<string> => {
      try {
        // Calculate content hash if blob is provided (for deduplication)
        let contentHash: string | undefined;
        if (pdfBlob) {
          contentHash = await calculateFileHash(pdfBlob);

          // Check for existing document with same content
          const existing = await db.documents.where('contentHash').equals(contentHash).first();

          if (existing) {
            // Deduplication: return existing document ID
            console.log(`Duplicate detected, reusing existing document: ${existing.id}`);
            setState({
              document: existing,
              isLoading: false,
              error: null,
            });
            return existing.id;
          }
        }

        // Generate new ID and create document
        const id = generateDocumentId();
        const doc = createPDFDocument(id, metadata, pages);

        // Phase 7.2: Compress page text
        let compressedSize = 0;
        let originalSize = 0;
        const compressedPages = pages.map((page) => {
          const originalText = page.text || '';
          const textSize = getTextSize(originalText);
          originalSize += textSize;

          const result = compressIfNeeded(originalText);
          compressedSize += result.compressedSize;

          return {
            ...page,
            text: result.text,
            _compressed: result.compressed,
          };
        });

        // Add blob data, content hash, flat properties, and compression stats
        const docWithBlob = {
          ...doc,
          pages: compressedPages,
          contentHash,
          pdfBlob,
          blobSize: pdfBlob?.size,
          // Phase 7.2: Flat properties for proper indexing
          title: metadata.title,
          uploadDate: metadata.uploadDate,
          fileSize: metadata.fileSize,
          // Phase 7.2: Compression statistics
          originalSize,
          compressedSize,
        };

        // Use transaction for atomic operation
        await db.transaction('rw', db.documents, async () => {
          await db.documents.put(docWithBlob);
        });

        // Keep decompressed version in state
        setState({
          document: doc,
          isLoading: false,
          error: null,
        });

        const blobInfo = pdfBlob ? `, blob: ${(pdfBlob.size / 1024 / 1024).toFixed(2)}MB` : '';
        const compressionInfo = originalSize > 0
          ? `, compressed: ${((compressedSize / originalSize) * 100).toFixed(0)}%`
          : '';
        console.log(`Document saved: ${id} (${pages.length} pages${blobInfo}${compressionInfo})`);
        return id;
      } catch (err) {
        console.error('Failed to save document:', err);

        // Check for quota exceeded errors
        let errorMessage = 'Failed to save document';
        if (err instanceof Error) {
          if (err.name === 'QuotaExceededError' || err.message.includes('quota')) {
            errorMessage = 'Storage quota exceeded. Please delete some documents and try again.';
          } else {
            errorMessage = err.message;
          }
        }

        setState((prev) => ({ ...prev, error: errorMessage }));
        throw new Error(errorMessage);
      }
    },
    []
  );

  /**
   * Save a document incrementally as pages are extracted
   * This allows users to see progress and start viewing sooner
   * Returns the document ID on first call, and updates on subsequent calls
   */
  const saveDocumentStreaming = useCallback(
    async (metadata: PDFMetadata, pages: PDFPage[], pdfBlob?: Blob, documentId?: string): Promise<string> => {
      try {
        const id = documentId || generateDocumentId();
        const doc = createPDFDocument(id, metadata, pages);

        // Add blob data
        let docWithBlob = { ...doc };

        if (documentId) {
          // UPDATING existing document - preserve existing blob data
          const existing = await db.documents.get(documentId);
          if (existing) {
            // Keep existing contentHash, pdfBlob, and blobSize
            docWithBlob = {
              ...doc,
              contentHash: existing.contentHash,
              pdfBlob: existing.pdfBlob,
              blobSize: existing.blobSize,
            };
          }
        } else if (pdfBlob) {
          // FIRST SAVE - attach blob and calculate hash
          const contentHash = await calculateFileHash(pdfBlob);
          docWithBlob = {
            ...doc,
            contentHash,
            pdfBlob,
            blobSize: pdfBlob.size,
          };
        }

        // Update or create document
        await db.transaction('rw', db.documents, async () => {
          await db.documents.put(docWithBlob);
        });

        // Only set state if this is the final save (all pages)
        if (pages.length === metadata.pageCount) {
          setState({
            document: docWithBlob,
            isLoading: false,
            error: null,
          });
        }

        console.log(`Document streaming save: ${id} (${pages.length}/${metadata.pageCount} pages)`);
        return id;
      } catch (err) {
        console.error('Failed to save document incrementally:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to save document';
        setState((prev) => ({ ...prev, error: errorMessage }));
        throw new Error(errorMessage);
      }
    },
    []
  );

  /**
   * Update document metadata (e.g., rename title)
   */
  const updateDocument = useCallback(async (id: string, updates: Partial<Pick<PDFDocument, 'metadata'>>) => {
    try {
      const doc = await db.documents.get(id);
      if (!doc) {
        throw new Error('Document not found');
      }

      const updatedDoc = {
        ...doc,
        metadata: {
          ...doc.metadata,
          ...updates.metadata,
        },
      };

      await db.documents.put(updatedDoc);

      // Update state if this is the current document
      setState((prev) => ({
        ...prev,
        document: prev.document?.id === id ? updatedDoc : prev.document,
      }));

      console.log(`Document updated: ${id}`);
    } catch (err) {
      console.error('Failed to update document:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update document';
      setState((prev) => ({ ...prev, error: errorMessage }));
      throw new Error(errorMessage);
    }
  }, []);

  /**
   * Delete a document and its associated messages from IndexedDB
   */
  const deleteDocument = useCallback(async (id: string) => {
    try {
      await db.transaction('rw', [db.documents, db.messages], async () => {
        await db.documents.delete(id);
        await db.messages.where('documentId').equals(id).delete();
      });

      setState((prev) => ({
        ...prev,
        document: prev.document?.id === id ? null : prev.document,
      }));
      
      console.log(`Document deleted: ${id}`);
    } catch (err) {
      console.error('Failed to delete document:', err);
      throw err;
    }
  }, []);

  /**
   * Get all stored documents (for document list/history)
   * Note: This returns full documents including pages - use getDocumentSummaries for lists
   */
  const getAllDocuments = useCallback(async (): Promise<PDFDocument[]> => {
    try {
      const docs = await db.documents.orderBy('metadata.uploadDate').reverse().toArray();
      return docs;
    } catch (err) {
      console.error('Failed to get documents:', err);
      return [];
    }
  }, []);

  /**
   * Get document summaries (metadata only, no pages/blob)
   * Phase 7.2: Uses flat indexes for faster queries
   */
  const getDocumentSummaries = useCallback(async (): Promise<DocumentSummary[]> => {
    try {
      // Phase 7.2: Use flat uploadDate index instead of nested metadata.uploadDate
      const docs = await db.documents.orderBy('uploadDate').reverse().toArray();
      // Return only metadata (exclude pages and blob for performance)
      return docs.map(doc => ({
        id: doc.id,
        contentHash: doc.contentHash,
        metadata: doc.metadata,
        blobSize: doc.blobSize,
        // Phase 7.2: Include flat properties
        title: doc.title,
        uploadDate: doc.uploadDate,
        fileSize: doc.fileSize,
      }));
    } catch (err) {
      console.error('Failed to get document summaries:', err);
      return [];
    }
  }, []);

  /**
   * Get the PDF blob for a document (for viewing)
   */
  const getPDFBlob = useCallback(async (id: string): Promise<Blob | null> => {
    try {
      const doc = await db.documents.get(id);
      return doc?.pdfBlob || null;
    } catch (err) {
      console.error('Failed to get PDF blob:', err);
      return null;
    }
  }, []);

  /**
   * Get a document by ID without setting it as current
   */
  const getDocumentById = useCallback(async (id: string): Promise<PDFDocument | null> => {
    try {
      const doc = await db.documents.get(id);
      return doc || null;
    } catch (err) {
      console.error('Failed to get document by ID:', err);
      return null;
    }
  }, []);

  /**
   * Clear current document from state (does not delete from storage)
   */
  const clearDocument = useCallback(() => {
    setState({
      document: null,
      isLoading: false,
      error: null,
    });
  }, []);

  /**
   * Phase 7.2: Cleanup old documents to free up storage space
   */
  const cleanupOldDocumentsCallback = useCallback(async (daysOld: number) => {
    try {
      const result = await cleanupOldDocuments(daysOld);
      return {
        deletedCount: result.deletedDocuments,
        freedSpace: result.freedSpaceFormatted,
      };
    } catch (err) {
      console.error('Failed to cleanup old documents:', err);
      throw err;
    }
  }, []);

  /**
   * Phase 7.2: Get storage statistics
   */
  const getStorageStatsCallback = useCallback(async (): Promise<StorageStats> => {
    try {
      return await getDatabaseSize();
    } catch (err) {
      console.error('Failed to get storage stats:', err);
      throw err;
    }
  }, []);

  /**
   * Phase 7.2: Get largest documents to help users decide what to delete
   */
  const getLargestDocumentsCallback = useCallback(async (limit = 10) => {
    try {
      const docs = await getDocumentsBySize(limit);
      return docs.map(doc => ({
        id: doc.id,
        title: doc.title,
        uploadDate: doc.uploadDate,
        totalSize: doc.totalSizeFormatted,
      }));
    } catch (err) {
      console.error('Failed to get largest documents:', err);
      throw err;
    }
  }, []);

  return {
    ...state,
    loadDocument,
    saveDocument,
    saveDocumentStreaming,
    updateDocument,
    deleteDocument,
    clearDocument,
    getAllDocuments,
    getDocumentSummaries,
    getPDFBlob,
    getDocumentById,
    // Phase 7.2: Cleanup and storage management methods
    cleanupOldDocuments: cleanupOldDocumentsCallback,
    getStorageStats: getStorageStatsCallback,
    getLargestDocuments: getLargestDocumentsCallback,
  };
}

