import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rubyChunker } from "../../chunker/ruby.js";

describe("RubyChunker", () => {
  it("language is 'ruby'", () => {
    assert.equal(rubyChunker.language, "ruby");
  });

  it("fileExtensions includes .rb", () => {
    assert.ok(rubyChunker.fileExtensions.includes(".rb"));
    assert.equal(rubyChunker.fileExtensions.length, 1);
  });

  it("nodeTypes contains method, singleton_method", () => {
    assert.ok(rubyChunker.nodeTypes.has("method"));
    assert.ok(rubyChunker.nodeTypes.has("singleton_method"));
    assert.ok(!rubyChunker.nodeTypes.has("class"), "class removed for function-level chunking");
    assert.ok(!rubyChunker.nodeTypes.has("module"), "module removed for function-level chunking");
  });

  it("chunk returns empty for empty content", async () => {
    const chunks = await rubyChunker.chunk("test.rb", "");
    assert.deepStrictEqual(chunks, []);
  });

  it("chunk parses a method definition", async () => {
    const code = "def greet(name)\n  \"Hello #{name}\"\nend";
    const chunks = await rubyChunker.chunk("test.rb", code);
    assert.equal(chunks.length, 1);
    assert.ok(chunks[0]!.content.includes("def greet"));
  });

  it("chunk extracts methods from class definition", async () => {
    const code = "class Point\n  def x\n    @x\n  end\n  def y\n    @y\n  end\nend";
    const chunks = await rubyChunker.chunk("test.rb", code);
    assert.ok(chunks.length >= 2, "expected at least two chunks (one per method)");
    assert.ok(chunks.some((c) => c.content.includes("def x")), "should have x method chunk");
    assert.ok(chunks.some((c) => c.content.includes("def y")), "should have y method chunk");
    assert.ok(!chunks.some((c) => c.content.includes("class Point")), "should not have class-level chunk");
  });

  it("chunk generates unique IDs", async () => {
    const code = "def a; end\ndef b; end\ndef c; end";
    const chunks = await rubyChunker.chunk("test.rb", code);
    assert.equal(new Set(chunks.map((c) => c.id)).size, chunks.length);
  });
});
