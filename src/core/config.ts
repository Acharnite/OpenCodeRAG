import { readFileSync } from "node:fs";
import path from "node:path";
import { env } from "node:process";
import type { EmbeddingProvider, Chunker, VectorStore } from "./interfaces.js";

export interface ChunkerConfig {
  module: string;
  extensions: string[];
}

export interface ProxyConfig {
  url?: string;
  username?: string;
  password?: string;
  noProxy?: string;
}

export interface AutoIndexConfig {
  enabled: boolean;
  debounceMs: number;
  intervalMs: number;
}

export type ReadNoResultsBehavior = "hint" | "empty" | "error";

export interface AutoInjectConfig {
  enabled: boolean;
  minScore: number;
  maxChunks: number;
  maxTokens: number;
}

export interface DescriptionConfig {
  enabled: boolean;
  provider: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  timeoutMs?: number;
  proxy?: ProxyConfig;
  systemPrompt: string;
  batchMaxChunks?: number;
  batchTimeoutMs?: number;
  retryMax?: number;
  retryBaseDelayMs?: number;
}

export interface UiConfig {
  port: number;
  openBrowser: boolean;
}

export interface TuiConfig {
  fileListKeybinding: string;
  chunksKeybinding: string;
}

export interface McpConfig {
  enabled: boolean;
}

export interface RagConfig {
  embedding: {
    provider: string;
    baseUrl: string;
    apiKey?: string;
    model: string;
    timeoutMs?: number;
    proxy?: ProxyConfig;
    documentPrefix?: string;
    queryPrefix?: string;
  };
  indexing: {
    includeExtensions: string[];
    excludeDirs: string[];
    chunkOverlap: number;
    minFileSizeBytes?: number;
    concurrency: number;
    embedBatchSize: number;
  };
  vectorStore: {
    path: string;
  };
  retrieval: {
    topK: number;
    minScore: number;
    hybridSearch?: {
      enabled: boolean;
      keywordWeight: number;
    };
  };
  openCode: {
    enabled: boolean;
    maxContextChunks: number;
    autoIndex?: AutoIndexConfig;
    autoInject?: AutoInjectConfig;
    readOverride?: boolean;
    maxReadOutputChars?: number;
    readNoResultsBehavior?: ReadNoResultsBehavior;
    readRelatedFilesMax?: number;
  };
  chunkers?: ChunkerConfig[];
  chunking?: {
    nodeTypes?: Record<string, string[]>;
  };
  description?: DescriptionConfig;
  mcp?: McpConfig;
  ui?: UiConfig;
  tui: TuiConfig;
  logging: LoggingConfig;
}

export interface LoggingConfig {
  level: "debug" | "info" | "error";
  logFilePath: string;
}

export const DEFAULT_CONFIG: RagConfig = {
  embedding: {
    provider: "ollama",
    baseUrl: "http://127.0.0.1:11434/api",
    model: "embeddinggemma:latest",
    timeoutMs: 30000,
  },
  indexing: {
    includeExtensions: [
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      ".mjs",
      ".cjs",
      ".py",
      ".java",
      ".go",
      ".md",
      ".mdx",
      ".c",
      ".h",
      ".cpp",
      ".cc",
      ".cxx",
      ".hpp",
      ".hxx",
      ".cs",
      ".aspx",
      ".razor",
      ".cshtml",
      ".json",
      ".html",
      ".htm",
      ".css",
      ".xml",
      ".csproj",
      ".sln",
      ".rs",
      ".rb",
      ".kt",
      ".kts",
      ".swift",
      ".tex",
      ".pdf",
      ".docx",
      ".doc",
      ".xls",
    ".xlsx",
    ".sh",
    ".bash",
    ".zsh",
    ".php",
    ".ps1",
    ".psm1",
    ".psd1",
    ".ini",
    ".cfg",
    ".yaml",
    ".yml",
    ".toml",
    ".sql",
    "dockerfile",
    "containerfile",
    ".dockerfile",
    ".containerfile",
  ],
    excludeDirs: [
      "node_modules",
      ".git",
      ".opencode",
      "dist",
      "build",
      "__pycache__",
      ".venv",
    ],
    chunkOverlap: 0,
    minFileSizeBytes: 0,
    concurrency: 4,
    embedBatchSize: 50,
  },
  vectorStore: {
    path: "./.opencode/rag_db",
  },
  retrieval: {
    topK: 10,
    minScore: 0.5,
    hybridSearch: {
      enabled: true,
      keywordWeight: 0.4,
    },
  },
  openCode: {
    enabled: true,
    maxContextChunks: 10,
    readOverride: true,
    autoIndex: {
      enabled: true,
      debounceMs: 2000,
      intervalMs: 300000,
    },
    autoInject: {
      enabled: true,
      minScore: 0.75,
      maxChunks: 3,
      maxTokens: 2000,
    },
  },
  description: {
    enabled: true,
    provider: "ollama",
    baseUrl: "http://127.0.0.1:11434/api",
    model: "qwen2.5:3b",
    timeoutMs: 60000,
    systemPrompt:
      "You are a code analysis assistant. Describe code for embedding search in caveman style: short simple words, rough grammar. Include what code do, main names, data in, data out, side effects, errors, and search words. No markdown, no code, no line-by-line talk. If user message contains multiple chunks labeled === CHUNK N ===, describe each one separately, starting each with CHUNK N: followed by the description. For a single chunk, give the description directly.",
    batchMaxChunks: 25,
    batchTimeoutMs: 120000,
    retryMax: 3,
    retryBaseDelayMs: 1000,
  },
  mcp: {
    enabled: true,
  },
  ui: {
    port: 3210,
    openBrowser: true,
  },
  tui: {
    fileListKeybinding: "ctrl+enter",
    chunksKeybinding: "ctrl+alt+enter",
  },
  logging: {
    level: "info",
    logFilePath: "./.opencode/opencode-rag.log",
  },
};

