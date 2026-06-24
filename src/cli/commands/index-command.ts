/**
 * `index` command — indexes workspace files into the vector database.
 *
 * Supports incremental indexing (only changed files), full rebuilds (`--force`),
 * and watch mode (`--watch`) with chokidar-based file monitoring.
 */

import type { Command } from "commander";
import path from "node:path";
import chokidar from "chokidar";
import { appendDebugLog } from "../../core/fileLogger.js";
import {
  createWatchPassScheduler,
  createWatchIgnore,
  runIndexPass,
} from "../../indexer.js";
import {
  c,
  resolveCliContext,
  cleanupContext,
  logCliError,
  logCliInfo,
  logIndexSummary,
  formatDuration,
} from "../format.js";
import { TerminalProgressTable } from "../progress.js";
import type { CliOptions } from "../types.js";

/**
 * Register the `index` command on the given Commander program.
 *
 * Scans the workspace, chunks changed/new files, generates embeddings,
 * and stores vectors in LanceDB. In watch mode, monitors file changes
 * via chokidar and triggers debounced re-indexing.
 *
 * @param program - The Commander `Command` instance to register on.
 */
export function registerIndexCommand(program: Command): void {
  program
    .command("index")
    .description("Index workspace files")
    .option("-c, --config <path>", "path to config file")
    .option("-f, --force", "force full re-index")
    .option("-w, --watch", "watch workspace and incrementally re-index on changes")
    .action(async (options: CliOptions) => {
      const started = Date.now();

      try {
        const cwd = process.cwd();
        let logFilePath = path.resolve(cwd, ".opencode", "opencode-rag.log");
        const ctx = await resolveCliContext(options, logFilePath);
        const { config, embedder, store, storePath, keywordIndex, descriptionProvider, dimension } = ctx;
        logFilePath = ctx.logFilePath;

        logCliInfo(logFilePath, "index", `\n${c.heading("Indexing workspace...")}`);
        logCliInfo(logFilePath, "index", `  ${c.label("Vector dimension:")}   ${c.num(dimension)}`);
        if (descriptionProvider) {
          const descriptionConfig = config.description ?? { provider: "ollama" as const, model: "qwen2.5:3b" };
          logCliInfo(logFilePath, "index", `  ${c.label("Description LLM:")}  ${c.value(descriptionConfig.model)} (${descriptionConfig.provider})`);
        }

        logCliInfo(logFilePath, "index", `${c.label("Scanning:")} ${c.file(cwd)}`);
        const progress = new TerminalProgressTable(process.stdout);
        const runPass = async (watchTriggered: boolean = false): Promise<void> => {
          const passStarted = Date.now();
          const stats = await runIndexPass({
            cwd,
            storePath,
            config,
            store,
            embedder,
            keywordIndex,
            descriptionProvider,
            progress,
            force: Boolean(options.force && !watchTriggered),
            logger: {
              info: (message) => {
                console.log(message);
                appendDebugLog(logFilePath, { scope: "index", message });
              },
              warn: (message) => {
                console.warn(message);
                appendDebugLog(logFilePath, { scope: "index", message: `WARN: ${message}` });
              },
              debug: (message) => {
                appendDebugLog(logFilePath, { scope: "index", message: `DEBUG: ${message}`, severity: "debug" });
              },
            },
          });

          progress.done();
          logIndexSummary(logFilePath, stats);
          logCliInfo(
            logFilePath,
            "index",
            `\n${c.success("Indexing complete.")} ${c.num(stats.finalCount)} chunks stored (${formatDuration(Date.now() - passStarted)}).`
          );
        };

        await runPass(false);

        if (!options.watch) {
          await cleanupContext(ctx);
          process.exit(0);
        }

        logCliInfo(logFilePath, "index", `\n${c.heading("Watching for changes...")}`);
        const scheduler = createWatchPassScheduler(
          () => runPass(true),
          (error) => {
            const message = (error as Error).message || String(error);
            logCliError(logFilePath, "watch", `\nWatch reindex failed: ${message}`, error);
          },
          300,
        );

        const watcher = chokidar.watch(cwd, {
          ignored: createWatchIgnore(cwd, config, storePath),
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
          logCliError(logFilePath, "watch", `Watcher error: ${(error as Error).message}`, error);
          console.error(c.error(`\nWatcher error: ${(error as Error).message}`));
        });

        const shutdown = async () => {
          scheduler.close();
          await scheduler.waitForIdle();
          await Promise.race([
            watcher.close(),
            new Promise((r) => setTimeout(r, 5000)),
          ]);
          await cleanupContext(ctx);
          process.exit(0);
        };

        process.once("SIGINT", () => void shutdown());
        process.once("SIGTERM", () => void shutdown());

        const duration = formatDuration(Date.now() - started);
        logCliInfo(logFilePath, "index", `${c.success("Watcher ready")} (${duration} startup). Press Ctrl+C to stop.`);
      } catch (err) {
        const message = (err as Error).message || String(err);
        const logFilePath = path.resolve(process.cwd(), ".opencode", "opencode-rag.log");
        logCliError(logFilePath, "index", `\nIndexing failed: ${message}`, err);
        if (message.toLowerCase().includes("fetch") || message.toLowerCase().includes("econnrefused")) {
          console.error(c.warn("Hint: Is your embedding provider running?"));
        }
        process.exit(1);
      }
    });
}
