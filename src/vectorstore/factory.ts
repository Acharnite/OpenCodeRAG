import type { VectorStore } from "../core/interfaces.js";
import type { RagConfig } from "../core/config.js";
import { LanceDBStore } from "./lancedb.js";
import { InMemoryVectorStore } from "./memory.js";

export function createVectorStore(
  config: RagConfig,
  storePath: string,
  dimension: number,
): VectorStore {
  const provider = config.vectorStore.provider ?? "lancedb";

  if (provider === "lancedb") {
    return new LanceDBStore(storePath, dimension);
  }

  if (provider === "memory") {
    return new InMemoryVectorStore();
  }

  throw new Error(`Unknown vector store provider: ${provider}`);
}
