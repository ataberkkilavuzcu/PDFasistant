/**
 * Database schema definitions for IndexedDB via Dexie.js
 */

import type { PDFPage, PDFMetadata } from '@/types/pdf';
import type { MessageRole } from '@/types/chat';

/**
 * Stored PDF document in IndexedDB
 */
export interface StoredDocument {
  id: string;
  metadata: PDFMetadata;
  pages: PDFPage[];
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
 */
export const DB_VERSION = 1;

/**
 * Database name
 */
export const DB_NAME = 'pdfasistant-db';

