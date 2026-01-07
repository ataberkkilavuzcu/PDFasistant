'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import type { ReactNode } from 'react';
import type { PDFDocument } from '@/types/pdf';
import { db } from '@/lib/db';
import type { DocumentSummary } from '@/hooks/usePDF';

interface DocumentState {
  currentDocument: PDFDocument | null;
  currentPage: number;
  isUploading: boolean;
  recentDocuments: DocumentSummary[];
  lastOpenedDocumentId: string | null;
  isLoadingRecent: boolean;
}

interface DocumentActions {
  setDocument: (doc: PDFDocument | null) => void;
  setCurrentPage: (page: number) => void;
  setIsUploading: (uploading: boolean) => void;
  reset: () => void;
  loadRecentDocuments: () => Promise<void>;
  setLastOpenedDocument: (documentId: string | null) => Promise<void>;
  removeRecentDocument: (documentId: string) => void;
  getLastOpenedDocumentId: () => Promise<string | null>;
}

type DocumentStore = DocumentState & DocumentActions;

const PREFERENCES_ID = 'user-preferences';

const initialState: DocumentState = {
  currentDocument: null,
  currentPage: 1,
  isUploading: false,
  recentDocuments: [],
  lastOpenedDocumentId: null,
  isLoadingRecent: false,
};

const DocumentContext = createContext<DocumentStore | null>(null);

export function DocumentProvider(props: { children: ReactNode }) {
  const [state, setState] = useState<DocumentState>(initialState);

  const loadRecentDocuments = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoadingRecent: true }));
    try {
      const docs = await db.documents
        .orderBy('metadata.uploadDate')
        .reverse()
        .limit(10)
        .toArray();

      const summaries: DocumentSummary[] = docs.map((doc) => ({
        id: doc.id,
        contentHash: doc.contentHash,
        metadata: doc.metadata,
        blobSize: doc.blobSize,
      }));

      setState((prev) => ({
        ...prev,
        recentDocuments: summaries,
        isLoadingRecent: false,
      }));
    } catch (err) {
      console.error('Failed to load recent documents:', err);
      setState((prev) => ({ ...prev, isLoadingRecent: false }));
    }
  }, []);

  const loadLastOpenedDocument = useCallback(async () => {
    try {
      const prefs = await db.preferences.get(PREFERENCES_ID);
      if (prefs?.lastOpenedDocumentId) {
        setState((prev) => ({
          ...prev,
          lastOpenedDocumentId: prefs.lastOpenedDocumentId || null,
        }));
      }
    } catch (err) {
      console.error('Failed to load last opened document:', err);
    }
  }, []);

  const setLastOpenedDocument = useCallback(async (documentId: string | null) => {
    setState((prev) => ({ ...prev, lastOpenedDocumentId: documentId }));
    try {
      const prefs = await db.preferences.get(PREFERENCES_ID);
      await db.preferences.put({
        id: PREFERENCES_ID,
        theme: prefs?.theme || 'system',
        contextWindowSize: prefs?.contextWindowSize || 3,
        lastOpenedDocumentId: documentId || undefined,
      });
    } catch (err) {
      console.error('Failed to save last opened document:', err);
    }
  }, []);

  const setDocument = useCallback((doc: PDFDocument | null) => {
    setState((prev) => ({ ...prev, currentDocument: doc, currentPage: 1 }));
    // Update last opened document when setting a document
    if (doc) {
      setLastOpenedDocument(doc.id);
    }
  }, [setLastOpenedDocument]);

  const setCurrentPage = useCallback((page: number) => {
    setState((prev) => ({ ...prev, currentPage: page }));
  }, []);

  const setIsUploading = useCallback((uploading: boolean) => {
    setState((prev) => ({ ...prev, isUploading: uploading }));
  }, []);

  // Load recent documents and last opened document on mount
  useEffect(() => {
    loadRecentDocuments();
    loadLastOpenedDocument();
  }, [loadRecentDocuments, loadLastOpenedDocument]);

  const getLastOpenedDocumentId = useCallback(async (): Promise<string | null> => {
    try {
      const prefs = await db.preferences.get(PREFERENCES_ID);
      return prefs?.lastOpenedDocumentId || null;
    } catch (err) {
      console.error('Failed to get last opened document ID:', err);
      return null;
    }
  }, []);

  const removeRecentDocument = useCallback((documentId: string) => {
    setState((prev) => ({
      ...prev,
      recentDocuments: prev.recentDocuments.filter((d) => d.id !== documentId),
      lastOpenedDocumentId:
        prev.lastOpenedDocumentId === documentId ? null : prev.lastOpenedDocumentId,
    }));
  }, []);

  const reset = useCallback(() => {
    setState((prev) => ({
      ...initialState,
      recentDocuments: prev.recentDocuments,
    }));
  }, []);

  const store: DocumentStore = {
    ...state,
    setDocument,
    setCurrentPage,
    setIsUploading,
    reset,
    loadRecentDocuments,
    setLastOpenedDocument,
    removeRecentDocument,
    getLastOpenedDocumentId,
  };

  return React.createElement(
    DocumentContext.Provider,
    { value: store },
    props.children
  );
}

export function useDocumentStore(): DocumentStore {
  const context = useContext(DocumentContext);

  if (!context) {
    throw new Error('useDocumentStore must be used within a DocumentProvider');
  }

  return context;
}

/** Optional hook that returns null if used outside provider (for conditional usage) */
export function useDocumentStoreOptional(): DocumentStore | null {
  return useContext(DocumentContext);
}
