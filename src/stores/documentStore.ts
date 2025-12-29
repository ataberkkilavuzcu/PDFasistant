'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
} from 'react';
import type { ReactNode } from 'react';
import type { PDFDocument } from '@/types/pdf';

interface DocumentState {
  currentDocument: PDFDocument | null;
  currentPage: number;
  isUploading: boolean;
}

interface DocumentActions {
  setDocument: (doc: PDFDocument | null) => void;
  setCurrentPage: (page: number) => void;
  setIsUploading: (uploading: boolean) => void;
  reset: () => void;
}

type DocumentStore = DocumentState & DocumentActions;

const initialState: DocumentState = {
  currentDocument: null,
  currentPage: 1,
  isUploading: false,
};

const DocumentContext = createContext<DocumentStore | null>(null);

export function DocumentProvider(props: { children: ReactNode }) {
  const [state, setState] = useState<DocumentState>(initialState);

  const setDocument = useCallback((doc: PDFDocument | null) => {
    setState((prev) => ({ ...prev, currentDocument: doc, currentPage: 1 }));
  }, []);

  const setCurrentPage = useCallback((page: number) => {
    setState((prev) => ({ ...prev, currentPage: page }));
  }, []);

  const setIsUploading = useCallback((uploading: boolean) => {
    setState((prev) => ({ ...prev, isUploading: uploading }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  const store: DocumentStore = {
    ...state,
    setDocument,
    setCurrentPage,
    setIsUploading,
    reset,
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
