'use client';

/**
 * Custom hook for PDF state management
 * Handles:
 * - Loading documents from IndexedDB
 * - Saving new documents with metadata and pages
 * - Error handling for storage operations
 */

import { useState, useCallback } from 'react';
import type { PDFDocument, PDFPage, PDFMetadata } from '@/types/pdf';
import { db } from '@/lib/db';
import { generateDocumentId, createPDFDocument } from '@/lib/pdf/extractor';

interface UsePDFState {
  document: PDFDocument | null;
  isLoading: boolean;
  error: string | null;
}

interface UsePDFReturn extends UsePDFState {
  loadDocument: (id: string) => Promise<void>;
  saveDocument: (metadata: PDFMetadata, pages: PDFPage[]) => Promise<string>;
  deleteDocument: (id: string) => Promise<void>;
  clearDocument: () => void;
  getAllDocuments: () => Promise<PDFDocument[]>;
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
   * Returns the generated document ID
   */
  const saveDocument = useCallback(
    async (metadata: PDFMetadata, pages: PDFPage[]): Promise<string> => {
      try {
        const id = generateDocumentId();
        const doc = createPDFDocument(id, metadata, pages);

        // Use transaction for atomic operation
        await db.transaction('rw', db.documents, async () => {
          await db.documents.put(doc);
        });

        setState({
          document: doc,
          isLoading: false,
          error: null,
        });

        console.log(`Document saved: ${id} (${pages.length} pages, ${metadata.fileSize} bytes)`);
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
    deleteDocument,
    clearDocument,
    getAllDocuments,
  };
}

