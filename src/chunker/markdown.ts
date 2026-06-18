import { TreeSitterChunker } from "./base.js";

export class MarkdownChunker extends TreeSitterChunker {
  readonly language = "markdown";
  readonly fileExtensions = [".md", ".mdx"];
  readonly grammarName = "markdown";
  readonly nodeTypes = new Set(["section"]);
}

export const markdownChunker = new MarkdownChunker();
