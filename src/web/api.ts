import type { IncomingMessage, ServerResponse } from "node:http";
import { LanceDBStore } from "../vectorstore/lancedb.js";
import { KeywordIndex } from "../retriever/keyword-index.js";

interface ApiResponse {
  status: number;
  body: unknown;
}

function parseQuery(url: string): { path: string; params: URLSearchParams } {
  const [path, queryString] = url.split("?");
  return {
    path: path ?? "/",
    params: new URLSearchParams(queryString ?? ""),
  };
}

export function createApiHandler(store: LanceDBStore, keywordIndex: KeywordIndex) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const url = req.url ?? "/";
    const { path, params } = parseQuery(url);

    let response: ApiResponse;

    try {
      if (path === "/api/stats") {
        response = await handleStats(store);
      } else if (path === "/api/files") {
        response = await handleFiles(store);
      } else if (path === "/api/chunks" && !path.includes("/api/chunks/")) {
        response = await handleChunks(store, params);
      } else if (path.startsWith("/api/chunks/")) {
        const id = path.slice("/api/chunks/".length);
        response = await handleChunkById(store, id);
      } else if (path === "/api/search") {
        response = await handleSearch(keywordIndex, params);
      } else if (path === "/api/compare") {
        response = await handleCompare(store, params);
      } else {
        return false;
      }

      res.writeHead(response.status, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(JSON.stringify(response.body));
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: message }));
      return true;
    }
  };
}

async function handleStats(store: LanceDBStore): Promise<ApiResponse> {
  const totalChunks = await store.count();
  const files = await store.listFiles();

  const langMap = new Map<string, number>();
  for (const file of files) {
    langMap.set(file.language, (langMap.get(file.language) ?? 0) + file.chunkCount);
  }

  const languages = [...langMap.entries()]
    .map(([language, count]) => ({ language, count }))
    .sort((a, b) => b.count - a.count);

  return {
    status: 200,
    body: {
      totalChunks,
      totalFiles: files.length,
      languages,
    },
  };
}

async function handleFiles(store: LanceDBStore): Promise<ApiResponse> {
  const files = await store.listFiles();
  return { status: 200, body: files };
}

async function handleChunks(
  store: LanceDBStore,
  params: URLSearchParams
): Promise<ApiResponse> {
  const offset = parseInt(params.get("offset") ?? "0", 10);
  const limit = parseInt(params.get("limit") ?? "50", 10);
  const langFilter = params.get("lang");
  const fileFilter = params.get("file");

  const allChunks = await store.getChunks(0, 100000);

  let filtered = allChunks;

  if (langFilter) {
    filtered = filtered.filter((c) => c.language === langFilter);
  }

  if (fileFilter) {
    filtered = filtered.filter((c) => c.filePath.startsWith(fileFilter));
  }

  const total = filtered.length;
  const chunks = filtered.slice(offset, offset + limit);

  return {
    status: 200,
    body: { chunks, total, offset, limit },
  };
}

async function handleChunkById(
  store: LanceDBStore,
  id: string
): Promise<ApiResponse> {
  const chunks = await store.getChunks(0, 100000);
  const chunk = chunks.find((c) => c.id === id);

  if (!chunk) {
    return { status: 404, body: { error: "Chunk not found" } };
  }

  return { status: 200, body: chunk };
}

async function handleSearch(
  keywordIndex: KeywordIndex,
  params: URLSearchParams
): Promise<ApiResponse> {
  const query = params.get("q") ?? "";
  const topK = parseInt(params.get("topK") ?? "20", 10);

  if (!query.trim()) {
    return { status: 200, body: { results: [] } };
  }

  const results = keywordIndex.search(query, topK);

  return {
    status: 200,
    body: {
      results: results.map((r) => ({
        chunk: {
          id: r.chunk.id,
          filePath: r.chunk.metadata.filePath,
          startLine: r.chunk.metadata.startLine,
          endLine: r.chunk.metadata.endLine,
          language: r.chunk.metadata.language,
          content: r.chunk.content,
          description: r.chunk.description,
        },
        score: Math.round(r.score * 1000) / 1000,
      })),
    },
  };
}

async function handleCompare(
  store: LanceDBStore,
  params: URLSearchParams
): Promise<ApiResponse> {
  const idsParam = params.get("ids") ?? "";
  const ids = idsParam.split(",").filter(Boolean);

  if (ids.length === 0) {
    return { status: 400, body: { error: "No chunk IDs provided" } };
  }

  const allChunks = await store.getChunks(0, 100000);
  const chunks = allChunks.filter((c) =>
    ids.includes((c as unknown as { id?: string }).id ?? "")
  );

  return { status: 200, body: { chunks } };
}
