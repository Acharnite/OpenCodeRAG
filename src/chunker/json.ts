import { TreeSitterChunker } from "./base.js";

export class JsonChunker extends TreeSitterChunker {
  readonly language = "json";
  readonly fileExtensions = [".json"];
  readonly grammarName = "json";
  readonly nodeTypes = new Set([
    "pair",
  ]);
}

export const jsonChunker = new JsonChunker();
