import { TreeSitterChunker } from "./base.js";

export class JavaChunker extends TreeSitterChunker {
  readonly language = "java";
  readonly fileExtensions = [".java"];
  readonly grammarName = "java";
  readonly nodeTypes = new Set([
    "method_declaration",
  ]);
}

export const javaChunker = new JavaChunker();
