import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { kotlinChunker } from "../../chunker/kotlin.js";

describe("KotlinChunker", () => {
  it("language is 'kotlin'", () => {
    assert.equal(kotlinChunker.language, "kotlin");
  });

  it("fileExtensions includes .kt and .kts", () => {
    assert.ok(kotlinChunker.fileExtensions.includes(".kt"));
    assert.ok(kotlinChunker.fileExtensions.includes(".kts"));
    assert.equal(kotlinChunker.fileExtensions.length, 2);
  });

  it("nodeTypes contains function_declaration, class_declaration, interface_declaration, object_declaration, property_declaration", () => {
    assert.ok(kotlinChunker.nodeTypes.has("function_declaration"));
    assert.ok(kotlinChunker.nodeTypes.has("class_declaration"));
    assert.ok(kotlinChunker.nodeTypes.has("interface_declaration"));
    assert.ok(kotlinChunker.nodeTypes.has("object_declaration"));
    assert.ok(kotlinChunker.nodeTypes.has("property_declaration"));
  });

  it("chunk returns empty for empty content", async () => {
    const chunks = await kotlinChunker.chunk("test.kt", "");
    assert.deepStrictEqual(chunks, []);
  });

  it("chunk parses a function definition", async () => {
    const code = "fun greet(name: String): String {\n    return \"Hello $name\"\n}";
    const chunks = await kotlinChunker.chunk("test.kt", code);
    assert.equal(chunks.length, 1);
    assert.ok(chunks[0]!.content.includes("fun greet"));
  });

  it("chunk parses a class definition", async () => {
    const code = "class Point(val x: Double, val y: Double)";
    const chunks = await kotlinChunker.chunk("test.kt", code);
    assert.equal(chunks.length, 1);
    assert.ok(chunks[0]!.content.includes("class Point"));
  });

  it("chunk generates unique IDs", async () => {
    const code = "fun a() {}\nfun b() {}\nfun c() {}";
    const chunks = await kotlinChunker.chunk("test.kt", code);
    assert.equal(new Set(chunks.map((c) => c.id)).size, chunks.length);
  });
});
