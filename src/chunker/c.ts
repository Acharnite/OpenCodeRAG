import { TreeSitterChunker } from "./base.js";

export class CChunker extends TreeSitterChunker {
  readonly language = "c";
  readonly fileExtensions = [".c", ".h"];
  readonly grammarName = "c";
  readonly nodeTypes = new Set([
    "function_definition",
    "struct_specifier",
    "enum_specifier",
    "union_specifier",
    "type_definition",
    "preproc_def",
  ]);
}

export const cChunker = new CChunker();
