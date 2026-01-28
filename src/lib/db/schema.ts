/**
 * Database schema definitions for IndexedDB via Dexie.js
 */

import type { PDFPage, PDFMetadata } from '@/types/pdf';
import type { MessageRole } from '@/types/chat';

/**
 * Stored PDF document in IndexedDB
 * Includes optional blob storage for the original PDF file
 *
 * Version 5: Added flat properties for proper indexing
 * - title, uploadDate, fileSize are flattened from metadata for Dexie indexes
 * - compressedSize and originalSize track compression stats
 */
export interface StoredDocument {
  id: string;
  /** SHA-256 hash of PDF content for deduplication */
  contentHash?: string;
  metadata: PDFMetadata;
  pages: PDFPage[];
  /** Original PDF file as Blob (for viewing) */
  pdfBlob?: Blob;
  /** Size of the PDF blob in bytes */
  blobSize?: number;

  // Version 5: Flat properties for proper Dexie indexing
  /** Flattened from metadata.title for indexed queries */
  title?: string;
  /** Flattened from metadata.uploadDate for indexed sorting */
  uploadDate?: Date;
  /** Flattened from metadata.fileSize for indexed filtering */
  fileSize?: number;

  // Version 5: Compression statistics
  /** Compressed size of all page text in bytes */
  compressedSize?: number;
  /** Original size of all page text in bytes (before compression) */
  originalSize?: number;
}

/**
 * Stored chat message in IndexedDB
 */
export interface StoredMessage {
  id: string;
  documentId: string;
  conversationId: string; // Groups messages into conversations
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
 * Version 3: Added contentHash for PDF deduplication
 * Version 4: Added conversationId to messages for conversation sessions
 * Version 5:
 *   - Added flat properties (title, uploadDate, fileSize) for proper Dexie indexing
 *   - Added compression support for page text (compressedSize, originalSize)
 *   - Added role index to messages for faster filtering
 *   - Improved indexes for better query performance
 */
export const DB_VERSION = 5;

/**
 * Database name
 */
export const DB_NAME = 'pdfasistant-db';

