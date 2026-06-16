import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let cachedHtml: string | null = null;

export function getStaticHtml(): string {
  if (cachedHtml) return cachedHtml;

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const htmlPath = join(__dirname, "ui", "index.html");
  cachedHtml = readFileSync(htmlPath, "utf-8");
  return cachedHtml;
}
