/**
 * Helper functions for the `init` command — file generation, config building,
 * dependency installation, and gitignore merging.
 */

import path from "node:path";
import os from "node:os";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { DEFAULT_CONFIG } from "../../core/config.js";
import { c } from "../format.js";
import {
  getPackageRoot,
  getStringRecord,
  readJsonObject,
  writeJsonFile,
  toPosixPath,
} from "../helpers.js";
import type { PackageMetadata } from "../types.js";

/**
 * Resolve the npm package specifier for the workspace-local plugin.
 *
 * If the workspace root and package root share the same drive letter,
 * a relative `file:` specifier is used; otherwise the bare version
 * string is returned (for published packages).
 *
 * @param opencodeDir - Absolute path to the `.opencode/` directory.
 * @param packageRoot - Absolute path to the package root.
 * @param version - The package version string.
 * @returns A specifier like `"file:../../opencode-rag"` or `"1.12.17"`.
 */
export function resolveWorkspacePackageSpecifier(opencodeDir: string, packageRoot: string, version: string): string {
  const workspaceRoot = path.parse(opencodeDir).root.toLowerCase();
  const sourceRoot = path.parse(packageRoot).root.toLowerCase();

  if (workspaceRoot === sourceRoot) {
    return `file:${toPosixPath(path.relative(opencodeDir, packageRoot))}`;
  }

  return version;
}

/**
 * Build the workspace-local `.opencode/package.json` content.
 *
 * Merges existing dependencies with the required `@opencode-ai/plugin`
 * and the current package's workspace specifier.
 *
 * @param existing - The existing package.json content (if any).
 * @param packageMetadata - The CLI package's metadata for version resolution.
 * @param opencodeDir - Absolute path to the `.opencode/` directory.
 * @returns The merged package.json object.
 */
export function buildWorkspacePackageJson(
  existing: Record<string, unknown> | undefined,
  packageMetadata: PackageMetadata,
  opencodeDir: string,
): Record<string, unknown> {
  const existingDependencies = getStringRecord(existing?.dependencies);
  const pluginVersion =
    existingDependencies["@opencode-ai/plugin"] ??
    packageMetadata.devDependencies?.["@opencode-ai/plugin"] ??
    packageMetadata.peerDependencies?.["@opencode-ai/plugin"] ??
    ">=1.0.0";

  return {
    ...existing,
    name: typeof existing?.name === "string" ? existing.name : ".opencode",
    private: true,
    type: "module",
    dependencies: {
      ...existingDependencies,
      "@opencode-ai/plugin": pluginVersion,
      [packageMetadata.name]: resolveWorkspacePackageSpecifier(opencodeDir, getPackageRoot(), packageMetadata.version),
    },
  };
}

/**
 * Build the `.opencode/opencode.json` config object.
 *
 * Ensures the `$schema` key is present and removes any stale `plugin`
 * entries that would trigger erroneous npm installs.
 *
 * @param existing - The existing opencode.json content (if any).
 * @returns The normalized config object.
 */
export function buildOpencodeConfig(existing: Record<string, unknown> | undefined): Record<string, unknown> {
  const next = { ...(existing ?? {}) };
  if (typeof next.$schema !== "string") {
    next.$schema = "https://opencode.ai/config.json";
  }
  // Plugin is loaded via .opencode/plugins/rag-plugin.js auto-discovery,
  // not via npm package resolution. Stale "plugin" entries from older
  // init versions would trigger npm install (which fails due to native
  // dependencies like canvas) and produce "Plugin export is not a function".
  delete next.plugin;

  return next;
}

/**
 * Remove stale global OpenCode plugin registrations from config files.
 *
 * Scans `~/.config/opencode/opencode.jsonc` and `opencode.json` for
 * plugin entries matching `pluginName` and removes them.
 *
 * @param homeDir - The user's home directory (typically `os.homedir()`).
 * @param pluginName - The plugin package name to remove.
 * @returns Array of config file paths that were modified.
 */
