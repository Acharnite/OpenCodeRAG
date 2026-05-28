import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { razorChunker } from "../../chunker/razor.js";

describe("RazorChunker", () => {
  it("language is 'razor'", () => {
    assert.equal(razorChunker.language, "razor");
  });

  it("fileExtensions includes .razor and .cshtml", () => {
    assert.ok(razorChunker.fileExtensions.includes(".razor"));
    assert.ok(razorChunker.fileExtensions.includes(".cshtml"));
  });

  it("chunk returns empty array for empty content", async () => {
    const chunks = await razorChunker.chunk("test.razor", "");
    assert.deepStrictEqual(chunks, []);
  });

  it("returns single chunk for content without code blocks", async () => {
    const code = "<h1>Hello</h1>\n<p>Welcome</p>";
    const chunks = await razorChunker.chunk("page.razor", code);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0]!.metadata.language, "razor");
  });

  it("splits on @code block boundaries", async () => {
    const template = "<h1>Counter</h1>\n<button>Click</button>\n";
    const code = '@code {\n  private int count = 0;\n  void Inc() { count++; }\n}\n';
    const chunks = await razorChunker.chunk("counter.razor", template + code);
    assert.equal(chunks.length, 2, "expected template + code block");
    assert.ok(chunks.some((c) => c.content.includes("@code")), "expected @code block");
    assert.ok(chunks.some((c) => c.content.includes("<h1>")), "expected template chunk");
  });

  it("handles @functions blocks", async () => {
    const content = "@functions {\n  void Foo() { }\n}\n";
    const chunks = await razorChunker.chunk("fn.cshtml", content);
    assert.equal(chunks.length, 1);
    assert.ok(chunks[0]!.content.includes("@functions"));
  });

  it("handles multiple code blocks", async () => {
    const content = [
      "<h1>Title</h1>",
      "@code { int x = 1; }",
      "<p>Body</p>",
      "@code { int y = 2; }",
    ].join("\n");
    const chunks = await razorChunker.chunk("multi.razor", content);
    assert.equal(chunks.length, 4, "expected 2 templates + 2 code blocks");
  });

  it("sets correct startLine and endLine metadata", async () => {
    const content = [
      "<h1>Title</h1>",
      "<p>intro</p>",
      '@code {',
      '  void Foo() { }',
      '}',
      "<p>outro</p>",
    ].join("\n");
    const chunks = await razorChunker.chunk("lines.razor", content);
    const codeChunk = chunks.find((c) => c.content.includes("@code"));
    assert.ok(codeChunk, "expected @code chunk");
    assert.equal(codeChunk!.metadata.startLine, 3);
    assert.equal(codeChunk!.metadata.endLine, 5);
  });

  it("generates unique ids for each chunk", async () => {
    const content = [
      "<h1>Title</h1>",
      '@code { int a = 1; }',
      "<p>Body</p>",
      '@code { int b = 2; }',
    ].join("\n");
    const chunks = await razorChunker.chunk("ids.razor", content);
    const ids = new Set(chunks.map((c) => c.id));
    assert.equal(ids.size, chunks.length);
  });
});
