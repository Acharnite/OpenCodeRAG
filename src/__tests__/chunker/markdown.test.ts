import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MarkdownChunker } from "../../chunker/markdown.js";

describe("MarkdownChunker", () => {
  const chunker = new MarkdownChunker();

  it("returns empty array for empty content", async () => {
    const chunks = await chunker.chunk("test.md", "");
    assert.deepStrictEqual(chunks, []);
  });

  it("returns single chunk for content without headings", async () => {
    const chunks = await chunker.chunk("test.md", "Some plain text\nwithout any headings.");
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0]!.metadata.startLine, 1);
    assert.equal(chunks[0]!.metadata.endLine, 2);
    assert.equal(chunks[0]!.content, "Some plain text\nwithout any headings.");
  });

  it("splits on level-1 and level-2 headings", async () => {
    const content = [
      "# Section 1",
      "Content of section 1",
      "",
      "## Section 2",
      "Content of section 2",
      "",
      "# Section 3",
      "Content of section 3",
    ].join("\n");

    const chunks = await chunker.chunk("test.md", content);
    assert.ok(chunks.length >= 2, `Expected at least 2 chunks, got ${chunks.length}`);
  });

  it("includes heading text in chunk content", async () => {
    const content = "# Title\nSome content here.";
    const chunks = await chunker.chunk("test.md", content);
    assert.equal(chunks.length, 1);
    assert.ok(chunks[0]!.content.includes("Title"));
  });

  it("sets markdown language metadata", async () => {
    const chunks = await chunker.chunk("test.md", "# Hello\nWorld");
    assert.equal(chunks[0]!.metadata.language, "markdown");
  });

  it("sets correct filePath", async () => {
    const chunks = await chunker.chunk("/docs/readme.md", "# Hello\nWorld");
    assert.equal(chunks[0]!.metadata.filePath, "/docs/readme.md");
  });

  it("handles deep headings (h3+) with end-of-file split", async () => {
    const content = [
      "# Main",
      "main content",
      "### Sub detail",
      "detail content",
    ].join("\n");
    const chunks = await chunker.chunk("test.md", content);
    assert.ok(chunks.length >= 1, `Expected at least 1 chunk, got ${chunks.length}`);
  });

  it("generates unique ids for each chunk", async () => {
    const content = [
      "# First",
      "first content",
      "# Second",
      "second content",
      "# Third",
      "third content",
    ].join("\n");
    const chunks = await chunker.chunk("test.md", content);
    assert.ok(chunks.length >= 3);
    const ids = new Set(chunks.map((c) => c.id));
    assert.equal(ids.size, chunks.length);
  });

  it("language property returns 'markdown'", () => {
    assert.equal(chunker.language, "markdown");
  });

  it("fileExtensions includes .md and .mdx", () => {
    assert.deepStrictEqual(chunker.fileExtensions, [".md", ".mdx"]);
  });
});