export function removeStaleGlobalPluginRegistrations(homeDir: string, pluginName: string): string[] {
  const globalConfigDir = path.join(homeDir, ".config", "opencode");
  const updatedPaths: string[] = [];

  for (const cfgFile of ["opencode.jsonc", "opencode.json"]) {
    const configPath = path.join(globalConfigDir, cfgFile);
    if (!existsSync(configPath)) {
      continue;
    }

    try {
      const cfg = readJsonObject(configPath);
      if (!cfg || !Array.isArray(cfg.plugin)) {
        continue;
      }

      const nextPlugins = cfg.plugin.filter((entry): entry is string => typeof entry === "string" && entry !== pluginName);
      if (nextPlugins.length === cfg.plugin.length) {
        continue;
      }

      if (nextPlugins.length > 0) {
        cfg.plugin = nextPlugins;
      } else {
        delete cfg.plugin;
      }

      writeJsonFile(configPath, cfg);
      updatedPaths.push(configPath);
    } catch {
      // Ignore malformed OpenCode config files and leave them unchanged.
    }
  }

  return updatedPaths;
}

/**
 * Generate the content for `.opencode/plugins/rag-plugin.js`.
 *
 * This file re-exports the plugin from the workspace-local node_modules.
 *
 * @param packageName - The npm package name of the RAG plugin.
 * @returns The JavaScript source code for the plugin entry file.
 */
export function generateWorkspacePluginFile(packageName: string): string {
  return [
    `import plugin from "../node_modules/${packageName}/dist/plugin-entry.js";`,
    `export const id = plugin.id;`,
    `export const server = plugin.server;`,
    `export default plugin;`,
    "",
  ].join("\n");
}

/**
 * Generate the content for `.opencode/plugins/rag-tui.js`.
 *
 * This file re-exports the TUI plugin from the workspace-local node_modules.
 *
 * @param packageName - The npm package name of the RAG plugin.
 * @returns The JavaScript source code for the TUI plugin entry file.
 */
export function generateWorkspaceTuiPluginFile(packageName: string): string {
  return [
    `import plugin from "../node_modules/${packageName}/dist/tui.js";`,
    `export default plugin;`,
    "",
  ].join("\n");
}

/**
 * Generate the content for `.opencode/skills/opencode-rag/SKILL.md`.
 *
 * This file provides tool usage guidance for AI assistants working in the workspace.
 *
 * @returns The full Markdown content of the skill file.
 */
export function generateSkillFile(): string {
  return [
    "---",
    "name: opencode-rag",
    "description: Semantic code & image retrieval via OpenCodeRAG — vector search, file skeletons, symbol usage lookup, and image description lookup for this workspace",
    "---",
    "",
    "## OpenCodeRAG Tools",
    "",
    "This workspace has OpenCodeRAG indexed for semantic code and image search. Use these tools BEFORE planning, editing, or answering code questions.",
    "",
    "### Decision tree — ALWAYS follow this order",
    "",
    "1. User mentions code behavior/architecture → `search_semantic(query)`",
    "2. User mentions a file path → `get_file_skeleton(filePath)` THEN `read` on specific lines",
    "3. User mentions a function/class/variable to edit → `find_usages(symbolName)` THEN `search_semantic` THEN `edit`",
    "4. User asks a code question → `search_semantic` to gather context before answering",
    "5. User asks about an image or visual asset → `describe_image(filePath)` to retrieve its generated description, then optionally `search_semantic` for related code",
    "",
    "### When to use each tool",
    "",
    "| Tool | Use when | Example |",
    "|------|----------|---------|",
    "| `search_semantic` | Any code search — find relevant code by meaning or keyword | `\"authentication middleware\"` |",
    "| `get_file_skeleton` | You have a file path but need to orient before reading | `\"src/plugin.ts\"` |",
    "| `find_usages` | Before editing any function, class, or variable — check all call sites | `\"createRagHooks\"` |",
    "| `describe_image` | When the user refers to an image or asks \"what's in this screenshot/diagram?\" | `\"assets/login-screen.png\"` |",
    "",
    "### Workflow",
    "",
    "1. **Skeleton first** — call `get_file_skeleton(filePath)` to see structure",
    "2. **Find usages** — call `find_usages(symbolName)` before modifying any symbol",
    "3. **Search** — call `search_semantic(query)` to find relevant code",
    "4. **Describe images** — call `describe_image(filePath)` when context involves an image file",
    "5. **Read** — use the `read` tool on specific line ranges identified above",
    "6. **Edit** — now you have full context to make safe changes",
    "",
    "### Anti-patterns — NEVER do these",
    "",
    "- Reading full files without calling `get_file_skeleton` first (wastes tokens)",
    "- Editing a function without calling `find_usages` first (breaks call sites)",
    "- Answering code questions without calling `search_semantic` first (you guess at behavior)",
    "- Using `grep`/`glob` when `search_semantic` would find the answer faster",
    "- Treating image files as text — use `describe_image` instead of reading raw bytes",
    "",
    "### Parameters",
    "",
    "- `search_semantic`: `query` (req), `pathHints?`, `languageHints?`, `topK?`",
    "- `get_file_skeleton`: `filePath` (req)",
    "- `find_usages`: `symbolName` (req), `pathHint?`, `topK?`",
    "- `describe_image`: `filePath` (req)",
    "",
    "### Tips",
    "",
    "- Use `pathHints` to narrow searches to specific directories",
    "- Use `languageHints` to filter by file type",
    "- `find_usages` is essential before refactoring — it shows every reference",
    "- If no results appear, the workspace may not be indexed yet — run `opencode-rag index`",
    "- Image descriptions are generated at index time using the configured vision provider; ensure `imageDescription` is configured in `opencode-rag.json` if your project includes images",
    "",
  ].join("\n");
}

