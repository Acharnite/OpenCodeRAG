import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cssChunker } from "../../chunker/css.js";

describe("CssChunker", () => {
  it("language is 'css'", () => {
    assert.equal(cssChunker.language, "css");
  });

  it("fileExtensions includes .css", () => {
    assert.ok(cssChunker.fileExtensions.includes(".css"));
    assert.equal(cssChunker.fileExtensions.length, 1);
  });

  it("grammarName is 'css'", () => {
    assert.equal(cssChunker.grammarName, "css");
  });

  it("nodeTypes contains rule_set, at_rule, media_statement, keyframes_statement", () => {
    assert.ok(cssChunker.nodeTypes.has("rule_set"));
    assert.ok(cssChunker.nodeTypes.has("at_rule"));
    assert.ok(cssChunker.nodeTypes.has("media_statement"));
    assert.ok(cssChunker.nodeTypes.has("keyframes_statement"));
  });

  it("chunk returns empty array for empty content", async () => {
    const chunks = await cssChunker.chunk("test.css", "");
    assert.deepStrictEqual(chunks, []);
  });

  it("chunk returns empty array for whitespace-only content", async () => {
    const chunks = await cssChunker.chunk("test.css", "   \n  ");
    assert.deepStrictEqual(chunks, []);
  });

  it("chunk parses a rule set", async () => {
    const css = ".foo { color: red; }";
    const chunks = await cssChunker.chunk("test.css", css);
    assert.equal(chunks.length, 1);
    assert.ok(chunks[0]!.content.includes(".foo"));
  });

  it("chunk parses multiple rule sets", async () => {
    const css = ".a { x: 1; }\n.b { y: 2; }";
    const chunks = await cssChunker.chunk("test.css", css);
    assert.equal(chunks.length, 2);
  });

  it("chunk parses an at-rule (keyframes)", async () => {
    const css = "@keyframes slide { from { left: 0; } to { left: 100%; } }";
    const chunks = await cssChunker.chunk("test.css", css);
    assert.equal(chunks.length, 1);
    assert.ok(chunks[0]!.content.includes("@keyframes"));
  });

  it("chunk parses a media query as media_statement", async () => {
    const css = "@media (max-width: 600px) { body { font-size: 14px; } }";
    const chunks = await cssChunker.chunk("test.css", css);
    assert.equal(chunks.length, 1);
    assert.ok(chunks[0]!.content.includes("@media"));
  });

  it("chunk generates unique IDs", async () => {
    const css = ".a { x: 1; }\n.b { y: 2; }\n.c { z: 3; }";
    const chunks = await cssChunker.chunk("test.css", css);
    const ids = chunks.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("chunk sets correct startLine metadata", async () => {
    const css = "\n\n.foo { color: red; }";
    const chunks = await cssChunker.chunk("test.css", css);
    assert.equal(chunks[0]!.metadata.startLine, 3);
  });
});
