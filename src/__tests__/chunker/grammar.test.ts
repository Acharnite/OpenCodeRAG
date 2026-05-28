import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { walkTree, type AstNode } from "../../chunker/grammar.js";

interface MockNode {
  type: string;
  startIndex: number;
  endIndex: number;
  startPosition: { row: number };
  endPosition: { row: number };
  children: MockNode[];
}

function makeNode(
  type: string,
  startIndex: number,
  endIndex: number,
  startRow: number,
  endRow: number,
  children: MockNode[] = []
): MockNode {
  return {
    type,
    startIndex,
    endIndex,
    startPosition: { row: startRow },
    endPosition: { row: endRow },
    children,
  };
}

describe("walkTree", () => {
  it("returns empty array for leaf node", () => {
    const node = makeNode("identifier", 0, 5, 0, 0);
    const result = walkTree(node as never, new Set(["function"]), "hello");
    assert.deepStrictEqual(result, []);
  });

  it("does not match at depth 0 (root node type is ignored)", () => {
    const node = makeNode("function_declaration", 0, 20, 0, 2, [
      makeNode("identifier", 5, 10, 0, 0),
    ]);
    const result = walkTree(
      node as never,
      new Set(["function_declaration"]),
      "function hello() {}"
    );
    // Root node type matches but depth=0 → not collected
    assert.deepStrictEqual(result, []);
  });

  it("matches node at depth 1 when type is in nodeTypes", () => {
    const child = makeNode("function_declaration", 0, 20, 1, 3);
    const root = makeNode("program", 0, 20, 0, 3, [child]);
    const result = walkTree(
      root as never,
      new Set(["function_declaration"]),
      "function hello() {}"
    );
    assert.equal(result.length, 1);
    assert.equal(result[0]!.type, "function_declaration");
  });

  it("recurses into children to find matching node", () => {
    const grandchild = makeNode("function_declaration", 0, 20, 2, 5);
    const child = makeNode("block", 0, 20, 1, 5, [grandchild]);
    const root = makeNode("program", 0, 20, 0, 5, [child]);
    const result = walkTree(
      root as never,
      new Set(["function_declaration"]),
      "function hello() {}"
    );
    assert.equal(result.length, 1);
    assert.equal(result[0]!.type, "function_declaration");
  });

  it("respects maxDepth parameter", () => {
    const deep = makeNode("function_declaration", 0, 20, 3, 5);
    const mid = makeNode("block", 0, 20, 2, 5, [deep]);
    const child = makeNode("class", 0, 20, 1, 5, [mid]);
    const root = makeNode("program", 0, 20, 0, 5, [child]);

    // Default maxDepth=10: searches depths 0–10 → reaches depth 3
    const result = walkTree(
      root as never,
      new Set(["function_declaration"]),
      "content"
    );
    assert.equal(result.length, 1);

    // maxDepth=2: searches depths 0–2 → won't reach depth 3
    const resultShallow = walkTree(
      root as never,
      new Set(["function_declaration"]),
      "content",
      2
    );
    assert.deepStrictEqual(resultShallow, []);
  });

  it("finds multiple matching nodes at same depth", () => {
    const fn1 = makeNode("function_declaration", 0, 10, 1, 1);
    const fn2 = makeNode("function_declaration", 11, 21, 2, 2);
    const root = makeNode("program", 0, 21, 0, 2, [fn1, fn2]);
    const result = walkTree(
      root as never,
      new Set(["function_declaration"]),
      "fn1() {} fn2() {}"
    );
    assert.equal(result.length, 2);
  });

  it("extracts correct text from source using startIndex/endIndex", () => {
    const source = "function hello() { return 'world'; }";
    const child = makeNode("function_declaration", 0, source.length, 1, 1);
    const root = makeNode("program", 0, source.length, 0, 1, [child]);
    const result = walkTree(
      root as never,
      new Set(["function_declaration"]),
      source
    );
    assert.equal(result.length, 1);
    assert.equal(result[0]!.text, source);
  });

  it("sets correct 1-indexed line numbers from row positions", () => {
    const child = makeNode("function_declaration", 10, 50, 5, 8);
    const root = makeNode("program", 0, 60, 0, 10, [child]);
    const result = walkTree(
      root as never,
      new Set(["function_declaration"]),
      "some\ncontent\nhere\nmore\nstuff\nfunction foo() {\n  return 1;\n}\n"
    );
    assert.equal(result.length, 1);
    assert.equal(result[0]!.startLine, 6); // row 5 + 1
    assert.equal(result[0]!.endLine, 9); // row 8 + 1
  });

  it("returns empty array when no node types match within maxDepth", () => {
    const child = makeNode("variable_declaration", 0, 10, 1, 1);
    const root = makeNode("program", 0, 10, 0, 1, [child]);
    const result = walkTree(
      root as never,
      new Set(["function_declaration", "class_declaration"]),
      "let x = 1;"
    );
    assert.deepStrictEqual(result, []);
  });

  it("empty nodeTypes set returns nothing", () => {
    const child = makeNode("function_declaration", 0, 10, 1, 1);
    const root = makeNode("program", 0, 10, 0, 1, [child]);
    const result = walkTree(root as never, new Set(), "function foo() {}");
    assert.deepStrictEqual(result, []);
  });

  it("stops recursing once a matching node is found (no grandchildren)", () => {
    const grandchild = makeNode("method_definition", 5, 15, 3, 4);
    const classNode = makeNode("class_declaration", 0, 20, 1, 5, [grandchild]);
    const root = makeNode("program", 0, 20, 0, 5, [classNode]);
    // class_declaration matches at depth 1 → stops, never reaches grandchild
    const result = walkTree(
      root as never,
      new Set(["class_declaration", "method_definition"]),
      "class A { foo() {} }"
    );
    assert.equal(result.length, 1);
    assert.equal(result[0]!.type, "class_declaration");
  });

  it("preserves correct startIndex and endIndex in result", () => {
    const child = makeNode("function_declaration", 5, 15, 1, 2);
    const root = makeNode("program", 0, 20, 0, 3, [child]);
    const result = walkTree(
      root as never,
      new Set(["function_declaration"]),
      "01234function foo()0123456789"
    );
    assert.equal(result.length, 1);
    assert.equal(result[0]!.startIndex, 5);
    assert.equal(result[0]!.endIndex, 15);
  });
});
