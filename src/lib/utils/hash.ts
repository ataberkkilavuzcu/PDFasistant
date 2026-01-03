/**
 * Cryptographic hash utilities for file deduplication
 */

/**
 * Calculate SHA-256 hash of a file or blob
 * @param file - The File or Blob to hash
 * @returns Hexadecimal string representation of the SHA-256 hash
 */
export async function calculateFileHash(file: File | Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
