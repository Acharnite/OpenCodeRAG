# AGENTS.md — OpenCodeRAG

## Project status

MVP implemented. All core modules are built and tested:
- Chunking (5 languages + fallback)
- Embedding (Ollama + OpenAI)
- Vector storage (LanceDB)
- Retrieval pipeline
- CLI (index, query, clear, status)
- OpenCode plugin (chat.message hook)
- Test suite (60 tests, 0 failures)

Design docs: `ReadMe.md` (project docs), `PLANNING.md` (roadmap + brainstorming),
`docs/designs/2026-05-28-rag-plugin-mvp-design.md` (architecture design).

## Tech Stack

| Layer         | Choice                                           |
| ------------- | ------------------------------------------------ |
| Runtime       | Node.js v22.14 + tsx (ESM, `"type": "module"`)   |
| Language      | TypeScript 5.8                                   |
| Package mgr   | npm                                              |
| Chunking      | web-tree-sitter (WASM, v0.26.9)                  |
| Grammars      | tree-sitter-wasm (v1.0.2, pre-built WASM files)  |
| Vector DB     | @lancedb/lancedb (v0.29.0)                       |
| Arrow types   | apache-arrow (peer dep for LanceDB)              |
| CLI framework | commander (v13.1.0)                               |
| Test runner   | Node.js built-in (`node:test`) with tsx import    |
| Plugin types  | local `.d.ts` in `src/types/` (module in .opencode) |

## Module Structure

```
src/
  core/
    interfaces.ts     — Chunk, SearchResult, Chunker, EmbeddingProvider, VectorStore
    config.ts         — RagConfig, DEFAULT_CONFIG, loadConfig() with deep merge
  chunker/
    grammar.ts        — tree-sitter init, language loader, walkTree()
    base.ts           — TreeSitterChunker abstract class
    typescript.ts     — nodeTypes: function_declaration, method_definition, class_declaration, ...
    python.ts         — nodeTypes: function_definition, class_definition, decorated_definition
    java.ts           — nodeTypes: method_declaration, class_declaration, interface_declaration, ...
    go.ts             — nodeTypes: function_declaration, method_declaration, type_declaration
    markdown.ts       — regex heading-splitter, code-block aware
    fallback.ts       — line-based 100-line chunks
    factory.ts        — getChunker(filePath) by extension, chunkFile()
    uuid.ts           — simple UUID v4 generator
  embedder/
    ollama.ts         — POST /embeddings, one text per request
    openai.ts         — POST /embeddings, batched input with auth header
    factory.ts        — createEmbedder(config), embedBatch()
  vectorstore/
    lancedb.ts        — LanceDBStore with memory:// support for tests
  retriever/
    retriever.ts      — retrieve(query, embedder, store, options)
  types/
    opencode-plugin.d.ts  — local type declaration for @opencode-ai/plugin
  cli.ts              — commander: index, query, clear, status
  plugin.ts           — ragPlugin: chat.message hook
  index.ts            — public API re-exports + plugin default export
  __tests__/          — mirrors module structure
```

## Commands

```bash
npm test              # node --import tsx --test "src/**/*.test.ts"
npm run typecheck     # tsc --noEmit
npm run cli           # tsx src/cli.ts
```

## Conventions

- **ESM only** — all imports use `.js` extensions and `node:` prefixes
- **Interfaces over classes** — module boundaries defined by interfaces in
  `core/interfaces.ts`; concrete implementations implement them
- **Factory pattern** — `getChunker()` and `createEmbedder()` for dispatch
- **Adapter pattern** — `LanceDBStore` implements `VectorStore`; provider classes
  implement `EmbeddingProvider`
- **Error resilience** — plugin and CLI catch errors silently where appropriate;
  type errors are surfaced via TypeScript
- **No build step** — tsx handles TypeScript at runtime; `tsc --noEmit` for type
  checking only
- **Node test runner** — no Jest, Mocha, or Vitest. `node:test` with `tsx` import
  hook
- **UUID generation** — internal `uuid()` in `chunker/uuid.ts` (no dependency)

## Gotchas & Lessons Learned

### npm install
- Use `--legacy-peer-deps` — LanceDB and other deps have peer dependency
  conflicts
- Corporate SSL issues: `set NODE_TLS_REJECT_UNAUTHORIZED=0` before `npm install`

### LanceDB type casts
LanceDB's TS API expects `Record<string, unknown>[]` for data inputs but typed
interfaces with known keys don't match. Cast through `unknown`:
```ts
await table.add(rows as unknown as Record<string, unknown>[]);
await db.createTable({ data: [seed] as unknown as Record<string, unknown>[] });
```

### LanceDB peer dependency
`@lancedb/lancedb` requires `apache-arrow` at runtime. Install it explicitly if
auto-install fails.

### tree-sitter WASM
- Native tree-sitter requires C++ build tools → unavailable on Win without
  Visual Studio
- Switched to `web-tree-sitter` (runs as WASM, no native compilation)
- `tree-sitter-wasm` package provides pre-built `.wasm` grammar files via
  `getWasmPath()`
- web-tree-sitter uses `Node` type (not `SyntaxNode`), `Parser` is a class
  (not `new Parser()`), `Language` is top-level class

### OpenCode plugin types
`@opencode-ai/plugin` lives in `.opencode/node_modules/` — not installed via
npm. Declare types locally in `src/types/opencode-plugin.d.ts` rather than
adding a dependency.

### Test runner
- Pattern: `"src/**/*.test.ts"` (quoted in package.json)
- Individual file: `node --import tsx --test src/__tests__/chunker/fallback.test.ts`
- LanceDB tests use `memory://` URI — data discarded after test
- LanceDB tests need native binary support (works on Win/Linux/Mac x64+arm)

### Config loading
- `loadConfig()` deep-merges per section (not recursive)
- CLI auto-detects `./opencode-rag.json` and `./.opencode/rag.json`
- Default config is the fallback when no file found

## Adding a New Language Chunker

1. Create `src/chunker/<lang>.ts` extending `TreeSitterChunker`
2. Set `language`, `fileExtensions`, `grammarName`, `nodeTypes`
3. Add the new chunker instance to the `chunkers` array in `factory.ts`
4. Verify the grammar exists in `tree-sitter-wasm` (see
   `node_modules/tree-sitter-wasm/README.md` for supported names)
5. Add extension to defaults in `DEFAULT_CONFIG.indexing.includeExtensions`

## Adding a New Embedding Provider

1. Create `src/embedder/<name>.ts` implementing `EmbeddingProvider`
2. Add provider dispatch in `createEmbedder()` in `factory.ts`
3. Update `RagConfig.embedding.provider` union type in `config.ts`
