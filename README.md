# PDFasistant

Your intelligent PDF reading companion. Upload a document and get instant, page-aware answers to your questions with AI-powered assistance.

## Features

- **Page-Aware Chat**: Ask questions and get answers with context from your current reading position
- **Smart Search**: Find information across your entire document with intelligent keyword matching
- **Privacy First**: Your documents stay in your browser. PDFs are never stored on servers

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **PDF Rendering**: react-pdf, pdfjs-dist
- **Local Storage**: IndexedDB via Dexie.js
- **AI**: Google Gemini 1.5 Pro

## Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm
- A Google AI Studio API key (for Gemini)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/PDFasistant.git
cd PDFasistant
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Add your Gemini API key to `.env.local`:
```
GEMINI_API_KEY=your_api_key_here
```

Get your API key at: https://aistudio.google.com/app/apikey

5. Start the development server:
```bash
pnpm dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── chat/          # Page-aware chat endpoint
│   │   └── search-rank/   # LLM search ranking endpoint
│   ├── viewer/            # PDF viewer page
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Landing page
├── components/            # React components
│   ├── chat/              # Chat interface components
│   ├── pdf/               # PDF viewer components
│   ├── search/            # Search components
│   └── ui/                # Shared UI primitives
├── hooks/                 # Custom React hooks
├── lib/                   # Core utilities
│   ├── ai/                # Gemini API client
│   ├── db/                # Dexie.js database
│   ├── pdf/               # PDF processing
│   └── search/            # Keyword search
├── stores/                # State management
└── types/                 # TypeScript definitions
```

## Architecture

PDFasistant uses a client-centric architecture:

- **Client-side**: PDF processing, text extraction, local storage, and UI
- **Server-side**: Secure API key handling and AI API orchestration

PDFs never leave your browser. Only relevant text snippets are sent to the AI for processing.

## Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint

## License

MIT License - see [LICENSE](LICENSE) for details
