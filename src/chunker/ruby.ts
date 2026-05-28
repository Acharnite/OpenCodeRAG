import { TreeSitterChunker } from "./base.js";

export class RubyChunker extends TreeSitterChunker {
  readonly language = "ruby";
  readonly fileExtensions = [".rb"];
  readonly grammarName = "ruby";
  readonly nodeTypes = new Set([
    "method",
    "class",
    "module",
    "singleton_method",
  ]);
}

export const rubyChunker = new RubyChunker();
