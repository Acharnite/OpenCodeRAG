import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { goChunker } from "../../chunker/go.js";

describe("GoChunker", () => {
  it("language is 'go'", () => {
    assert.equal(goChunker.language, "go");
  });

  it("fileExtensions includes .go", () => {
    assert.ok(goChunker.fileExtensions.includes(".go"));
  });

  it("grammarName is 'go'", () => {
    assert.equal(goChunker.grammarName, "go");
  });

  it("nodeTypes contains expected types", () => {
    const types = goChunker.nodeTypes;
    assert.ok(types.has("function_declaration"));
    assert.ok(types.has("method_declaration"));
    assert.ok(!types.has("type_declaration"), "type_declaration removed for function-level chunking");
  });

  it("chunk returns empty array for empty content", async () => {
    const chunks = await goChunker.chunk("test.go", "");
    assert.deepStrictEqual(chunks, []);
  });

  it("chunk returns empty array for whitespace-only content", async () => {
    const chunks = await goChunker.chunk("test.go", "   \n  \n   ");
    assert.deepStrictEqual(chunks, []);
  });

  it("chunk parses a function declaration", async () => {
    const code = "package main\n\nfunc hello() string {\n\treturn \"world\"\n}\n";
    const chunks = await goChunker.chunk("test.go", code);
    assert.ok(chunks.length > 0, "expected at least one chunk");
    assert.equal(chunks[0]!.metadata.language, "go");
    assert.equal(chunks[0]!.metadata.filePath, "test.go");
    assert.ok(chunks[0]!.content.includes("hello"));
  });

  it("chunk parses a method declaration", async () => {
    const code = [
      "package main",
      "",
      "type Counter struct {",
      "\tvalue int",
      "}",
      "",
      "func (c *Counter) Increment() {",
      "\tc.value++",
      "}",
    ].join("\n");
    const chunks = await goChunker.chunk("counter.go", code);
    assert.ok(chunks.length > 0, "expected at least one chunk");
    const methodChunks = chunks.filter((c) => c.content.includes("Increment"));
    assert.ok(methodChunks.length > 0, "expected Increment method chunk");
  });

  it("chunk parses a method on a type", async () => {
    const code = "package main\n\ntype User struct {\n\tName string\n\tAge  int\n}\n\nfunc (u *User) GetName() string {\n\treturn u.Name\n}\n";
    const chunks = await goChunker.chunk("user.go", code);
    assert.ok(chunks.length > 0, "expected at least one chunk");
    assert.ok(chunks.some((c) => c.content.includes("GetName")), "should capture method");
  });

  it("chunk generates unique IDs for multiple declarations", async () => {
    const code = [
      "package main",
      "",
      "func foo() {}",
      "",
      "func bar() {}",
      "",
      "func baz() {}",
    ].join("\n");
    const chunks = await goChunker.chunk("multi.go", code);
    const ids = new Set(chunks.map((c) => c.id));
    assert.equal(ids.size, chunks.length);
  });

  it("chunk sets correct startLine metadata", async () => {
    const code = [
      "package main",
      "",
      "// first function",
      "func first() {}",
      "",
      "// second function",
      "func second() {}",
    ].join("\n");
    const chunks = await goChunker.chunk("lines.go", code);
    assert.ok(chunks.length >= 2, "expected at least two chunks");
    const firstFn = chunks.find((c) => c.content.includes("first"));
    assert.ok(firstFn, "should find first() chunk");
    assert.equal(firstFn!.metadata.startLine, 4);
  });
});
