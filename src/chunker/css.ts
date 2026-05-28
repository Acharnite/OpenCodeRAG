import { TreeSitterChunker } from "./base.js";

export class CssChunker extends TreeSitterChunker {
  readonly language = "css";
  readonly fileExtensions = [".css"];
  readonly grammarName = "css";
  readonly nodeTypes = new Set([
    "rule_set",
    "at_rule",
    "media_statement",
    "keyframes_statement",
  ]);
}

export const cssChunker = new CssChunker();
