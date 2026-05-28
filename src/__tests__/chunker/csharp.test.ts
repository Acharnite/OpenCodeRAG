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
    assert.ok(types.has("class_declaration"));
    assert.ok(types.has("interface_declaration"));
    assert.ok(types.has("struct_declaration"));
    assert.ok(types.has("enum_declaration"));
    assert.ok(types.has("method_declaration"));
    assert.ok(types.has("namespace_declaration"));
    assert.ok(types.has("record_declaration"));
  });

  it("chunk returns empty array for empty content", async () => {
    const chunks = await csharpChunker.chunk("test.cs", "");
    assert.deepStrictEqual(chunks, []);
  });

  it("chunk returns empty array for whitespace-only content", async () => {
    const chunks = await csharpChunker.chunk("test.cs", "   \n  \n   ");
    assert.deepStrictEqual(chunks, []);
  });

  it("chunk parses a class declaration", async () => {
    const code = "class Calculator { int Add(int a, int b) { return a + b; } }";
    const chunks = await csharpChunker.chunk("test.cs", code);
    assert.ok(chunks.length > 0, "expected at least one chunk");
    assert.equal(chunks[0]!.metadata.language, "csharp");
    assert.equal(chunks[0]!.metadata.filePath, "test.cs");
    assert.ok(chunks[0]!.content.includes("class Calculator"));
  });

  it("chunk parses an interface declaration", async () => {
    const code = "interface IRepository { void Save(); }";
    const chunks = await csharpChunker.chunk("repo.cs", code);
    assert.ok(chunks.length > 0, "expected at least one chunk");
    assert.ok(chunks.some((c) => c.content.includes("interface IRepository")));
  });

  it("chunk parses an enum declaration", async () => {
    const code = "enum Color { Red, Green, Blue }";
    const chunks = await csharpChunker.chunk("color.cs", code);
    assert.ok(chunks.length > 0, "expected at least one chunk");
    assert.ok(chunks.some((c) => c.content.includes("enum Color")));
  });

  it("chunk parses a namespace declaration", async () => {
    const code = "namespace MyApp.Utils { class Helper {} }";
    const chunks = await csharpChunker.chunk("ns.cs", code);
    assert.ok(chunks.length > 0, "expected at least one chunk");
    assert.ok(chunks.some((c) => c.content.includes("namespace MyApp.Utils")));
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
      "// first class",
      "class First {}",
      "",
      "// second class",
      "class Second {}",
    ].join("\n");
    const chunks = await csharpChunker.chunk("lines.cs", code);
    assert.ok(chunks.length >= 2, "expected at least two chunks");
    const firstFn = chunks.find((c) => c.content.includes("First"));
    assert.ok(firstFn, "should find First chunk");
    assert.equal(firstFn!.metadata.startLine, 4);
  });
});
