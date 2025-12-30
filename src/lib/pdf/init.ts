/**
 * PDF.js initialization utility
 * Ensures PDF.js worker is configured before any PDF operations
 * Prevents "Object.defineProperty called on non-object" errors
 */

let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * Initialize PDF.js with proper worker configuration
 * This must be called before any PDF.js operations
 */
export async function initializePDFJS(): Promise<void> {
  // Return existing promise if already initializing
  if (initializationPromise) {
    return initializationPromise;
  }

  // Return immediately if already initialized
  if (isInitialized) {
    return;
  }

  // Create initialization promise
  initializationPromise = (async () => {
    if (typeof window === 'undefined') {
      throw new Error('PDF.js can only be initialized in the browser');
    }

    try {
      // Dynamically import pdfjs-dist
      const pdfjs = await import('pdfjs-dist');

      // Ensure GlobalWorkerOptions exists and is an object
      if (!pdfjs.GlobalWorkerOptions) {
        throw new Error('PDF.js GlobalWorkerOptions not found');
      }

      // Configure worker source BEFORE any PDF operations
      // Use protocol-relative URL to work with both http and https
      const workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
      
      // Set worker source
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

      // Verify worker source was set correctly
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        throw new Error('Failed to set PDF.js worker source');
      }

      // Mark as initialized
      isInitialized = true;
      
      console.log('PDF.js initialized successfully with worker:', workerSrc);
    } catch (error) {
      // Reset promise on error so we can retry
      initializationPromise = null;
      console.error('Failed to initialize PDF.js:', error);
      throw error;
    }
  })();

  return initializationPromise;
}

/**
 * Get PDF.js module (ensures initialization first)
 */
export async function getPDFJS() {
  await initializePDFJS();
  return await import('pdfjs-dist');
}

/**
 * Reset initialization state (useful for testing)
 */
export function resetPDFJS() {
  isInitialized = false;
  initializationPromise = null;
}

