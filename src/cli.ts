/**
 * Backwards-compatibility shim — re-exports the public API from the new
 * `cli/` module tree so existing tests and external consumers that import
 * from `../cli.js` continue to work unchanged.
 *
 * The actual CLI entry point is now `cli/index.ts` (compiled to `dist/cli/index.js`).
 */

export { runCli, shouldAutoRunCli } from "./cli/index.js";
export { removeStaleGlobalPluginRegistrations } from "./cli/commands/init-helpers.js";
