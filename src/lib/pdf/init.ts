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
 * Uses jsDelivr CDN (same as the main library) for consistency
 */
function getWorkerSource(): string {
  if (typeof window === 'undefined') {
    throw new Error('Worker source can only be determined in the browser');
  }

  // Use jsDelivr CDN worker (same CDN as the main library)
  // The worker file is at build/pdf.worker.min.mjs
  const cdnWorkerPath = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs';
  
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
      // Access pdfjs from global window object (loaded from CDN via Next.js Script)
      // Wait for it to be available if Script is still loading
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let pdfjs = (window as any).pdfjsLib;

      // If not available yet, wait for Script to load (max 10 seconds)
      if (!pdfjs) {
        await new Promise<void>((resolve, reject) => {
          const checkInterval = setInterval(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            pdfjs = (window as any).pdfjsLib;
            if (pdfjs) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);

          setTimeout(() => {
            clearInterval(checkInterval);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (!(window as any).pdfjsLib) {
              reject(new Error('PDF.js failed to load from CDN script - timeout'));
            }
          }, 10000);
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pdfjs = (window as any).pdfjsLib;
      }
      pdfjsModule = pdfjs;

      // Ensure the module loaded correctly
      if (!pdfjs || typeof pdfjs !== 'object') {
        throw new Error('PDF.js module failed to load - invalid module structure');
      }

      // Type guard: ensure GlobalWorkerOptions exists
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfjsAny = pdfjs as any;

      // In ESM builds, GlobalWorkerOptions might be accessed differently
      // Try to get the actual GlobalWorkerOptions object
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let globalWorkerOptions: any;

      // Check if pdfjs is a namespace object (ESM default export)
      if (pdfjsAny.default && pdfjsAny.default.GlobalWorkerOptions) {
        globalWorkerOptions = pdfjsAny.default.GlobalWorkerOptions;
        pdfjsModule = pdfjsAny.default; // Use default export
      } else if (pdfjsAny.GlobalWorkerOptions) {
        // If GlobalWorkerOptions is a function (getter), call it or access its properties
        if (typeof pdfjsAny.GlobalWorkerOptions === 'function') {
          // It's a function - try to access it as a getter or get the actual object
          // In some PDF.js builds, GlobalWorkerOptions is accessed via a getter
          try {
            // Try accessing workerSrc directly - if it works, the function is a getter
            const testValue = pdfjsAny.GlobalWorkerOptions.workerSrc;
            if (testValue !== undefined) {
              globalWorkerOptions = pdfjsAny.GlobalWorkerOptions;
            } else {
              // It's a function but not a getter - might need to call it
              throw new Error('GlobalWorkerOptions is a function but not accessible as object');
            }
            } catch {
              // If accessing properties fails, try to get the actual object
              // Some ESM builds expose it differently
              if (pdfjsAny.getGlobalWorkerOptions) {
                globalWorkerOptions = pdfjsAny.getGlobalWorkerOptions();
              } else {
                throw new Error('PDF.js GlobalWorkerOptions is a function but cannot be accessed');
              }
            }
        } else if (typeof pdfjsAny.GlobalWorkerOptions === 'object' && pdfjsAny.GlobalWorkerOptions !== null) {
          globalWorkerOptions = pdfjsAny.GlobalWorkerOptions;
        } else {
          throw new Error('PDF.js GlobalWorkerOptions is not accessible');
        }
      } else {
        throw new Error('PDF.js GlobalWorkerOptions not found - PDF.js may not be loaded correctly');
      }
      
      if (!globalWorkerOptions || (typeof globalWorkerOptions !== 'object' && typeof globalWorkerOptions !== 'function')) {
        throw new Error('PDF.js GlobalWorkerOptions is not a valid object or function');
      }

      // Get worker source
      let workerSrc: string;
      try {
        workerSrc = getWorkerSource();
      } catch (err) {
        console.warn('Failed to determine worker source, using default:', err);
        // Fallback to jsDelivr CDN worker
        workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs';
      }

      // Set worker source BEFORE any PDF operations
      // This is critical - must be set before getDocument() is called
      // Handle both object and function (getter) cases
      try {
        if (typeof globalWorkerOptions === 'object' && globalWorkerOptions !== null) {
          globalWorkerOptions.workerSrc = workerSrc;
        } else if (typeof globalWorkerOptions === 'function') {
          // If it's a function, try to set it as a property
          // Some PDF.js builds use a function that acts as both getter and setter
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (globalWorkerOptions as any).workerSrc = workerSrc;
        } else {
          throw new Error('Cannot set workerSrc on GlobalWorkerOptions');
        }
      } catch (setError) {
        // If direct assignment fails, try using the default export's GlobalWorkerOptions
        if (pdfjsAny.default && pdfjsAny.default.GlobalWorkerOptions) {
          pdfjsAny.default.GlobalWorkerOptions.workerSrc = workerSrc;
          globalWorkerOptions = pdfjsAny.default.GlobalWorkerOptions;
        } else {
          throw new Error(`Failed to set PDF.js worker source: ${setError instanceof Error ? setError.message : String(setError)}`);
        }
      }

      // Verify worker source was set correctly
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const verifiedWorkerSrc = typeof globalWorkerOptions === 'object' ? globalWorkerOptions?.workerSrc : (globalWorkerOptions as any)?.workerSrc;
      if (!verifiedWorkerSrc) {
        throw new Error(`Failed to set PDF.js worker source - workerSrc is empty`);
      }

      if (verifiedWorkerSrc !== workerSrc) {
        console.warn(
          `Worker source mismatch. Expected: ${workerSrc}, Got: ${verifiedWorkerSrc}`
        );
      }

      // Mark as initialized
      isInitialized = true;
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const finalWorkerSrc = typeof globalWorkerOptions === 'object' ? globalWorkerOptions?.workerSrc : (globalWorkerOptions as any)?.workerSrc;
      const pdfjsVersion = pdfjsModule?.version || pdfjsAny?.version || pdfjsAny?.default?.version || 'unknown';
      
      console.log('PDF.js initialized successfully', {
        workerSrc: finalWorkerSrc,
        version: pdfjsVersion,
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
  
  // Get pdfjs from global window (loaded from CDN)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjs = (window as any).pdfjsLib;
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
