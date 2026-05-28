import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { uuid } from "../../chunker/uuid.js";

describe("uuid", () => {
  it("generates a valid UUID v4 format", () => {
    const id = uuid();
    assert.match(
      id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => uuid()));
    assert.equal(ids.size, 100);
  });

  it("generates IDs as strings", () => {
    const id = uuid();
    assert.equal(typeof id, "string");
    assert.equal(id.length, 36);
  });
});
