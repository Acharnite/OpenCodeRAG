import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pythonChunker } from "../../chunker/python.js";

describe("PythonChunker", () => {
  it("language is 'python'", () => {
    assert.equal(pythonChunker.language, "python");
  });

  it("fileExtensions includes .py", () => {
    assert.ok(pythonChunker.fileExtensions.includes(".py"));
  });

  it("grammarName is 'python'", () => {
    assert.equal(pythonChunker.grammarName, "python");
  });

  it("nodeTypes contains expected types", () => {
    const types = pythonChunker.nodeTypes;
    assert.ok(types.has("function_definition"));
    assert.ok(types.has("class_definition"));
    assert.ok(types.has("decorated_definition"));
  });

  it("chunk returns empty array for empty content", async () => {
    const chunks = await pythonChunker.chunk("test.py", "");
    assert.deepStrictEqual(chunks, []);
  });

  it("chunk returns empty array for whitespace-only content", async () => {
    const chunks = await pythonChunker.chunk("test.py", "   \n  \n   ");
    assert.deepStrictEqual(chunks, []);
  });

  it("chunk parses a function definition", async () => {
    const code = "def hello():\n    return 'world'\n";
    const chunks = await pythonChunker.chunk("test.py", code);
    assert.ok(chunks.length > 0, "expected at least one chunk");
    assert.equal(chunks[0]!.metadata.language, "python");
    assert.equal(chunks[0]!.metadata.filePath, "test.py");
    assert.ok(chunks[0]!.content.includes("hello"));
  });

  it("chunk parses a class definition", async () => {
    const code = "class Animal:\n    def speak(self):\n        return 'hello'\n";
    const chunks = await pythonChunker.chunk("animals.py", code);
    assert.ok(chunks.length > 0, "expected at least one chunk");
    assert.equal(chunks[0]!.metadata.language, "python");
    assert.ok(chunks[0]!.content.includes("class Animal"));
  });

  it("chunk parses a decorated definition", async () => {
    const code = "@staticmethod\ndef helper():\n    pass\n";
    const chunks = await pythonChunker.chunk("utils.py", code);
    assert.ok(chunks.length > 0, "expected at least one chunk");
    assert.ok(
      chunks.some(
        (c) => c.content.includes("@staticmethod") || c.content.includes("helper")
      )
    );
  });

  it("chunk generates unique IDs for multiple definitions", async () => {
    const code = [
      "def foo():",
      "    pass",
      "",
      "def bar():",
      "    pass",
      "",
      "class Baz:",
      "    pass",
    ].join("\n");
    const chunks = await pythonChunker.chunk("multi.py", code);
    const ids = new Set(chunks.map((c) => c.id));
    assert.equal(ids.size, chunks.length);
  });

  it("chunk sets correct startLine metadata", async () => {
    const code = [
      "# top comment",
      "",
      "def first():",
      "    return 1",
      "",
      "def second():",
      "    return 2",
    ].join("\n");
    const chunks = await pythonChunker.chunk("lines.py", code);
    assert.ok(chunks.length >= 2, "expected at least two chunks");
    const firstFn = chunks.find((c) => c.content.includes("first"));
    assert.ok(firstFn, "should find first() chunk");
    assert.equal(firstFn!.metadata.startLine, 3);
  });
});
