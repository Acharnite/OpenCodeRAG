# OpenCodeRAG MVP Design

**Date:** 2026-05-28
**Status:** Approved

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Runtime | Bun | Built-in TS support, test runner, package manager |
| Scope | CLI + OpenCode plugin (single package) | Both manual and automated use cases |
| Vector store | LanceDB | Columnar, efficient ANN search |
| Chunking | AST-based (tree-sitter) | Accurate function/class boundaries |
| Languages | TS, Python, Markdown, Java, Go | Broad coverage |
| Embedding | Configurable provider (default: Ollama) | Offline-first, zero-cost default |
| Architecture | Modular pipeline with adapters | Testable, swappable components |

## Architecture

```
                    ┌──────────────────┐
                    │   CLI (Bun)      │
                    │  index | query   │
                    └────┬─────────┬───┘
                         │         │
     ┌───────────────────▼──┐  ┌───▼───────────────────┐
     │  Index Pipeline      │  │  Query Pipeline       │
     │  FileWalker          │  │  QueryProcessor       │
     │    → Chunker (AST)   │  │    → Retriever        │
     │    → Embedder        │  │    → ResultFormatter  │
     │    → VectorStore     │  └───────────────────────┘
     └──────────────────────┘
                        │
     ┌──────────────────▼──────────────────┐
     │  OpenCode Plugin (prompt hook)      │
     │  → retrieves context                │
     │  → injects into prompt              │
     └─────────────────────────────────────┘
```

## Directory Structure

```
src/
  index.ts              — CLI + plugin exports
  cli.ts                — CLI commands
  plugin.ts             — OpenCode prompt pipeline hook

  core/
    interfaces.ts       — Chunker, EmbeddingProvider, VectorStore, SearchResult
    pipeline.ts         — IndexPipeline, QueryPipeline orchestration
    config.ts           — rag.json loader + defaults
    types.ts            — Chunk, Embedding, Config

  chunker/
    factory.ts          — dispatch by file extension
    grammar.ts          — tree-sitter grammar registry
    typescript.ts
    python.ts
    java.ts
    go.ts
    markdown.ts
    fallback.ts         — line-based for unsupported languages

  embedder/
    factory.ts          — provider dispatch + batching
    ollama.ts
    openai.ts

  vectorstore/
    lancedb.ts          — LanceDB implementation

  retriever/
    retriever.ts        — embed → search → rank pipeline
```

## Core Interfaces

```ts
interface Chunk {
  id: string
  content: string
  embedding?: number[]
  metadata: {
    filePath: string
    startLine: number
    endLine: number
    language: string
  }
}

interface Chunker {
  readonly language: string
  chunk(filePath: string, content: string): Promise<Chunk[]>
}

interface EmbeddingProvider {
  readonly name: string
  embed(texts: string[]): Promise<number[][]>
}

interface VectorStore {
  addChunks(chunks: Chunk[]): Promise<void>
  search(embedding: number[], topK: number): Promise<SearchResult[]>
  count(): Promise<number>
  clear(): Promise<void>
}

interface SearchResult {
  chunk: Chunk
  score: number
}
```

## Modules

### Chunking (tree-sitter)

- `tree-sitter` + per-language grammar packages
- Grammar registry loads parsers lazily
- Each chunker walks AST, extracts function/class/method nodes with line ranges
- Markdown splits by heading level
- Fallback: max-token line-based with configurable overlap

### Embedding

- Factory selects provider from config
- Batching for large text arrays
- Retry on transient failures

### Vector Store (LanceDB)

- Vector-based ANN search
- Table schema: id, content, embedding, filePath, startLine, endLine, language
- Data path: `.opencode/rag_db/`

### CLI

```
opencode-rag index   [--force]
opencode-rag query   <query> [--top-k]
opencode-rag clear
opencode-rag status
```

### OpenCode Plugin

- Implements `@opencode-ai/plugin` Plugin interface
- Intercepts user prompt, retrieves context, injects
- Configurable max chunks per injection

## Config

```json
{
  "embedding": {
    "provider": "ollama",
    "baseUrl": "http://localhost:11434/v1",
    "model": "nomic-embed-text"
  },
  "indexing": {
    "includeExtensions": [".ts", ".tsx", ".js", ".jsx", ".py", ".java", ".go", ".md"],
    "excludeDirs": ["node_modules", ".git", "dist", "build", "__pycache__", ".venv"],
    "chunkOverlap": 0
  },
  "vectorStore": {
    "path": "./.opencode/rag_db"
  },
  "retrieval": {
    "topK": 10
  },
  "openCode": {
    "enabled": true,
    "maxContextChunks": 5
  }
}
```

## Testing

- Bun native test runner
- Unit tests per chunker (sample code → expected chunks)
- Mocked HTTP for embedder tests
- LanceDB in-memory for store tests
- Integration: index fixture workspace, query, verify results
