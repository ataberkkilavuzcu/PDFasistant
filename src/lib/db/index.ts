/**
 * Dexie.js database instance for PDFasistant
 */

import Dexie, { type Table } from 'dexie';
import {
  type StoredDocument,
  type StoredMessage,
  type UserPreferences,
  DB_NAME,
  DB_VERSION,
} from './schema';

export class PDFasistantDB extends Dexie {
  documents!: Table<StoredDocument, string>;
  messages!: Table<StoredMessage, string>;
  preferences!: Table<UserPreferences, string>;

  constructor() {
    super(DB_NAME);

    // Version 1: Initial schema
    this.version(1).stores({
      documents: 'id, metadata.title, metadata.uploadDate',
      messages: 'id, documentId, timestamp',
      preferences: 'id',
    });

    // Version 2: Added pdfBlob and blobSize (no index changes needed)
    this.version(DB_VERSION).stores({
      documents: 'id, metadata.title, metadata.uploadDate',
      messages: 'id, documentId, timestamp',
      preferences: 'id',
    });
  }
}

// Singleton database instance
export const db = new PDFasistantDB();

// Re-export schema types
export * from './schema';

