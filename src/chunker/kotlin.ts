import { TreeSitterChunker } from "./base.js";

export class KotlinChunker extends TreeSitterChunker {
  readonly language = "kotlin";
  readonly fileExtensions = [".kt", ".kts"];
  readonly grammarName = "kotlin";
  readonly nodeTypes = new Set([
    "function_declaration",
    "property_declaration",
  ]);
}

export const kotlinChunker = new KotlinChunker();
