/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    esmExternals: 'loose',
  },
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

    // Exclude pdfjs worker from webpack processing
    config.externals = config.externals || [];
    config.externals.push({
      'pdfjs-dist/build/pdf.worker.min.mjs': 'commonjs pdfjs-dist/build/pdf.worker.min.mjs',
    });

    return config;
  },
};

export default nextConfig;