/**
 * Merge required entries into an existing `.gitignore` content string.
 *
 * Ensures `node_modules/`, `package-lock.json`, `rag_db/`, and `opencode-rag.log`
 * are present. If no existing content is provided, generates a complete file.
 *
 * @param existingContent - The current `.gitignore` content, or `undefined` if absent.
 * @returns The merged `.gitignore` content with a trailing newline.
 */
export function mergeGitignoreContent(existingContent?: string): string {
  const lines = existingContent ? existingContent.split(/\r?\n/) : [];
  const trimmed = new Set(lines.map((line) => line.trim()));
  const requiredEntries = ["node_modules/", "package-lock.json", "rag_db/", "opencode-rag.log"];
  const missing = requiredEntries.filter((entry) => !trimmed.has(entry));

  if (!existingContent) {
    return [
      "# Ignore workspace-local plugin dependencies",
      "node_modules/",
      "package-lock.json",
      "",
      "# Ignore the LanceDB vector store (binary data)",
      "rag_db/",
      "",
      "# Ignore logs",
      "opencode-rag.log",
      "",
    ].join("\n");
  }

  if (missing.length === 0) {
    return existingContent.endsWith("\n") ? existingContent : `${existingContent}\n`;
  }

  const merged = [...lines];
  const lastLine = merged.length > 0 ? (merged[merged.length - 1] ?? "") : "";
  if (lastLine.trim().length > 0) {
    merged.push("");
  }
  merged.push("# OpenCodeRAG workspace state", ...missing, "");
  return merged.join("\n");
}

/**
 * Run `npm install` in the `.opencode/` directory to install workspace-local
 * plugin dependencies. Retries once with `--ignore-scripts --no-optional`
 * if the first attempt fails (to handle native module compilation issues).
 *
 * Shows an animated spinner while the install runs.
 *
 * @param opencodeDir - Absolute path to the `.opencode/` directory.
 * @throws If both install attempts fail.
 */
