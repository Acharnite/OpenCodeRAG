import { Command } from "commander";
import path from "node:path";
import chokidar from "chokidar";
import { loadConfig, DEFAULT_CONFIG, type RagConfig } from "./core/config.js";
import { loadChunkersFromConfig } from "./chunker/loader.js";
import { createEmbedder } from "./embedder/factory.js";
import { LanceDBStore } from "./vectorstore/lancedb.js";
import { retrieve } from "./retriever/retriever.js";
import {
  createWatchPassScheduler,
  getIndexStatusSummary,
  runIndexPass,
  type IndexRunStats,
} from "./indexer.js";
import { manifestPathFor } from "./core/manifest.js";

interface CliOptions {
  config?: string;
  force?: boolean;
  watch?: boolean;
  topK?: string;
}

async function resolveConfig(opt: CliOptions): Promise<RagConfig> {
  if (opt.config) {
    try {
      const configPath = path.resolve(opt.config);
      const cfg = loadConfig(configPath);
      await loadChunkersFromConfig(cfg, path.dirname(configPath));
      console.log(`Config: ${configPath}`);
      return logConfigDetails(cfg);
    } catch {
      console.error(`Could not load config from ${opt.config}, using defaults`);
    }
  }
  for (const loc of ["opencode-rag.json", ".opencode/rag.json"]) {
    try {
      const configPath = path.resolve(loc);
      const cfg = loadConfig(configPath);
      await loadChunkersFromConfig(cfg, path.dirname(configPath));
      console.log(`Config: ${configPath}`);
      return logConfigDetails(cfg);
    } catch {
      // continue
    }
  }
  console.log(`Config: using defaults (no opencode-rag.json found)`);
  return logConfigDetails(DEFAULT_CONFIG);
}

function logConfigDetails(config: RagConfig): RagConfig {
  console.log(`  Embedding provider: ${config.embedding.provider}`);
  console.log(`  Embedding model:    ${config.embedding.model}`);
  console.log(`  Vector store:       ${config.vectorStore.path}`);
  return config;
}

function formatTimestamp(timestamp?: number): string {
  if (!timestamp) return "never";
  return new Date(timestamp).toLocaleString();
}

function logIndexSummary(stats: IndexRunStats): void {
  console.log(`  New:              ${stats.newFiles}`);
  console.log(`  Modified:         ${stats.modifiedFiles}`);
  console.log(`  Unchanged:        ${stats.unchangedFiles}`);
  console.log(`  Deleted:          ${stats.deletedFiles}`);
  console.log(`  Removed:          ${stats.removedFiles}`);
  console.log(`  Empty skipped:    ${stats.skippedEmptyFiles}`);
  console.log(`  Chunks written:   ${stats.totalChunks}`);
}

function createWatchIgnore(
  cwd: string,
  config: RagConfig,
  storePath: string
): (watchedPath: string) => boolean {
  const manifestPath = manifestPathFor(storePath);
  const excludeDirs = new Set(config.indexing.excludeDirs);

  return (watchedPath: string): boolean => {
    const resolved = path.resolve(watchedPath);
    if (resolved.startsWith(storePath)) return true;
    if (resolved === manifestPath) return true;

    const relative = path.relative(cwd, resolved);
    if (!relative || relative.startsWith("..")) return false;
    const segments = relative.split(path.sep);
    return segments.some((segment) => excludeDirs.has(segment));
  };
}

