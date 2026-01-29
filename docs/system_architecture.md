# PDFasistant – System Architecture

## 1. Overview

PDFasistant is a client-centric, privacy-first PDF reading and AI assistance system. The architecture prioritizes low latency, minimal backend responsibility, and free-tier compatibility while delivering intelligent, context-aware interactions.

The system is designed around **two core interaction modes**:

* Page-aware conversational assistance
* Intelligent document-wide search

All heavy document processing is performed on the client, while the backend is limited to secure AI API orchestration.

---

## 2. High-Level Architecture

```
Browser (Next.js App)
 ├─ PDF Viewer (react-pdf)
 ├─ Chat & Search UI
 ├─ Client-side Text Extraction (pdfjs-dist)
 ├─ Local Storage (IndexedDB via Dexie.js)
 │
 └─ API Requests (context snippets only)
        ↓
Next.js API Routes (Serverless)
 └─ Gemini API (LLM)
```

---

## 3. Client-Side Architecture

### 3.1 PDF Processing

* PDFs are loaded and rendered using `react-pdf`.
* Text extraction is performed per page using `pdfjs-dist`.
* Extracted content is structured as:

```ts
{
  documentId: string,
  metadata: { title, pageCount, uploadDate },
  pages: [{ pageNumber, text }]
}
```

### 3.2 Local Persistence

* **IndexedDB (Dexie.js)** stores:

  * Page text
  * Metadata
  * Conversation history per document
* Enables:

  * Offline access
  * Support for large PDFs (50MB+)
  * Zero backend storage cost

### 3.3 Page Awareness

* The PDF viewer continuously tracks the current page.
* Page context windows are computed dynamically:

```
Current Page = P
Context Pages = P - 2 … P + 2
```

Only this scoped context is used for chat queries.

---

## 4. Interaction Modes

### 4.1 Page-Aware Chat Flow

1. User asks a question while reading
2. System gathers text from current page ±2 pages
3. Context is sent to the backend API
4. Gemini API generates a response
5. Response is streamed back with page references

### 4.2 Intelligent Search Flow

1. User submits a search-style query
2. Client performs keyword filtering across all pages
3. Results are categorized:

   * 0 results → return "Not found"
   * 1–2 results → return directly (no LLM)
   * 3+ results → send snippets to LLM for ranking
4. Ranked results returned with page numbers

---

## 5. Backend Architecture

### 5.1 API Routes (Next.js)

* `/api/chat` – Page-aware conversational queries
* `/api/search-rank` – LLM-assisted search verification

### 5.2 Responsibilities

* Securely store Gemini API keys
* Validate and sanitize requests
* Stream responses to client

No PDF files or full documents are ever stored server-side.

---

## 6. AI Integration

* **Primary Model:** Gemini 2.5 Flash
* Context-limited prompts to reduce token usage
* Page references injected via structured prompting

Example prompt structure:

```
You are assisting a user reading a PDF.
Answer using ONLY the provided page content.
Cite page numbers explicitly.
```

---

## 7. Security & Privacy

* PDFs never leave the browser
* Only minimal text snippets are sent per request
* No authentication required
* No persistent server-side storage

---

## 8. Scalability & Constraints

* Optimized for low-concurrency usage
* Free-tier friendly
* Designed for easy extension to:

  * Server-side indexing
  * Vector databases
  * Authentication (future)

---

## 9. Key Architectural Decisions

* Client-first processing for privacy
* Page-level context windows for efficiency
* Hybrid search to minimize LLM calls
* Serverless backend for simplicity

---

## 10. Conclusion

PDFasistant’s architecture demonstrates a production-oriented, cost-aware, and privacy-focused design that balances intelligent AI usage with strong UX principles.
