import { TreeSitterChunker } from "./base.js";

export class RustChunker extends TreeSitterChunker {
  readonly language = "rust";
  readonly fileExtensions = [".rs"];
  readonly grammarName = "rust";
  readonly nodeTypes = new Set([
    "function_item",
    "struct_item",
    "enum_item",
    "trait_item",
    "impl_item",
    "mod_item",
    "type_item",
  ]);
}

export const rustChunker = new RustChunker();