function formatDuration(ms: number): string {
  const seconds = (ms / 1000).toFixed(1);
  if (ms < 60000) return `${seconds}s`;
  const minutes = Math.floor(ms / 60000);
  const secs = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${secs}s`;
}

const program = new Command();

program
  .name("opencode-rag")
  .description("Local-first RAG semantic code search")
  .version("0.1.0");

program
  .command("index")
  .description("Index workspace files")
  .option("-c, --config <path>", "path to config file")
  .option("-f, --force", "force full re-index")
  .option("-w, --watch", "watch workspace and incrementally re-index on changes")
  .action(async (options: CliOptions) => {
    const started = Date.now();

    try {
      const config = await resolveConfig(options);
      const cwd = process.cwd();

      console.log("\nIndexing workspace...");

      const embedder = createEmbedder(config);

      // Detect actual vector dimension from the model
      const probe = await embedder.embed(["dimension-probe"]);
      const vectorDimension = probe[0]?.length ?? 384;
      console.log(`  Vector dimension:   ${vectorDimension}`);

      const store = new LanceDBStore(
        path.resolve(cwd, config.vectorStore.path),
        vectorDimension
      );

      console.log(`Scanning: ${cwd}`);
      const runPass = async (watchTriggered: boolean = false): Promise<void> => {
        const passStarted = Date.now();
        const stats = await runIndexPass({
          cwd,
          storePath: path.resolve(cwd, config.vectorStore.path),
          config,
          store,
          embedder,
          force: Boolean(options.force && !watchTriggered),
          logger: {
            info: (message) => console.log(message),
            warn: (message) => console.warn(message),
          },
        });

        console.log();
        logIndexSummary(stats);
        console.log(
          `\nIndexing complete. ${stats.finalCount} chunks stored (${formatDuration(Date.now() - passStarted)}).`
        );
      };

      await runPass(false);

      if (!options.watch) {
        return;
      }

      console.log("\nWatching for changes...");
      const scheduler = createWatchPassScheduler(
        () => runPass(true),
        (error) => {
          const message = (error as Error).message || String(error);
          console.error(`\nWatch reindex failed: ${message}`);
        },
        300
      );

      const watcher = chokidar.watch(cwd, {
        ignored: createWatchIgnore(cwd, config, path.resolve(cwd, config.vectorStore.path)),
        ignoreInitial: true,
        persistent: true,
      });

      const handleChange = () => scheduler.notifyChange();
      watcher.on("add", handleChange);
      watcher.on("change", handleChange);
      watcher.on("unlink", handleChange);
      watcher.on("unlinkDir", handleChange);
      watcher.on("addDir", handleChange);
      watcher.on("error", (error) => {
        console.error(`\nWatcher error: ${(error as Error).message}`);
      });

      const shutdown = async () => {
        scheduler.close();
        await watcher.close();
        process.exit(0);
      };

      process.once("SIGINT", () => void shutdown());
      process.once("SIGTERM", () => void shutdown());

      const duration = formatDuration(Date.now() - started);
      console.log(`Watcher ready (${duration} startup). Press Ctrl+C to stop.`);
    } catch (err) {
      const message = (err as Error).message || String(err);
      console.error(`\nIndexing failed: ${message}`);
      if (message.toLowerCase().includes("fetch") || message.toLowerCase().includes("econnrefused")) {
        console.error("Hint: Is your embedding provider running?");
      }
      process.exit(1);
    }
  });

program
  .command("query")
  .description("Search the indexed codebase")
  .argument("<query>", "natural language query")
  .option("-c, --config <path>", "path to config file")
  .option("-n, --top-k <number>", "number of results", "10")
  .action(async (query: string, options: CliOptions) => {
    const started = Date.now();

    try {
      const config = await resolveConfig(options);
      const cwd = process.cwd();

      console.log(`\nQuerying: "${query}"`);
      console.log(`Top-K: ${parseInt(options.topK ?? "10", 10)}`);

      const embedder = createEmbedder(config);
      const store = new LanceDBStore(path.resolve(cwd, config.vectorStore.path));

      const indexedCount = await store.count();
      if (indexedCount === 0) {
        console.log("No indexed chunks found. Run 'opencode-rag index' first.");
        return;
      }
      console.log(`Searching ${indexedCount} indexed chunks...`);

      const topK = parseInt(options.topK ?? "10", 10);
      const results = await retrieve(query, embedder, store, { topK });

      if (results.length === 0) {
        console.log("No results found.");
        return;
      }

      const duration = formatDuration(Date.now() - started);
      console.log(`\n${results.length} result(s) in ${duration}:\n`);

      for (const r of results) {
        console.log(`  ${r.chunk.metadata.filePath}:${r.chunk.metadata.startLine}-${r.chunk.metadata.endLine}`);
        console.log(`  Score: ${r.score.toFixed(4)}`);
        console.log(
          `  ${r.chunk.content.slice(0, 200).replace(/\n/g, "\n  ")}`
        );
        console.log();
      }
    } catch (err) {
      const message = (err as Error).message || String(err);
      console.error(`\nQuery failed: ${message}`);
      if (message.toLowerCase().includes("fetch") || message.toLowerCase().includes("econnrefused")) {
        console.error("Hint: Is your embedding provider running?");
      }
      process.exit(1);
    }
  });

program
  .command("clear")
  .description("Clear all indexed data")
  .option("-c, --config <path>", "path to config file")
  .action(async (options: CliOptions) => {
    try {
      const config = await resolveConfig(options);
      const cwd = process.cwd();

      const store = new LanceDBStore(path.resolve(cwd, config.vectorStore.path));
      const prevCount = await store.count();

      if (prevCount === 0) {
        console.log("No indexed data to clear.");
        return;
      }

      console.log(`Clearing ${prevCount} indexed chunks...`);
      await store.clear();
      console.log(`Done. ${prevCount} chunks removed.`);
    } catch (err) {
      const message = (err as Error).message || String(err);
      console.error(`\nClear failed: ${message}`);
      process.exit(1);
    }
  });

program
  .command("status")
  .description("Show indexing status")
  .option("-c, --config <path>", "path to config file")
  .action(async (options: CliOptions) => {
    try {
      const config = await resolveConfig(options);
      const cwd = process.cwd();

      const store = new LanceDBStore(path.resolve(cwd, config.vectorStore.path));
      const count = await store.count();
      const summary = await getIndexStatusSummary(
        cwd,
        path.resolve(cwd, config.vectorStore.path),
        config,
        store
      );

      console.log(`\nIndexed chunks:    ${count}`);
      console.log(`Store path:        ${path.resolve(cwd, config.vectorStore.path)}`);
      console.log(`Embedding provider: ${config.embedding.provider}`);
      console.log(`Embedding model:   ${config.embedding.model}`);
      console.log(`File extensions:   ${config.indexing.includeExtensions.join(", ")}`);
      console.log(`Excluded dirs:     ${config.indexing.excludeDirs.join(", ")}`);
      console.log(`Default top-K:     ${config.retrieval.topK}`);
      console.log(`Plugin enabled:    ${config.openCode.enabled}`);
      console.log(`Manifest status:   ${summary.manifestStatus}`);
      console.log(`Manifest entries:  ${summary.manifestEntries}`);
      console.log(`Last indexed:      ${formatTimestamp(summary.lastIndexedAt)}`);
      console.log(`Up-to-date files:  ${summary.upToDateFiles}`);
      console.log(`Pending files:     ${summary.pendingFiles}`);
      console.log(`Watch mode:        off`);
      if (summary.rebuildRequired) {
        console.log(`Rebuild required:  yes (manifest missing/corrupt)`);
      }
    } catch (err) {
      const message = (err as Error).message || String(err);
      console.error(`\nStatus check failed: ${message}`);
      process.exit(1);
    }
  });

if (
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` ||
  process.argv[1]?.endsWith("cli.ts") ||
  process.argv[1]?.endsWith("cli.js")
) {
  program.parseAsync(process.argv);
}

export async function runCli(argv: string[] = process.argv): Promise<void> {
  await program.parseAsync(argv);
}