export async function installWorkspaceDependencies(opencodeDir: string): Promise<void> {
  const attempts = [
    {
      args: ["install", "--silent", "--no-package-lock"],
      retry: false,
    },
    {
      args: [
        "install",
        "--silent",
        "--no-package-lock",
        "--ignore-scripts",
        "--no-optional",
      ],
      retry: true,
    },
  ];

  let lastError: Error | undefined;

  for (const attempt of attempts) {
    if (attempt.retry) {
      console.log(c.warn("  Retrying dependency install without native module compilation..."));
    }

    await new Promise<void>((resolve, reject) => {
      const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
      let frameIdx = 0;
      const spinnerInterval = setInterval(() => {
        process.stderr.write(`\r  ${frames[frameIdx++ % frames.length]} Installing dependencies...`);
      }, 80);

      let child: ReturnType<typeof spawn>;
      if (process.platform === "win32") {
        const cmd = process.env.ComSpec ?? "cmd.exe";
        const shellArgs = attempt.args.map((a) => (/[\s"]/u.test(a) ? `"${a.replace(/"/g, '""')}"` : a));
        child = spawn(cmd, ["/d", "/s", "/c", `npm ${shellArgs.join(" ")}`], {
          cwd: opencodeDir,
          stdio: "ignore",
          env: process.env,
        });
      } else {
        child = spawn("npm", attempt.args, {
          cwd: opencodeDir,
          stdio: "ignore",
          env: process.env,
        });
      }

      child.on("error", (err) => {
        clearInterval(spinnerInterval);
        process.stderr.write("\r");
        lastError = err;
        reject(err);
      });

      child.on("close", (code) => {
        clearInterval(spinnerInterval);
        process.stderr.write("\r");
        if (code === 0) {
          resolve();
        } else {
          lastError = new Error(`npm install exited with code ${code ?? 1}`);
          reject(lastError);
        }
      });
    }).catch(() => {
      // caught per-attempt; continue to retry or throw below
    });

    if (!lastError) {
      return;
    }
  }

  throw lastError ?? new Error("npm install failed for workspace dependencies");
}

/**
 * Generate the default `opencode-rag.json` configuration content.
 *
 * @returns A pretty-printed JSON string with all default configuration values.
 */
export function generateDefaultConfigJson(): string {
  return JSON.stringify(
    {
      embedding: {
        provider: DEFAULT_CONFIG.embedding.provider,
        baseUrl: DEFAULT_CONFIG.embedding.baseUrl,
        model: DEFAULT_CONFIG.embedding.model,
        timeoutMs: DEFAULT_CONFIG.embedding.timeoutMs,
      },
      indexing: {
        includeExtensions: DEFAULT_CONFIG.indexing.includeExtensions,
        excludeDirs: DEFAULT_CONFIG.indexing.excludeDirs,
        chunkOverlap: DEFAULT_CONFIG.indexing.chunkOverlap,
        minFileSizeBytes: DEFAULT_CONFIG.indexing.minFileSizeBytes,
        concurrency: DEFAULT_CONFIG.indexing.concurrency,
        embedBatchSize: DEFAULT_CONFIG.indexing.embedBatchSize,
      },
      vectorStore: {
        path: DEFAULT_CONFIG.vectorStore.path,
      },
      retrieval: {
        topK: DEFAULT_CONFIG.retrieval.topK,
        minScore: DEFAULT_CONFIG.retrieval.minScore,
        hybridSearch: {
          enabled: DEFAULT_CONFIG.retrieval.hybridSearch!.enabled,
          keywordWeight: DEFAULT_CONFIG.retrieval.hybridSearch!.keywordWeight,
        },
      },
      openCode: {
        enabled: DEFAULT_CONFIG.openCode.enabled,
        maxContextChunks: DEFAULT_CONFIG.openCode.maxContextChunks,
        readOverride: DEFAULT_CONFIG.openCode.readOverride,
        autoIndex: {
          enabled: DEFAULT_CONFIG.openCode.autoIndex!.enabled,
          debounceMs: DEFAULT_CONFIG.openCode.autoIndex!.debounceMs,
          intervalMs: DEFAULT_CONFIG.openCode.autoIndex!.intervalMs,
        },
        autoInject: {
          enabled: DEFAULT_CONFIG.openCode.autoInject!.enabled,
          minScore: DEFAULT_CONFIG.openCode.autoInject!.minScore,
          maxChunks: DEFAULT_CONFIG.openCode.autoInject!.maxChunks,
          maxTokens: DEFAULT_CONFIG.openCode.autoInject!.maxTokens,
          contentType: DEFAULT_CONFIG.openCode.autoInject!.contentType,
        },
      },
      imageDescription: {
        enabled: DEFAULT_CONFIG.imageDescription!.enabled,
        provider: DEFAULT_CONFIG.imageDescription!.provider,
        model: DEFAULT_CONFIG.imageDescription!.model,
        baseUrl: DEFAULT_CONFIG.imageDescription!.baseUrl,
        timeoutMs: DEFAULT_CONFIG.imageDescription!.timeoutMs,
        think: DEFAULT_CONFIG.imageDescription!.think,
        numCtx: DEFAULT_CONFIG.imageDescription!.numCtx,
      },
      description: {
        enabled: DEFAULT_CONFIG.description!.enabled,
        provider: DEFAULT_CONFIG.description!.provider,
        baseUrl: DEFAULT_CONFIG.description!.baseUrl,
        model: DEFAULT_CONFIG.description!.model,
        think: DEFAULT_CONFIG.description!.think,
        numCtx: DEFAULT_CONFIG.description!.numCtx,
        timeoutMs: DEFAULT_CONFIG.description!.timeoutMs,
      },
      mcp: {
        enabled: DEFAULT_CONFIG.mcp!.enabled,
      },
      logging: {
        level: DEFAULT_CONFIG.logging.level,
        logFilePath: DEFAULT_CONFIG.logging.logFilePath,
      },
      chunking: {
        nodeTypes: {},
      },
    },
    null,
    2,
  ) + "\n";
}
