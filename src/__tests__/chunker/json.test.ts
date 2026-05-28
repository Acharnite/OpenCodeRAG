import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { jsonChunker } from "../../chunker/json.js";

describe("JsonChunker", () => {
  it("language is 'json'", () => {
    assert.equal(jsonChunker.language, "json");
  });

  it("fileExtensions includes .json", () => {
    assert.ok(jsonChunker.fileExtensions.includes(".json"));
    assert.equal(jsonChunker.fileExtensions.length, 1);
  });

  it("grammarName is 'json'", () => {
    assert.equal(jsonChunker.grammarName, "json");
  });

  it("nodeTypes contains pair", () => {
    assert.ok(jsonChunker.nodeTypes.has("pair"));
  });

  it("chunk returns empty array for empty content", async () => {
    const chunks = await jsonChunker.chunk("test.json", "");
    assert.deepStrictEqual(chunks, []);
  });

  it("chunk returns empty array for whitespace-only content", async () => {
    const chunks = await jsonChunker.chunk("test.json", "   \n  ");
    assert.deepStrictEqual(chunks, []);
  });

  it("chunk extracts each pair from a JSON object", async () => {
    const json = JSON.stringify({ name: "test", version: "1.0", private: true }, null, 2);
    const chunks = await jsonChunker.chunk("test.json", json);
    assert.equal(chunks.length, 3);
    assert.ok(chunks[0]!.content.includes("\"name\""));
    assert.ok(chunks[1]!.content.includes("\"version\""));
    assert.ok(chunks[2]!.content.includes("\"private\""));
  });

  it("chunk handles nested objects", async () => {
    const json = JSON.stringify({ scripts: { build: "tsc", test: "jest" }, deps: {} }, null, 2);
    const chunks = await jsonChunker.chunk("test.json", json);
    assert.equal(chunks.length, 2);
    assert.ok(chunks[0]!.content.includes("\"scripts\""));
    assert.ok(chunks[1]!.content.includes("\"deps\""));
  });

  it("chunk generates unique IDs", async () => {
    const json = JSON.stringify({ a: 1, b: 2, c: 3 }, null, 2);
    const chunks = await jsonChunker.chunk("test.json", json);
    const ids = chunks.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("chunk sets correct startLine metadata", async () => {
    const json = JSON.stringify({ alpha: 1, beta: 2 }, null, 2);
    const chunks = await jsonChunker.chunk("test.json", json);
    assert.ok(chunks[0]!.metadata.startLine >= 1);
    assert.ok(chunks[1]!.metadata.startLine > chunks[0]!.metadata.startLine);
  });
});
