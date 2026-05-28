import { TreeSitterChunker } from "./base.js";

export class PythonChunker extends TreeSitterChunker {
  readonly language = "python";
  readonly fileExtensions = [".py"];
  readonly grammarName = "python";
  readonly nodeTypes = new Set([
    "function_definition",
    "class_definition",
    "decorated_definition",
  ]);
}

export const pythonChunker = new PythonChunker();
