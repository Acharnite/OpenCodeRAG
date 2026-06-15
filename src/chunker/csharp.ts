import { TreeSitterChunker } from "./base.js";

export class CSharpChunker extends TreeSitterChunker {
  readonly language = "csharp";
  readonly fileExtensions = [".cs"];
  readonly grammarName = "c_sharp";
  readonly nodeTypes = new Set([
    "method_declaration",
    "interface_declaration",
    "struct_declaration",
    "record_declaration",
    "enum_declaration",
  ]);
}

export const csharpChunker = new CSharpChunker();
