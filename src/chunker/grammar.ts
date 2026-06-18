import { Parser, Language, Node } from "web-tree-sitter";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const MS_WASM_DIR = resolve(
  PROJECT_ROOT,
  "node_modules",
  "@vscode",
  "tree-sitter-wasm",
  "wasm"
);

const SELF_WASM_DIR = resolve(PROJECT_ROOT, "wasm");

const MS_LANGUAGES = new Set([
  "bash",
  "c_sharp",
  "cpp",
  "css",
  "go",
  "ini",
  "java",
  "javascript",
  "php",
  "powershell",
  "python",
  "regex",
  "ruby",
  "rust",
  "tsx",
  "typescript",
]);

function resolveWasmPath(lang: string): string {
  if (MS_LANGUAGES.has(lang)) {
    const msName = lang.replace(/_/g, "-");
    return resolve(MS_WASM_DIR, `tree-sitter-${msName}.wasm`);
  }
  return resolve(SELF_WASM_DIR, `tree-sitter-${lang}.wasm`);
}

let initialized = false;
let initPromise: Promise<void> | null = null;

export async function initParser(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;
  initPromise = Parser.init().then(() => {
    initialized = true;
    initPromise = null;
  });
  return initPromise;
}

const grammarCache = new Map<string, Language>();

export async function loadLanguage(lang: string): Promise<Language> {
  const cached = grammarCache.get(lang);
  if (cached) return cached;

  await initParser();
  const wasmPath = resolveWasmPath(lang);
  const buffer = readFileSync(wasmPath);
  const language = await Language.load(buffer);
  grammarCache.set(lang, language);
  return language;
}

export async function loadLanguageFromPath(
  cacheKey: string,
  wasmPath: string
): Promise<Language> {
  const cached = grammarCache.get(cacheKey);
  if (cached) return cached;

  await initParser();
  const resolvedPath = resolve(wasmPath);
  const buffer = readFileSync(resolvedPath);
  const language = await Language.load(buffer);
  grammarCache.set(cacheKey, language);
  return language;
}

export interface AstNode {
  text: string;
  startLine: number;
  endLine: number;
  startIndex: number;
  endIndex: number;
  type: string;
}

export function walkTree(
  node: Node,
  nodeTypes: Set<string>,
  source: string,
  maxDepth: number = 10,
  depth: number = 0
): AstNode[] {
  const results: AstNode[] = [];

  if (nodeTypes.has(node.type) && depth > 0) {
    results.push({
      text: source.slice(node.startIndex, node.endIndex),
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      startIndex: node.startIndex,
      endIndex: node.endIndex,
      type: node.type,
    });
    return results;
  }

  if (depth < maxDepth) {
    for (const child of node.children) {
      results.push(
        ...walkTree(child, nodeTypes, source, maxDepth, depth + 1)
      );
    }
  }

  return results;
}
