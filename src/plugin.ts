import type { Plugin, PluginInput, Hooks } from "@opencode-ai/plugin";
import { loadConfig, DEFAULT_CONFIG, type RagConfig } from "./core/config.js";
import { createEmbedder } from "./embedder/factory.js";
import { LanceDBStore } from "./vectorstore/lancedb.js";
import { retrieve } from "./retriever/retriever.js";
import { loadChunkersFromConfig } from "./chunker/loader.js";
import path from "node:path";

let config: RagConfig | null = null;

async function getConfig(directory: string): Promise<RagConfig> {
  if (config) return config;

  for (const loc of ["opencode-rag.json", ".opencode/rag.json"]) {
    try {
      const configPath = path.join(directory, loc);
      const cfg = loadConfig(configPath);
      await loadChunkersFromConfig(cfg, path.dirname(configPath));
      config = cfg;
      return config;
    } catch {
      // continue
    }
  }

  config = DEFAULT_CONFIG;
  return config;
}

function formatContext(
  results: Awaited<ReturnType<typeof retrieve>>
): string {
  if (results.length === 0) return "";

  const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;

  const parts: string[] = [];
  parts.push("\n🧠 **opencode-rag retrieved context** _(context: " + results.length + " chunks, avg relevance: " + avgScore.toFixed(2) + ")_\n");
  parts.push("---\n");

  for (const r of results) {
    const m = r.chunk.metadata;
    parts.push(
      `[${m.filePath}:${m.startLine}-${m.endLine}] (${m.language}, score: ${r.score.toFixed(2)})`
    );
    parts.push("```" + m.language);
    parts.push(r.chunk.content);
    parts.push("```\n");
  }

  parts.push("---\n");
  return parts.join("\n");
}

export const ragPlugin: Plugin = async (
  input: PluginInput,
  _options?: Record<string, unknown>
): Promise<Hooks> => {
  const cfg = await getConfig(input.directory);

  if (!cfg.openCode.enabled) {
    return {};
  }

  const embedder = createEmbedder(cfg);
  const storePath = path.resolve(input.directory, cfg.vectorStore.path);

  return {
    async "chat.message"(_input, output) {
      try {
        const store = new LanceDBStore(storePath);
        const count = await store.count();

        if (count === 0) return; // Nothing indexed yet

        // Extract query text from parts
        const queryTexts: string[] = [];
        for (const part of output.parts) {
          if (part.type === "text" && "text" in part) {
            queryTexts.push((part as { text: string }).text);
          }
        }

        const query = queryTexts.join("\n");
        if (query.trim().length === 0) return;

        const results = await retrieve(query, embedder, store, {
          topK: cfg.retrieval.topK,
        });

        const maxChunks = cfg.openCode.maxContextChunks;
        const topResults = results.slice(0, maxChunks);

        if (topResults.length > 0) {
          const context = formatContext(topResults);

          // Append context as a text part
          output.parts.push({
            type: "text",
            text: context,
          } as never);
        }
      } catch (err) {
        // Silently fail - don't break the user's chat if RAG fails
        console.error("[opencode-rag] chat.message hook error:", err);
      }
    },
  };
};

export default ragPlugin;
