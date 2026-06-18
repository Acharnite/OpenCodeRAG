# 🛣️ Roadmap

## ✅ Completed / Shipped

### Chunking & Indexing

- [x] AST-based code chunking for 16 languages
- [x] Regex/document chunking for Markdown, Razor, .sln, LaTeX
- [x] Document text extraction for PDF, DOCX, DOC, Excel
- [x] Line-based fallback chunking
- [x] Pluggable chunkers via `Chunker` interface + config-loaded custom chunkers
- [x] Incremental indexing (file-hash-based, manifest-backed, diff-aware)
- [x] File watching / background re-indexing (debounced, serialized, watcher status file)
- [x] Enhanced chunk descriptions with path + line numbers in LLM and non-LLM modes

### Embedding & Storage

- [x] Embedding providers (Ollama + OpenAI, factory dispatch)
- [x] Proxy-aware transport (config/env, auth headers, raw socket localhost bypass)
- [x] Dimension probing at startup (auto-detect, fallback 384)
- [x] Vector storage (LanceDB, `memory://` test mode)
- [x] Pluggable storage via `VectorStore` interface
- [x] Batch embedding (configurable batch size)
- [x] Auto-detection of LanceDB schema for seamless upgrades
- [x] Robust `clear()` via `dropDatabase()`

### Retrieval

- [x] Retrieval pipeline (embed → search → score → return)
- [x] Hybrid search (TF×IDF keyword + vector fusion)
- [x] Session-level retrieval cache
- [x] Auto-context injection on `chat.message` (high-confidence chunks injected directly)
- [x] Configurable auto-inject settings (`minScore`, `maxChunks`, `maxTokens`, `enabled`)

### OpenCode Plugin

- [x] `opencode-rag-context`, `search_semantic`, `get_file_skeleton`, `find_usages` tools
- [x] `chat.message` hook with file suggestions + auto-injection
- [x] RAG-backed read override tool (shadows built-in read)
- [x] TUI plugin module (sidebar panel, model picker dropdowns)
- [x] `PluginModule` export pattern for v1.17.0 compatibility
- [x] Background auto-indexing with watcher status file
- [x] API key auto-resolution from OpenCode provider config
- [x] Skill-based agent discovery (SKILL.md)
- [x] Conditional system prompt injection (skipped when no chunks)

### CLI & Distribution

- [x] CLI (`init`, `index`, `query`, `clear`, `status`, `list`, `show`, `dump`, `ui`)
- [x] Full `init` lifecycle (plugins, SKILL.md, .gitignore, npm install, stale cleanup)
- [x] Install scripts (`install.ps1`/`install.sh`) with uninstall mode
- [x] Release automation (`scripts/release-patch.js`)
- [x] Multi-entry package exports (plugin, server, library, TUI)
- [x] Published npm package
- [x] CLI query deduplication, `clear` uses `dropDatabase()`

### Web UI

- [x] Browser dashboard (`opencode-rag ui`): Dashboard, Chunks, Files, Compare views
- [x] Syntax-highlighted code viewer with description panel + copy button
- [x] Collapsible file tree sidebar with filter + language color-coding
- [x] Global keyword search with dropdown results
- [x] REST API (stats, files, chunks, search, compare)
- [x] Zero-dependency HTTP server (Node.js built-in `http`)

### Config & Quality

- [x] JSON config with deep-merged partial overrides
- [x] Runtime overrides system (`runtime-overrides.json`, 5s TTL)
- [x] Configurable file logging
- [x] Manifest schema versioning with corruption detection + auto-rebuild
- [x] 680+ automated tests

## Short Term

- [ ] LLM-based re-ranking layer (cross-encoder or lightweight model after vector search)
- [ ] Query rewriting / multi-variant expansion
- [ ] Context window optimization (dedup, merge adjacent chunks)
- [ ] Better ranking/diversity for `chat.message` file suggestions
- [ ] Clearer retrieval/debug surfaces for why files or chunks were returned

## Mid Term

- [ ] Cross-file relationship graph (imports, call graph)
- [ ] Dependency-aware search
- [ ] Multi-repo / cross-workspace search
- [ ] IDE context awareness (current file, cursor position)
- [ ] Prompt template customization
- [ ] Debugging tools (inspecting embeddings, result explanations)
- [ ] Memory / persistent context across sessions

## Long Term

- [ ] Evaluation framework (benchmark queries, precision@K, recall)
- [ ] Code execution-aware retrieval
- [ ] Semantic refactoring assistant
- [ ] Agent-based code navigation
- [ ] Richer non-code / multimodal support (diagrams, API specs, JSON schemas, YAML configs)
- [ ] Access control (per-folder permissions, sensitive file exclusion)

---

# 💡 Brainstorming: Future Enhancements

## Query Enhancement

Improve retrieval quality by expanding shorthand queries into multiple semantic variants before searching.

## Code Graph Awareness

Build a structural understanding of the codebase: function call graphs, import dependencies, class hierarchies. Enables "where is this function used?" and "what depends on this module?" queries.

## Re-ranking Layer

After vector search, use a cross-encoder or lightweight LLM to re-rank results. Drastically improves precision for ambiguous queries.

## Context Window Optimization

Prevent token overload by deduplicating similar chunks, merging adjacent chunks, and ranking by diversity. Currently `maxContextChunks` limits the count, but no quality filtering is applied.

## IDE/Editor Context Awareness

Integrate with the editor's current context: active file, cursor position, and selected code. Boost retrieval relevance by weighting results near the user's current focus.

## Evaluation Framework

Measure retrieval quality with benchmark queries, precision@K, and recall. Needed before tuning chunking strategies or embedding models.

## Access Control

Per-folder permissions and sensitive file exclusion for enterprise or multi-user environments.

## Caching Layer

Cache embeddings and query results to avoid recomputation. Batch embedding already reduces API calls but does not persist results across sessions.

## Non-Code / Multimodal Retrieval

Initial document support already in place via extracted text for PDF, DOCX, DOC, and Excel. Future work: diagrams, JSON schemas, API specs, YAML configs.

## Prompt Templates

Allow users to customize how retrieved context is formatted and injected into LLM prompts. Currently uses a fixed pattern.

## Debugging Tools

Inspect embeddings visually, show vector distances between results, explain why a particular chunk or file was retrieved.

## Memory & Storage Optimization

Quantized embeddings to reduce storage, pruning stale entries, garbage collection on unused chunks.

## Persistent Session Memory

Retain coding patterns, project conventions, and past decisions across sessions. Inspired by [opencode-mem](https://github.com/tickernelz/opencode-mem): store structured memories in a local vector DB, auto-capture insights, inject relevant memories into future prompts.

## Multi-Workspace Awareness

Support indexing and searching across multiple repositories. Enable cross-project queries for monorepo setups or microservice architectures. Could use per-workspace vector shards with a unified query layer.

---

# 🎯 Summary

Local-first semantic code search with AST/document chunking, incremental/background indexing, pluggable embeddings + vector storage, hybrid search, CLI, OpenCode plugin (context tools, TUI, read-override), and Web UI.

**Key strengths:** privacy-first, modular architecture, workspace-native bootstrap, broad coverage, hybrid search, runtime overrides, auto API key resolution, manifest versioning, install/uninstall scripts.

**Next steps:** re-ranking, query rewriting, context optimization, code graph awareness, session memory, multi-workspace.
