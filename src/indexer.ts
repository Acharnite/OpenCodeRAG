import fs from "node:fs/promises";
import path from "node:path";
import pLimit from "p-limit";
import { chunkFile } from "./chunker/factory.js";
import { extractPdfText } from "./chunker/pdf.js";
import { uuid } from "./chunker/uuid.js";
import { extractDocxText } from "./chunker/docx.js";
import { extractDocText } from "./chunker/doc.js";
import { extractExcelText } from "./chunker/excel.js";
import { createImageVisionProvider, getMimeType, SUPPORTED_IMAGE_EXTENSIONS } from "./chunker/image.js";
import type { RagConfig } from "./core/config.js";
import type { ImageVisionProvider } from "./chunker/image.js";
import {
  computeFileHash,
  loadManifest,
  manifestPathFor,
  normalizeFilePath,
  saveManifest,
} from "./core/manifest.js";
import type { Chunk, DescriptionProvider, EmbeddingProvider, KeywordIndex, VectorStore } from "./core/interfaces.js";
import { embedBatch } from "./embedder/factory.js";

export interface IndexRunStats {
  totalFiles: number;
  newFiles: number;
  modifiedFiles: number;
  unchangedFiles: number;
  deletedFiles: number;
  removedFiles: number;
  skippedEmptyFiles: number;
  skippedSmallFiles: number;
  totalChunks: number;
  finalCount: number;
  manifestStatus: "ok" | "missing" | "corrupt";
  rebuildPerformed: boolean;
  batchesFlushed: number;
}

export interface IndexStatusSummary {
  manifestStatus: "ok" | "missing" | "corrupt";
  manifestEntries: number;
  upToDateFiles: number;
  pendingFiles: number;
  lastIndexedAt?: number;
  rebuildRequired: boolean;
}

export interface WorkspaceFile {
  filePath: string;
  normalizedPath: string;
  content: string;
  hash: string;
  isEmpty: boolean;
  isTooSmall: boolean;
}

interface Logger {
  info(message: string): void;
  warn(message: string): void;
}

export interface RunIndexPassOptions {
  cwd: string;
  storePath: string;
  config: RagConfig;
  store: VectorStore;
  embedder: EmbeddingProvider;
  force?: boolean;
  logger?: Partial<Logger>;
  keywordIndex?: KeywordIndex;
  descriptionProvider?: DescriptionProvider;
}

export interface WatchPassScheduler {
  notifyChange(): void;
  waitForIdle(): Promise<void>;
  close(): void;
}

function createLogger(logger?: Partial<Logger>): Logger {
  return {
    info: logger?.info ?? (() => {}),
    warn: logger?.warn ?? (() => {}),
  };
}

const FILE_TYPE_LABELS: Record<string, string> = {
  ".pdf": "pdf",
  ".docx": "docx",
  ".doc": "doc",
  ".xls": "excel",
  ".xlsx": "excel",
  ".md": "markdown",
  ".mdx": "markdown",
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",
  ".xml": "xml",
  ".html": "html",
  ".css": "css",
  ".csv": "csv",
  ".txt": "text",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".py": "python",
  ".java": "java",
  ".go": "go",
  ".rs": "rust",
  ".c": "c",
  ".cpp": "cpp",
  ".h": "c",
  ".hpp": "cpp",
  ".cs": "csharp",
  ".rb": "ruby",
  ".php": "php",
  ".swift": "swift",
  ".kt": "kotlin",
  ".sql": "sql",
  ".sh": "bash",
  ".bash": "bash",
  ".ps1": "powershell",
  ".dockerfile": "dockerfile",
  ".tex": "latex",
  ".razor": "razor",
  ".sln": "sln",
  ".ini": "ini",
};

function classifyContentType(relPath: string): string {
  const lower = relPath.toLowerCase();
  const parts = lower.split("/");
  const basename = parts[parts.length - 1] ?? "";

  if (basename.startsWith("readme")) return "readme";
  if (/^(test|tests|__tests__|spec|specs|__spec__)\b/.test(basename) || /\.(test|spec)\.[^.]+$/.test(basename)) return "test";
  if (parts.some((p) => /^(docs?|documentation|guides?|manual|tutorial|tutorial)s?$/.test(p))) return "documentation";
  if (parts.some((p) => /^(config|conf|configuration|settings|env)s?$/.test(p)) || /\.(config|conf)\.[^.]+$/.test(basename)) return "configuration";
  if (parts.some((p) => /^(src|source|lib|packages?|modules?)$/.test(p))) return "source";
  if (parts.some((p) => /^(ci|cd|\.github|\.gitlab|build|deploy|scripts?)$/.test(p))) return "build";
  if (parts.some((p) => /^(examples?|samples?|demo|demos?)$/.test(p))) return "example";
  return "";
}

