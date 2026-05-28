# Pluggable Chunkers — Design

## Problem

Chunkers are hardcoded in `factory.ts`. Adding a new language requires modifying core source files.
Users should be able to install custom chunkers without forking the project — via config file or
programmatic API.

## API

```typescript
// Programmatic — register any Chunker instance at runtime
registerChunker(chunker: Chunker, extensions?: string[]): void
```

- `extensions` overrides `chunker.fileExtensions` when provided
- Warns on conflict, keeps the existing chunker

## Config shape

```typescript
// In RagConfig
chunkers?: {
  module: string;       // dynamic import path, resolved relative to config dir
  extensions: string[]; // file extensions to map
}[];
```

Example `opencode-rag.json`:
```json
{
  "chunkers": [
    { "module": "./custom-chunkers/rust-chunker.js", "extensions": [".rs"] }
  ]
}
```

## Loading flow

1. `loadConfig()` → returns config with optional `chunkers` array
2. Caller `loadChunkersFromConfig(config, configDir)` in `loader.ts`
3. Iterates entries, `import(path.resolve(configDir, entry.module))`
4. For each loaded module, calls `registerChunker(exported, entry.extensions)`
5. Tries `module.default` then `module`; validates `chunk` is a function

## Files

| File | Change |
|------|--------|
| `src/chunker/factory.ts` | Add `registerChunker()` |
| `src/chunker/loader.ts` | NEW — `loadChunkersFromConfig()` |
| `src/core/config.ts` | Add `chunkers` to `RagConfig` |
| `src/plugin.ts` | Call `loadChunkersFromConfig()` on init |
| `src/cli.ts` | Call `loadChunkersFromConfig()` at startup |
| `src/index.ts` | Export `registerChunker` |
| `src/__tests__/chunker/register.test.ts` | Tests for register + loader |
