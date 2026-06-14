import { TreeSitterChunker } from "./base.js";

export class GoChunker extends TreeSitterChunker {
  readonly language = "go";
  readonly fileExtensions = [".go"];
  readonly grammarName = "go";
  readonly nodeTypes = new Set([
    "function_declaration",
    "method_declaration",
  ]);
}

export const goChunker = new GoChunker();
