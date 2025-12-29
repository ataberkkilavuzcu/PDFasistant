'use client';

/**
 * Custom hook for PDF state management
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
  clearDocument: () => void;
}

/**
 * Hook for managing PDF document state
 */
export function usePDF(): UsePDFReturn {
  const [state, setState] = useState<UsePDFState>({
    document: null,
    isLoading: false,
    error: null,
  });

  const loadDocument = useCallback(async (id: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const doc = await db.documents.get(id);

      if (!doc) {
        throw new Error('Document not found');
      }

      setState({
        document: doc,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      setState({
        document: null,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load document',
      });
    }
  }, []);

  const saveDocument = useCallback(
    async (metadata: PDFMetadata, pages: PDFPage[]): Promise<string> => {
      const id = generateDocumentId();
      const doc = createPDFDocument(id, metadata, pages);

      await db.documents.put(doc);

      setState({
        document: doc,
        isLoading: false,
        error: null,
      });

      return id;
    },
    []
  );

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
    clearDocument,
  };
}

