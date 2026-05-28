import { TreeSitterChunker } from "./base.js";

export class TypeScriptChunker extends TreeSitterChunker {
  readonly language = "typescript";
  readonly fileExtensions = [".ts", ".tsx"];
  readonly grammarName = "typescript";
  readonly nodeTypes = new Set([
    "function_declaration",
    "method_definition",
    "class_declaration",
    "arrow_function",
    "interface_declaration",
    "type_alias_declaration",
    "export_statement",
  ]);
}

export const typescriptChunker = new TypeScriptChunker();
