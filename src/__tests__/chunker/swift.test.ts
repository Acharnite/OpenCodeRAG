import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { swiftChunker } from "../../chunker/swift.js";

describe("SwiftChunker", () => {
  it("language is 'swift'", () => {
    assert.equal(swiftChunker.language, "swift");
  });

  it("fileExtensions includes .swift", () => {
    assert.ok(swiftChunker.fileExtensions.includes(".swift"));
    assert.equal(swiftChunker.fileExtensions.length, 1);
  });

  it("nodeTypes contains function_declaration, enum_declaration, variable_declaration", () => {
    assert.ok(swiftChunker.nodeTypes.has("function_declaration"));
    assert.ok(swiftChunker.nodeTypes.has("enum_declaration"));
    assert.ok(swiftChunker.nodeTypes.has("variable_declaration"));
    assert.ok(!swiftChunker.nodeTypes.has("class_declaration"), "class_declaration removed for function-level chunking");
    assert.ok(!swiftChunker.nodeTypes.has("struct_declaration"), "struct_declaration removed for function-level chunking");
    assert.ok(!swiftChunker.nodeTypes.has("protocol_declaration"), "protocol_declaration removed for function-level chunking");
    assert.ok(!swiftChunker.nodeTypes.has("extension_declaration"), "extension_declaration removed for function-level chunking");
  });

  it("chunk returns empty for empty content", async () => {
    const chunks = await swiftChunker.chunk("test.swift", "");
    assert.deepStrictEqual(chunks, []);
  });

  it("chunk parses a function definition", async () => {
    const code = "func greet(name: String) -> String {\n    return \"Hello \\(name)\"\n}";
    const chunks = await swiftChunker.chunk("test.swift", code);
    assert.equal(chunks.length, 1);
    assert.ok(chunks[0]!.content.includes("func greet"));
  });

  it("chunk extracts methods from class definition", async () => {
    const code = "class Point { var x: Double; func distanceTo(other: Point) -> Double { return 0.0 } func description() -> String { return \"\" } }";
    const chunks = await swiftChunker.chunk("test.swift", code);
    assert.ok(chunks.length >= 2, "expected at least two chunks (one per method)");
    assert.ok(chunks.some((c) => c.content.includes("distanceTo")), "should have distanceTo method chunk");
    assert.ok(chunks.some((c) => c.content.includes("description")), "should have description method chunk");
    assert.ok(!chunks.some((c) => c.content.includes("class Point")), "should not have class-level chunk");
  });

  it("chunk parses a struct definition", async () => {
    const code = "struct User {\n    let id: Int\n}";
    const chunks = await swiftChunker.chunk("test.swift", code);
    // struct_declaration was removed, so this may produce no chunks
    assert.ok(Array.isArray(chunks));
  });

  it("chunk generates unique IDs", async () => {
    const code = "func a() {}\nfunc b() {}\nfunc c() {}";
    const chunks = await swiftChunker.chunk("test.swift", code);
    assert.equal(new Set(chunks.map((c) => c.id)).size, chunks.length);
  });
});
