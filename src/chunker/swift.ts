import { TreeSitterChunker } from "./base.js";

export class SwiftChunker extends TreeSitterChunker {
  readonly language = "swift";
  readonly fileExtensions = [".swift"];
  readonly grammarName = "swift";
  readonly nodeTypes = new Set([
    "function_declaration",
    "enum_declaration",
    "protocol_declaration",
    "variable_declaration",
  ]);
}

export const swiftChunker = new SwiftChunker();
