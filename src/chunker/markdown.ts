import type { Chunker, Chunk } from "../core/interfaces.js";
import { uuid } from "./uuid.js";

const HEADING_REGEX = /^(#{1,6})\s+(.+)$/gm;

export class MarkdownChunker implements Chunker {
  readonly language = "markdown";
  readonly fileExtensions = [".md", ".mdx"];

  async chunk(filePath: string, content: string): Promise<Chunk[]> {
    if (content.trim().length === 0) return [];

    const chunks: Chunk[] = [];
    const lines = content.split("\n");
    const sections: { heading: string; level: number; startLine: number }[] = [];

    let inCodeBlock = false;
    let currentSectionStart = 1;
    let currentHeading = "";
    let currentLevel = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";

      if (line.trim().startsWith("```")) {
        inCodeBlock = !inCodeBlock;
        continue;
      }

      if (inCodeBlock) continue;

      const match = HEADING_REGEX.exec(line);
      HEADING_REGEX.lastIndex = 0;
      if (match) {
        if (currentHeading) {
          sections.push({
            heading: currentHeading,
            level: currentLevel,
            startLine: currentSectionStart,
          });
        }
        currentHeading = match[2] ?? "";
        currentLevel = match[1]?.length ?? 1;
        currentSectionStart = i + 1;

        if (currentLevel <= 2) {
          sections.push({
            heading: currentHeading,
            level: currentLevel,
            startLine: currentSectionStart,
          });
          currentHeading = "";
        }
      }
    }

    // Last section
    if (currentHeading) {
      sections.push({
        heading: currentHeading,
        level: currentLevel,
        startLine: currentSectionStart,
      });
    }

    // If no sections found, create one chunk for the whole file
    if (sections.length === 0) {
      return [
        {
          id: uuid(),
          content,
          metadata: {
            filePath,
            startLine: 1,
            endLine: lines.length,
            language: this.language,
          },
        },
      ];
    }

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i]!;
      const startLine = section.startLine;
      const endLine =
        i + 1 < sections.length
          ? sections[i + 1]!.startLine - 1
          : lines.length;

      if (startLine > endLine) continue;

      const chunkContent = lines.slice(startLine - 1, endLine).join("\n").trim();
      if (chunkContent.length === 0) continue;

      chunks.push({
        id: uuid(),
        content: chunkContent,
        metadata: {
          filePath,
          startLine,
          endLine,
          language: this.language,
        },
      });
    }

    return chunks;
  }
}

export const markdownChunker = new MarkdownChunker();
