import { TreeSitterChunker } from "./base.js";

export class JavaScriptChunker extends TreeSitterChunker {
  readonly language = "javascript";
  readonly fileExtensions = [".js", ".jsx", ".mjs", ".cjs"];
  readonly grammarName = "javascript";
  readonly nodeTypes = new Set([
    "function_declaration",
    "method_definition",
    "class_declaration",
    "arrow_function",
    "export_statement",
  ]);
}

export const javascriptChunker = new JavaScriptChunker();
