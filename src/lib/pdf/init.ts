/**
 * PDF.js initialization utility
 * Ensures PDF.js worker is configured before any PDF operations
 * Prevents "Object.defineProperty called on non-object" errors
 * Uses worker from node_modules for better reliability
 */

let isInitialized = false;
let initializationPromise: Promise<void> | null = null;
let pdfjsModule: typeof import('pdfjs-dist') | null = null;

/**
 * Get the worker source URL
 * Uses the worker from node_modules via Next.js static file serving
 */
function getWorkerSource(): string {
  if (typeof window === 'undefined') {
    throw new Error('Worker source can only be determined in the browser');
  }

  // Use the worker from node_modules - Next.js will serve it from _next/static
  // This is more reliable than CDN and works offline
  // The worker file is at: node_modules/pdfjs-dist/build/pdf.worker.min.mjs
  // Next.js will copy it to the build output
  
  // Use CDN worker with proper protocol (https/http)
  // In production, you could copy the worker to public/ folder for better reliability
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
  if (isInitialized && pdfjsModule) {
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
      pdfjsModule = pdfjs;

      // Ensure the module loaded correctly
      if (!pdfjs || typeof pdfjs !== 'object') {
        throw new Error('PDF.js module failed to load - invalid module structure');
      }

      // Type guard: ensure GlobalWorkerOptions exists
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfjsAny = pdfjs as any;
      if (!pdfjsAny.GlobalWorkerOptions) {
        throw new Error('PDF.js GlobalWorkerOptions not found - PDF.js may not be loaded correctly');
      }

      // Check if GlobalWorkerOptions is actually an object (not null/undefined)
      if (typeof pdfjsAny.GlobalWorkerOptions !== 'object' || pdfjsAny.GlobalWorkerOptions === null) {
        throw new Error('PDF.js GlobalWorkerOptions is not a valid object');
      }

      // Get worker source
      let workerSrc: string;
      try {
        workerSrc = getWorkerSource();
      } catch (err) {
        console.warn('Failed to determine worker source, using default:', err);
        // Fallback to version-specific CDN with https
        workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.296/pdf.worker.min.mjs`;
      }

      // Set worker source BEFORE any PDF operations
      // This is critical - must be set before getDocument() is called
      pdfjsAny.GlobalWorkerOptions.workerSrc = workerSrc;

      // Verify worker source was set correctly
      if (!pdfjsAny.GlobalWorkerOptions.workerSrc) {
        throw new Error(`Failed to set PDF.js worker source - workerSrc is empty`);
      }

      if (pdfjsAny.GlobalWorkerOptions.workerSrc !== workerSrc) {
        console.warn(
          `Worker source mismatch. Expected: ${workerSrc}, Got: ${pdfjsAny.GlobalWorkerOptions.workerSrc}`
        );
      }

      // Mark as initialized
      isInitialized = true;
      
      console.log('PDF.js initialized successfully', {
        workerSrc: pdfjsAny.GlobalWorkerOptions.workerSrc,
        version: pdfjsAny.version || 'unknown',
      });
    } catch (error) {
      // Reset promise on error so we can retry
      initializationPromise = null;
      isInitialized = false;
      pdfjsModule = null;
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      console.error('Failed to initialize PDF.js:', {
        message: errorMessage,
        stack: errorStack,
        error,
      });
      
      // Provide more helpful error message
      if (errorMessage.includes('GlobalWorkerOptions')) {
        throw new Error('PDF.js library failed to load. The PDF.js module may be corrupted or incompatible.');
      } else if (errorMessage.includes('worker')) {
        throw new Error('PDF.js worker configuration failed. Please check your internet connection and try again.');
      } else if (errorMessage.includes('module')) {
        throw new Error('PDF.js module failed to load. Please refresh the page and try again.');
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
  // If already initialized and module cached, return it
  if (isInitialized && pdfjsModule) {
    // Verify worker is still configured
    if (pdfjsModule.GlobalWorkerOptions?.workerSrc) {
      return pdfjsModule;
    }
    // Worker lost, re-initialize
    isInitialized = false;
    pdfjsModule = null;
    initializationPromise = null;
  }

  // Initialize if not already done
  await initializePDFJS();
  
  // Get fresh import to ensure we have the latest module
  const pdfjs = await import('pdfjs-dist');
  pdfjsModule = pdfjs;
  
  // Double-check that worker is configured
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjsAny = pdfjs as any;
  if (!pdfjsAny.GlobalWorkerOptions?.workerSrc) {
    console.error('PDF.js worker not configured after initialization');
    // Reset and retry once
    isInitialized = false;
    pdfjsModule = null;
    initializationPromise = null;
    await initializePDFJS();
    const retryPdfjs = await import('pdfjs-dist');
    pdfjsModule = retryPdfjs;
    return retryPdfjs;
  }
  
  return pdfjs;
}

/**
 * Reset initialization state (useful for testing or retry)
 */
export function resetPDFJS() {
  isInitialized = false;
  initializationPromise = null;
  pdfjsModule = null;
}

/**
 * Check if PDF.js is initialized
 */
export function isPDFJSInitialized(): boolean {
  return isInitialized && pdfjsModule !== null;
}