function extractDocumentTitle(content: string, filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".md" || ext === ".mdx") {
    const match = content.match(/^#{1,3}\s+(.+)$/m);
    if (match?.[1]) return match[1].trim().slice(0, 80);
  }
  const basename = path.basename(filePath, ext);
  return basename
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .slice(0, 80);
}

function buildFileMetadataHeader(filePath: string, cwd: string, content: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const relPath = path.relative(cwd, filePath).replace(/\\/g, "/");
  const fileType = FILE_TYPE_LABELS[ext] ?? ext.slice(1);
  const dirParts = relPath.split("/");
  dirParts.pop();
  const topDir = dirParts[0] ?? "";
  const contentType = classifyContentType(relPath);
  const title = extractDocumentTitle(content, filePath);

  const parts: string[] = [];
  if (fileType) parts.push(`[${fileType}]`);
  if (topDir) parts.push(`[${topDir}]`);
  if (contentType) parts.push(`[${contentType}]`);
  if (title) parts.push(title);

  return parts.length > 0 ? parts.join(" ") : "";
}

export async function walkFiles(
  dir: string,
  extensions: Set<string>,
  excludeDirs: Set<string>
): Promise<string[]> {
  const results: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (excludeDirs.has(entry.name)) continue;
      if (entry.name.startsWith(".") && !extensions.size) continue;
      results.push(...(await walkFiles(fullPath, extensions, excludeDirs)));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      const basename = entry.name.toLowerCase();
      if (extensions.has(ext) || extensions.has(basename)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

function isImageFile(fp: string, extensions: Set<string> | string[]): boolean {
  const lower = fp.toLowerCase();
  for (const ext of extensions) {
    if (lower.endsWith(ext.toLowerCase())) return true;
  }
  return false;
}

function imageExtensionSet(extensions: string[]): Set<string> {
  return new Set(extensions.map((e) => e.toLowerCase()));
}

export async function scanWorkspace(cwd: string, config: RagConfig, logger?: Logger): Promise<WorkspaceFile[]> {
  const extensions = new Set(config.indexing.includeExtensions);

  let imageVisionProvider: ImageVisionProvider | null = null;
  const imageCfg = config.imageDescription;
  if (imageCfg?.enabled) {
    for (const ext of SUPPORTED_IMAGE_EXTENSIONS) {
      extensions.add(ext.toLowerCase());
    }
    imageVisionProvider = createImageVisionProvider(imageCfg);
  }

  const files = await walkFiles(
    cwd,
    extensions,
    new Set(config.indexing.excludeDirs)
  );

  const isPdf = (fp: string) => fp.toLowerCase().endsWith(".pdf");
  const isDocx = (fp: string) => fp.toLowerCase().endsWith(".docx");
  const isDoc = (fp: string) => fp.toLowerCase().endsWith(".doc");
  const isExcel = (fp: string) => { const e = fp.toLowerCase(); return e.endsWith(".xls") || e.endsWith(".xlsx"); };

  const minSize = config.indexing.minFileSizeBytes ?? 0;
  const workspaceFiles: WorkspaceFile[] = [];
  for (const filePath of files) {
    let content: string;
    if (isPdf(filePath)) {
      const buffer = await fs.readFile(filePath);
      try {
        content = await extractPdfText(buffer);
      } catch (err) {
        content = "";
      }
    } else if (isDocx(filePath)) {
      const buffer = await fs.readFile(filePath);
      try {
        content = await extractDocxText(buffer);
      } catch (err) {
        content = "";
      }
    } else if (isDoc(filePath)) {
      const buffer = await fs.readFile(filePath);
      try {
        content = await extractDocText(buffer);
      } catch (err) {
        content = "";
      }
    } else if (isExcel(filePath)) {
      const buffer = await fs.readFile(filePath);
      try {
        content = await extractExcelText(buffer);
      } catch (err) {
        content = "";
      }
    } else if (imageVisionProvider && isImageFile(filePath, SUPPORTED_IMAGE_EXTENSIONS)) {
      const buffer = await fs.readFile(filePath);
      try {
        const ext = path.extname(filePath).toLowerCase();
        const mimeType = getMimeType(ext);
        const b64 = buffer.toString("base64");
        const prompt = imageCfg!.prompt;
        content = await imageVisionProvider.describeImage(b64, mimeType, prompt);
      } catch (err) {
        logger?.warn(`  ${filePath} (vision failed: ${(err as Error).message})`);
        content = "";
      }
    } else {
      content = await fs.readFile(filePath, "utf-8");
    }
    const byteLength = Buffer.byteLength(content, "utf-8");
    workspaceFiles.push({
      filePath,
      normalizedPath: normalizeFilePath(filePath),
      content,
      hash: computeFileHash(content),
      isEmpty: content.trim().length === 0,
      isTooSmall: !content.trim().length === false && byteLength < minSize,
    });
  }

  return workspaceFiles;
}

function createIndexStats(totalFiles: number, manifestStatus: IndexRunStats["manifestStatus"]): IndexRunStats {
  return {
    totalFiles,
    newFiles: 0,
    modifiedFiles: 0,
    unchangedFiles: 0,
    deletedFiles: 0,
    removedFiles: 0,
    skippedEmptyFiles: 0,
    skippedSmallFiles: 0,
    totalChunks: 0,
    finalCount: 0,
    manifestStatus,
    rebuildPerformed: false,
    batchesFlushed: 0,
  };
}

export async function runIndexPass(options: RunIndexPassOptions): Promise<IndexRunStats> {
  const logger = createLogger(options.logger);
  const workspaceFiles = await scanWorkspace(options.cwd, options.config, logger);
  const loadResult = await loadManifest(options.storePath);
  const manifest = loadResult.manifest;
  let manifestStatus = loadResult.status;
  let rebuildPerformed = false;

  const existingCount = await options.store.count();
  if (options.force || (manifestStatus !== "ok" && existingCount > 0)) {
    await options.store.clear();
    options.keywordIndex?.clear();
    for (const key of Object.keys(manifest.files)) {
      delete manifest.files[key];
    }
    manifest.lastIndexedAt = undefined;
    rebuildPerformed = existingCount > 0 || Boolean(options.force);
    if (manifestStatus !== "ok" && existingCount > 0) {
      logger.warn("Manifest missing or corrupt; rebuilding full index.");
    }
    manifestStatus = options.force ? "missing" : manifestStatus;
  }

  const stats = createIndexStats(workspaceFiles.length, manifestStatus);
  stats.rebuildPerformed = rebuildPerformed;

  const currentPaths = new Set(workspaceFiles.map((file) => file.normalizedPath));
  for (const indexedPath of Object.keys(manifest.files)) {
    if (!currentPaths.has(indexedPath)) {
      await options.store.deleteByFilePath(indexedPath);
      options.keywordIndex?.removeByFilePath(indexedPath);
      delete manifest.files[indexedPath];
      stats.deletedFiles++;
    }
  }

  const limit = pLimit(options.config.indexing.concurrency);

  interface WorkerResult {
    normalizedPath: string;
    hash: string;
    chunkCount: number;
    fileLabel: string;
    isNew: boolean;
    isModified: boolean;
    isUnchanged: boolean;
    isEmpty: boolean;
    isTooSmall: boolean;
    isRemoved: boolean;
    hadChunks: boolean;
  }

  const workerResults = await Promise.all(
    workspaceFiles.map((file) =>
      limit(async (): Promise<WorkerResult> => {
        const previous = manifest.files[file.normalizedPath];
        const fileLabel = path.relative(options.cwd, file.filePath);

        if (file.isEmpty) {
          if (previous) {
            await options.store.deleteByFilePath(file.normalizedPath);
            options.keywordIndex?.removeByFilePath(file.normalizedPath);
            logger.info(`  ${fileLabel} (empty, removed from index)`);
            return { normalizedPath: file.normalizedPath, hash: file.hash, chunkCount: 0, fileLabel, isNew: false, isModified: false, isUnchanged: false, isEmpty: true, isTooSmall: false, isRemoved: true, hadChunks: false };
          }
          logger.info(`  ${fileLabel} (empty, skipped)`);
          return { normalizedPath: file.normalizedPath, hash: file.hash, chunkCount: 0, fileLabel, isNew: false, isModified: false, isUnchanged: false, isEmpty: true, isTooSmall: false, isRemoved: false, hadChunks: false };
        }

        if (file.isTooSmall) {
          if (previous) {
            await options.store.deleteByFilePath(file.normalizedPath);
            options.keywordIndex?.removeByFilePath(file.normalizedPath);
            logger.info(`  ${fileLabel} (too small, removed from index)`);
            return { normalizedPath: file.normalizedPath, hash: file.hash, chunkCount: 0, fileLabel, isNew: false, isModified: false, isUnchanged: false, isEmpty: false, isTooSmall: true, isRemoved: true, hadChunks: false };
          }
          logger.info(`  ${fileLabel} (too small, skipped)`);
          return { normalizedPath: file.normalizedPath, hash: file.hash, chunkCount: 0, fileLabel, isNew: false, isModified: false, isUnchanged: false, isEmpty: false, isTooSmall: true, isRemoved: false, hadChunks: false };
        }

        if (previous && previous.hash === file.hash) {
          logger.info(`  ${fileLabel} (unchanged)`);
          return { normalizedPath: file.normalizedPath, hash: file.hash, chunkCount: 0, fileLabel, isNew: false, isModified: false, isUnchanged: true, isEmpty: false, isTooSmall: false, isRemoved: false, hadChunks: false };
        }

        let isModified = false;
        if (previous) {
          await options.store.deleteByFilePath(file.normalizedPath);
          options.keywordIndex?.removeByFilePath(file.normalizedPath);
          isModified = true;
        }

        let chunks;

        // Images: 1 image → 1 chunk (description as content, no paragraph splitting)
        if (isImageFile(file.filePath, SUPPORTED_IMAGE_EXTENSIONS) && file.content.trim().length > 0) {
          const imgExt = path.extname(file.filePath).toLowerCase();
          const imgRelPath = path.relative(options.cwd, file.filePath).replace(/\\/g, "/");
          const metaHeader = `[image] [${imgExt.slice(1)}] [${imgRelPath}]`;
          chunks = [{
            id: uuid(),
            content: metaHeader + " " + file.content,
            metadata: {
              filePath: file.filePath,
              startLine: 1,
              endLine: 1,
              language: "image",
              contentType: "image",
            },
          }];
        } else {
          chunks = await chunkFile(file.filePath, file.content, options.config.chunking?.nodeTypes).catch((err) => {
            logger.warn(`  ${fileLabel} (chunking failed: ${(err as Error).message})`);
            return null;
          });
        }

        if (chunks === null || chunks.length === 0) {
          if (chunks === null) {
            // Chunking failed — keep previous index state if file was indexed before
            if (previous) {
              return { normalizedPath: file.normalizedPath, hash: file.hash, chunkCount: previous.chunkCount, fileLabel, isNew: false, isModified: false, isUnchanged: true, isEmpty: false, isTooSmall: false, isRemoved: false, hadChunks: true };
            }
            return { normalizedPath: file.normalizedPath, hash: file.hash, chunkCount: 0, fileLabel, isNew: false, isModified: false, isUnchanged: false, isEmpty: false, isTooSmall: false, isRemoved: true, hadChunks: false };
          }
          logger.info(`  ${fileLabel} (0 chunks, removed from index)`);
          return { normalizedPath: file.normalizedPath, hash: file.hash, chunkCount: 0, fileLabel, isNew: false, isModified: false, isUnchanged: false, isEmpty: false, isTooSmall: false, isRemoved: true, hadChunks: false };
        }

        options.keywordIndex?.addChunks(chunks);

        try {
        const docPrefix = options.config.embedding.documentPrefix ?? "";
        const relPath = path.relative(options.cwd, file.filePath).replace(/\\/g, "/");
        const isImage = isImageFile(file.filePath, SUPPORTED_IMAGE_EXTENSIONS);
        const metaHeader = isImage
          ? ""
          : buildFileMetadataHeader(file.filePath, options.cwd, file.content);
        const textToEmbed: string[] = [];

        if (options.descriptionProvider) {
          let descriptionMap: Map<string, string> | null = null;

          if (chunks.length > 1) {
            try {
              descriptionMap = await options.descriptionProvider.generateBatchDescriptions(chunks);
            } catch (err) {
              logger.warn(`Batch description failed, falling back to individual: ${(err as Error).message}`);
            }
          }

          for (const chunk of chunks) {
            const batchDesc = descriptionMap?.get(chunk.id);
            if (isImage) {
              const imgExt = path.extname(file.filePath).toLowerCase();
              chunk.description = batchDesc && batchDesc.trim().length > 0
                ? batchDesc
                : `image file (${imgExt.slice(1)}): ${relPath}`;
              textToEmbed.push(docPrefix + relPath + "\n\n[Content type: image file]\n\n" + chunk.description + "\n\n" + chunk.content);
            } else if (batchDesc && batchDesc.trim().length > 0) {
              chunk.description = batchDesc;
              textToEmbed.push(docPrefix + relPath + "\n\n" + metaHeader + "\n\n" + chunk.description + "\n\n" + chunk.content);
            } else {
              try {
                chunk.description = await options.descriptionProvider.generateDescription(chunk);
                textToEmbed.push(docPrefix + relPath + "\n\n" + metaHeader + "\n\n" + chunk.description + "\n\n" + chunk.content);
              } catch (err) {
                logger.warn(`Description generation failed for ${chunk.id}, falling back to content: ${(err as Error).message}`);
                textToEmbed.push(docPrefix + relPath + "\n\n" + metaHeader + "\n\n" + chunk.content);
              }
            }
          }
        } else {
          for (const chunk of chunks) {
            if (isImage) {
              const imgExt = path.extname(file.filePath).toLowerCase();
              chunk.description = `image file (${imgExt.slice(1)}): ${relPath}`;
              textToEmbed.push(docPrefix + relPath + "\n\n[Content type: image file]\n\n" + chunk.description + "\n\n" + chunk.content);
            } else {
              chunk.description = `lines ${chunk.metadata.startLine}-${chunk.metadata.endLine}, ${chunk.metadata.language}`;
              textToEmbed.push(docPrefix + relPath + "\n\n" + metaHeader + "\n\n" + chunk.description + "\n\n" + chunk.content);
            }
          }
        }

        const embeddings = await embedBatch(options.embedder, textToEmbed, options.config.indexing.embedBatchSize, "document");

        for (let i = 0; i < chunks.length; i++) {
          const emb = embeddings[i];
          if (Array.isArray(emb) && emb.length > 0 && typeof emb[0] === "number") {
            chunks[i]!.embedding = emb as number[];
          } else {
            chunks[i]!.embedding = undefined;
          }
        }

        const validChunks = chunks.filter((c) => c.embedding && c.embedding.length > 0);
        if (validChunks.length > 0) {
          await options.store.addChunks(validChunks);
        }

        logger.info(`  ${fileLabel} (${chunks.length} chunks${isModified ? ", modified" : ", new"})`);

        return {
          normalizedPath: file.normalizedPath,
          hash: file.hash,
          chunkCount: chunks.length,
          fileLabel,
          isNew: !isModified && !previous,
          isModified,
          isUnchanged: false,
          isEmpty: false,
          isTooSmall: false,
          isRemoved: false,
          hadChunks: chunks.length > 0,
        };
        } catch (err) {
          logger.warn(`  ${fileLabel} (embed/store failed: ${(err as Error).message})`);
          if (previous) {
            return { normalizedPath: file.normalizedPath, hash: file.hash, chunkCount: previous.chunkCount, fileLabel, isNew: false, isModified: false, isUnchanged: true, isEmpty: false, isTooSmall: false, isRemoved: false, hadChunks: true };
          }
          return { normalizedPath: file.normalizedPath, hash: file.hash, chunkCount: 0, fileLabel, isNew: false, isModified: false, isUnchanged: false, isEmpty: false, isTooSmall: false, isRemoved: true, hadChunks: false };
        }
      })
    )
  );

  for (const result of workerResults) {
    if (result.isEmpty) {
      stats.skippedEmptyFiles++;
      if (result.isRemoved) {
        delete manifest.files[result.normalizedPath];
        stats.removedFiles++;
      }
      continue;
    }
    if (result.isTooSmall) {
      stats.skippedSmallFiles++;
      if (result.isRemoved) {
        delete manifest.files[result.normalizedPath];
        stats.removedFiles++;
      }
      continue;
    }
    if (result.isUnchanged) {
      stats.unchangedFiles++;
      continue;
    }
    if (result.isRemoved) {
      delete manifest.files[result.normalizedPath];
      stats.removedFiles++;
      continue;
    }
    if (result.isModified) {
      stats.modifiedFiles++;
    } else if (result.isNew) {
      stats.newFiles++;
    }
    if (result.chunkCount > 0) {
      manifest.files[result.normalizedPath] = {
        hash: result.hash,
        chunkCount: result.chunkCount,
        indexedAt: Date.now(),
      };
      stats.totalChunks += result.chunkCount;
      stats.batchesFlushed++;
    }
  }

  manifest.lastIndexedAt = Date.now();
  await saveManifest(options.storePath, manifest);
  await options.keywordIndex?.save(options.storePath);
  stats.finalCount = await options.store.count();
  return stats;
}

export async function getIndexStatusSummary(
  cwd: string,
  storePath: string,
  config: RagConfig,
  store: VectorStore
): Promise<IndexStatusSummary> {
  const workspaceFiles = await scanWorkspace(cwd, config);
  const loadResult = await loadManifest(storePath);
  const storeCount = await store.count();

  if (loadResult.status !== "ok") {
    return {
      manifestStatus: loadResult.status,
      manifestEntries: 0,
      upToDateFiles: 0,
      pendingFiles: workspaceFiles.length,
      rebuildRequired: storeCount > 0,
    };
  }

  const manifest = loadResult.manifest;
  const currentPaths = new Set(workspaceFiles.map((file) => file.normalizedPath));
  let upToDateFiles = 0;
  let pendingFiles = 0;

  for (const file of workspaceFiles) {
    const previous = manifest.files[file.normalizedPath];
    if (file.isEmpty || file.isTooSmall) {
      if (previous) pendingFiles++;
      continue;
    }

    if (previous && previous.hash === file.hash) {
      upToDateFiles++;
    } else {
      pendingFiles++;
    }
  }

  for (const indexedPath of Object.keys(manifest.files)) {
    if (!currentPaths.has(indexedPath)) {
      pendingFiles++;
    }
  }

  return {
    manifestStatus: loadResult.status,
    manifestEntries: Object.keys(manifest.files).length,
    upToDateFiles,
    pendingFiles,
    lastIndexedAt: manifest.lastIndexedAt,
    rebuildRequired: false,
  };
}

export function createWatchPassScheduler(
  runPass: () => Promise<void>,
  onError: (error: unknown) => void,
  debounceMs: number = 300
): WatchPassScheduler {
  let timer: NodeJS.Timeout | null = null;
  let running = false;
  let rerunRequested = false;
  let closed = false;
  const waiters: Array<() => void> = [];

  function resolveWaiters(): void {
    if (running || timer || rerunRequested) return;
    while (waiters.length > 0) {
      waiters.shift()?.();
    }
  }

  function schedule(): void {
    if (closed) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void execute();
    }, debounceMs);
  }

  async function execute(): Promise<void> {
    if (closed) return;
    if (running) {
      rerunRequested = true;
      return;
    }

    running = true;
    try {
      await runPass();
    } catch (error) {
      onError(error);
    } finally {
      running = false;
      if (rerunRequested) {
        rerunRequested = false;
        schedule();
      } else {
        resolveWaiters();
      }
    }
  }

  return {
    notifyChange() {
      if (closed) return;
      if (running) {
        rerunRequested = true;
        return;
      }
      schedule();
    },
    waitForIdle() {
      if (!running && !timer && !rerunRequested) {
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        waiters.push(resolve);
      });
    },
    close() {
      closed = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      resolveWaiters();
    },
  };
}

export function createWatchIgnore(
  cwd: string,
  config: RagConfig,
  storePath: string
): (watchedPath: string) => boolean {
  const manifestPath = manifestPathFor(storePath);
  const excludeDirs = new Set(config.indexing.excludeDirs);

  return (watchedPath: string): boolean => {
    const resolved = path.resolve(watchedPath);
    if (resolved.startsWith(storePath)) return true;
    if (resolved === manifestPath) return true;

    const relative = path.relative(cwd, resolved);
    if (!relative || relative.startsWith("..")) return false;
    const segments = relative.split(path.sep);
    return segments.some((segment) => excludeDirs.has(segment));
  };
}