export function resolveLogConfig(config: RagConfig): LoggingConfig {
  return {
    level: config.logging?.level ?? DEFAULT_CONFIG.logging.level,
    logFilePath: config.logging?.logFilePath ?? env.LOG_FILE_PATH ?? DEFAULT_CONFIG.logging.logFilePath,
  };
}

export interface RagContext {
  config: RagConfig;
  embedder: EmbeddingProvider;
  chunker: Chunker;
  vectorStore: VectorStore;
}

export interface ConfigValidationResult {
  valid: boolean;
  warnings: string[];
}

export function validateConfig(config: RagConfig): ConfigValidationResult {
  const warnings: string[] = [];

  const KNOWN_TOP_KEYS = new Set([
    "embedding", "indexing", "vectorStore", "retrieval",
    "openCode", "chunkers", "chunking", "description",
    "mcp", "ui", "tui", "logging",
  ]);
  const topKeys = new Set(Object.keys(config as unknown as Record<string, unknown>));
  for (const key of topKeys) {
    if (!KNOWN_TOP_KEYS.has(key)) {
      warnings.push(`Unknown top-level config key "${key}" — possible typo`);
    }
  }

  if (!["ollama", "openai"].includes(config.embedding.provider)) {
    warnings.push(`embedding.provider "${config.embedding.provider}" — expected "ollama" or "openai"`);
  }
  if (config.embedding.timeoutMs != null && config.embedding.timeoutMs <= 0) {
    warnings.push("embedding.timeoutMs must be > 0");
  }
  try { new URL(config.embedding.baseUrl); } catch {
    warnings.push(`embedding.baseUrl "${config.embedding.baseUrl}" is not a valid URL`);
  }

  if (config.indexing.chunkOverlap < 0) {
    warnings.push("indexing.chunkOverlap must be >= 0");
  }
  if (config.indexing.concurrency <= 0) {
    warnings.push("indexing.concurrency must be > 0");
  }
  if (config.indexing.embedBatchSize <= 0) {
    warnings.push("indexing.embedBatchSize must be > 0");
  }
  if (config.indexing.minFileSizeBytes != null && config.indexing.minFileSizeBytes < 0) {
    warnings.push("indexing.minFileSizeBytes must be >= 0");
  }

  if (config.retrieval.topK <= 0) {
    warnings.push("retrieval.topK must be > 0");
  }
  if (config.retrieval.minScore < 0 || config.retrieval.minScore > 1) {
    warnings.push("retrieval.minScore must be between 0 and 1");
  }
  if (config.retrieval.hybridSearch?.enabled) {
    const kw = config.retrieval.hybridSearch.keywordWeight;
    if (kw < 0 || kw > 1) {
      warnings.push("retrieval.hybridSearch.keywordWeight must be between 0 and 1");
    }
  }

  if (config.openCode.maxContextChunks <= 0) {
    warnings.push("openCode.maxContextChunks must be > 0");
  }

  if (!["debug", "info", "error"].includes(config.logging.level)) {
    warnings.push(`logging.level "${config.logging.level}" — expected "debug", "info", or "error"`);
  }

  if (config.ui) {
    if (config.ui.port < 1 || config.ui.port > 65535) {
      warnings.push("ui.port must be between 1 and 65535");
    }
  }

  if (config.description) {
    if (!["ollama", "openai"].includes(config.description.provider)) {
      warnings.push(`description.provider "${config.description.provider}" — expected "ollama" or "openai"`);
    }
    if (config.description.timeoutMs != null && config.description.timeoutMs <= 0) {
      warnings.push("description.timeoutMs must be > 0");
    }
  }

  return { valid: warnings.length === 0, warnings };
}

