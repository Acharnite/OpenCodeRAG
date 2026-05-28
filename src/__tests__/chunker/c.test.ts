import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cChunker } from "../../chunker/c.js";

describe("CChunker", () => {
  it("language is 'c'", () => {
    assert.equal(cChunker.language, "c");
  });

  it("fileExtensions includes .c and .h", () => {
    assert.ok(cChunker.fileExtensions.includes(".c"));
    assert.ok(cChunker.fileExtensions.includes(".h"));
  });

  it("grammarName is 'c'", () => {
    assert.equal(cChunker.grammarName, "c");
  });

  it("nodeTypes contains expected types", () => {
    const types = cChunker.nodeTypes;
    assert.ok(types.has("function_definition"));
    assert.ok(types.has("struct_specifier"));
    assert.ok(types.has("enum_specifier"));
    assert.ok(types.has("union_specifier"));
    assert.ok(types.has("type_definition"));
    assert.ok(types.has("preproc_def"));
  });

  it("chunk returns empty array for empty content", async () => {
    const chunks = await cChunker.chunk("test.c", "");
    assert.deepStrictEqual(chunks, []);
  });

  it("chunk returns empty array for whitespace-only content", async () => {
    const chunks = await cChunker.chunk("test.c", "   \n  \n   ");
    assert.deepStrictEqual(chunks, []);
  });

  it("chunk parses a function definition", async () => {
    const code = "int add(int a, int b) {\n  return a + b;\n}\n";
    const chunks = await cChunker.chunk("test.c", code);
    assert.ok(chunks.length > 0, "expected at least one chunk");
    assert.equal(chunks[0]!.metadata.language, "c");
    assert.equal(chunks[0]!.metadata.filePath, "test.c");
    assert.ok(chunks[0]!.content.includes("add"));
  });

  it("chunk parses a struct definition", async () => {
    const code = "struct Point {\n  int x;\n  int y;\n};\n";
    const chunks = await cChunker.chunk("point.c", code);
    assert.ok(chunks.length > 0, "expected at least one chunk");
    assert.equal(chunks[0]!.metadata.language, "c");
    assert.ok(chunks[0]!.content.includes("struct Point"));
  });

  it("chunk parses an enum definition", async () => {
    const code = "enum Color { RED, GREEN, BLUE };\n";
    const chunks = await cChunker.chunk("color.c", code);
    assert.ok(chunks.length > 0, "expected at least one chunk");
    assert.ok(chunks.some((c) => c.content.includes("enum Color")));
  });

  it("chunk generates unique IDs for multiple declarations", async () => {
    const code = [
      "void foo() {}",
      "",
      "void bar() {}",
      "",
      "void baz() {}",
    ].join("\n");
    const chunks = await cChunker.chunk("multi.c", code);
    const ids = new Set(chunks.map((c) => c.id));
    assert.equal(ids.size, chunks.length);
  });

  it("chunk sets correct startLine metadata", async () => {
    const code = [
      "#include <stdio.h>",
      "",
      "// first function",
      "void first() {}",
      "",
      "// second function",
      "void second() {}",
    ].join("\n");
    const chunks = await cChunker.chunk("lines.c", code);
    assert.ok(chunks.length >= 2, "expected at least two chunks");
    const firstFn = chunks.find((c) => c.content.includes("first"));
    assert.ok(firstFn, "should find first() chunk");
    assert.equal(firstFn!.metadata.startLine, 4);
  });
});
