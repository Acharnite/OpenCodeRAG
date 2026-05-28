import type { EmbeddingProvider, VectorStore, SearchResult } from "../core/interfaces.js";

export interface RetrieveOptions {
  topK?: number;
}

export async function retrieve(
  query: string,
  embedder: EmbeddingProvider,
  store: VectorStore,
  options: RetrieveOptions = {}
): Promise<SearchResult[]> {
  const topK = options.topK ?? 10;

  const embeddings = await embedder.embed([query]);
  const embedding = embeddings[0];
  if (!embedding || embedding.length === 0) {
    return [];
  }

  return store.search(embedding, topK);
}
