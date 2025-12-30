/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    esmExternals: 'loose',
  },
  // Don't transpile pdfjs-dist since we're making it external
  // transpilePackages: ['pdfjs-dist'],
  webpack: (config, { isServer }) => {
    // Required for react-pdf to work properly
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    
    // The externals function should handle pdfjs-dist imports
    // The alias to false helps prevent webpack from resolving the module

    // Fix for pdfjs-dist worker files in Next.js 14
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    // Make pdfjs-dist completely external to avoid webpack module system issues
    // This prevents "Object.defineProperty called on non-object" errors
    // Use the CDN-loaded version from window.pdfjsLib
    if (!isServer) {
      // Convert externals to array if it's not already
      if (!Array.isArray(config.externals)) {
        config.externals = config.externals ? [config.externals] : [];
      }
      
      // Make pdfjs-dist resolve to the global window.pdfjsLib (loaded from CDN)
      // This tells webpack to use window.pdfjsLib instead of bundling pdfjs-dist
      const originalExternals = config.externals;
      
      // Function to handle pdfjs-dist external resolution
      // Use the correct webpack 5 externals function signature: ({context, request}, callback)
      // Make pdfjs-dist external for ALL code (including react-pdf)
      // This prevents webpack from bundling pdfjs-dist, which causes "Object.defineProperty" errors
      // IMPORTANT: This function must run FIRST to catch all pdfjs-dist imports
      const pdfjsExternal = ({ context, request }, callback) => {
        // Check if the request is for pdfjs-dist or any subpath
        // This must catch ALL variations of pdfjs-dist imports
        if (request === 'pdfjs-dist') {
          // Return the global variable that webpack will use
          // This makes webpack use window.pdfjsLib instead of bundling pdfjs-dist
          return callback(null, 'window pdfjsLib');
        }
        
        // Also catch subpath imports like 'pdfjs-dist/build/pdf.mjs'
        if (typeof request === 'string' && request.startsWith('pdfjs-dist')) {
          // For subpaths, we still return the main global variable
          // The worker path is handled separately via options.workerSrc
          return callback(null, 'window pdfjsLib');
        }
        
        // Let webpack handle other externals normally
        callback();
      };
      
      // Put pdfjsExternal FIRST in the array to ensure it runs before other externals
      if (Array.isArray(originalExternals)) {
        config.externals = [pdfjsExternal, ...originalExternals];
      } else if (originalExternals) {
        config.externals = [pdfjsExternal, originalExternals];
      } else {
        config.externals = [pdfjsExternal];
      }
    }

    return config;
  },
};

export default nextConfig;
