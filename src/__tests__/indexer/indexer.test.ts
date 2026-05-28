import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { DEFAULT_CONFIG, type RagConfig } from "../../core/config.js";
import { loadManifest } from "../../core/manifest.js";
import {
  createWatchPassScheduler,
  getIndexStatusSummary,
  runIndexPass,
} from "../../indexer.js";
import type { EmbeddingProvider } from "../../core/interfaces.js";
import { LanceDBStore } from "../../vectorstore/lancedb.js";

class TestEmbedder implements EmbeddingProvider {
  readonly name = "test";

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text, index) => [text.length, index + 1, 0.5, -0.5]);
  }
}

async function makeTempDir(name: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), `${name}-`));
}

async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf-8");
}

function testConfig(): RagConfig {
  return {
    ...DEFAULT_CONFIG,
    indexing: {
      ...DEFAULT_CONFIG.indexing,
      includeExtensions: [".ts"],
      excludeDirs: ["node_modules", ".git", ".opencode"],
    },
  };
}

describe("indexer", () => {
  let workspaceDir: string;
  let storeDir: string;
  let store: LanceDBStore;
  const embedder = new TestEmbedder();

  beforeEach(async () => {
    workspaceDir = await makeTempDir("indexer-workspace");
    storeDir = await makeTempDir("indexer-store");
    store = new LanceDBStore(storeDir, 4);
  });

  it("indexes new files and records them in the manifest", async () => {
    await writeFile(path.join(workspaceDir, "src", "a.ts"), "function alpha() { return 1; }\n");
    await writeFile(path.join(workspaceDir, "src", "b.ts"), "function beta() { return 2; }\n");

    const stats = await runIndexPass({
      cwd: workspaceDir,
      storePath: storeDir,
      config: testConfig(),
      store,
      embedder,
    });

    assert.equal(stats.newFiles, 2);
    assert.equal(stats.modifiedFiles, 0);
    assert.equal(stats.unchangedFiles, 0);
    assert.equal(stats.deletedFiles, 0);
    assert.equal(stats.finalCount, 2);

    const manifest = await loadManifest(storeDir);
    assert.equal(manifest.status, "ok");
    assert.equal(Object.keys(manifest.manifest.files).length, 2);
  });

  it("skips unchanged files and updates modified or deleted files", async () => {
    const fileA = path.join(workspaceDir, "src", "a.ts");
    const fileB = path.join(workspaceDir, "src", "b.ts");
    const fileC = path.join(workspaceDir, "src", "c.ts");

    await writeFile(fileA, "function alpha() { return 1; }\n");
    await writeFile(fileB, "function beta() { return 2; }\n");
    await runIndexPass({
      cwd: workspaceDir,
      storePath: storeDir,
      config: testConfig(),
      store,
      embedder,
    });

    await writeFile(fileA, "function alpha() { return 10; }\n");
    await fs.unlink(fileB);
    await writeFile(fileC, "function gamma() { return 3; }\n");

    const stats = await runIndexPass({
      cwd: workspaceDir,
      storePath: storeDir,
      config: testConfig(),
      store,
      embedder,
    });

    assert.equal(stats.newFiles, 1);
    assert.equal(stats.modifiedFiles, 1);
    assert.equal(stats.deletedFiles, 1);
    assert.equal(stats.unchangedFiles, 0);
    assert.equal(stats.finalCount, 2);
  });

  it("removes empty files from the index", async () => {
    const filePath = path.join(workspaceDir, "src", "empty.ts");
    await writeFile(filePath, "function keep() { return 1; }\n");

    await runIndexPass({
      cwd: workspaceDir,
      storePath: storeDir,
      config: testConfig(),
      store,
      embedder,
    });

    await writeFile(filePath, "   \n");
    const stats = await runIndexPass({
      cwd: workspaceDir,
      storePath: storeDir,
      config: testConfig(),
      store,
      embedder,
    });

    assert.equal(stats.skippedEmptyFiles, 1);
    assert.equal(stats.removedFiles, 1);
    assert.equal(await store.count(), 0);
  });

  it("reports pending files in status summary", async () => {
    const filePath = path.join(workspaceDir, "src", "a.ts");
    await writeFile(filePath, "function alpha() { return 1; }\n");

    await runIndexPass({
      cwd: workspaceDir,
      storePath: storeDir,
      config: testConfig(),
      store,
      embedder,
    });

    await writeFile(filePath, "function alpha() { return 2; }\n");

    const summary = await getIndexStatusSummary(
      workspaceDir,
      storeDir,
      testConfig(),
      store
    );

    assert.equal(summary.manifestStatus, "ok");
    assert.equal(summary.upToDateFiles, 0);
    assert.equal(summary.pendingFiles, 1);
    assert.equal(summary.manifestEntries, 1);
  });

  it("rebuilds safely when manifest is missing but store has data", async () => {
    const filePath = path.join(workspaceDir, "src", "a.ts");
    await writeFile(filePath, "function alpha() { return 1; }\n");

    await runIndexPass({
      cwd: workspaceDir,
      storePath: storeDir,
      config: testConfig(),
      store,
      embedder,
    });

    await fs.unlink(path.join(storeDir, "manifest.json"));
    const stats = await runIndexPass({
      cwd: workspaceDir,
      storePath: storeDir,
      config: testConfig(),
      store,
      embedder,
    });

    assert.equal(stats.rebuildPerformed, true);
    assert.equal(stats.newFiles, 1);
    assert.equal(await store.count(), 1);
  });

  it("queues one follow-up watch pass while a pass is running", async () => {
    let runs = 0;
    let release = () => {};

    const scheduler = createWatchPassScheduler(
      async () => {
        runs++;
        if (runs === 1) {
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
      },
      () => {
        assert.fail("unexpected watch scheduler error");
      },
      10
    );

    scheduler.notifyChange();
    await delay(25);
    scheduler.notifyChange();
    scheduler.notifyChange();

    release();
    await scheduler.waitForIdle();
    scheduler.close();

    assert.equal(runs, 2);
  });
});
