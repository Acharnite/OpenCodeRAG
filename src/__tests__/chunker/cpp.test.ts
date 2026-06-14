import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cppChunker } from "../../chunker/cpp.js";

describe("CppChunker", () => {
  it("language is 'cpp'", () => {
    assert.equal(cppChunker.language, "cpp");
  });

  it("fileExtensions includes .cpp, .cc, .cxx, .hpp, .hxx", () => {
    assert.ok(cppChunker.fileExtensions.includes(".cpp"));
    assert.ok(cppChunker.fileExtensions.includes(".cc"));
    assert.ok(cppChunker.fileExtensions.includes(".cxx"));
    assert.ok(cppChunker.fileExtensions.includes(".hpp"));
    assert.ok(cppChunker.fileExtensions.includes(".hxx"));
  });

  it("grammarName is 'cpp'", () => {
    assert.equal(cppChunker.grammarName, "cpp");
  });

  it("nodeTypes contains expected types", () => {
    const types = cppChunker.nodeTypes;
    assert.ok(types.has("function_definition"));
    assert.ok(types.has("struct_specifier"));
    assert.ok(types.has("enum_specifier"));
    assert.ok(types.has("union_specifier"));
    assert.ok(!types.has("class_specifier"), "class_specifier removed for function-level chunking");
    assert.ok(!types.has("namespace_definition"), "namespace_definition removed for function-level chunking");
    assert.ok(!types.has("template_declaration"), "template_declaration removed for function-level chunking");
  });

  it("chunk returns empty array for empty content", async () => {
    const chunks = await cppChunker.chunk("test.cpp", "");
    assert.deepStrictEqual(chunks, []);
  });

  it("chunk returns empty array for whitespace-only content", async () => {
    const chunks = await cppChunker.chunk("test.cpp", "   \n  \n   ");
    assert.deepStrictEqual(chunks, []);
  });

  it("chunk parses a function definition", async () => {
    const code = "int add(int a, int b) {\n  return a + b;\n}\n";
    const chunks = await cppChunker.chunk("test.cpp", code);
    assert.ok(chunks.length > 0, "expected at least one chunk");
    assert.equal(chunks[0]!.metadata.language, "cpp");
    assert.equal(chunks[0]!.metadata.filePath, "test.cpp");
    assert.ok(chunks[0]!.content.includes("add"));
  });

  it("chunk extracts methods from class definition", async () => {
    const code = [
      "class Calculator {",
      "public:",
      "  int add(int a, int b) { return a + b; }",
      "  int sub(int a, int b) { return a - b; }",
      "};",
    ].join("\n");
    const chunks = await cppChunker.chunk("calc.cpp", code);
    assert.ok(chunks.length >= 2, "expected at least two chunks (one per method)");
    assert.ok(chunks.some((c) => c.content.includes("add")), "should have add method chunk");
    assert.ok(chunks.some((c) => c.content.includes("sub")), "should have sub method chunk");
    assert.ok(!chunks.some((c) => c.content.includes("class Calculator")), "should not have class-level chunk");
  });

  it("chunk parses a namespace with functions", async () => {
    const code = "namespace utils {\n  int value() { return 0; }\n}\n";
    const chunks = await cppChunker.chunk("ns.cpp", code);
    assert.ok(chunks.length > 0, "expected at least one chunk");
    assert.ok(chunks.some((c) => c.content.includes("value")), "should capture function inside namespace");
  });

  it("chunk parses a template function declaration", async () => {
    const code = "template<typename T>\nT max(T a, T b) {\n  return a > b ? a : b;\n}\n";
    const chunks = await cppChunker.chunk("tmpl.cpp", code);
    assert.ok(chunks.length > 0, "expected at least one chunk");
    assert.ok(chunks.some((c) => c.content.includes("max")), "should capture function body");
  });

  it("chunk generates unique IDs for multiple declarations", async () => {
    const code = [
      "int foo() { return 1; }",
      "",
      "int bar() { return 2; }",
      "",
      "int baz() { return 3; }",
    ].join("\n");
    const chunks = await cppChunker.chunk("multi.cpp", code);
    const ids = new Set(chunks.map((c) => c.id));
    assert.equal(ids.size, chunks.length);
  });

  it("chunk sets correct startLine metadata", async () => {
    const code = [
      "#include <iostream>",
      "",
      "// first function",
      "void first() {}",
      "",
      "// second function",
      "void second() {}",
    ].join("\n");
    const chunks = await cppChunker.chunk("lines.cpp", code);
    assert.ok(chunks.length >= 2, "expected at least two chunks");
    const firstFn = chunks.find((c) => c.content.includes("first"));
    assert.ok(firstFn, "should find first() chunk");
    assert.equal(firstFn!.metadata.startLine, 4);
  });
});
