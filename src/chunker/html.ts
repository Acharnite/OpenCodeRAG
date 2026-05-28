import { TreeSitterChunker } from "./base.js";

export class HtmlChunker extends TreeSitterChunker {
  readonly language = "html";
  readonly fileExtensions = [".html", ".htm"];
  readonly grammarName = "html";
  readonly nodeTypes = new Set([
    "script_element",
    "style_element",
  ]);
}

export const htmlChunker = new HtmlChunker();
