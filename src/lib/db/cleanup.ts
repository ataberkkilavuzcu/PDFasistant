/**
 * Database cleanup utilities for managing IndexedDB storage
 * Provides functions to remove old documents, conversations, and orphaned data
 */

import { db } from './index';

/**
 * Storage statistics for a document or conversation
 */
export interface StorageStats {
  totalDocuments: number;
  totalMessages: number;
  totalSize: number;
  totalSizeFormatted: string;
  documentsSize: number;
  messagesSize: number;
  oldestDocument?: Date;
  newestDocument?: Date;
}

/**
 * Cleanup result information
 */
export interface CleanupResult {
  deletedDocuments: number;
  deletedMessages: number;
  freedSpace: number;
  freedSpaceFormatted: string;
}

/**
 * Get total database size and statistics
 * Note: IndexedDB doesn't provide a built-in way to get exact storage size
 * This estimates based on stored data
 */
export async function getDatabaseSize(): Promise<StorageStats> {
  try {
    const documents = await db.documents.toArray();
    const messages = await db.messages.toArray();

    // Calculate approximate sizes
    let documentsSize = 0;
    let oldestDate: Date | undefined;
    let newestDate: Date | undefined;

    for (const doc of documents) {
      // Estimate size based on JSON serialization
      const docWithoutBlob = { ...doc, pdfBlob: undefined };
      const docSize = new TextEncoder().encode(JSON.stringify(docWithoutBlob)).length;
      documentsSize += docSize;

      // Add blob size if present
      if (doc.blobSize) {
        documentsSize += doc.blobSize;
      }

      // Track date range
      if (doc.metadata.uploadDate) {
        const uploadDate = new Date(doc.metadata.uploadDate);
        if (!oldestDate || uploadDate < oldestDate) {
          oldestDate = uploadDate;
        }
        if (!newestDate || uploadDate > newestDate) {
          newestDate = uploadDate;
        }
      }
    }

    let messagesSize = 0;
    for (const msg of messages) {
      const msgSize = new TextEncoder().encode(JSON.stringify(msg)).length;
      messagesSize += msgSize;
    }

    const totalSize = documentsSize + messagesSize;

    return {
      totalDocuments: documents.length,
      totalMessages: messages.length,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      documentsSize,
      messagesSize,
      oldestDocument: oldestDate,
      newestDocument: newestDate,
    };
  } catch (error) {
    console.error('Failed to get database size:', error);
    throw new Error('Failed to calculate database size');
  }
}

/**
 * Delete documents older than specified number of days
 * @param daysOld - Age threshold in days (documents older than this will be deleted)
 * @returns Cleanup result with counts and freed space
 */
export async function cleanupOldDocuments(daysOld: number): Promise<CleanupResult> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Get documents to be deleted (for size calculation)
    const oldDocuments = await db.documents
      .filter((doc) => {
        const uploadDate = new Date(doc.metadata.uploadDate);
        return uploadDate < cutoffDate;
      })
      .toArray();

    if (oldDocuments.length === 0) {
      return {
        deletedDocuments: 0,
        deletedMessages: 0,
        freedSpace: 0,
        freedSpaceFormatted: '0 Bytes',
      };
    }

    // Calculate space to be freed
    let freedSpace = 0;
    for (const doc of oldDocuments) {
      const docWithoutBlob = { ...doc, pdfBlob: undefined };
      const docSize = new TextEncoder().encode(JSON.stringify(docWithoutBlob)).length;
      freedSpace += docSize;
      if (doc.blobSize) {
        freedSpace += doc.blobSize;
      }
    }

    // Get document IDs
    const documentIds = oldDocuments.map((doc) => doc.id);

    // Delete documents and their associated messages
    await db.transaction('rw', [db.documents, db.messages], async () => {
      // Delete messages for these documents
      await db.messages
        .where('documentId')
        .anyOf(documentIds)
        .delete();

      // Delete documents
      await db.documents
        .where('id')
        .anyOf(documentIds)
        .delete();
    });

    return {
      deletedDocuments: oldDocuments.length,
      deletedMessages: 0, // Messages are counted separately
      freedSpace,
      freedSpaceFormatted: formatBytes(freedSpace),
    };
  } catch (error) {
    console.error('Failed to cleanup old documents:', error);
    throw new Error('Failed to cleanup old documents');
  }
}

/**
 * Delete conversations (and their messages) older than specified number of days
 * @param daysOld - Age threshold in days
 * @returns Cleanup result with counts and freed space
 */
export async function cleanupOldConversations(daysOld: number): Promise<CleanupResult> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Get old messages
    const oldMessages = await db.messages
      .filter((msg) => {
        const msgDate = new Date(msg.timestamp);
        return msgDate < cutoffDate;
      })
      .toArray();

    if (oldMessages.length === 0) {
      return {
        deletedDocuments: 0,
        deletedMessages: 0,
        freedSpace: 0,
        freedSpaceFormatted: '0 Bytes',
      };
    }

    // Calculate space to be freed
    let freedSpace = 0;
    for (const msg of oldMessages) {
      const msgSize = new TextEncoder().encode(JSON.stringify(msg)).length;
      freedSpace += msgSize;
    }

    // Group by conversation ID
    const conversationIds = new Set(oldMessages.map((msg) => msg.conversationId));

    // Delete messages
    await db.messages
      .where('conversationId')
      .anyOf(Array.from(conversationIds))
      .delete();

    return {
      deletedDocuments: 0,
      deletedMessages: oldMessages.length,
      freedSpace,
      freedSpaceFormatted: formatBytes(freedSpace),
    };
  } catch (error) {
    console.error('Failed to cleanup old conversations:', error);
    throw new Error('Failed to cleanup old conversations');
  }
}

