# AGENTS.md — OpenCodeRAG

Project status: stable MVP. See `ReadMe.md`, `doc/`, `PLANNING.md`.

## Tech Stack

| Layer         | Choice                                           |
| ------------- | ------------------------------------------------ |
| Runtime       | Node.js v22.14 + tsx (ESM, `"type": "module"`)   |
| Language      | TypeScript 5.8                                   |
| Chunking      | web-tree-sitter (WASM, v0.26.9)                  |
| Grammars      | @vscode/tree-sitter-wasm (16) + self-built in `wasm/` |
| Vector DB     | @lancedb/lancedb (v0.29.0) + apache-arrow        |
| CLI           | commander (v13.1.0)                               |
| Test runner   | Node.js `node:test` + tsx                        |
| Plugin types  | local `.d.ts` in `src/types/`                    |

## MANDATORY: OpenCodeRAG Tool Usage

Before ANY code task, you MUST call these tools — not optionally:

| Tool | When | What happens if you skip |
|------|------|--------------------------|
| `search_semantic(query)` | Before answering any code question | You guess at code behavior |
| `get_file_skeleton(filePath)` | Before reading any file >50 lines | You waste tokens reading irrelevant sections |
| `find_usages(symbolName)` | Before editing any function/class/variable | You break unseen call sites |

**Workflow:** skeleton → find_usages → search → read specific lines → edit

**Decision tree — ALWAYS follow this order:**
1. User mentions code behavior/architecture → `search_semantic(query)`
2. User mentions a file path → `get_file_skeleton(filePath)` THEN `read` on specific lines
3. User mentions a function/class/variable to edit → `find_usages(symbolName)` THEN `search_semantic` THEN `edit`
4. User asks a code question → `search_semantic` to gather context before answering

**Anti-patterns — NEVER do these:**
- Reading full files without calling `get_file_skeleton` first (wastes tokens)
- Editing a function without calling `find_usages` first (breaks call sites)
- Answering code questions without calling `search_semantic` first (you guess at behavior)
- Using `grep`/`glob` when `search_semantic` would find the answer faster

## Module Structure

```
src/
  core/        — interfaces, config, runtime-overrides, manifest
  chunker/     — AST + regex + PDF + fallback chunkers
  embedder/    — Ollama, OpenAI
  describer/   — LLM description provider
  vectorstore/ — LanceDBStore
  retriever/   — retrieve(), KeywordIndex
  indexer.ts   — runIndexPass, scanWorkspace
  watcher.ts   — createBackgroundIndexer
  cli.ts       — index, query, clear, status, list, show, dump
  plugin.ts    — ragPlugin (tools + hooks + auto-indexing)
  index.ts     — public API re-exports
  __tests__/   — mirrors src/
```

## Commands

```bash
npm test              # --import tsx --test --test-force-exit "src/**/*.test.ts"
npm run typecheck     # tsc --noEmit
npm run cli           # tsx src/cli.ts
```

## Conventions

- ESM only — `.js` extensions, `node:` prefixes
- Interfaces in `core/interfaces.ts`; implementations via factory/adapter pattern
- No build step — tsx at runtime, `tsc --noEmit` for checking
- Node test runner (no Jest/Vitest); `--test-force-exit` required (open handles)
- UUID in `chunker/uuid.ts` (no dependency)

## Key Gotchas

### npm
- `--legacy-peer-deps` for LanceDB peer conflicts
- Proxy: `HTTP_PROXY` env vars or `embedding.proxy` config; localhost always bypassed

### LanceDB
- Cast data: `rows as unknown as Record<string, unknown>[]`
- `getTable()` needs promise guard for concurrent calls

### tree-sitter
- 16 WASMs from `@vscode/tree-sitter-wasm/wasm/`; extra grammars in `wasm/`
- Uses `Node` type (not `SyntaxNode`)

### Ollama
- Returns `embedding` or `embeddings` shape — accept both
- `embedding.timeoutMs` default: 30000

### Embedding models (Ollama, ranked)
1. `bge-m3` (1024d) — multilingual, best quality
2. `mxbai-embed-large` (1024d) — English
3. `nomic-embed-code` (768d) — code-specific, supports `search_query:`/`search_document:` prefixes
4. `nomic-embed-text` (768d) — general purpose
5. `all-minilm:l6-v2` (384d) — fast/lightweight

### Plugin
- Registers: `search_semantic`, `get_file_skeleton`, `find_usages`
- Auto-injection: minScore ≥ 0.75, maxChunks 10, maxTokens 3000, contentType "file_paths"
- TUI hotkeys: Ctrl+Enter (file list), Ctrl+Alt+Enter (chunks); use `tui.prompt.append` event, never dialogs
- Prompt ref: render `api.ui.Prompt()` in slot, wrap ref callback — Solid.js slot props are read-only proxies
- Read-override: `openCode.readOverride` shadows built-in read tool

### Hybrid search
- `KeywordIndex`: token-based inverted index, CamelCase/snake_case tokenizer
- Score fusion: `(1-kw) * vScore + kw * kScore`
- Serialized to `${storePath}/keyword-index.json`

### Install
- `install.ps1`/`install.sh`: build → pack → `npm install --prefix` → add to `opencode.jsonc`
- **Never** `opencode plugin --global` (downloads stale npm version)
- Uninstall: `install.ps1 uninstall`/`install.sh uninstall`

### PluginModule export
- OpenCode expects `default` as object `{ id, server }` — bare function causes "not a function" error
- Use: `export default { id: "opencode-rag-plugin", server: ragPlugin }`

### Manifest
- `SCHEMA_VERSION` in `core/manifest.ts`; mismatch → full rebuild

### API keys
- `resolveApiKeyFromProviderConfig()` auto-resolves OpenAI apiKey from OpenCode config files

## How-To Guides

### Add a language chunker
1. Create `src/chunker/<lang>.ts` extending `TreeSitterChunker`
2. Set `language`, `fileExtensions`, `grammarName`, `nodeTypes` (target function-level)
3. Register in `factory.ts`; add extension to `DEFAULT_CONFIG.indexing.includeExtensions`
4. If grammar not in `@vscode/tree-sitter-wasm`, build via `npx tree-sitter build --wasm` → `wasm/`

### Add a non-code chunker (PDF, etc.)
1. Create `src/chunker/<lang>.ts` implementing `Chunker` directly
2. Use dynamic imports for binary extraction (see `pdf.ts`)
3. Register in `factory.ts`; update `scanWorkspace` for Buffer reads

### Add an embedding provider
1. Create `src/embedder/<name>.ts` implementing `EmbeddingProvider`
2. Add dispatch in `createEmbedder()` in `factory.ts`
3. Update `RagConfig.embedding.provider` union type in `config.ts`

### Description-Based Embedding
Enabled by default. Pipeline: filePath → LLM description → embedder (`filePath + "\n\n" + description + "\n\n" + content`). Keyword search uses raw content. Set `description.enabled: false` to disable.
