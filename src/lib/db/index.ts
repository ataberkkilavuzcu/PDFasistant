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
import {
  compressIfNeeded,
  shouldCompress,
  getTextSize,
} from './compression';

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
    this.version(4).stores({
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

    // Version 5: Optimized indexes and compression support
    // - Added flat properties (title, uploadDate, fileSize) for proper Dexie indexing
    // - Added compression support for page text
    // - Added role index to messages for faster filtering
    // - Improved compound indexes
    this.version(DB_VERSION).stores({
      documents: 'id, contentHash, title, uploadDate, fileSize, [contentHash+title]',
      messages: 'id, documentId, conversationId, role, timestamp, [documentId+conversationId]',
      preferences: 'id',
    }).upgrade(async (trans) => {
      console.log('[DB Migration v5] Starting migration...');

      // Migrate documents: add flat properties and compress page text
      const docs = await trans.table<StoredDocument>('documents').toArray();
      let compressedPages = 0;
      let totalOriginalSize = 0;
      let totalCompressedSize = 0;

      for (const doc of docs) {
        const updates: Partial<StoredDocument> = {};

        // Add flat properties from nested metadata
        if (doc.metadata.title) {
          updates.title = doc.metadata.title;
        }
        if (doc.metadata.uploadDate) {
          updates.uploadDate = new Date(doc.metadata.uploadDate);
        }
        if (doc.metadata.fileSize) {
          updates.fileSize = doc.metadata.fileSize;
        }

        // Compress page text if large enough
        if (doc.pages && doc.pages.length > 0) {
          let docOriginalSize = 0;
          let docCompressedSize = 0;
          const compressedPagesList = doc.pages.map((page) => {
            const originalText = page.text || '';
            const textSize = getTextSize(originalText);
            docOriginalSize += textSize;

            if (shouldCompress(originalText)) {
              const result = compressIfNeeded(originalText);
              docCompressedSize += result.compressedSize;
              compressedPages++;
              return {
                ...page,
                text: result.text,
                _compressed: result.compressed,
              };
            }
            return page;
          });

          updates.pages = compressedPagesList;
          updates.originalSize = docOriginalSize;
          updates.compressedSize = docCompressedSize;
          totalOriginalSize += docOriginalSize;
          totalCompressedSize += docCompressedSize;
        }

        await trans.table<StoredDocument>('documents').update(doc.id, updates);
      }

      const compressionRatio = totalOriginalSize > 0
        ? Math.round((totalCompressedSize / totalOriginalSize) * 100)
        : 0;

      console.log(`[DB Migration v5] Completed:`);
      console.log(`  - Migrated ${docs.length} documents`);
      console.log(`  - Compressed ${compressedPages} pages`);
      console.log(`  - Original size: ${(totalOriginalSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  - Compressed size: ${(totalCompressedSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  - Compression ratio: ${compressionRatio}%`);
      console.log(`  - Space saved: ${((totalOriginalSize - totalCompressedSize) / 1024 / 1024).toFixed(2)} MB`);
    });
  }
}

// Singleton database instance
export const db = new PDFasistantDB();

// Re-export schema types
export * from './schema';
