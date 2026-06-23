import type { Chunk } from "../core/interfaces.js";
import pLimit from "p-limit";

export function buildUserMessage(chunk: Chunk): string {
  const parts: string[] = [];

  if (chunk.metadata.filePath) {
    parts.push(`File: ${chunk.metadata.filePath}`);
  }
  if (chunk.metadata.language) {
    parts.push(`Language: ${chunk.metadata.language}`);
  }
  parts.push(`Lines: ${chunk.metadata.startLine}-${chunk.metadata.endLine}`);
  parts.push("");
  parts.push("```" + (chunk.metadata.language || ""));
  parts.push(chunk.content);
  parts.push("```");

  return parts.join("\n");
}

export function buildBatchUserMessage(chunks: Chunk[]): string {
  const first = chunks[0]!;
  const parts: string[] = [];

  if (first.metadata.filePath) {
    parts.push(`File: ${first.metadata.filePath}`);
  }
  if (first.metadata.language) {
    parts.push(`Language: ${first.metadata.language}`);
  }
  parts.push(`Chunks: ${chunks.length}`);
  parts.push("");

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    const lang = chunk.metadata.language || "";
    parts.push(`=== CHUNK ${i} (lines ${chunk.metadata.startLine}-${chunk.metadata.endLine}) ===`);
    parts.push("```" + lang);
    parts.push(chunk.content);
    parts.push("```");
    parts.push("");
  }

  return parts.join("\n");
}

export function parseBatchResponse(text: string, chunks: Chunk[]): Map<string, string> {
  const result = new Map<string, string>();
  const chunkPattern = /^CHUNK\s+(\d+)\s*[):-]?\s*/i;

  const lines = text.split("\n");
  let currentIndex: number | null = null;
  let currentDesc: string[] = [];

  for (const line of lines) {
    const match = chunkPattern.exec(line.trim());
    if (match) {
      if (currentIndex !== null && currentDesc.length > 0) {
        const desc = currentDesc.join(" ").trim();
        if (desc.length > 0 && currentIndex >= 0 && currentIndex < chunks.length) {
          result.set(chunks[currentIndex]!.id, desc);
        }
      }
      currentIndex = parseInt(match[1]!, 10);
      currentDesc = [line.slice(match[0]!.length).trim()];
    } else if (currentIndex !== null) {
      currentDesc.push(line.trim());
    }
  }

  if (currentIndex !== null && currentDesc.length > 0) {
    const desc = currentDesc.join(" ").trim();
    if (desc.length > 0 && currentIndex >= 0 && currentIndex < chunks.length) {
      result.set(chunks[currentIndex]!.id, desc);
    }
  }

  return result;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runBatchDescriptions(
  chunks: Chunk[],
  batchMaxChunks: number,
  batchConcurrency: number,
  executeBatch: (chunks: Chunk[]) => Promise<Map<string, string>>,
  generateSingle: (chunk: Chunk) => Promise<string>,
): Promise<Map<string, string>> {
  if (chunks.length === 1) {
    const desc = await generateSingle(chunks[0]!);
    return new Map([[chunks[0]!.id, desc]]);
  }

  const batches: Chunk[][] = [];
  for (let i = 0; i < chunks.length; i += batchMaxChunks) {
    batches.push(chunks.slice(i, i + batchMaxChunks));
  }

  console.log(`[describer] Batch description: ${chunks.length} chunks in ${batches.length} batches`);

  const result = new Map<string, string>();
  const batchLimit = pLimit(batchConcurrency);
  await Promise.all(
    batches.map((batch, batchIdx) =>
      batchLimit(async () => {
        try {
          const batchResult = await executeBatch(batch);
          console.log(`[describer] Batch ${batchIdx + 1}/${batches.length} complete: ${batchResult.size}/${batch.length} descriptions`);
          for (const [id, desc] of batchResult) {
            result.set(id, desc);
          }
        } catch (err) {
          console.warn(`[describer] Batch ${batchIdx + 1}/${batches.length} failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }),
    ),
  );

  const missingChunks = chunks.filter((c) => !result.has(c.id));
  if (missingChunks.length > 0) {
    console.log(`[describer] Falling back to individual descriptions for ${missingChunks.length} chunks`);
    const fallbackLimit = pLimit(batchConcurrency);
    await Promise.all(
      missingChunks.map((chunk) =>
        fallbackLimit(async () => {
          try {
            const desc = await generateSingle(chunk);
            result.set(chunk.id, desc);
            console.log(`[describer] Individual fallback succeeded for chunk ${chunk.id}`);
          } catch (err) {
            console.warn(`[describer] Individual fallback failed for chunk ${chunk.id}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }),
      ),
    );
  }

  console.log(`[describer] Batch description complete: ${result.size}/${chunks.length} descriptions`);
  return result;
}
