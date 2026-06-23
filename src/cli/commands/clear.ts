/**
 * `clear` command — removes all indexed vector data from the workspace.
 */

import type { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import { c, resolveCliContext, cleanupContext, logCliError, logCliInfo } from "../format.js";
import { manifestPathFor } from "../../core/manifest.js";
import type { CliOptions } from "../types.js";

/**
 * Register the `clear` command on the given Commander program.
 *
 * Clears all indexed chunks from the vector store and prints a confirmation message.
 *
 * @param program - The Commander `Command` instance to register on.
 */
export function registerClearCommand(program: Command): void {
  program
    .command("clear")
    .description("Clear all indexed data")
    .option("-c, --config <path>", "path to config file")
    .action(async (options: CliOptions) => {
      try {
        const cwd = process.cwd();
        let logFilePath = path.resolve(cwd, ".opencode", "opencode-rag.log");
        const ctx = await resolveCliContext(options, logFilePath);
        const { store } = ctx;
        logFilePath = ctx.logFilePath;

        const prevCount = await store.count();

        if (prevCount === 0) {
          logCliInfo(logFilePath, "clear", c.warn("No indexed data to clear."));
        } else {
          logCliInfo(logFilePath, "clear", `${c.label("Clearing")} ${c.num(prevCount)} indexed chunks...`);
        }

        await store.clear();
        await fs.unlink(manifestPathFor(ctx.storePath)).catch(() => {});
        logCliInfo(logFilePath, "clear", `${c.success("Done.")} vector database directory removed.`);
        await cleanupContext(ctx);
      } catch (err) {
        const message = (err as Error).message || String(err);
        const logFilePath = path.resolve(process.cwd(), ".opencode", "opencode-rag.log");
        logCliError(logFilePath, "clear", `\nClear failed: ${message}`, err);
        process.exit(1);
      }
    });
}
