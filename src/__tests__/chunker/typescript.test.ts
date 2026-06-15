import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { typescriptChunker } from "../../chunker/typescript.js";

describe("TypeScriptChunker", () => {
  it("language is 'typescript'", () => {
    assert.equal(typescriptChunker.language, "typescript");
  });

  it("fileExtensions includes .ts and .tsx", () => {
    assert.ok(typescriptChunker.fileExtensions.includes(".ts"));
    assert.ok(typescriptChunker.fileExtensions.includes(".tsx"));
  });

  it("grammarName is 'typescript'", () => {
    assert.equal(typescriptChunker.grammarName, "typescript");
  });

  it("nodeTypes contains expected types", () => {
    const types = typescriptChunker.nodeTypes;
    assert.ok(types.has("function_declaration"));
    assert.ok(types.has("method_definition"));
    assert.ok(types.has("arrow_function"));
    assert.ok(types.has("interface_declaration"));
    assert.ok(types.has("type_alias_declaration"));
    assert.ok(!types.has("class_declaration"), "class_declaration removed for function-level chunking");
    assert.ok(!types.has("export_statement"), "export_statement removed for function-level chunking");
  });

  it("chunk returns empty array for empty content", async () => {
    const chunks = await typescriptChunker.chunk("test.ts", "");
    assert.deepStrictEqual(chunks, []);
  });

  it("chunk returns empty array for whitespace-only content", async () => {
    const chunks = await typescriptChunker.chunk("test.ts", "   \n  \n   ");
    assert.deepStrictEqual(chunks, []);
  });

  it("chunk parses a function declaration", async () => {
    const code = "function hello() { return 'world'; }";
    const chunks = await typescriptChunker.chunk("test.ts", code);
    assert.ok(chunks.length > 0, "expected at least one chunk");
    assert.equal(chunks[0]!.metadata.language, "typescript");
    assert.equal(chunks[0]!.metadata.filePath, "test.ts");
    assert.ok(chunks[0]!.id.length > 0);
    assert.ok(chunks[0]!.content.includes("hello"));
  });

  it("chunk extracts methods from class declaration", async () => {
    const code = "class Foo { bar(): string { return 'baz'; } baz(): number { return 42; } }";
    const chunks = await typescriptChunker.chunk("/src/Foo.ts", code);
    assert.ok(chunks.length >= 2, "expected at least two chunks (one per method)");
    assert.equal(chunks[0]!.metadata.language, "typescript");
    assert.equal(chunks[0]!.metadata.filePath, "/src/Foo.ts");
    assert.ok(chunks.some((c) => c.content.includes("bar")), "should have bar method chunk");
    assert.ok(chunks.some((c) => c.content.includes("baz")), "should have baz method chunk");
    assert.ok(!chunks.some((c) => c.content.includes("class Foo")), "should not have class-level chunk");
  });

  it("chunk parses an interface declaration", async () => {
    const code = "interface User { name: string; age: number; }";
    const chunks = await typescriptChunker.chunk("types.ts", code);
    assert.ok(chunks.length > 0, "expected at least one chunk");
    assert.ok(chunks[0]!.content.includes("interface User"));
  });

  it("chunk parses a type alias declaration", async () => {
    const code = "type Point = { x: number; y: number; };";
    const chunks = await typescriptChunker.chunk("types.ts", code);
    assert.ok(chunks.length > 0, "expected at least one chunk");
    assert.ok(chunks.some((c) => c.content.includes("Point")));
  });

  it("chunk generates unique IDs for multiple declarations", async () => {
    const code = [
      "function foo() { return 1; }",
      "function bar() { return 2; }",
      "function baz() { return 3; }",
    ].join("\n");
    const chunks = await typescriptChunker.chunk("multi.ts", code);
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
    const chunks = await typescriptChunker.chunk("lines.ts", code);
    assert.ok(chunks.length >= 2, "expected at least two chunks");
    // first() starts at line 3 (1-indexed)
    const firstFn = chunks.find((c) => c.content.includes("first"));
    assert.ok(firstFn, "should find first() chunk");
    assert.equal(firstFn!.metadata.startLine, 3);
  });
});
