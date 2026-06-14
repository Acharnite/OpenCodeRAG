import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rustChunker } from "../../chunker/rust.js";

describe("RustChunker", () => {
  it("language is 'rust'", () => {
    assert.equal(rustChunker.language, "rust");
  });

  it("fileExtensions includes .rs", () => {
    assert.ok(rustChunker.fileExtensions.includes(".rs"));
    assert.equal(rustChunker.fileExtensions.length, 1);
  });

  it("nodeTypes contains function_item, struct_item, enum_item, type_item", () => {
    assert.ok(rustChunker.nodeTypes.has("function_item"));
    assert.ok(rustChunker.nodeTypes.has("struct_item"));
    assert.ok(rustChunker.nodeTypes.has("enum_item"));
    assert.ok(rustChunker.nodeTypes.has("type_item"));
    assert.ok(!rustChunker.nodeTypes.has("trait_item"), "trait_item removed for function-level chunking");
    assert.ok(!rustChunker.nodeTypes.has("impl_item"), "impl_item removed for function-level chunking");
    assert.ok(!rustChunker.nodeTypes.has("mod_item"), "mod_item removed for function-level chunking");
  });

  it("chunk returns empty for empty content", async () => {
    const chunks = await rustChunker.chunk("test.rs", "");
    assert.deepStrictEqual(chunks, []);
  });

  it("chunk parses a function definition", async () => {
    const code = "fn greet(name: &str) -> String {\n    format!(\"Hello {}\", name)\n}";
    const chunks = await rustChunker.chunk("test.rs", code);
    assert.equal(chunks.length, 1);
    assert.ok(chunks[0]!.content.includes("fn greet"));
  });

  it("chunk parses a struct definition", async () => {
    const code = "struct Point {\n    x: f64,\n    y: f64,\n}";
    const chunks = await rustChunker.chunk("test.rs", code);
    assert.equal(chunks.length, 1);
    assert.ok(chunks[0]!.content.includes("struct Point"));
  });

  it("chunk generates unique IDs", async () => {
    const code = "fn a() {}\nfn b() {}\nfn c() {}";
    const chunks = await rustChunker.chunk("test.rs", code);
    assert.equal(new Set(chunks.map((c) => c.id)).size, chunks.length);
  });
});
