#!/usr/bin/env node
/**
 * Build CSS for the web UI — generates a Tailwind CSS bundle, copies
 * the highlight.js theme, and downloads the highlight.min.js runtime.
 */

import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync, copyFileSync } from "node:fs";
import { get } from "node:https";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const uiDir = resolve(root, "src", "web", "ui");
const inputFile = resolve(uiDir, "tailwind-input.css");
const outputFile = resolve(uiDir, "app.css");

// Create Tailwind input file
const tailwindInput = `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body { background: #0f172a; color: #e2e8f0; }
}

@layer components {
  .scrollbar-thin::-webkit-scrollbar { width: 6px; }
  .scrollbar-thin::-webkit-scrollbar-track { background: #1e293b; }
  .scrollbar-thin::-webkit-scrollbar-thumb { background: #475569; border-radius: 3px; }
  .chunk-row { border-left: 2px solid transparent; }
  .chunk-row:hover { background: #1e293b; }
  .chunk-row.selected { background: #1e293b; border-left-color: #06b6d4; }
  .file-item:hover { background: #1e293b; }
  .file-item.active { background: #1e293b; border-left: 2px solid #06b6d4; }
  .kpi-card { background: #1e293b; border: 1px solid #334155; border-radius: 0.75rem; }
  .nav-btn.active { background: #06b6d4; color: #0f172a; }
  pre code.hljs { background: transparent; padding: 0; }
}
`;

writeFileSync(inputFile, tailwindInput, "utf-8");

// Run Tailwind CLI
const bin = resolve(root, "node_modules", ".bin", "tailwindcss");
try {
  execFileSync(bin, ["-i", inputFile, "-o", outputFile, "--minify"], {
    cwd: root,
    stdio: "inherit",
  });
  console.log(`✓ Built ${outputFile}`);
} catch (err) {
  console.error("Tailwind build failed:", err.message);
  process.exit(1);
}

// Copy highlight.js github-dark theme CSS from node_modules
const themeSrc = resolve(root, "node_modules", "highlight.js", "styles", "github-dark.css");
const themeDst = resolve(uiDir, "github-dark.css");
if (existsSync(themeSrc)) {
  copyFileSync(themeSrc, themeDst);
  console.log(`✓ Copied github-dark.css theme`);
} else {
  console.warn(`⚠ github-dark theme not found at ${themeSrc}`);
}

// Download highlight.min.js from CDN (npm package doesn't bundle the browser-ready file)
const hljsDst = resolve(uiDir, "highlight.min.js");
const HLJS_VERSION = "11.9.0";
const hljsUrl = `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/${HLJS_VERSION}/highlight.min.js`;

/**
 * Download a file from a URL to a local destination.
 * Follows HTTP redirects (301/302) recursively.
 *
 * @param {string} url - The URL to download from.
 * @param {string} dest - The local file path to write to.
 * @returns {Promise<void>}
 */
function download(url, dest) {
  return new Promise((resolve, reject) => {
    if (existsSync(dest)) {
      console.log(`  ${dest} already exists, skipping download`);
      resolve();
      return;
    }
    const file = createWriteStream(dest);
    get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        download(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      response.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
    }).on("error", (err) => {
      import("node:fs").then(fs => fs.unlinkSync(dest));
      reject(err);
    });
  });
}

import { createWriteStream } from "node:fs";

try {
  await download(hljsUrl, hljsDst);
  console.log(`✓ Downloaded highlight.min.js`);
} catch (err) {
  console.warn(`⚠ Could not download highlight.js: ${err.message}`);
  console.warn(`  The UI will fall back to CDN if this file is missing.`);
}
