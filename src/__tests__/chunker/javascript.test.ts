import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { javascriptChunker } from "../../chunker/javascript.js";

describe("JavaScriptChunker", () => {
  it("language is 'javascript'", () => {
    assert.equal(javascriptChunker.language, "javascript");
  });

  it("fileExtensions includes .js, .jsx, .mjs, .cjs", () => {
    assert.ok(javascriptChunker.fileExtensions.includes(".js"));
    assert.ok(javascriptChunker.fileExtensions.includes(".jsx"));
    assert.ok(javascriptChunker.fileExtensions.includes(".mjs"));
    assert.ok(javascriptChunker.fileExtensions.includes(".cjs"));
  });

  it("grammarName is 'javascript'", () => {
    assert.equal(javascriptChunker.grammarName, "javascript");
  });

  it("nodeTypes contains expected types", () => {
    const types = javascriptChunker.nodeTypes;
    assert.ok(types.has("function_declaration"));
    assert.ok(types.has("method_definition"));
    assert.ok(types.has("arrow_function"));
    assert.ok(!types.has("class_declaration"), "class_declaration removed for function-level chunking");
    assert.ok(!types.has("export_statement"), "export_statement removed for function-level chunking");
  });

  it("chunk returns empty array for empty content", async () => {
    const chunks = await javascriptChunker.chunk("test.js", "");
    assert.deepStrictEqual(chunks, []);
  });

  it("chunk returns empty array for whitespace-only content", async () => {
    const chunks = await javascriptChunker.chunk("test.js", "   \n  \n   ");
    assert.deepStrictEqual(chunks, []);
  });

  it("chunk parses a function declaration", async () => {
    const code = "function hello() { return 'world'; }";
    const chunks = await javascriptChunker.chunk("test.js", code);
    assert.ok(chunks.length > 0, "expected at least one chunk");
    assert.equal(chunks[0]!.metadata.language, "javascript");
    assert.equal(chunks[0]!.metadata.filePath, "test.js");
    assert.ok(chunks[0]!.content.includes("hello"));
  });

  it("chunk extracts methods from class declaration", async () => {
    const code = "class Counter { increment() { this.value++; } decrement() { this.value--; } }";
    const chunks = await javascriptChunker.chunk("counter.js", code);
    assert.ok(chunks.length >= 2, "expected at least two chunks (one per method)");
    assert.ok(chunks.some((c) => c.content.includes("increment")), "should have increment method chunk");
    assert.ok(chunks.some((c) => c.content.includes("decrement")), "should have decrement method chunk");
    assert.ok(!chunks.some((c) => c.content.includes("class Counter")), "should not have class-level chunk");
  });

  it("chunk parses an arrow function", async () => {
    const code = "const add = (a, b) => a + b;";
    const chunks = await javascriptChunker.chunk("arrow.js", code);
    assert.ok(chunks.length > 0, "expected at least one chunk");
    assert.ok(chunks.some((c) => c.content.includes("=>")));
  });

  it("chunk parses exported function declaration", async () => {
    const code = "export function greet() { return 'hi'; }";
    const chunks = await javascriptChunker.chunk("mod.js", code);
    assert.ok(chunks.length > 0, "expected at least one chunk");
    assert.ok(chunks.some((c) => c.content.includes("greet")), "should capture function body");
  });

  it("chunk generates unique IDs for multiple declarations", async () => {
    const code = [
      "function foo() { return 1; }",
      "function bar() { return 2; }",
      "function baz() { return 3; }",
    ].join("\n");
    const chunks = await javascriptChunker.chunk("multi.js", code);
    const ids = new Set(chunks.map((c) => c.id));
    assert.equal(ids.size, chunks.length);
  });

  it("chunk sets correct startLine metadata", async () => {
    const code = [
      "// top comment",
      "",
      "function first() {",
      "  return 1;",
      "}",
      "",
      "function second() {",
      "  return 2;",
      "}",
    ].join("\n");
    const chunks = await javascriptChunker.chunk("lines.js", code);
    assert.ok(chunks.length >= 2, "expected at least two chunks");
    const firstFn = chunks.find((c) => c.content.includes("first"));
    assert.ok(firstFn, "should find first() chunk");
    assert.equal(firstFn!.metadata.startLine, 3);
  });
});