/**
 * Remove messages that don't have valid associated documents
 * (orphaned messages)
 * @returns Number of orphaned messages deleted
 */
export async function cleanupOrphanedMessages(): Promise<number> {
  try {
    // Get all document IDs
    const documentIds = new Set((await db.documents.toCollection().primaryKeys()).map(String));

    // Find messages with documentId not in the documents table
    const orphanedMessages = await db.messages
      .filter((msg) => !documentIds.has(msg.documentId))
      .toArray();

    if (orphanedMessages.length === 0) {
      return 0;
    }

    // Delete orphaned messages
    const messageIds = orphanedMessages.map((msg) => msg.id);
    await db.messages.where('id').anyOf(messageIds).delete();

    return orphanedMessages.length;
  } catch (error) {
    console.error('Failed to cleanup orphaned messages:', error);
    throw new Error('Failed to cleanup orphaned messages');
  }
}

/**
 * Auto-cleanup function to be called on app startup
 * Cleans up old data if auto-cleanup is enabled
 * @param options - Auto-cleanup configuration
 */
export interface AutoCleanupOptions {
  enabled: boolean;
  documentsOlderThanDays?: number; // Default: 90 days
  conversationsOlderThanDays?: number; // Default: 180 days
  cleanupOrphanedMessages?: boolean; // Default: true
}

export async function autoCleanup(options: AutoCleanupOptions): Promise<CleanupResult> {
  if (!options.enabled) {
    return {
      deletedDocuments: 0,
      deletedMessages: 0,
      freedSpace: 0,
      freedSpaceFormatted: '0 Bytes',
    };
  }

  const docDays = options.documentsOlderThanDays ?? 90;
  const convDays = options.conversationsOlderThanDays ?? 180;

  let totalDeletedDocuments = 0;
  let totalDeletedMessages = 0;
  let totalFreedSpace = 0;

  try {
    // Cleanup old documents
    if (docDays > 0) {
      const docResult = await cleanupOldDocuments(docDays);
      totalDeletedDocuments += docResult.deletedDocuments;
      totalFreedSpace += docResult.freedSpace;
    }

    // Cleanup old conversations
    if (convDays > 0) {
      const convResult = await cleanupOldConversations(convDays);
      totalDeletedMessages += convResult.deletedMessages;
      totalFreedSpace += convResult.freedSpace;
    }

    // Cleanup orphaned messages
    if (options.cleanupOrphanedMessages !== false) {
      const orphanedCount = await cleanupOrphanedMessages();
      totalDeletedMessages += orphanedCount;
    }

    return {
      deletedDocuments: totalDeletedDocuments,
      deletedMessages: totalDeletedMessages,
      freedSpace: totalFreedSpace,
      freedSpaceFormatted: formatBytes(totalFreedSpace),
    };
  } catch (error) {
    console.error('Auto-cleanup failed:', error);
    throw error;
  }
}

/**
 * Format byte size as human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 Bytes';
  }

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Export all data as JSON (for backup before migration)
 */
export async function exportDatabase(): Promise<string> {
  try {
    const documents = await db.documents.toArray();
    const messages = await db.messages.toArray();
    const preferences = await db.preferences.toArray();

    const exportData = {
      version: 5,
      exportDate: new Date().toISOString(),
      documents,
      messages,
      preferences,
    };

    return JSON.stringify(exportData, null, 2);
  } catch (error) {
    console.error('Failed to export database:', error);
    throw new Error('Failed to export database');
  }
}

/**
 * Get documents sorted by size (largest first)
 * Useful for identifying which documents to delete to free space
 */
export async function getDocumentsBySize(limit: number = 10): Promise<
  Array<{
    id: string;
    title: string;
    uploadDate: Date;
    totalSize: number;
    totalSizeFormatted: string;
  }>
> {
  try {
    const documents = await db.documents.toArray();

    const docsWithSize = documents
      .map((doc) => {
        // Calculate approximate size
        const docWithoutBlob = { ...doc, pdfBlob: undefined };
        const dataSize = new TextEncoder().encode(JSON.stringify(docWithoutBlob)).length;
        const blobSize = doc.blobSize || 0;
        const totalSize = dataSize + blobSize;

        return {
          id: doc.id,
          title: doc.metadata.title,
          uploadDate: doc.metadata.uploadDate,
          totalSize,
          totalSizeFormatted: formatBytes(totalSize),
        };
      })
      .sort((a, b) => b.totalSize - a.totalSize)
      .slice(0, limit);

    return docsWithSize;
  } catch (error) {
    console.error('Failed to get documents by size:', error);
    throw new Error('Failed to get documents by size');
  }
}
