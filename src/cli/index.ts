/**
 * CLI entry point — creates the Commander program, wires all command modules,
 * and handles auto-run detection for symlinked binaries.
 *
 * This file is the compiled output target (`dist/cli.js`) referenced by
 * the `bin` entry in `package.json`.
 */

import { Command } from "commander";
import { realpathSync } from "node:fs";
import { getPackageMetadata } from "./helpers.js";
import {
  registerIndexCommand,
  registerQueryCommand,
  registerClearCommand,
  registerStatusCommand,
  registerListCommand,
  registerShowCommand,
  registerDumpCommand,
  registerInitCommand,
  registerUiCommand,
  registerMcpCommand,
  registerUpdateCommand,
  registerEvalSessionsCommand,
  registerEvalAnalyzeCommand,
  registerEvalCompareCommand,
  registerDescribeImageCommand,
} from "./commands/index.js";

/**
 * The top-level Commander program instance that defines the `opencode-rag` CLI.
 *
 * All command modules register their sub-commands against this instance during
 * module initialization. The program is parsed either on auto-run detection or
 * when {@link runCli} is called programmatically.
 */
const program = new Command();

program
  .name("opencode-rag")
  .description("Local-first RAG semantic code search");

registerIndexCommand(program);
registerQueryCommand(program);
registerClearCommand(program);
registerStatusCommand(program);
registerListCommand(program);
registerShowCommand(program);
registerDumpCommand(program);
registerDescribeImageCommand(program);
registerUiCommand(program);
registerMcpCommand(program);
registerUpdateCommand(program);
registerEvalSessionsCommand(program);
registerEvalAnalyzeCommand(program);
registerEvalCompareCommand(program);
registerInitCommand(program);

// ── Auto-run detection ──────────────────────────────────────────

/**
 * Determine whether the CLI should auto-run for the current module.
 *
 * Resolves the first argv entry so symlinked binaries compare against the
 * real file path, and returns `false` if the path cannot be resolved.
 *
 * @param moduleUrl - The `import.meta.url` of the CLI entry module.
 * @param argv1 - The first CLI argument (`process.argv[1]`), typically the script path.
 * @returns `true` if the resolved argv path matches the module URL.
 */
export function shouldAutoRunCli(moduleUrl: string, argv1?: string): boolean {
  if (!argv1) {
    return false;
  }

  try {
    const resolvedPath = realpathSync(argv1).replace(/\\/g, "/");
    const normalizedUrl = moduleUrl.replace(/\\/g, "/");
    return normalizedUrl === `file://${resolvedPath}` || normalizedUrl.endsWith(`/${resolvedPath}`) || normalizedUrl.includes(resolvedPath);
  } catch {
    return false;
  }
}

if (shouldAutoRunCli(import.meta.url, process.argv[1])) {
  void program.parseAsync(process.argv);
} else {
  // Fallback: if the module appears to be running as a CLI and not being
  // imported as a library, parse the arguments anyway. When invoked with no
  // arguments Commander will display the help text.
  const commands = ['init', 'index', 'query', 'clear', 'status', 'list', 'show', 'dump', 'describe-image', 'ui', 'mcp', 'update', 'eval:sessions', 'eval:analyze', 'eval:compare'];
  const cmd = process.argv[2];
  if ((process.argv.length <= 2) || (cmd && commands.includes(cmd.toLowerCase()))) {
    void program.parseAsync(process.argv);
  }
}

/**
 * Programmatically invoke the CLI with custom arguments.
 *
 * This is the public API entry point for running the CLI from code
 * (e.g. from tests or the library export).
 *
 * @param argv - The argument vector to parse (defaults to `process.argv`).
 */
export async function runCli(argv: string[] = process.argv): Promise<void> {
  await program.parseAsync(argv);
}
