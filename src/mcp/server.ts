import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod/v4";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { EmbeddingProvider, VectorStore, KeywordIndex } from "../core/interfaces.js";
import type { RagConfig } from "../core/config.js";
import { loadConfig, DEFAULT_CONFIG } from "../core/config.js";
import { createEmbedder } from "../embedder/factory.js";
import { LanceDBStore } from "../vectorstore/lancedb.js";
import { KeywordIndex as KeywordIndexImpl } from "../retriever/keyword-index.js";
import { retrieve } from "../retriever/retriever.js";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  handleSearchSemantic,
  handleFileSkeleton,
  handleFindUsages,
  type SearchSemanticParams,
  type FileSkeletonParams,
  type FindUsagesParams,
} from "./handlers.js";

export interface McpServerOptions {
  configPath?: string;
  cwd?: string;
  transport?: Transport;
}

export interface RagMcpInstance {
  server: McpServer;
  close: () => Promise<void>;
}

function resolveConfig(cwd: string, configPath?: string): RagConfig {
  if (configPath) {
    return loadConfig(path.resolve(configPath));
  }

  const locations = [
    path.join(cwd, "opencode-rag.json"),
    path.join(cwd, ".opencode", "opencode-rag.json"),
    path.join(cwd, ".opencode", "rag.json"),
  ];
  for (const loc of locations) {
    if (existsSync(loc)) {
      return loadConfig(loc);
    }
  }

  return { ...DEFAULT_CONFIG };
}

async function probeDimension(embedder: EmbeddingProvider): Promise<number> {
  try {
    const probe = await embedder.embed(["dimension-probe"], "query");
    if (probe && probe[0] && probe[0].length > 0 && typeof probe[0][0] === "number") {
      return (probe[0] as number[]).length;
    }
  } catch {
  }
  return 384;
}

async function loadKeywordIndex(storePath: string): Promise<KeywordIndex> {
  try {
    const idx = await KeywordIndexImpl.load(storePath);
    return idx;
  } catch {
    return new KeywordIndexImpl(storePath);
  }
}

export async function createMcpServer(options?: McpServerOptions): Promise<RagMcpInstance> {
  const cwd = options?.cwd ?? process.cwd();
  const cfg = resolveConfig(cwd, options?.configPath);
  const storePath = path.resolve(cwd, cfg.vectorStore.path);

  const embedder = createEmbedder(cfg);
  const dimension = await probeDimension(embedder);
  const store: VectorStore = new LanceDBStore(storePath, dimension);
  const keywordIndex = await loadKeywordIndex(storePath);

  const server = new McpServer({
    name: "opencode-rag-mcp",
    version: "1.0.0",
  });

  server.tool(
    "search_semantic",
    "Search the indexed codebase by meaning, not just keywords. Returns relevant code chunks with file paths, line numbers, and relevance scores.",
    {
      query: z.string().min(1, "A search query is required."),
      pathHints: z.array(z.string().min(1)).max(10).optional(),
      languageHints: z.array(z.string().min(1)).max(10).optional(),
      topK: z.number().int().min(1).max(25).optional(),
    },
    async (args: SearchSemanticParams) => {
      try {
        const result = await handleSearchSemantic(args, embedder, store, cfg, keywordIndex, retrieve);
        return {
          content: [{ type: "text" as const, text: result.formatted }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Search failed: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "get_file_skeleton",
    "Get a quick structural overview of a source file — functions, classes, interfaces, methods, and other top-level declarations with their line numbers.",
    {
      filePath: z.string().min(1, "A file path is required."),
    },
    async (args: FileSkeletonParams) => {
      try {
        const result = await handleFileSkeleton(args, cwd);
        return {
          content: [{ type: "text" as const, text: result.formatted }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: `Could not read file: ${message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "find_usages",
    "Find usages and references of a symbol (function, variable, class, etc.) across the indexed codebase.",
    {
      symbolName: z.string().min(1, "A symbol name is required."),
      pathHint: z.string().optional(),
      topK: z.number().int().min(1).max(50).optional(),
    },
    async (args: FindUsagesParams) => {
      try {
        const result = await handleFindUsages(args, embedder, store, cfg, keywordIndex, retrieve);
        return {
          content: [{ type: "text" as const, text: result.formatted }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Search failed: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    }
  );

  const transport = options?.transport ?? new StdioServerTransport();
  await server.connect(transport);

  return {
    server,
    close: async () => {
      await server.close();
    },
  };
}
