/**
 * PDF.js initialization utility
 * Ensures PDF.js worker is configured before any PDF operations
 * Prevents "Object.defineProperty called on non-object" errors
 * Uses local worker file with CDN fallback
 */

let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * Get the worker source URL
 * Tries local first, falls back to CDN
 */
function getWorkerSource(): string {
  if (typeof window === 'undefined') {
    throw new Error('Worker source can only be determined in the browser');
  }

  // Use CDN worker with proper protocol (https/http)
  // TODO: Copy worker to public directory for better reliability
  const protocol = window.location.protocol;
  const cdnWorkerPath = `${protocol}//cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.296/pdf.worker.min.mjs`;
  
  return cdnWorkerPath;
}

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
        throw new Error('PDF.js GlobalWorkerOptions not found - PDF.js may not be loaded correctly');
      }

      // Check if GlobalWorkerOptions is actually an object (not null/undefined)
      if (typeof pdfjs.GlobalWorkerOptions !== 'object' || pdfjs.GlobalWorkerOptions === null) {
        throw new Error('PDF.js GlobalWorkerOptions is not a valid object');
      }

      // Get worker source with fallback
      let workerSrc: string;
      try {
        workerSrc = getWorkerSource();
      } catch (err) {
        console.warn('Failed to determine worker source, using default:', err);
        // Fallback to version-specific CDN
        workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.296/pdf.worker.min.mjs`;
      }

      // Set worker source BEFORE any PDF operations
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

      // Verify worker source was set correctly
      if (!pdfjs.GlobalWorkerOptions.workerSrc || pdfjs.GlobalWorkerOptions.workerSrc !== workerSrc) {
        throw new Error(`Failed to set PDF.js worker source. Expected: ${workerSrc}, Got: ${pdfjs.GlobalWorkerOptions.workerSrc}`);
      }

      // Test that the worker can be accessed (optional check)
      // We'll let the actual PDF operation fail if worker is unreachable
      
      // Mark as initialized
      isInitialized = true;
      
      console.log('PDF.js initialized successfully with worker:', workerSrc);
    } catch (error) {
      // Reset promise on error so we can retry
      initializationPromise = null;
      isInitialized = false;
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to initialize PDF.js:', errorMessage, error);
      
      // Provide more helpful error message
      if (errorMessage.includes('GlobalWorkerOptions')) {
        throw new Error('PDF.js library failed to load. Please refresh the page and try again.');
      } else if (errorMessage.includes('worker')) {
        throw new Error('PDF.js worker failed to load. Please check your internet connection and try again.');
      } else {
        throw new Error(`PDF.js initialization failed: ${errorMessage}`);
      }
    }
  })();

  return initializationPromise;
}

/**
 * Get PDF.js module (ensures initialization first)
 */
export async function getPDFJS() {
  await initializePDFJS();
  const pdfjs = await import('pdfjs-dist');
  
  // Double-check that worker is configured
  if (!pdfjs.GlobalWorkerOptions?.workerSrc) {
    // Reset and retry once
    isInitialized = false;
    initializationPromise = null;
    await initializePDFJS();
    return await import('pdfjs-dist');
  }
  
  return pdfjs;
}

/**
 * Reset initialization state (useful for testing or retry)
 */
export function resetPDFJS() {
  isInitialized = false;
  initializationPromise = null;
}
