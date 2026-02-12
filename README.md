# PDFasistant

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-38bdf8?logo=tailwindcss)
![Gemini AI](https://img.shields.io/badge/Gemini_AI-2.5_Flash-4285F4?logo=google)
![License](https://img.shields.io/badge/License-MIT-green)

Your intelligent PDF reading companion. Upload a document and get instant, page-aware answers to your questions with AI-powered assistance. **100% client-side PDF processing** — your documents never leave your browser.

## Features

- **Page-Aware AI Chat** — Ask questions and get answers with context from your current reading position (±2 pages)
- **Intelligent Search** — Keyword search with LLM-powered result ranking for 3+ matches
- **Privacy First** — PDFs are processed entirely in the browser. Only text snippets go to AI
- **Multi-Provider AI** — Google Gemini primary with Zhipu GLM automatic fallback
- **Streaming Responses** — Real-time AI response streaming for chat and search
- **Conversation History** — Full persistence with create, edit, delete, and export as Markdown
- **PDF Viewer** — Zoom, keyboard navigation, page tracking, text selection, and search highlighting
- **Dark Theme UI** — Polished, responsive design with Framer Motion animations
- **PWA Ready** — Installable as a progressive web app for quick access
- **Keyboard Shortcuts** — Full keyboard navigation (press `?` in the viewer for help)

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion
- **PDF**: react-pdf, pdfjs-dist (client-side extraction & rendering)
- **Storage**: IndexedDB via Dexie.js with LZ-String compression
- **AI**: Google Gemini 2.5 Flash + Zhipu GLM fallback
- **Backend**: Next.js API Routes (serverless, API key handling only)

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

PDFasistant uses a **client-centric architecture** to maximise privacy and minimise costs:

| Layer | Responsibility |
|-------|---------------|
| **Browser** | PDF parsing, text extraction, IndexedDB storage, rendering, search |
| **Next.js API Routes** | Secure API key handling, AI prompt orchestration, rate limiting |
| **AI Providers** | Gemini 2.5 Flash (primary), Zhipu GLM (fallback) |

PDFs never leave your browser. Only the relevant page text snippets (current page ± context window) are sent to the AI for processing.

## Deployment

Deploy to Vercel in one click:

1. Push the repo to GitHub
2. Import to [Vercel](https://vercel.com/new)
3. Add environment variables (`GEMINI_API_KEY`, optionally `GLM_API_KEY` and `AI_PROVIDER`)
4. Deploy!

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |

## License

MIT License — see [LICENSE](LICENSE) for details
