import { TreeSitterChunker } from "./base.js";

export class TypeScriptChunker extends TreeSitterChunker {
  readonly language = "typescript";
  readonly fileExtensions = [".ts", ".tsx"];
  readonly grammarName = "typescript";
  readonly nodeTypes = new Set([
    "function_declaration",
    "method_definition",
    "arrow_function",
    "interface_declaration",
    "type_alias_declaration",
  ]);
}

export const typescriptChunker = new TypeScriptChunker();
