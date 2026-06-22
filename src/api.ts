import { resolveRagContext, type BootstrapOptions } from "./core/bootstrap.js";
import { retrieve } from "./retriever/retriever.js";
import type { RetrieveOptions } from "./retriever/retriever.js";
import { runIndexPass, getIndexStatusSummary, scanWorkspace, type IndexRunStats, type WorkspaceFile } from "./indexer.js";
import type { SearchResult } from "./core/interfaces.js";

export interface SearchOptions {
  cwd?: string;
  configPath?: string;
  topK?: number;
  minScore?: number;
  keywordWeight?: number;
  pathHints?: string[];
  languageHints?: string[];
  explain?: boolean;
}

export interface IndexOptions {
  configPath?: string;
  force?: boolean;
  onProgress?: (message: string) => void;
}

export interface ContextResult {
  chunks: SearchResult[];
  text: string;
}

function formatContextResults(results: SearchResult[]): string {
  if (results.length === 0) return "No matching chunks found.";

  const lines: string[] = [];
  for (const r of results) {
    const { filePath, startLine, endLine, language } = r.chunk.metadata;
    lines.push(`#### ${filePath}:${startLine}-${endLine} (score: ${r.score.toFixed(3)})`);
    lines.push("```" + language);
    lines.push(r.chunk.content);
    lines.push("```");
    if (r.chunk.description) {
      lines.push(`> ${r.chunk.description}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export async function search(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const ctx = await resolveRagContext({
    cwd: options.cwd,
    configPath: options.configPath,
  });

  return retrieve(query, ctx.embedder, ctx.store, {
    topK: options.topK ?? ctx.config.retrieval.topK,
    minScore: options.minScore ?? ctx.config.retrieval.minScore,
    keywordIndex: ctx.keywordIndex,
    keywordWeight: options.keywordWeight ?? ctx.config.retrieval.hybridSearch?.keywordWeight ?? 0.4,
    queryPrefix: ctx.config.embedding.queryPrefix,
    explain: options.explain,
  } satisfies RetrieveOptions);
}

export async function indexWorkspace(
  cwd?: string,
  options: IndexOptions = {}
): Promise<IndexRunStats> {
  const workDir = cwd ?? process.cwd();
  const ctx = await resolveRagContext({
    cwd: workDir,
    configPath: options.configPath,
  });

  if (options.onProgress) {
    options.onProgress(`Indexing ${workDir}...`);
  }

  const stats = await runIndexPass({
    cwd: workDir,
    storePath: ctx.storePath,
    config: ctx.config,
    store: ctx.store,
    embedder: ctx.embedder,
    force: options.force ?? false,
    keywordIndex: ctx.keywordIndex,
    descriptionProvider: ctx.descriptionProvider,
  });

  return stats;
}

export async function getContext(
  query: string,
  options: SearchOptions = {}
): Promise<ContextResult> {
  const results = await search(query, options);
  return {
    chunks: results,
    text: formatContextResults(results),
  };
}

export { validateConfig } from "./core/config.js";
export type { ConfigValidationResult } from "./core/config.js";
export { scanWorkspace, getIndexStatusSummary } from "./indexer.js";
export type { WorkspaceFile, IndexRunStats } from "./indexer.js";
