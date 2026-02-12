import type { Metadata } from 'next';
import Script from 'next/script';
import localFont from 'next/font/local';
import './globals.css';
import { Providers } from '@/components/Providers';

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
    'Upload PDFs and get instant, page-aware answers to your questions with AI-powered assistance. Free, private, and runs entirely in your browser.',
  keywords: ['PDF', 'AI', 'reading', 'assistant', 'document', 'chat', 'Gemini', 'summarize'],
  authors: [{ name: 'PDFasistant' }],
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
  openGraph: {
    title: 'PDFasistant - AI-Powered PDF Reader',
    description:
      'Chat with your PDFs using AI. Page-aware answers, intelligent search, and full privacy — your documents never leave your browser.',
    type: 'website',
    locale: 'en_US',
    siteName: 'PDFasistant',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PDFasistant - AI-Powered PDF Reader',
    description:
      'Chat with your PDFs using AI. Page-aware answers, intelligent search, and full privacy.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#10b981" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
