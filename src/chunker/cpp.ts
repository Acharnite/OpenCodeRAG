import { TreeSitterChunker } from "./base.js";

export class CppChunker extends TreeSitterChunker {
  readonly language = "cpp";
  readonly fileExtensions = [".cpp", ".cc", ".cxx", ".hpp", ".hxx"];
  readonly grammarName = "cpp";
  readonly nodeTypes = new Set([
    "function_definition",
    "class_specifier",
    "struct_specifier",
    "enum_specifier",
    "union_specifier",
    "namespace_definition",
    "template_declaration",
  ]);
}

export const cppChunker = new CppChunker();