export function loadConfig(filePath: string, validate: boolean = true): RagConfig {
  let raw: string;
  let parsed: Partial<RagConfig>;
  try {
    raw = readFileSync(filePath, "utf-8");
    parsed = JSON.parse(raw) as Partial<RagConfig>;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error(`Config file not found: ${filePath}`);
    }
    if (err instanceof SyntaxError) {
      throw new Error(`Invalid JSON in config file ${filePath}: ${err.message}`);
    }
    throw err;
  }

  const safeObj = <T>(value: unknown): Partial<T> | undefined =>
    value && typeof value === "object" && !Array.isArray(value) ? (value as Partial<T>) : undefined;

  const cfg: RagConfig = {
    embedding: {
      ...DEFAULT_CONFIG.embedding,
      ...parsed.embedding,
    },
    indexing: {
      ...DEFAULT_CONFIG.indexing,
      ...parsed.indexing,
    },
    vectorStore: {
      ...DEFAULT_CONFIG.vectorStore,
      ...parsed.vectorStore,
    },
    retrieval: {
      ...DEFAULT_CONFIG.retrieval,
      ...parsed.retrieval,
      hybridSearch: {
        ...DEFAULT_CONFIG.retrieval.hybridSearch,
        ...(safeObj<typeof DEFAULT_CONFIG.retrieval.hybridSearch>(
          (parsed.retrieval as Record<string, unknown> | undefined)?.hybridSearch
        ) ?? {}),
      } as { enabled: boolean; keywordWeight: number },
    },
    openCode: (() => {
      const base = DEFAULT_CONFIG.openCode;
      const user: Partial<typeof base> = (parsed as { openCode?: Partial<typeof base> }).openCode ?? {};
      const merged: typeof base = {
        ...base,
        ...user,
        autoIndex: {
          ...base.autoIndex,
          ...(safeObj<AutoIndexConfig>(user.autoIndex) ?? {}),
        } as AutoIndexConfig,
        autoInject: {
          ...base.autoInject,
          ...(safeObj<AutoInjectConfig>(user.autoInject) ?? {}),
        } as AutoInjectConfig,
      };
      return merged;
    })(),
  chunkers: parsed.chunkers ?? DEFAULT_CONFIG.chunkers,
  chunking: {
    nodeTypes: {
      ...((DEFAULT_CONFIG.chunking as Record<string, unknown>)?.nodeTypes as Record<string, string[]> | undefined ?? {}),
      ...((parsed.chunking as Record<string, unknown>)?.nodeTypes as Record<string, string[]> | undefined ?? {}),
    },
  },
    description: {
      ...DEFAULT_CONFIG.description,
      ...(safeObj<DescriptionConfig>((parsed as { description?: unknown }).description) ?? {}),
    } as DescriptionConfig,
    mcp: {
      ...DEFAULT_CONFIG.mcp,
      ...(safeObj<McpConfig>((parsed as { mcp?: unknown }).mcp) ?? {}),
    } as McpConfig,
    ui: {
      ...DEFAULT_CONFIG.ui,
      ...(safeObj<UiConfig>((parsed as { ui?: unknown }).ui) ?? {}),
    } as UiConfig,
    tui: {
      ...DEFAULT_CONFIG.tui,
      ...(safeObj<TuiConfig>((parsed as { tui?: unknown }).tui) ?? {}),
    } as TuiConfig,
    logging: {
      ...DEFAULT_CONFIG.logging,
      ...(safeObj<LoggingConfig>(parsed.logging) ?? {}),
    } as LoggingConfig,
  };

  if (validate) {
    const result = validateConfig(cfg);
    for (const w of result.warnings) {
      console.warn(`[opencode-rag] Config warning: ${w}`);
    }
  }

  return cfg;
}
