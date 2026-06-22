import path from "node:path";
import { existsSync } from "node:fs";
import { loadConfig, DEFAULT_CONFIG, type RagConfig } from "./config.js";
import { resolveApiKey } from "./resolve-api-key.js";
import { loadChunkersFromConfig } from "../chunker/loader.js";
import { createEmbedder } from "../embedder/factory.js";
import { createDescriptionProvider } from "../describer/factory.js";
import { LanceDBStore } from "../vectorstore/lancedb.js";
import { KeywordIndex } from "../retriever/keyword-index.js";
import type {
  EmbeddingProvider,
  VectorStore,
  KeywordIndex as IKeywordIndex,
  DescriptionProvider,
} from "./interfaces.js";

export interface BootstrapOptions {
  cwd?: string;
  configPath?: string;
  requireDescriptionProvider?: boolean;
}

export interface RagContext {
  config: RagConfig;
  embedder: EmbeddingProvider;
  store: VectorStore;
  storePath: string;
  keywordIndex: IKeywordIndex;
  descriptionProvider?: DescriptionProvider;
  dimension: number;
  logFilePath: string;
}

async function probeDimension(embedder: EmbeddingProvider): Promise<number> {
  try {
    const probe = await embedder.embed(["dimension-probe"], "query");
    if (probe && probe[0] && probe[0].length > 0 && typeof probe[0][0] === "number") {
      return (probe[0] as number[]).length;
    }
  } catch {
    // fallback to 384
  }
  return 384;
}

async function loadKeywordIndex(storePath: string): Promise<IKeywordIndex> {
  try {
    const idx = await KeywordIndex.load(storePath);
    return idx;
  } catch {
    return new KeywordIndex(storePath);
  }
}

export async function resolveRagContext(
  opts: BootstrapOptions = {}
): Promise<RagContext> {
  const workDir = opts.cwd ?? process.cwd();
  let configPath: string | undefined;

  if (opts.configPath) {
    configPath = path.resolve(workDir, opts.configPath);
  } else {
    for (const loc of [
      "opencode-rag.json",
      ".opencode/opencode-rag.json",
      ".opencode/rag.json",
    ]) {
      const candidate = path.join(workDir, loc);
      if (existsSync(candidate)) {
        configPath = candidate;
        break;
      }
    }
  }

  let cfg: RagConfig;
  if (configPath) {
    cfg = loadConfig(configPath);
    resolveApiKey(cfg, workDir);
    await loadChunkersFromConfig(cfg, path.dirname(configPath));
  } else {
    cfg = { ...DEFAULT_CONFIG };
  }

  const logFilePath = path.resolve(
    workDir,
    cfg.logging?.logFilePath ?? ".opencode/opencode-rag.log"
  );

  const embedder = createEmbedder(cfg);
  const dimension = await probeDimension(embedder);
  const storePath = path.resolve(workDir, cfg.vectorStore.path);
  const store = new LanceDBStore(storePath, dimension);
  const keywordIndex = await loadKeywordIndex(storePath);

  const descriptionConfig = cfg.description;
  const descriptionProvider =
    descriptionConfig?.enabled
      ? createDescriptionProvider(descriptionConfig)
      : undefined;

  return {
    config: cfg,
    embedder,
    store,
    storePath,
    keywordIndex,
    descriptionProvider,
    dimension,
    logFilePath,
  };
}
