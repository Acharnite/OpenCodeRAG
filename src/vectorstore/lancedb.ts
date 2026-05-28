import * as lancedb from "@lancedb/lancedb";
import type { Connection, Table } from "@lancedb/lancedb";
import type { VectorStore, Chunk, SearchResult } from "../core/interfaces.js";
import { normalizeFilePath } from "../core/manifest.js";

const TABLE_NAME = "chunks";
const VECTOR_COLUMN = "embedding";

interface ChunkRow {
  id: string;
  content: string;
  embedding: number[];
  filePath: string;
  startLine: number;
  endLine: number;
  language: string;
}

export class LanceDBStore implements VectorStore {
  private dbPath: string;
  private vectorDimension: number;
  private db: Connection | null = null;
  private table: Table | null = null;

  constructor(dbPath: string, vectorDimension: number = 384) {
    this.dbPath = dbPath;
    this.vectorDimension = vectorDimension;
  }

  private async getDb(): Promise<Connection> {
    if (!this.db) {
      this.db = await lancedb.connect(this.dbPath);
    }
    return this.db;
  }

  private async getTable(): Promise<Table> {
    if (this.table) return this.table;

    const db = await this.getDb();
    const tableNames = await db.tableNames();

    if (tableNames.includes(TABLE_NAME)) {
      this.table = await db.openTable(TABLE_NAME);
    } else {
      // Create table with initial data to infer schema
      const seedRow: ChunkRow = {
        id: "__seed__",
        content: "",
        embedding: new Array(this.vectorDimension).fill(0),
        filePath: "",
        startLine: 0,
        endLine: 0,
        language: "",
      };

      this.table = await db.createTable({
        name: TABLE_NAME,
        data: [seedRow] as unknown as Record<string, unknown>[],
        mode: "overwrite",
      });

      // Remove seed row
      await this.table.delete('id = "__seed__"');
    }

    return this.table;
  }

  async addChunks(chunks: Chunk[]): Promise<void> {
    if (chunks.length === 0) return;

    const table = await this.getTable();
    const rows: ChunkRow[] = chunks
      .filter((c) => c.embedding && c.embedding.length > 0)
      .map((c) => ({
        id: c.id,
        content: c.content,
        embedding: c.embedding!,
        filePath: normalizeFilePath(c.metadata.filePath),
        startLine: c.metadata.startLine,
        endLine: c.metadata.endLine,
        language: c.metadata.language,
      }));

    if (rows.length === 0) return;

    await table.add(rows as unknown as Record<string, unknown>[]);
  }

  async search(
    embedding: number[],
    topK: number
  ): Promise<SearchResult[]> {
    const db = await this.getDb();
    const tableNames = await db.tableNames();
    if (!tableNames.includes(TABLE_NAME)) return [];

    const table = await this.getTable();
    const count = await table.countRows();

    // If table is empty, return nothing
    if (count === 0) return [];

    const results = await table.search(embedding).limit(topK).toArray();

    return results.map((row: Record<string, unknown>) => {
      const distance = (row._distance as number) ?? 0;
      const score = 1 / (1 + distance);

      return {
        score,
        chunk: {
          id: row.id as string,
          content: row.content as string,
          metadata: {
            filePath: row.filePath as string,
            startLine: row.startLine as number,
            endLine: row.endLine as number,
            language: row.language as string,
          },
        },
      };
    });
  }

  async count(): Promise<number> {
    try {
      const db = await this.getDb();
      const tableNames = await db.tableNames();
      if (!tableNames.includes(TABLE_NAME)) return 0;

      const table = await this.getTable();
      return await table.countRows();
    } catch {
      return 0;
    }
  }

  async clear(): Promise<void> {
    try {
      const db = await this.getDb();
      const tableNames = await db.tableNames();
      if (tableNames.includes(TABLE_NAME)) {
        await db.dropTable(TABLE_NAME);
      }
    } catch {
      // Table may not exist
    }
    this.table = null;
  }

  async deleteByFilePath(filePath: string): Promise<void> {
    const db = await this.getDb();
    const tableNames = await db.tableNames();
    if (!tableNames.includes(TABLE_NAME)) return;

    const table = await this.getTable();
    const normalizedPath = normalizeFilePath(filePath).replace(/'/g, "''");
    await table.delete(`filePath = '${normalizedPath}'`);
  }
}
