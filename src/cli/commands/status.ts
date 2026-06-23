/**
 * `status` command — shows index statistics, store health, and configuration summary.
 */

import type { Command } from "commander";
import path from "node:path";
import { c, resolveCliContext, cleanupContext, logCliError, logCliInfo, formatTimestamp } from "../format.js";
import { getIndexStatusSummary } from "../../indexer.js";
import type { CliOptions } from "../types.js";

/**
 * Register the `status` command on the given Commander program.
 *
 * Displays a comprehensive overview of the current index: chunk counts,
 * store path, embedding provider/model, file extensions, manifest status,
 * keyword index state, and whether a rebuild is required.
 *
 * @param program - The Commander `Command` instance to register on.
 */
export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show indexing status")
    .option("-c, --config <path>", "path to config file")
    .action(async (options: CliOptions) => {
      try {
        const cwd = process.cwd();
        let logFilePath = path.resolve(cwd, ".opencode", "opencode-rag.log");
        const ctx = await resolveCliContext(options, logFilePath);
        const { config, store, storePath, keywordIndex } = ctx;
        logFilePath = ctx.logFilePath;

        const count = await store.count();
        const summary = await getIndexStatusSummary(
          cwd,
          storePath,
          config,
          store,
        );

        logCliInfo(logFilePath, "status", `\n${c.heading("Indexed chunks:")}    ${c.num(count)}`);
        logCliInfo(logFilePath, "status", `${c.label("Store path:")}        ${c.file(storePath)}`);
        logCliInfo(logFilePath, "status", `${c.label("Embedding provider:")} ${c.value(config.embedding.provider)}`);
        logCliInfo(logFilePath, "status", `${c.label("Embedding model:")}   ${c.value(config.embedding.model)}`);
        logCliInfo(logFilePath, "status", `${c.label("File extensions:")}   ${config.indexing.includeExtensions.join(", ")}`);
        logCliInfo(logFilePath, "status", `${c.label("Excluded dirs:")}     ${config.indexing.excludeDirs.join(", ")}`);
        logCliInfo(logFilePath, "status", `${c.label("Default top-K:")}     ${c.num(config.retrieval.topK)}`);
        logCliInfo(logFilePath, "status", `${c.label("Plugin enabled:")}    ${config.openCode.enabled ? c.enabled("yes") : c.disabled("no")}`);
        logCliInfo(logFilePath, "status", `${c.label("Manifest status:")}   ${summary.manifestStatus}`);
        logCliInfo(logFilePath, "status", `${c.label("Manifest entries:")}  ${c.num(summary.manifestEntries)}`);
        logCliInfo(logFilePath, "status", `${c.label("Last indexed:")}      ${c.value(formatTimestamp(summary.lastIndexedAt))}`);
        logCliInfo(logFilePath, "status", `${c.label("Up-to-date files:")}  ${c.num(summary.upToDateFiles)}`);
        logCliInfo(logFilePath, "status", `${c.label("Pending files:")}     ${c.num(summary.pendingFiles)}`);
        logCliInfo(logFilePath, "status", `${c.label("Indexed chunks:")}    ${c.num(summary.storeChunkCount)}`);
        logCliInfo(logFilePath, "status", `${c.label("Expected chunks:")}   ${c.num(summary.manifestExpectedChunks)}`);
        logCliInfo(logFilePath, "status", `${c.label("Watch mode:")}        ${c.dim("off")}`);
        const kiCount = config.retrieval.hybridSearch?.enabled
          ? keywordIndex?.count() ?? 0
          : 0;
        logCliInfo(logFilePath, "status", `${c.label("Keyword index:")}     ${config.retrieval.hybridSearch?.enabled ? c.enabled("enabled") : c.disabled("disabled")} (${c.num(kiCount)} chunks)`);
        if (summary.rebuildRequired) {
          logCliInfo(logFilePath, "status", `${c.label("Rebuild required:")}  ${c.warn("yes")} (manifest missing/corrupt)`);
        }
        if (summary.storeChunkCount > 0 && summary.manifestExpectedChunks > 0 && summary.storeChunkCount < summary.manifestExpectedChunks * 0.5) {
          logCliInfo(logFilePath, "status", `${c.label("Data loss detected:")} ${c.warn("yes")} — store has fewer chunks than expected. Run 'opencode-rag index' to rebuild.`);
        }
        await cleanupContext(ctx);
      } catch (err) {
        const message = (err as Error).message || String(err);
        const logFilePath = path.resolve(process.cwd(), ".opencode", "opencode-rag.log");
        logCliError(logFilePath, "status", `\nStatus check failed: ${message}`, err);
        process.exit(1);
      }
    });
}
