import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FallbackChunker } from "../../chunker/fallback.js";

describe("FallbackChunker", () => {
  it("returns empty array for empty content", async () => {
    const chunker = new FallbackChunker();
    const chunks = await chunker.chunk("test.txt", "");
    assert.deepStrictEqual(chunks, []);
  });

  it("returns empty array for whitespace-only content", async () => {
    const chunker = new FallbackChunker();
    const chunks = await chunker.chunk("test.txt", "   \n  \n   ");
    assert.deepStrictEqual(chunks, []);
  });

  it("splits content by maxLines", async () => {
    const chunker = new FallbackChunker(3);
    const lines = ["line 1", "line 2", "line 3", "line 4", "line 5"];
    const chunks = await chunker.chunk("test.txt", lines.join("\n"));
    assert.equal(chunks.length, 2);
    assert.equal(chunks[0]!.metadata.startLine, 1);
    assert.equal(chunks[0]!.metadata.endLine, 3);
    assert.equal(chunks[1]!.metadata.startLine, 4);
    assert.equal(chunks[1]!.metadata.endLine, 5);
  });

  it("creates single chunk for content under maxLines", async () => {
    const chunker = new FallbackChunker(100);
    const chunks = await chunker.chunk("test.txt", "single line");
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0]!.metadata.startLine, 1);
    assert.equal(chunks[0]!.metadata.endLine, 1);
  });

  it("sets correct filePath and language metadata", async () => {
    const chunker = new FallbackChunker();
    const chunks = await chunker.chunk("/path/to/file.txt", "content");
    assert.equal(chunks[0]!.metadata.filePath, "/path/to/file.txt");
    assert.equal(chunks[0]!.metadata.language, "text");
  });

  it("generates unique id for each chunk", async () => {
    const chunker = new FallbackChunker(1);
    const chunks = await chunker.chunk("test.txt", "a\nb\nc");
    assert.equal(chunks.length, 3);
    const ids = new Set(chunks.map((c) => c.id));
    assert.equal(ids.size, 3);
  });

  it("uses default maxLines of 100", async () => {
    const chunker = new FallbackChunker();
    const lines = Array.from({ length: 150 }, (_, i) => `line ${i + 1}`);
    const chunks = await chunker.chunk("test.txt", lines.join("\n"));
    assert.equal(chunks.length, 2);
    assert.equal(chunks[0]!.metadata.endLine, 100);
    assert.equal(chunks[1]!.metadata.startLine, 101);
    assert.equal(chunks[1]!.metadata.endLine, 150);
  });

  it("skips empty chunks from whitespace-only lines", async () => {
    const chunker = new FallbackChunker(5);
    const content = "line 1\n\n\n\n\nline 6\n\n\n\n\nline 11";
    const chunks = await chunker.chunk("test.txt", content);
    // 11 lines total, chunks of 5: lines 1-5 (trimmed keeps only "line 1"),
    // lines 6-10 (trimmed keeps only "line 6"), lines 11-11 (trimmed keeps "line 11")
    assert.equal(chunks.length, 3);
  });

  it("language property returns 'text'", () => {
    const chunker = new FallbackChunker();
    assert.equal(chunker.language, "text");
  });
});
