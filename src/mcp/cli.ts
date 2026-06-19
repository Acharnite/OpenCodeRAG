import process from "node:process";
import { createMcpServer } from "./server.js";

let closed = false;

export async function runMcpServer(options?: {
  configPath?: string;
  cwd?: string;
}): Promise<void> {
  const instance = await createMcpServer(options);

  async function shutdown(): Promise<void> {
    if (closed) return;
    closed = true;
    await instance.close();
    process.exit(0);
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await new Promise<void>(() => {});
}
