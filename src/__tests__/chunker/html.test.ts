import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { htmlChunker } from "../../chunker/html.js";

describe("HtmlChunker", () => {
  it("language is 'html'", () => {
    assert.equal(htmlChunker.language, "html");
  });

  it("fileExtensions includes .html and .htm", () => {
    assert.ok(htmlChunker.fileExtensions.includes(".html"));
    assert.ok(htmlChunker.fileExtensions.includes(".htm"));
    assert.equal(htmlChunker.fileExtensions.length, 2);
  });

  it("grammarName is 'html'", () => {
    assert.equal(htmlChunker.grammarName, "html");
  });

  it("nodeTypes contains script_element and style_element", () => {
    assert.ok(htmlChunker.nodeTypes.has("script_element"));
    assert.ok(htmlChunker.nodeTypes.has("style_element"));
  });

  it("chunk returns empty array for empty content", async () => {
    const chunks = await htmlChunker.chunk("test.html", "");
    assert.deepStrictEqual(chunks, []);
  });

  it("chunk returns empty array for whitespace-only content", async () => {
    const chunks = await htmlChunker.chunk("test.html", "   \n  ");
    assert.deepStrictEqual(chunks, []);
  });

  it("chunk parses a script element", async () => {
    const html = "<html><body><script>const x = 1;</script></body></html>";
    const chunks = await htmlChunker.chunk("test.html", html);
    assert.equal(chunks.length, 1);
    assert.ok(chunks[0]!.content.includes("<script>"));
  });

  it("chunk parses a style element", async () => {
    const html = "<html><head><style>body { color: red; }</style></head></html>";
    const chunks = await htmlChunker.chunk("test.html", html);
    assert.equal(chunks.length, 1);
    assert.ok(chunks[0]!.content.includes("<style>"));
  });

  it("chunk parses both script and style elements", async () => {
    const html = `<html>
  <head><style>.a { x: 1; }</style></head>
  <body><script>const y = 2;</script></body>
</html>`;
    const chunks = await htmlChunker.chunk("test.html", html);
    assert.equal(chunks.length, 2);
    const hasStyle = chunks.some((c) => c.content.includes("<style>"));
    const hasScript = chunks.some((c) => c.content.includes("<script>"));
    assert.ok(hasStyle);
    assert.ok(hasScript);
  });

  it("chunk generates unique IDs", async () => {
    const html = "<html><head><style>.a{}</style></head><body><script>const x = 1;</script></body></html>";
    const chunks = await htmlChunker.chunk("test.html", html);
    const ids = chunks.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("chunk sets correct startLine metadata", async () => {
    const html = "\n\n\n<style>body { color: red; }</style>";
    const chunks = await htmlChunker.chunk("test.html", html);
    assert.equal(chunks[0]!.metadata.startLine, 4);
  });
});
