import type { Metadata } from 'next';
import Script from 'next/script';
import localFont from 'next/font/local';
import './globals.css';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
});

const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: 'PDFasistant - Your Intelligent PDF Reading Companion',
  description:
    'Upload PDFs and get instant, page-aware answers to your questions with AI-powered assistance.',
  keywords: ['PDF', 'AI', 'reading', 'assistant', 'document', 'chat'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        {/* Load PDF.js from CDN to bypass webpack module system */}
        <Script
          id="pdfjs-loader"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (async function() {
                try {
                  const pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.296/build/pdf.mjs');
                  window.pdfjsLib = pdfjsLib;
                  console.log('PDF.js loaded from CDN');
                } catch (error) {
                  console.error('Failed to load PDF.js from CDN:', error);
                }
              })();
            `,
          }}
        />
        {children}
      </body>
    </html>
  );
}
