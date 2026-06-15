import { Parser } from "web-tree-sitter";
import { loadLanguage, walkTree, type AstNode } from "./grammar.js";
import type { Chunker, Chunk } from "../core/interfaces.js";
import { uuid } from "./uuid.js";

export abstract class TreeSitterChunker implements Chunker {
  abstract readonly language: string;
  abstract readonly fileExtensions: string[];
  abstract readonly grammarName: string;
  abstract readonly nodeTypes: Set<string>;

  private parser: Parser | null = null;

  withNodeTypes(types: Set<string>): Chunker {
    const original = this;
    return {
      get language() { return original.language; },
      get fileExtensions() { return original.fileExtensions; },
      async chunk(filePath: string, content: string): Promise<Chunk[]> {
        if (content.trim().length === 0) return [];
        const parser = await original.getParser();
        const tree = parser.parse(content);
        if (!tree) return [];
        const nodes = walkTree(tree.rootNode, types, content);
        return nodes.map((node: AstNode) => ({
          id: uuid(),
          content: node.text,
          metadata: {
            filePath,
            startLine: node.startLine,
            endLine: node.endLine,
            language: original.language,
          },
        }));
      },
    };
  }

  private async getParser(): Promise<Parser> {
    if (!this.parser) {
      const lang = await loadLanguage(this.grammarName);
      this.parser = new Parser();
      this.parser.setLanguage(lang);
    }
    return this.parser;
  }

  async chunk(filePath: string, content: string): Promise<Chunk[]> {
    if (content.trim().length === 0) return [];

    const parser = await this.getParser();
    const tree = parser.parse(content);
    if (!tree) return [];

    const nodes = walkTree(tree.rootNode, this.nodeTypes, content);

    return nodes.map((node: AstNode) => ({
      id: uuid(),
      content: node.text,
      metadata: {
        filePath,
        startLine: node.startLine,
        endLine: node.endLine,
        language: this.language,
      },
    }));
  }
}
