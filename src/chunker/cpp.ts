import { TreeSitterChunker } from "./base.js";

export class CppChunker extends TreeSitterChunker {
  readonly language = "cpp";
  readonly fileExtensions = [".cpp", ".cc", ".cxx", ".hpp", ".hxx"];
  readonly grammarName = "cpp";
  readonly nodeTypes = new Set([
    "function_definition",
    "struct_specifier",
    "enum_specifier",
    "union_specifier",
  ]);
}

export const cppChunker = new CppChunker();
