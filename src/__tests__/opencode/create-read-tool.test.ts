import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import type { EmbeddingProvider, VectorStore, SearchResult, Chunk } from "../../core/interfaces.js";
import { DEFAULT_CONFIG } from "../../core/config.js";
import { createRagReadTool } from "../../opencode/create-read-tool.js";

// ── Helpers ──────────────────────────────────────────────────

function resolve(p: string): string {
  return path.resolve(p).replace(/\\/g, "/");
}

// ── Mocks ────────────────────────────────────────────────────

function makeEmbedder(embeddings: number[][] = [[0.1, 0.2, 0.3]]): EmbeddingProvider {
  return {
    name: "test-embedder",
    embed: async () => embeddings,
  };
}

function makeStore(options: {
  count?: number;
  searchResults?: SearchResult[];
} = {}): VectorStore {
  const count = options.count ?? 5;
  const searchResults = options.searchResults ?? [];

  return {
    addChunks: async () => {},
    search: async () => searchResults,
    count: async () => count,
    clear: async () => {},
    deleteByFilePath: async () => {},
  };
}

function makeChunk(
  id: string,
  filePath: string,
  startLine: number,
  endLine: number,
  language: string,
  content: string
): Chunk {
  return {
    id,
    content,
    metadata: { filePath, startLine, endLine, language },
  };
}

function makeResult(
  id: string,
  filePath: string,
  startLine: number,
  endLine: number,
  language: string,
  content: string,
  score: number
): SearchResult {
  return {
    score,
    chunk: makeChunk(id, filePath, startLine, endLine, language, content),
  };
}

// ── Tests ────────────────────────────────────────────────────

