import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { javaChunker } from "../../chunker/java.js";

describe("JavaChunker", () => {
  it("language is 'java'", () => {
    assert.equal(javaChunker.language, "java");
  });

  it("fileExtensions includes .java", () => {
    assert.ok(javaChunker.fileExtensions.includes(".java"));
  });

  it("grammarName is 'java'", () => {
    assert.equal(javaChunker.grammarName, "java");
  });

  it("nodeTypes contains expected types", () => {
    const types = javaChunker.nodeTypes;
    assert.ok(types.has("method_declaration"));
    assert.ok(types.has("interface_declaration"), "interface_declaration restored for contract definitions");
    assert.ok(types.has("enum_declaration"), "enum_declaration restored for enum types");
    assert.ok(!types.has("class_declaration"), "class_declaration removed for function-level chunking");
  });

  it("chunk returns empty array for empty content", async () => {
    const chunks = await javaChunker.chunk("test.java", "");
    assert.deepStrictEqual(chunks, []);
  });

  it("chunk returns empty array for whitespace-only content", async () => {
    const chunks = await javaChunker.chunk("test.java", "   \n  \n   ");
    assert.deepStrictEqual(chunks, []);
  });

  it("chunk extracts methods from class declaration", async () => {
    const code =
      "class Foo {\n  void bar() {\n    return;\n  }\n  void baz() {\n    return;\n  }\n}";
    const chunks = await javaChunker.chunk("test.java", code);
    assert.ok(chunks.length >= 2, "expected at least two chunks (one per method)");
    assert.equal(chunks[0]!.metadata.language, "java");
    assert.equal(chunks[0]!.metadata.filePath, "test.java");
    assert.ok(chunks.some((c) => c.content.includes("bar")), "should have bar method chunk");
    assert.ok(chunks.some((c) => c.content.includes("baz")), "should have baz method chunk");
    assert.ok(!chunks.some((c) => c.content.includes("class Foo")), "should not have class-level chunk");
  });

  it("chunk parses an interface declaration", async () => {
    const code =
      "interface Runnable {\n  void run();\n  void stop();\n}";
    const chunks = await javaChunker.chunk("Runnable.java", code);
    assert.ok(chunks.length >= 1, "expected at least one chunk");
    assert.ok(chunks.some((c) => c.content.includes("interface Runnable")), "should have interface-level chunk");
  });

  it("chunk parses an enum declaration", async () => {
    const code =
      "enum Color {\n  RED, GREEN, BLUE\n}";
    const chunks = await javaChunker.chunk("Color.java", code);
    assert.ok(chunks.length > 0, "expected at least one chunk");
    assert.ok(chunks.some((c) => c.content.includes("enum Color")), "should have enum-level chunk");
  });

  it("chunk generates unique IDs for multiple declarations", async () => {
    const code = [
      "class Foo {",
      "  void bar() {}",
      "}",
      "",
      "class Baz {",
      "  void qux() {}",
      "}",
    ].join("\n");
    const chunks = await javaChunker.chunk("multi.java", code);
    const ids = new Set(chunks.map((c) => c.id));
    assert.equal(ids.size, chunks.length);
  });

  it("chunk sets correct startLine metadata", async () => {
    const code = [
      "// top comment",
      "",
      "class First {",
      "  void doThing() {}",
      "}",
      "",
      "class Second {",
      "  void doOther() {}",
      "}",
    ].join("\n");
    const chunks = await javaChunker.chunk("lines.java", code);
    const methodChunks = chunks.filter((c) => c.content.includes("void "));
    assert.ok(methodChunks.length >= 2, "expected at least two method chunks");
    const firstMethod = methodChunks.find((c) => c.content.includes("doThing"));
    assert.ok(firstMethod, "should find doThing chunk");
    assert.equal(firstMethod!.metadata.startLine, 4);
  });
});
