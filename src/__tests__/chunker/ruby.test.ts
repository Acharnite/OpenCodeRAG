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

  it("nodeTypes contains method, class, module, singleton_method", () => {
    assert.ok(rubyChunker.nodeTypes.has("method"));
    assert.ok(rubyChunker.nodeTypes.has("class"));
    assert.ok(rubyChunker.nodeTypes.has("module"));
    assert.ok(rubyChunker.nodeTypes.has("singleton_method"));
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

  it("chunk parses a class definition", async () => {
    const code = "class Point\n  attr_accessor :x, :y\nend";
    const chunks = await rubyChunker.chunk("test.rb", code);
    assert.equal(chunks.length, 1);
    assert.ok(chunks[0]!.content.includes("class Point"));
  });

  it("chunk generates unique IDs", async () => {
    const code = "def a; end\ndef b; end\ndef c; end";
    const chunks = await rubyChunker.chunk("test.rb", code);
    assert.equal(new Set(chunks.map((c) => c.id)).size, chunks.length);
  });
});
