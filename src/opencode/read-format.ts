import type { SearchResult } from "../core/interfaces.js";

/**
 * Options for formatting read tool output.
 */
export interface FormatReadOutputOptions {
  /** The requested file path (display-friendly). */
  filePath: string;
  /** The retrieval query used. */
  retrievalQuery: string;
  /** Search results to format. */
  results: SearchResult[];
  /** Maximum results to include. */
  maxChunks: number;
  /** Maximum output character count. */
  maxChars: number;
}

/**
 * Format RAG retrieval results for the read tool output.
 *
 * The output:
 *   - Clearly states full-file reading was suppressed.
 *   - Includes request metadata (file path, query, chunk count).
 *   - Formats each chunk with file path, line range, score, and code block.
 *   - Enforces maxChars limit and appends truncation notice.
 *
 * Returns a string ready to return as the tool output.
 */
export function formatReadOutput(options: FormatReadOutputOptions): string {
  const { filePath, retrievalQuery, results, maxChunks, maxChars } = options;

  const header = buildHeader(filePath, retrievalQuery, results.length, maxChunks);
  let output = header;

  const limited = results.slice(0, maxChunks);

  for (let i = 0; i < limited.length; i++) {
    const r = limited[i];
    if (!r) continue;
    const chunkPart = formatChunk(i + 1, r);

    // Check if adding this chunk would exceed the limit
    if ((output + "\n" + chunkPart).length > maxChars) {
      // If we already have some content, append truncation notice
      const truncationNotice =
        "\n\n---\nOutput truncated by OpenCodeRAG to stay within maxReadOutputChars.\nUse a more specific query or line range to retrieve narrower context.";
      if ((output + truncationNotice).length <= maxChars) {
        output += truncationNotice;
      }
      break;
    }

    if (i > 0) {
      output += "\n";
    }
    output += chunkPart;
  }

  return output;
}

function buildHeader(
  filePath: string,
  retrievalQuery: string,
  totalResults: number,
  maxChunks: number
): string {
  const parts: string[] = [
    "OpenCodeRAG read override active.",
    "Full file read suppressed. Returning relevant indexed chunks instead.",
    "",
    "Requested file:",
    `- ${filePath}`,
    "",
    "Retrieval query:",
    `- ${retrievalQuery.split("\n")[0]}` +
      (retrievalQuery.includes("\n") ? "..." : ""),
    "",
    `Returned chunks:`,
    `- ${Math.min(totalResults, maxChunks)} of max ${maxChunks}`,
    "",
  ];
  return parts.join("\n");
}

function formatChunk(index: number, result: SearchResult): string {
  const { chunk, score } = result;
  const metadata = chunk.metadata;
  const language = metadata.language || "";
  const lines: string[] = [];

  lines.push(`## Chunk ${index}`);
  lines.push(`File: ${metadata.filePath}`);
  lines.push(`Lines: ${metadata.startLine}-${metadata.endLine}`);
  lines.push(`Score: ${score.toFixed(4)}`);
  lines.push("");
  lines.push("```" + language);
  lines.push(chunk.content);
  if (!chunk.content.endsWith("\n")) {
    // Ensure code block closes on its own line
  }
  lines.push("```");

  return lines.join("\n");
}

/** A related file entry with path and score. */
export interface RelatedFileEntry {
  filePath: string;
  score: number;
}

/**
 * Options for formatting a direct file fallback.
 */
export interface FormatFileFallbackOptions {
  /** Absolute file path. */
  filePath: string;
  /** Raw file content (full file). */
  content: string;
  /** Optional start line (1-indexed). */
  startLine?: number;
  /** Optional end line (1-indexed). */
  endLine?: number;
  /** Reason why fallback was used. */
  reason: string;
  /** Maximum output character count. */
  maxChars?: number;
}

/**
 * Format raw file contents as a fallback when no RAG chunks are available.
 *
 * Applies optional line-range slicing and enforces maxChars limit.
 */
export function formatFileFallback(options: FormatFileFallbackOptions): string {
  const { filePath, content, startLine, endLine, reason, maxChars } = options;

  const lines = content.split("\n");
  const sliceStart = startLine !== undefined ? startLine - 1 : 0;
  const sliceEnd = endLine !== undefined ? endLine : lines.length;
  const sliced = lines.slice(sliceStart, sliceEnd);

  const header = [
    "OpenCodeRAG read override active.",
    `No indexed chunks available — returning direct file contents. (${reason})`,
    "",
    "Requested file:",
    `- ${filePath}`,
    startLine !== undefined || endLine !== undefined
      ? `Line range: ${startLine ?? 1}-${endLine ?? lines.length}`
      : `Lines: 1-${lines.length}`,
    "",
  ].join("\n");

  const lang = guessLanguage(filePath);
  const codeBlock = "```" + lang + "\n" + sliced.join("\n") + "\n```";
  let output = header + codeBlock;

  if (maxChars && output.length > maxChars) {
    output = output.slice(0, maxChars) + "\n\n---\nOutput truncated.";
  }

  return output;
}

function guessLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    py: "python", rb: "ruby", go: "go", rs: "rust", java: "java",
    kt: "kotlin", swift: "swift", c: "c", cpp: "cpp", h: "c", hpp: "cpp",
    cs: "csharp", php: "php", sh: "bash", bash: "bash", zsh: "bash",
    md: "markdown", json: "json", yaml: "yaml", yml: "yaml", xml: "xml",
    html: "html", css: "css", scss: "scss", sql: "sql", toml: "toml",
  };
  return map[ext] ?? "";
}

/**
 * Format a list of related files as a lightweight suggestion section.
 *
 * Only includes file paths and scores — no code content — to keep tokens low.
 * Format: "Please consider reading other relevant files:\n1. ./path (Score: 0.92)\n..."
 */
export function formatRelatedFiles(entries: RelatedFileEntry[]): string {
  if (entries.length === 0) return "";

  const lines = entries.map(
    (entry, i) => `${i + 1}. ${entry.filePath} (Score: ${entry.score.toFixed(2)})`
  );

  return `Please consider reading other relevant files:\n${lines.join("\n")}`;
}
