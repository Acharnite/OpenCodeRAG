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

  it("nodeTypes contains function_declaration, class_declaration, struct_declaration, enum_declaration, protocol_declaration, extension_declaration, variable_declaration", () => {
    assert.ok(swiftChunker.nodeTypes.has("function_declaration"));
    assert.ok(swiftChunker.nodeTypes.has("class_declaration"));
    assert.ok(swiftChunker.nodeTypes.has("struct_declaration"));
    assert.ok(swiftChunker.nodeTypes.has("enum_declaration"));
    assert.ok(swiftChunker.nodeTypes.has("protocol_declaration"));
    assert.ok(swiftChunker.nodeTypes.has("extension_declaration"));
    assert.ok(swiftChunker.nodeTypes.has("variable_declaration"));
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

  it("chunk parses a class definition", async () => {
    const code = "class Point {\n    var x: Double\n    var y: Double\n}";
    const chunks = await swiftChunker.chunk("test.swift", code);
    assert.equal(chunks.length, 1);
    assert.ok(chunks[0]!.content.includes("class Point"));
  });

  it("chunk parses a struct definition", async () => {
    const code = "struct User {\n    let id: Int\n}";
    const chunks = await swiftChunker.chunk("test.swift", code);
    assert.equal(chunks.length, 1);
    assert.ok(chunks[0]!.content.includes("struct User"));
  });

  it("chunk generates unique IDs", async () => {
    const code = "func a() {}\nfunc b() {}\nfunc c() {}";
    const chunks = await swiftChunker.chunk("test.swift", code);
    assert.equal(new Set(chunks.map((c) => c.id)).size, chunks.length);
  });
});