describe("createRagReadTool", () => {
const PROJECT = resolve("/project");
const MAIN_TS = PROJECT + "/src/main.ts";
const OTHER_TS = PROJECT + "/other.ts";

  it("returns a tool object with execute method", () => {
    const tool = createRagReadTool({
      worktree: PROJECT,
      config: DEFAULT_CONFIG,
      embedder: makeEmbedder(),
      store: makeStore(),
    });

    assert.ok(tool);
    assert.ok(typeof tool === "object");
    assert.ok("execute" in tool);
  });

  it("falls back to file read when store is empty (file not on disk → error)", async () => {
    const tool = createRagReadTool({
      worktree: PROJECT,
      config: DEFAULT_CONFIG,
      embedder: makeEmbedder(),
      store: makeStore({ count: 0 }),
    });

    const result = await (tool as { execute: Function }).execute(
      { filePath: "src/main.ts" },
      {}
    ) as { output: string };

    // File doesn't exist on disk, so fallback fails → retrieval error
    assert.match(result.output, /OpenCodeRAG retrieval failed/);
  });

  it("falls back to file read when file has no indexed chunks (file not on disk → error)", async () => {
    const tool = createRagReadTool({
      worktree: PROJECT,
      config: DEFAULT_CONFIG,
      embedder: makeEmbedder(),
      store: makeStore({
        count: 5,
        searchResults: [
          makeResult("c1", OTHER_TS, 1, 10, "typescript", "other code", 0.9),
        ],
      }),
    });

    const result = await (tool as { execute: Function }).execute(
      { filePath: "src/main.ts" },
      {}
    ) as { output: string };

    // File doesn't exist on disk, so fallback fails → retrieval error
    assert.match(result.output, /OpenCodeRAG retrieval failed/);
  });

  it("returns chunks filtered to the requested file", async () => {
    const tool = createRagReadTool({
      worktree: PROJECT,
      config: DEFAULT_CONFIG,
      embedder: makeEmbedder(),
      store: makeStore({
        count: 10,
        searchResults: [
          makeResult("c1", MAIN_TS, 5, 20, "typescript", "function a() {}", 0.95),
          makeResult("c2", MAIN_TS, 30, 50, "typescript", "function b() {}", 0.85),
          makeResult("c3", OTHER_TS, 1, 10, "typescript", "other", 0.9),
        ],
      }),
    });

    const result = await (tool as { execute: Function }).execute(
      { filePath: "src/main.ts" },
      {}
    ) as { output: string };

    assert.match(result.output, /OpenCodeRAG read override active/);
    assert.match(result.output, /function a\(\)/);
    assert.match(result.output, /function b\(\)/);
    assert.doesNotMatch(result.output, /other code/);
  });

  it("respects maxContextChunks limit", async () => {
    const manyResults = Array.from({ length: 10 }, (_, i) =>
      makeResult(
        `c${i}`,
        MAIN_TS,
        i * 10 + 1,
        i * 10 + 10,
        "typescript",
        `// chunk ${i}`,
        1.0 - i * 0.05
      )
    );

    const config = { ...DEFAULT_CONFIG, openCode: { ...DEFAULT_CONFIG.openCode, maxContextChunks: 2 } };

    const tool = createRagReadTool({
      worktree: PROJECT,
      config,
      embedder: makeEmbedder(),
      store: makeStore({ count: 50, searchResults: manyResults }),
    });

    const result = await (tool as { execute: Function }).execute(
      { filePath: "src/main.ts" },
      {}
    ) as { output: string };

    assert.match(result.output, /2 of max 2/);
    assert.doesNotMatch(result.output, /\/\/ chunk 2/);
  });

  it("applies line-range overlap filtering", async () => {
    const results = [
      makeResult("c1", MAIN_TS, 1, 20, "typescript", "first block", 0.9),
      makeResult("c2", MAIN_TS, 25, 40, "typescript", "second block", 0.85),
      makeResult("c3", MAIN_TS, 50, 70, "typescript", "third block", 0.8),
    ];

    const tool = createRagReadTool({
      worktree: PROJECT,
      config: DEFAULT_CONFIG,
      embedder: makeEmbedder(),
      store: makeStore({ count: 10, searchResults: results }),
    });

    // Request lines 15-30 which should overlap c1 (1-20) and c2 (25-40)
    const result = await (tool as { execute: Function }).execute(
      { filePath: "src/main.ts", startLine: 15, endLine: 30 },
      {}
    ) as { output: string };

    assert.match(result.output, /first block/);
    assert.match(result.output, /second block/);
    assert.doesNotMatch(result.output, /third block/);
  });

  it("handles retrieval errors gracefully (file not on disk → error)", async () => {
    const failingStore: VectorStore = {
      addChunks: async () => {},
      search: async () => { throw new Error("DB connection failed"); },
      count: async () => { throw new Error("DB connection failed"); },
      clear: async () => {},
      deleteByFilePath: async () => {},
    };

    const tool = createRagReadTool({
      worktree: PROJECT,
      config: DEFAULT_CONFIG,
      embedder: makeEmbedder(),
      store: failingStore,
    });

    const result = await (tool as { execute: Function }).execute(
      { filePath: "src/main.ts" },
      {}
    ) as { output: string };

    // File doesn't exist on disk either → still returns retrieval error
    assert.match(result.output, /OpenCodeRAG retrieval failed/);
  });

  it("returns suppression notice with successful retrieval", async () => {
    const tool = createRagReadTool({
      worktree: PROJECT,
      config: DEFAULT_CONFIG,
      embedder: makeEmbedder(),
      store: makeStore({
        count: 5,
        searchResults: [
          makeResult("c1", MAIN_TS, 1, 10, "typescript", "code", 0.9),
        ],
      }),
    });

    const result = await (tool as { execute: Function }).execute(
      { filePath: "src/main.ts" },
      {}
    ) as { output: string };

    assert.match(result.output, /OpenCodeRAG read override active/);
    assert.match(result.output, /Full file read suppressed/);
  });

  it("returns error for file path outside workspace", async () => {
    const tool = createRagReadTool({
      worktree: PROJECT,
      config: DEFAULT_CONFIG,
      embedder: makeEmbedder(),
      store: makeStore(),
    });

    const result = await (tool as { execute: Function }).execute(
      { filePath: "/outside/file.ts" },
      {}
    ) as { output: string };

    assert.match(result.output, /OpenCodeRAG retrieval failed/);
    assert.match(result.output, /outside the workspace/);
  });

  // ── Related files tests ──────────────────────────────────

  it("includes related files from other matching results", async () => {
    const OTHER2_TS = PROJECT + "/src/other2.ts";

    const tool = createRagReadTool({
      worktree: PROJECT,
      config: DEFAULT_CONFIG,
      embedder: makeEmbedder(),
      store: makeStore({
        count: 10,
        searchResults: [
          makeResult("c1", MAIN_TS, 1, 10, "typescript", "main code", 0.95),
          makeResult("c2", MAIN_TS, 20, 30, "typescript", "more main", 0.85),
          makeResult("c3", OTHER_TS, 1, 10, "typescript", "other code", 0.80),
          makeResult("c4", OTHER2_TS, 1, 10, "typescript", "other2 code", 0.75),
        ],
      }),
    });

    const result = await (tool as { execute: Function }).execute(
      { filePath: "src/main.ts" },
      {}
    ) as { output: string };

    // Chunks from requested file
    assert.match(result.output, /main code/);
    assert.match(result.output, /more main/);

    // Related files section with OTHER_TS and OTHER2_TS (not MAIN_TS)
    assert.match(result.output, /Please consider reading other relevant files/);
    assert.match(result.output, /other\.ts \(Score: 0\.80\)/);
    assert.match(result.output, /other2\.ts \(Score: 0\.75\)/);

    // Should NOT include the requested file in related files
    assert.doesNotMatch(result.output, /src\/main\.ts \(Score:/);
  });

  it("falls back to file read when file not indexed (file not on disk → error)", async () => {
    const tool = createRagReadTool({
      worktree: PROJECT,
      config: DEFAULT_CONFIG,
      embedder: makeEmbedder(),
      store: makeStore({
        count: 5,
        searchResults: [
          makeResult("c1", OTHER_TS, 1, 10, "typescript", "other code", 0.85),
          makeResult("c2", OTHER_TS, 20, 30, "typescript", "more other", 0.75),
        ],
      }),
    });

    const result = await (tool as { execute: Function }).execute(
      { filePath: "src/main.ts" },
      {}
    ) as { output: string };

    // File doesn't exist on disk, so fallback fails → retrieval error
    assert.match(result.output, /OpenCodeRAG retrieval failed/);
  });

  it("limits related files with readRelatedFilesMax", async () => {
    const OTHER2_TS = PROJECT + "/src/other2.ts";
    const OTHER3_TS = PROJECT + "/src/other3.ts";

    const config = {
      ...DEFAULT_CONFIG,
      openCode: { ...DEFAULT_CONFIG.openCode, readRelatedFilesMax: 1 },
    };

    const tool = createRagReadTool({
      worktree: PROJECT,
      config,
      embedder: makeEmbedder(),
      store: makeStore({
        count: 10,
        searchResults: [
          makeResult("c0", MAIN_TS, 1, 5, "typescript", "main", 0.95),
          makeResult("c1", OTHER_TS, 1, 10, "typescript", "other", 0.85),
          makeResult("c2", OTHER2_TS, 1, 10, "typescript", "other2", 0.80),
          makeResult("c3", OTHER3_TS, 1, 10, "typescript", "other3", 0.75),
        ],
      }),
    });

    const result = await (tool as { execute: Function }).execute(
      { filePath: "src/main.ts" },
      {}
    ) as { output: string };

    // Should have at most 1 related file
    assert.match(result.output, /Please consider reading other relevant files/);
    assert.match(result.output, /other\.ts \(Score: 0\.85\)/);
    assert.doesNotMatch(result.output, /other2\.ts/);
    assert.doesNotMatch(result.output, /other3\.ts/);
  });

  it("suppresses related files when readRelatedFilesMax is 0", async () => {
    const config = {
      ...DEFAULT_CONFIG,
      openCode: { ...DEFAULT_CONFIG.openCode, readRelatedFilesMax: 0 },
    };

    const tool = createRagReadTool({
      worktree: PROJECT,
      config,
      embedder: makeEmbedder(),
      store: makeStore({
        count: 10,
        searchResults: [
          makeResult("c0", MAIN_TS, 1, 5, "typescript", "main", 0.95),
          makeResult("c1", OTHER_TS, 1, 10, "typescript", "other", 0.85),
        ],
      }),
    });

    const result = await (tool as { execute: Function }).execute(
      { filePath: "src/main.ts" },
      {}
    ) as { output: string };

    assert.doesNotMatch(result.output, /Please consider reading other relevant files/);
  });

  it("suppresses related files when all results are from the same file", async () => {
    const tool = createRagReadTool({
      worktree: PROJECT,
      config: DEFAULT_CONFIG,
      embedder: makeEmbedder(),
      store: makeStore({
        count: 5,
        searchResults: [
          makeResult("c0", MAIN_TS, 1, 10, "typescript", "main", 0.95),
          makeResult("c1", MAIN_TS, 20, 30, "typescript", "more", 0.85),
        ],
      }),
    });

    const result = await (tool as { execute: Function }).execute(
      { filePath: "src/main.ts" },
      {}
    ) as { output: string };

    assert.doesNotMatch(result.output, /Please consider reading other relevant files/);
  });

  it("deduplicates related files by keeping best score", async () => {
    const tool = createRagReadTool({
      worktree: PROJECT,
      config: DEFAULT_CONFIG,
      embedder: makeEmbedder(),
      store: makeStore({
        count: 10,
        searchResults: [
          makeResult("c0", MAIN_TS, 1, 5, "typescript", "main", 0.95),
          makeResult("c1", OTHER_TS, 1, 10, "typescript", "first", 0.85),
          makeResult("c2", OTHER_TS, 20, 30, "typescript", "second", 0.72),
          makeResult("c3", OTHER_TS, 30, 40, "typescript", "third", 0.68),
        ],
      }),
    });

    const result = await (tool as { execute: Function }).execute(
      { filePath: "src/main.ts" },
      {}
    ) as { output: string };

    // Only one entry for other.ts, with best score 0.85
    assert.match(result.output, /Please consider reading other relevant files/);
    assert.match(result.output, /other\.ts \(Score: 0\.85\)/);
    // Should NOT show lower scores for same file
    const matches = result.output.match(/other\.ts \(Score:/g);
    assert.equal(matches?.length, 1, "expected exactly one related entry per file");
  });

  // ── Session cache tests ──────────────────────────────────

  it("uses cached results when message text matches", async () => {
    let retrieveCallCount = 0;

    const store: VectorStore = {
      addChunks: async () => {},
      search: async () => [],
      count: async () => 5,
      clear: async () => {},
      deleteByFilePath: async () => {},
    };

    const embedder = makeEmbedder();
    const sessionLastMessage = new Map<string, string>();
    const sessionRetrievalCache = new Map<
      string,
      { messageText: string; rawResults: SearchResult[] }
    >();

    // Pre-populate: simulate chat.message having stored the user message
    sessionLastMessage.set("session-1", "tell me about authentication");

    // And a cached retrieval result
    sessionRetrievalCache.set("session-1", {
      messageText: "tell me about authentication",
      rawResults: [
        makeResult("c1", MAIN_TS, 1, 10, "typescript", "cached result", 0.95),
      ],
    });

    // The retrieve function should NOT be called (we're testing cache hit)
    // We verify by using a counter instead of passing a spy
    const tool = createRagReadTool({
      worktree: PROJECT,
      config: DEFAULT_CONFIG,
      embedder,
      store,
      sessionLastMessage,
      sessionRetrievalCache,
    });

    // Passing sessionID via context triggers cache lookup
    const result = await (tool as { execute: Function }).execute(
      { filePath: "src/main.ts" },
      { sessionID: "session-1" }
    ) as { output: string };

    assert.match(result.output, /cached result/);
  });

  it("does not use cache when message text has changed", async () => {
    let retrieveCallCount = 0;

    const searchStore: VectorStore = {
      addChunks: async () => {},
      search: async () => [makeResult("c1", MAIN_TS, 1, 10, "typescript", "fresh result", 0.95)],
      count: async () => 5,
      clear: async () => {},
      deleteByFilePath: async () => {},
    };

    const sessionLastMessage = new Map<string, string>();
    const sessionRetrievalCache = new Map<
      string,
      { messageText: string; rawResults: SearchResult[] }
    >();

    // New message text (different from cached)
    sessionLastMessage.set("session-1", "tell me about database");

    // Cached old message
    sessionRetrievalCache.set("session-1", {
      messageText: "tell me about authentication",
      rawResults: [
        makeResult("c1", MAIN_TS, 1, 10, "typescript", "stale result", 0.95),
      ],
    });

    const tool = createRagReadTool({
      worktree: PROJECT,
      config: DEFAULT_CONFIG,
      embedder: makeEmbedder(),
      store: searchStore,
      sessionLastMessage,
      sessionRetrievalCache,
    });

    const result = await (tool as { execute: Function }).execute(
      { filePath: "src/main.ts" },
      { sessionID: "session-1" }
    ) as { output: string };

    // Should get fresh results (not stale), because the message changed
    assert.match(result.output, /fresh result/);
    assert.doesNotMatch(result.output, /stale result/);
  });
});

// ── File fallback tests (require real temp files) ────────────

describe("createRagReadTool — file fallback", () => {
  let tmpDir: string;
  let tmpWorktree: string;
  let tmpFile: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "rag-read-test-"));
    tmpWorktree = tmpDir.replace(/\\/g, "/");
    tmpFile = tmpWorktree + "/test-file.ts";
    await fs.writeFile(tmpFile, [
      "import { foo } from './foo';",
      "",
      "export function bar() {",
      "  return foo();",
      "}",
      "",
      "export function baz() {",
      "  return 42;",
      "}",
    ].join("\n"), "utf-8");
  });

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("reads actual file when index is empty", async () => {
    const tool = createRagReadTool({
      worktree: tmpWorktree,
      config: DEFAULT_CONFIG,
      embedder: makeEmbedder(),
      store: makeStore({ count: 0 }),
    });

    const result = await (tool as { execute: Function }).execute(
      { filePath: "test-file.ts" },
      {}
    ) as { output: string; metadata: Record<string, unknown> };

    assert.match(result.output, /No indexed chunks available/);
    assert.match(result.output, /index is empty/);
    assert.match(result.output, /export function bar/);
    assert.match(result.output, /export function baz/);
    assert.equal(result.metadata.fallback, true);
  });

  it("reads actual file when file has no indexed chunks", async () => {
    const otherFile = tmpWorktree + "/other.ts";
    await fs.writeFile(otherFile, "export const x = 1;", "utf-8");

    const tool = createRagReadTool({
      worktree: tmpWorktree,
      config: DEFAULT_CONFIG,
      embedder: makeEmbedder(),
      store: makeStore({
        count: 5,
        searchResults: [
          makeResult("c1", otherFile, 1, 1, "typescript", "export const x = 1;", 0.9),
        ],
      }),
    });

    const result = await (tool as { execute: Function }).execute(
      { filePath: "test-file.ts" },
      {}
    ) as { output: string; metadata: Record<string, unknown> };

    assert.match(result.output, /No indexed chunks available/);
    assert.match(result.output, /file not found in index/);
    assert.match(result.output, /export function bar/);
    assert.equal(result.metadata.fallback, true);

    await fs.unlink(otherFile);
  });

  it("respects startLine/endLine in fallback", async () => {
    const tool = createRagReadTool({
      worktree: tmpWorktree,
      config: DEFAULT_CONFIG,
      embedder: makeEmbedder(),
      store: makeStore({ count: 0 }),
    });

    const result = await (tool as { execute: Function }).execute(
      { filePath: "test-file.ts", startLine: 3, endLine: 5 },
      {}
    ) as { output: string };

    assert.match(result.output, /export function bar/);
    assert.match(result.output, /return foo/);
    assert.doesNotMatch(result.output, /import \{ foo \}/);
    assert.doesNotMatch(result.output, /export function baz/);
  });

  it("returns error for non-existent file when index is empty", async () => {
    const tool = createRagReadTool({
      worktree: tmpWorktree,
      config: DEFAULT_CONFIG,
      embedder: makeEmbedder(),
      store: makeStore({ count: 0 }),
    });

    const result = await (tool as { execute: Function }).execute(
      { filePath: "does-not-exist.ts" },
      {}
    ) as { output: string };

    assert.match(result.output, /OpenCodeRAG retrieval failed/);
  });

  it("returns error for non-existent file when file not in index", async () => {
    const tool = createRagReadTool({
      worktree: tmpWorktree,
      config: DEFAULT_CONFIG,
      embedder: makeEmbedder(),
      store: makeStore({
        count: 5,
        searchResults: [
          makeResult("c1", tmpFile, 1, 5, "typescript", "code", 0.8),
        ],
      }),
    });

    const result = await (tool as { execute: Function }).execute(
      { filePath: "missing.ts" },
      {}
    ) as { output: string };

    assert.match(result.output, /OpenCodeRAG retrieval failed/);
  });

  it("reads actual file on retrieval error", async () => {
    const failingStore: VectorStore = {
      addChunks: async () => {},
      search: async () => { throw new Error("DB down"); },
      count: async () => { throw new Error("DB down"); },
      clear: async () => {},
      deleteByFilePath: async () => {},
    };

    const tool = createRagReadTool({
      worktree: tmpWorktree,
      config: DEFAULT_CONFIG,
      embedder: makeEmbedder(),
      store: failingStore,
    });

    const result = await (tool as { execute: Function }).execute(
      { filePath: "test-file.ts" },
      {}
    ) as { output: string; metadata: Record<string, unknown> };

    assert.match(result.output, /No indexed chunks available/);
    assert.match(result.output, /retrieval error/);
    assert.match(result.output, /export function bar/);
    assert.equal(result.metadata.fallback, true);
  });
});
