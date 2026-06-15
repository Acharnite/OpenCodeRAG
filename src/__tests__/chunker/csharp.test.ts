import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { csharpChunker } from "../../chunker/csharp.js";

describe("CSharpChunker", () => {
  it("language is 'csharp'", () => {
    assert.equal(csharpChunker.language, "csharp");
  });

  it("fileExtensions includes .cs", () => {
    assert.ok(csharpChunker.fileExtensions.includes(".cs"));
  });

  it("grammarName is 'c_sharp'", () => {
    assert.equal(csharpChunker.grammarName, "c_sharp");
  });

  it("nodeTypes contains expected types", () => {
    const types = csharpChunker.nodeTypes;
    assert.ok(types.has("method_declaration"));
    assert.ok(types.has("interface_declaration"), "interface_declaration restored for contract definitions");
    assert.ok(types.has("struct_declaration"), "struct_declaration restored for value types");
    assert.ok(types.has("record_declaration"), "record_declaration restored for record types");
    assert.ok(types.has("enum_declaration"));
    assert.ok(!types.has("class_declaration"), "class_declaration removed for function-level chunking");
    assert.ok(!types.has("namespace_declaration"), "namespace_declaration removed for function-level chunking");
  });

  it("chunk returns empty array for empty content", async () => {
    const chunks = await csharpChunker.chunk("test.cs", "");
    assert.deepStrictEqual(chunks, []);
  });

  it("chunk returns empty array for whitespace-only content", async () => {
    const chunks = await csharpChunker.chunk("test.cs", "   \n  \n   ");
    assert.deepStrictEqual(chunks, []);
  });

  it("chunk extracts methods from class declaration", async () => {
    const code = "class Calculator { int Add(int a, int b) { return a + b; } int Sub(int a, int b) { return a - b; } }";
    const chunks = await csharpChunker.chunk("test.cs", code);
    assert.ok(chunks.length >= 2, "expected at least two chunks (one per method)");
    assert.equal(chunks[0]!.metadata.language, "csharp");
    assert.equal(chunks[0]!.metadata.filePath, "test.cs");
    assert.ok(chunks.some((c) => c.content.includes("Add")), "should have Add method chunk");
    assert.ok(chunks.some((c) => c.content.includes("Sub")), "should have Sub method chunk");
    assert.ok(!chunks.some((c) => c.content.includes("class Calculator")), "should not have class-level chunk");
  });

  it("chunk parses an enum declaration", async () => {
    const code = "enum Color { Red, Green, Blue }";
    const chunks = await csharpChunker.chunk("color.cs", code);
    assert.ok(chunks.length > 0, "expected at least one chunk");
    assert.ok(chunks.some((c) => c.content.includes("enum Color")));
  });

  it("chunk parses an interface declaration", async () => {
    const code = "interface IRepository { void Save(); void Load(); }";
    const chunks = await csharpChunker.chunk("repo.cs", code);
    assert.ok(chunks.length >= 1, "expected at least one chunk");
    assert.ok(chunks.some((c) => c.content.includes("interface IRepository")), "should have interface-level chunk");
  });

  it("chunk parses a struct declaration", async () => {
    const code = "struct Point { double X; double Y; }";
    const chunks = await csharpChunker.chunk("point.cs", code);
    assert.ok(chunks.length >= 1, "expected at least one chunk");
    assert.ok(chunks.some((c) => c.content.includes("struct Point")), "should have struct-level chunk");
  });

  it("chunk generates unique IDs for multiple declarations", async () => {
    const code = [
      "class Foo {}",
      "class Bar {}",
      "class Baz {}",
    ].join("\n");
    const chunks = await csharpChunker.chunk("multi.cs", code);
    const ids = new Set(chunks.map((c) => c.id));
    assert.equal(ids.size, chunks.length);
  });

  it("chunk sets correct startLine metadata", async () => {
    const code = [
      "using System;",
      "",
      "// first method",
      "class First { void DoThing() {} }",
      "",
      "// second method",
      "class Second { void DoOther() {} }",
    ].join("\n");
    const chunks = await csharpChunker.chunk("lines.cs", code);
    assert.ok(chunks.length >= 2, "expected at least two chunks (one per method)");
    const firstMethod = chunks.find((c) => c.content.includes("DoThing"));
    assert.ok(firstMethod, "should find DoThing chunk");
    assert.equal(firstMethod!.metadata.startLine, 4);
  });
});
