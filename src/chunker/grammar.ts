import { Parser, Language, Node } from "web-tree-sitter";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function resolveMsWasmDir(): string {
  const localDir = resolve(PROJECT_ROOT, "node_modules", "@vscode", "tree-sitter-wasm", "wasm");
  if (existsSync(localDir)) return localDir;

  try {
    const require = createRequire(import.meta.url);
    const pkgJson = require.resolve("@vscode/tree-sitter-wasm/package.json");
    return resolve(dirname(pkgJson), "wasm");
  } catch {
    return localDir;
  }
}

const MS_WASM_DIR = resolveMsWasmDir();

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
  leadingDoc?: string;
}

const COMMENT_NODE_TYPES = new Set([
  "comment",
  "line_comment",
  "multiline_comment",
  "marginalia",
  "Comment",
]);

function cleanCommentText(text: string): string {
  const lines = text.split("\n");

  if (text.startsWith("/*")) {
    let cleaned = lines.map((line, i) => {
      let l = line;
      if (i === 0) l = l.replace(/^\/\*+\s?/, "");
      if (i === lines.length - 1) l = l.replace(/\s?\*+\/$/, "");
      l = l.replace(/^\s*\*\s?/, "");
      return l;
    });
    return cleaned.filter((l) => l.trim().length > 0).join("\n");
  }

  if (text.startsWith("<!--")) {
    let cleaned = lines.map((line) =>
      line.replace(/^<!--\s?/, "").replace(/\s?-->$/, ""),
    );
    return cleaned.filter((l) => l.trim().length > 0).join("\n");
  }

  const prefix = /^(?:\/\/\/?|#|--|;|%)\s?/;
  let cleaned = lines.map((line) => line.replace(prefix, ""));
  return cleaned.filter((l) => l.trim().length > 0).join("\n");
}

function extractLeadingComments(node: Node, source: string): string | undefined {
  const comments: string[] = [];
  let sibling = node.previousSibling;

  while (sibling) {
    if (COMMENT_NODE_TYPES.has(sibling.type)) {
      const raw = source.slice(sibling.startIndex, sibling.endIndex);
      comments.unshift(cleanCommentText(raw));
      sibling = sibling.previousSibling;
    } else if (sibling.type === "expression_statement") {
      const firstChild = sibling.namedChildren[0];
      if (firstChild?.type === "string") {
        const raw = source.slice(firstChild.startIndex, firstChild.endIndex);
        comments.unshift(cleanCommentText(raw));
        sibling = sibling.previousSibling;
      } else {
        break;
      }
    } else {
      break;
    }
  }

  if (comments.length === 0) return undefined;
  return comments.join("\n\n");
}

function extractDocstringFromBody(node: Node, source: string): string | undefined {
  if (node.type !== "function_definition" && node.type !== "class_definition") {
    return undefined;
  }

  const body = node.children.find((c) => c.type === "block");
  if (!body) return undefined;

  const firstStmt = body.namedChildren[0];
  if (!firstStmt || firstStmt.type !== "expression_statement") return undefined;

  const stringNode = firstStmt.namedChildren[0];
  if (!stringNode || stringNode.type !== "string") return undefined;

  return cleanCommentText(source.slice(stringNode.startIndex, stringNode.endIndex));
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
    const leadingComments = extractLeadingComments(node, source);
    const bodyDocstring = extractDocstringFromBody(node, source);
    const leadingDoc = [leadingComments, bodyDocstring]
      .filter((d): d is string => d !== undefined && d.length > 0)
      .join("\n\n");

    results.push({
      text: source.slice(node.startIndex, node.endIndex),
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      startIndex: node.startIndex,
      endIndex: node.endIndex,
      type: node.type,
      leadingDoc: leadingDoc.length > 0 ? leadingDoc : undefined,
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
