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
import { calculateFileHash } from '@/lib/utils/hash';

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
    this.version(2).stores({
      documents: 'id, metadata.title, metadata.uploadDate',
      messages: 'id, documentId, timestamp',
      preferences: 'id',
    });

    // Version 3: Added contentHash for PDF deduplication
    this.version(3).stores({
      documents: 'id, contentHash, metadata.title, metadata.uploadDate',
      messages: 'id, documentId, timestamp',
      preferences: 'id',
    }).upgrade(async (trans) => {
      // Migrate existing documents - calculate hash for each
      const docs = await trans.table<StoredDocument>('documents').toArray();
      for (const doc of docs) {
        if (doc.pdfBlob && !doc.contentHash) {
          const contentHash = await calculateFileHash(doc.pdfBlob);
          await trans.table<StoredDocument>('documents').update(doc.id, { contentHash });
        }
      }
    });

    // Version 4: Added conversationId to messages for conversation sessions
    this.version(DB_VERSION).stores({
      documents: 'id, contentHash, metadata.title, metadata.uploadDate',
      messages: 'id, documentId, conversationId, timestamp, [documentId+conversationId]',
      preferences: 'id',
    }).upgrade(async (trans) => {
      // Migrate existing messages - add default conversationId
      const messages = await trans.table<StoredMessage>('messages').toArray();
      for (const message of messages) {
        if (!message.conversationId) {
          // Group all existing messages per document into a single "default" conversation
          const conversationId = `${message.documentId}-default`;
          await trans.table<StoredMessage>('messages').update(message.id, { conversationId });
        }
      }
    });
  }
}

// Singleton database instance
export const db = new PDFasistantDB();

// Re-export schema types
export * from './schema';

