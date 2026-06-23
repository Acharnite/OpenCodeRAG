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
  previousSibling: MockNode | null;
  namedChildren: MockNode[];
}

function makeNode(
  type: string,
  startIndex: number,
  endIndex: number,
  startRow: number,
  endRow: number,
  children: MockNode[] = []
): MockNode {
  const namedChildren = children.filter((c) =>
    !["def", ":", "(", ")", "{", "}", "pass", "return"].includes(c.type)
  );
  const node: MockNode = {
    type,
    startIndex,
    endIndex,
    startPosition: { row: startRow },
    endPosition: { row: endRow },
    children,
    previousSibling: null,
    namedChildren,
  };
  // Link siblings
  for (let i = 0; i < children.length; i++) {
    if (i > 0) children[i]!.previousSibling = children[i - 1]!;
  }
  return node;
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

  describe("leadingDoc extraction", () => {
    it("extracts leading single-line // comment", () => {
      const comment = makeNode("comment", 0, 20, 0, 0);
      const fn = makeNode("function_declaration", 21, 41, 1, 2);
      comment.previousSibling = null;
      fn.previousSibling = comment;
      const root = makeNode("program", 0, 41, 0, 2, [comment, fn]);
      const result = walkTree(
        root as never,
        new Set(["function_declaration"]),
        "// hello world\nfunction foo() {}"
      );
      assert.equal(result.length, 1);
      assert.equal(result[0]!.leadingDoc, "hello world");
    });

    it("extracts leading /* */ block comment", () => {
      const comment = makeNode("comment", 0, 22, 0, 0);
      const fn = makeNode("function_declaration", 23, 43, 1, 2);
      comment.previousSibling = null;
      fn.previousSibling = comment;
      const root = makeNode("program", 0, 43, 0, 2, [comment, fn]);
      const result = walkTree(
        root as never,
        new Set(["function_declaration"]),
        "/* hello */\nfunction foo() {}"
      );
      assert.equal(result.length, 1);
      assert.equal(result[0]!.leadingDoc, "hello");
    });

    it("extracts leading /** JSDoc */ block comment", () => {
      const comment = makeNode("comment", 0, 28, 0, 2, [
        makeNode("comment", 0, 28, 0, 2),
      ]);
      const fn = makeNode("function_declaration", 29, 49, 3, 4);
      comment.previousSibling = null;
      fn.previousSibling = comment;
      const root = makeNode("program", 0, 49, 0, 4, [comment, fn]);
      const result = walkTree(
        root as never,
        new Set(["function_declaration"]),
        "/**\n * JSDoc\n */\nfunction foo() {}"
      );
      assert.equal(result.length, 1);
      assert.ok(result[0]!.leadingDoc!.includes("JSDoc"));
    });

    it("extracts leading # comment (Python style)", () => {
      const comment = makeNode("comment", 0, 18, 0, 0);
      const fn = makeNode("function_definition", 19, 36, 1, 2);
      comment.previousSibling = null;
      fn.previousSibling = comment;
      const root = makeNode("module", 0, 36, 0, 2, [comment, fn]);
      const result = walkTree(
        root as never,
        new Set(["function_definition"]),
        "# helper function\ndef foo():\n    pass"
      );
      assert.equal(result.length, 1);
      assert.equal(result[0]!.leadingDoc, "helper function");
    });

    it("extracts leading -- comment (SQL style)", () => {
      const comment = makeNode("comment", 0, 18, 0, 0);
      const fn = makeNode("function_declaration", 19, 39, 1, 2);
      comment.previousSibling = null;
      fn.previousSibling = comment;
      const root = makeNode("program", 0, 39, 0, 2, [comment, fn]);
      const result = walkTree(
        root as never,
        new Set(["function_declaration"]),
        "-- helper function\nCREATE OR REPLACE"
      );
      assert.equal(result.length, 1);
      assert.equal(result[0]!.leadingDoc, "helper function");
    });

    it("extracts leading ; comment (INI style)", () => {
      const comment = makeNode("comment", 0, 18, 0, 0);
      const node = makeNode("section", 19, 30, 1, 2);
      comment.previousSibling = null;
      node.previousSibling = comment;
      const root = makeNode("program", 0, 30, 0, 2, [comment, node]);
      const result = walkTree(
        root as never,
        new Set(["section"]),
        "; server config\n[server]"
      );
      assert.equal(result.length, 1);
      assert.equal(result[0]!.leadingDoc, "server config");
    });

    it("extracts leading % comment (LaTeX style)", () => {
      const comment = makeNode("comment", 0, 20, 0, 0);
      const node = makeNode("section", 21, 40, 1, 2);
      comment.previousSibling = null;
      node.previousSibling = comment;
      const root = makeNode("program", 0, 40, 0, 2, [comment, node]);
      const result = walkTree(
        root as never,
        new Set(["section"]),
        "% This is a section\n\\section{Intro}"
      );
      assert.equal(result.length, 1);
      assert.equal(result[0]!.leadingDoc, "This is a section");
    });

    it("extracts multiple consecutive comments", () => {
      const c1 = makeNode("comment", 0, 15, 0, 0);
      const c2 = makeNode("comment", 16, 36, 1, 1);
      const fn = makeNode("function_declaration", 37, 57, 2, 3);
      c1.previousSibling = null;
      c2.previousSibling = c1;
      fn.previousSibling = c2;
      const root = makeNode("program", 0, 57, 0, 3, [c1, c2, fn]);
      const result = walkTree(
        root as never,
        new Set(["function_declaration"]),
        "// copyright\n// description\nfunction foo() {}"
      );
      assert.equal(result.length, 1);
      assert.ok(result[0]!.leadingDoc!.includes("copyright"));
      assert.ok(result[0]!.leadingDoc!.includes("description"));
    });

    it("does not extract unrelated comments (not directly preceding)", () => {
      const otherFn = makeNode("function_declaration", 0, 20, 0, 1);
      const comment = makeNode("comment", 21, 40, 2, 2);
      const fn = makeNode("function_declaration", 41, 61, 3, 4);
      otherFn.previousSibling = null;
      comment.previousSibling = otherFn;
      fn.previousSibling = comment;
      const root = makeNode("program", 0, 61, 0, 4, [otherFn, comment, fn]);
      const result = walkTree(
        root as never,
        new Set(["function_declaration"]),
        "function bar() {}\n// for foo\nfunction foo() {}"
      );
      assert.equal(result.length, 2);
      const foo = result.find((n) => n.text.includes("foo"));
      assert.ok(foo);
      assert.equal(foo.leadingDoc, "for foo");
      const bar = result.find((n) => n.text.includes("bar"));
      assert.ok(bar);
      assert.equal(bar.leadingDoc, undefined);
    });

    it("extracts leading HTML/XML comment", () => {
      const comment = makeNode("Comment", 0, 26, 0, 0);
      const node = makeNode("element", 27, 50, 1, 2);
      comment.previousSibling = null;
      node.previousSibling = comment;
      const root = makeNode("document", 0, 50, 0, 2, [comment, node]);
      const result = walkTree(
        root as never,
        new Set(["element"]),
        "<!-- main content -->\n<div>hello</div>"
      );
      assert.equal(result.length, 1);
      assert.equal(result[0]!.leadingDoc, "main content");
    });

    it("extracts Kotlin line_comment", () => {
      const comment = makeNode("line_comment", 0, 18, 0, 0);
      const fn = makeNode("function_declaration", 19, 39, 1, 2);
      comment.previousSibling = null;
      fn.previousSibling = comment;
      const root = makeNode("program", 0, 39, 0, 2, [comment, fn]);
      const result = walkTree(
        root as never,
        new Set(["function_declaration"]),
        "// helper function\nfun foo() {}"
      );
      assert.equal(result.length, 1);
      assert.equal(result[0]!.leadingDoc, "helper function");
    });

    it("extracts Swift multiline_comment", () => {
      const comment = makeNode("multiline_comment", 0, 22, 0, 0);
      const fn = makeNode("function_declaration", 23, 43, 1, 2);
      comment.previousSibling = null;
      fn.previousSibling = comment;
      const root = makeNode("program", 0, 43, 0, 2, [comment, fn]);
      const result = walkTree(
        root as never,
        new Set(["function_declaration"]),
        "/* helper */\nfunc foo() {}"
      );
      assert.equal(result.length, 1);
      assert.equal(result[0]!.leadingDoc, "helper");
    });

    it("extracts SQL marginalia (block comment)", () => {
      const comment = makeNode("marginalia", 0, 22, 0, 0);
      const fn = makeNode("function_declaration", 23, 43, 1, 2);
      comment.previousSibling = null;
      fn.previousSibling = comment;
      const root = makeNode("program", 0, 43, 0, 2, [comment, fn]);
      const result = walkTree(
        root as never,
        new Set(["function_declaration"]),
        "/* helper */\nCREATE OR REPLACE"
      );
      assert.equal(result.length, 1);
      assert.equal(result[0]!.leadingDoc, "helper");
    });

    it("returns undefined when no preceding comment exists", () => {
      const fn = makeNode("function_declaration", 0, 20, 1, 2);
      fn.previousSibling = null;
      const root = makeNode("program", 0, 20, 0, 2, [fn]);
      const result = walkTree(
        root as never,
        new Set(["function_declaration"]),
        "function foo() {}"
      );
      assert.equal(result.length, 1);
      assert.equal(result[0]!.leadingDoc, undefined);
    });

    it("extracts Python docstring from function body", () => {
      const docString = makeNode("string", 19, 42, 0, 0);
      const expr = makeNode("expression_statement", 19, 42, 0, 0, [docString]);
      const block = makeNode("block", 14, 56, 0, 2, [expr]);
      const name = makeNode("identifier", 4, 7, 0, 0);
      const params = makeNode("parameters", 7, 9, 0, 0);
      const fn = makeNode("function_definition", 0, 56, 0, 2, [name, params, block]);
      fn.previousSibling = null;
      const root = makeNode("module", 0, 56, 0, 2, [fn]);
      const result = walkTree(
        root as never,
        new Set(["function_definition"]),
        'def foo():\n  """Does something."""\n  pass'
      );
      assert.equal(result.length, 1);
      assert.equal(result[0]!.leadingDoc, "Does something.");
    });

    it("extracts Python class docstring from class body", () => {
      const docString = makeNode("string", 14, 39, 0, 0);
      const expr = makeNode("expression_statement", 14, 39, 0, 0, [docString]);
      const block = makeNode("block", 13, 55, 0, 2, [expr]);
      const name = makeNode("identifier", 6, 9, 0, 0);
      const cls = makeNode("class_definition", 0, 55, 0, 2, [name, block]);
      cls.previousSibling = null;
      const root = makeNode("module", 0, 55, 0, 2, [cls]);
      const result = walkTree(
        root as never,
        new Set(["class_definition"]),
        'class Foo:\n  """A class."""\n  pass'
      );
      assert.equal(result.length, 1);
      assert.ok(result[0]!.leadingDoc!.includes("A class."));
    });

    it("extracts leading Python docstring (module-level expression_statement)", () => {
      const docString = makeNode("string", 0, 25, 0, 0);
      const expr = makeNode("expression_statement", 0, 25, 0, 0, [docString]);
      const fn = makeNode("function_definition", 26, 45, 1, 2);
      expr.previousSibling = null;
      fn.previousSibling = expr;
      const root = makeNode("module", 0, 45, 0, 2, [expr, fn]);
      const result = walkTree(
        root as never,
        new Set(["function_definition"]),
        '"""Module docstring."""\ndef foo():\n  pass'
      );
      assert.equal(result.length, 1);
      assert.equal(result[0]!.leadingDoc, "Module docstring.");
    });

    it("extracts Rust triple-slash doc comment", () => {
      const comment = makeNode("comment", 0, 23, 0, 0);
      const fn = makeNode("function_item", 24, 44, 1, 2);
      comment.previousSibling = null;
      fn.previousSibling = comment;
      const root = makeNode("source_file", 0, 44, 0, 2, [comment, fn]);
      const result = walkTree(
        root as never,
        new Set(["function_item"]),
        "/// Does something\nfn foo() {}"
      );
      assert.equal(result.length, 1);
      assert.equal(result[0]!.leadingDoc, "Does something");
    });
  });
});
