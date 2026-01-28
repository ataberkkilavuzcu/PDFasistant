/**
 * Text compression utilities for reducing IndexedDB storage size
 * Uses LZ-string compression for efficient text compression in the browser
 */

import * as LZString from 'lz-string';

/**
 * Minimum text size (in bytes) before compression is applied
 * Small texts don't benefit from compression and may even get larger
 */
export const COMPRESSION_THRESHOLD = 1024; // 1KB

/**
 * Compress text using LZ-string algorithm
 * @param text - Plain text to compress
 * @returns Compressed string (encoded as base64-like string)
 */
export function compressText(text: string): string {
  if (!text) {
    return text;
  }

  try {
    const compressed = LZString.compressToUTF16(text);
    return compressed;
  } catch (error) {
    console.error('Compression failed:', error);
    // Return original text if compression fails
    return text;
  }
}

/**
 * Decompress text that was compressed with compressText
 * @param compressed - Compressed string
 * @returns Original plain text
 */
export function decompressText(compressed: string): string {
  if (!compressed) {
    return compressed;
  }

  try {
    // Check if the text is actually compressed
    // LZ-string compressed strings typically have specific patterns
    // If decompression fails, assume it's plain text
    const decompressed = LZString.decompressFromUTF16(compressed);
    return decompressed || compressed; // Fallback to original if decompression returns null
  } catch (error) {
    console.error('Decompression failed:', error);
    // Return original string if decompression fails
    return compressed;
  }
}

/**
 * Check if text should be compressed based on size
 * @param text - Text to check
 * @returns True if text is large enough to benefit from compression
 */
export function shouldCompress(text: string): boolean {
  if (!text) {
    return false;
  }

  // Calculate approximate byte size (UTF-16 uses 2 bytes per char)
  const byteSize = text.length * 2;
  return byteSize >= COMPRESSION_THRESHOLD;
}

/**
 * Calculate the size of a string in bytes (UTF-16)
 * @param text - Text to measure
 * @returns Size in bytes
 */
export function getTextSize(text: string): number {
  if (!text) {
    return 0;
  }
  return text.length * 2; // UTF-16 uses 2 bytes per character
}

/**
 * Compress text only if it's large enough to benefit
 * @param text - Text to potentially compress
 * @returns Object with compressed/decompressed text and metadata
 */
export function compressIfNeeded(text: string): {
  text: string;
  compressed: boolean;
  originalSize: number;
  compressedSize: number;
} {
  const originalSize = getTextSize(text);

  if (!shouldCompress(text)) {
    return {
      text,
      compressed: false,
      originalSize,
      compressedSize: originalSize,
    };
  }

  const compressedText = compressText(text);
  const compressedSize = getTextSize(compressedText);

  // If compression didn't help (made it larger), use original
  if (compressedSize >= originalSize) {
    return {
      text,
      compressed: false,
      originalSize,
      compressedSize: originalSize,
    };
  }

  return {
    text: compressedText,
    compressed: true,
    originalSize,
    compressedSize,
  };
}

/**
 * Decompress text if it was compressed
 * @param text - Text to potentially decompress
 * @param isCompressed - Whether the text is known to be compressed
 * @returns Decompressed text
 */
export function decompressIfNeeded(text: string, isCompressed: boolean): string {
  if (!isCompressed || !text) {
    return text;
  }

  return decompressText(text);
}

/**
 * Calculate compression ratio
 * @param originalSize - Original size in bytes
 * @param compressedSize - Compressed size in bytes
 * @returns Compression ratio as a percentage (e.g., 60 means 60% of original size)
 */
export function getCompressionRatio(originalSize: number, compressedSize: number): number {
  if (originalSize === 0) {
    return 100;
  }
  return Math.round((compressedSize / originalSize) * 100);
}

/**
 * Format byte size as human-readable string
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "1.5 MB", "500 KB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 Bytes';
  }

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
