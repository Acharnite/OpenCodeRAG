import process from "node:process";
import { createMcpServer } from "./server.js";

export async function runMcpServer(options?: {
  configPath?: string;
  cwd?: string;
}): Promise<void> {
  const instance = await createMcpServer(options);

  process.on("SIGINT", async () => {
    await instance.close();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await instance.close();
    process.exit(0);
  });

  await new Promise<void>(() => {});
}
