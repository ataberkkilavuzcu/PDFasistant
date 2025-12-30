/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    esmExternals: 'loose',
  },
  // Transpile pdfjs-dist to handle ESM properly and avoid webpack module system issues
  transpilePackages: ['pdfjs-dist'],
  webpack: (config, { isServer }) => {
    // Required for react-pdf to work properly
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;

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
    if (!isServer) {
      config.externals = config.externals || [];
      
      // Make pdfjs-dist external (not bundled by webpack)
      config.externals.push({
        'pdfjs-dist': 'commonjs pdfjs-dist',
      });
      
      // Exclude pdfjs worker from webpack processing
      config.externals.push({
        'pdfjs-dist/build/pdf.worker.min.mjs': 'commonjs pdfjs-dist/build/pdf.worker.min.mjs',
      });
    }

    return config;
  },
};

export default nextConfig;
