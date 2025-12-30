/**
 * Database schema definitions for IndexedDB via Dexie.js
 */

import type { PDFPage, PDFMetadata } from '@/types/pdf';
import type { MessageRole } from '@/types/chat';

/**
 * Stored PDF document in IndexedDB
 * Includes optional blob storage for the original PDF file
 */
export interface StoredDocument {
  id: string;
  metadata: PDFMetadata;
  pages: PDFPage[];
  /** Original PDF file as Blob (optional, for viewing) */
  pdfBlob?: Blob;
  /** Size of the PDF blob in bytes */
  blobSize?: number;
}

/**
 * Stored chat message in IndexedDB
 */
export interface StoredMessage {
  id: string;
  documentId: string;
  role: MessageRole;
  content: string;
  pageContext?: number;
  pageReferences?: number[];
  timestamp: Date;
}

/**
 * User preferences stored in IndexedDB
 */
export interface UserPreferences {
  id: string;
  theme: 'light' | 'dark' | 'system';
  contextWindowSize: number;
  lastOpenedDocumentId?: string;
}

/**
 * Database table names
 */
export const TABLE_NAMES = {
  DOCUMENTS: 'documents',
  MESSAGES: 'messages',
  PREFERENCES: 'preferences',
} as const;

/**
 * Database schema version
 * Version 2: Added pdfBlob and blobSize fields to documents
 */
export const DB_VERSION = 2;

/**
 * Database name
 */
export const DB_NAME = 'pdfasistant-db';

