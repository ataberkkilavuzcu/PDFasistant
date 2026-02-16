# PDFasistant

Your intelligent PDF reading companion. Upload a document and get instant, comprehensive answers to your questions with AI-powered assistance that understands your entire document.

**🌐 [Try it live →](https://pdfasistantataberk.vercel.app/)**

Want to test it out? Visit the live demo above and start asking questions about your PDFs right away!

## Features

- **Intelligent Chat**: Ask questions and get answers based on the FULL document content. The AI can find information anywhere in your PDF, not just the current page
- **Smart Search**: Find information across your entire document with intelligent keyword matching and LLM-assisted ranking
- **Privacy First**: Your documents stay in your browser. PDFs are never stored on servers

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **PDF Rendering**: react-pdf, pdfjs-dist
- **Local Storage**: IndexedDB via Dexie.js
- **AI**: Google Gemini 2.5 Flash (with GLM fallback support)

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

4. Add your API keys to `.env.local`:
```
# Primary provider (required)
GEMINI_API_KEY=your_gemini_api_key_here

# Fallback provider (optional, required for fallback mode)
GLM_API_KEY=your_glm_api_key_here

# Provider selection: 'gemini', 'glm', or 'fallback' (default)
AI_PROVIDER=fallback
```

Get your API keys:
- Gemini: https://aistudio.google.com/app/apikey
- GLM (Zhipu AI): https://open.bigmodel.cn/

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
│   │   ├── chat/          # Document-aware chat endpoint
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

PDFs never leave your browser. The full document text (up to 32K characters) is sent to the AI for comprehensive understanding, allowing it to find information anywhere in your PDF.

## Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint

## License

MIT License - see [LICENSE](LICENSE) for details
