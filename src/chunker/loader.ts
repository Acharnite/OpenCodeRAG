import { registerChunker } from "./factory.js";
import type { RagConfig, ChunkerConfig } from "../core/config.js";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function loadSingleChunker(
  entry: ChunkerConfig,
  configDir: string
): Promise<void> {
  const resolved = path.resolve(configDir, entry.module);
  const moduleUrl = pathToFileURL(resolved).href;
  try {
    const mod = await import(moduleUrl);

    const chunker = mod.default ?? mod;
    if (typeof chunker.chunk !== "function") {
      console.warn(
        `[opencode-rag] Module "${entry.module}" does not export a valid Chunker (no .chunk() method) — skipping`
      );
      return;
    }

    registerChunker(chunker, entry.extensions);
  } catch (err) {
    console.warn(
      `[opencode-rag] Failed to load chunker module "${entry.module}":`,
      (err as Error).message
    );
  }
}

export async function loadChunkersFromConfig(
  config: RagConfig,
  configDir: string
): Promise<void> {
  if (!config.chunkers || config.chunkers.length === 0) return;

  for (const entry of config.chunkers) {
    await loadSingleChunker(entry, configDir);
  }
}
