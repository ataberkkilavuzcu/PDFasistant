'use client';

/**
 * Custom hook for PDF state management
 * Handles:
 * - Loading documents from IndexedDB
 * - Saving new documents with metadata, pages, and PDF blob
 * - PDF blob storage for viewing
 * - Document deletion functionality
 * - Error handling for storage operations
 */

import { useState, useCallback } from 'react';
import type { PDFDocument, PDFPage, PDFMetadata } from '@/types/pdf';
import { db } from '@/lib/db';
import { generateDocumentId, createPDFDocument } from '@/lib/pdf/extractor';
import { calculateFileHash } from '@/lib/utils/hash';

/** Document summary for list display (without pages/blob for performance) */
export interface DocumentSummary {
  id: string;
  contentHash?: string;
  metadata: PDFMetadata;
  blobSize?: number;
}

interface UsePDFState {
  document: PDFDocument | null;
  isLoading: boolean;
  error: string | null;
}

interface UsePDFReturn extends UsePDFState {
  loadDocument: (id: string) => Promise<void>;
  saveDocument: (metadata: PDFMetadata, pages: PDFPage[], pdfBlob?: Blob) => Promise<string>;
  updateDocument: (id: string, updates: Partial<Pick<PDFDocument, 'metadata'>>) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  clearDocument: () => void;
  getAllDocuments: () => Promise<PDFDocument[]>;
  getDocumentSummaries: () => Promise<DocumentSummary[]>;
  getPDFBlob: (id: string) => Promise<Blob | null>;
  getDocumentById: (id: string) => Promise<PDFDocument | null>;
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
   */
  const loadDocument = useCallback(async (id: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const doc = await db.documents.get(id);

      if (!doc) {
        throw new Error('Document not found in local storage');
      }

      setState({
        document: doc,
        isLoading: false,
        error: null,
      });
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

        // Add blob data and content hash
        const docWithBlob = {
          ...doc,
          contentHash,
          pdfBlob,
          blobSize: pdfBlob?.size,
        };

        // Use transaction for atomic operation
        await db.transaction('rw', db.documents, async () => {
          await db.documents.put(docWithBlob);
        });

        setState({
          document: docWithBlob,
          isLoading: false,
          error: null,
        });

        const blobInfo = pdfBlob ? `, blob: ${(pdfBlob.size / 1024 / 1024).toFixed(2)}MB` : '';
        console.log(`Document saved: ${id} (${pages.length} pages${blobInfo})`);
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
   * More efficient for displaying document lists
   */
  const getDocumentSummaries = useCallback(async (): Promise<DocumentSummary[]> => {
    try {
      const docs = await db.documents.orderBy('metadata.uploadDate').reverse().toArray();
      // Return only metadata (exclude pages and blob for performance)
      return docs.map(doc => ({
        id: doc.id,
        contentHash: doc.contentHash,
        metadata: doc.metadata,
        blobSize: doc.blobSize,
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

  return {
    ...state,
    loadDocument,
    saveDocument,
    updateDocument,
    deleteDocument,
    clearDocument,
    getAllDocuments,
    getDocumentSummaries,
    getPDFBlob,
    getDocumentById,
  };
}

