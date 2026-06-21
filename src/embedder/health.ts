import type { RagConfig } from "../core/config.js";
import { postJson } from "./http.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface HealthCheckResult {
  provider: string;
  model: string;
  type: "embedding" | "description" | "image_description";
  status: "ok" | "missing" | "error";
  error?: string;
}

/**
 * Check connectivity and model availability for all configured providers.
 * Returns one result per configured model (embedding + description + image_description if enabled).
 */
export async function checkProviderHealth(config: RagConfig): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = [];
  const timeoutMs = config.embedding.timeoutMs ?? 30000;

  // Check embedding provider
  results.push(await checkEmbeddingModel(config, timeoutMs));

  // Check description provider if enabled
  if (config.description?.enabled) {
    results.push(await checkDescriptionModel(config, timeoutMs));
  }

  // Check image description provider if enabled
  if (config.imageDescription?.enabled) {
    results.push(await checkImageDescriptionModel(config, timeoutMs));
  }

  return results;
}

async function checkEmbeddingModel(config: RagConfig, timeoutMs: number): Promise<HealthCheckResult> {
  const { provider, baseUrl, model, apiKey, proxy } = config.embedding;

  if (provider === "ollama") {
    return checkOllamaEmbed(baseUrl, model, timeoutMs, proxy);
  }

  if (provider === "cohere") {
    return checkCohereEmbed(baseUrl, model, apiKey, timeoutMs, proxy);
  }

  if (isOpenAiCompatible(provider)) {
    return checkOpenAiEmbed(baseUrl, model, apiKey, timeoutMs, proxy);
  }

  return { provider, model, type: "embedding", status: "error", error: `Unknown provider: ${provider}` };
}

async function checkDescriptionModel(config: RagConfig, timeoutMs: number): Promise<HealthCheckResult> {
  const desc = config.description;
  if (!desc) {
    return { provider: "unknown", model: "unknown", type: "description", status: "error", error: "Description config is undefined" };
  }
  const { provider, baseUrl, model, apiKey } = desc;
  const descTimeout = desc.timeoutMs ?? 60000;

  if (provider === "ollama") {
    return checkOllamaChat(baseUrl, model, descTimeout, desc.proxy);
  }

  if (provider === "anthropic") {
    return checkAnthropicChat(baseUrl, model, apiKey, descTimeout);
  }

  if (provider === "google") {
    return checkGoogleChat(baseUrl, model, apiKey, descTimeout);
  }

  // OpenAI-compatible chat endpoint
  return checkOpenAiChat(baseUrl, model, apiKey, descTimeout, desc.proxy);
}

async function checkImageDescriptionModel(config: RagConfig, timeoutMs: number): Promise<HealthCheckResult> {
  const img = config.imageDescription;
  if (!img) {
    return { provider: "unknown", model: "unknown", type: "image_description", status: "error", error: "Image description config is undefined" };
  }
  const { provider, baseUrl, model, apiKey } = img;
  const imgTimeout = img.timeoutMs ?? 60000;

  if (provider === "ollama") {
    return checkOllamaChat(baseUrl, model, imgTimeout, img.proxy, "image_description");
  }

  if (provider === "anthropic") {
    return checkAnthropicChat(baseUrl, model, apiKey, imgTimeout, "image_description");
  }

  if (provider === "google") {
    return checkGoogleChat(baseUrl, model, apiKey, imgTimeout, "image_description");
  }

  // OpenAI-compatible chat endpoint
  return checkOpenAiChat(baseUrl, model, apiKey, imgTimeout, img.proxy, "image_description");
}

function isOpenAiCompatible(provider: string): boolean {
  // Known OpenAI-compatible providers from provider-defaults.ts
  const openaiCompatible = new Set(["openai", "nvidia", "azure", "mistral", "together", "fireworks"]);
  return openaiCompatible.has(provider);
}

// ── Ollama checks ──────────────────────────────────────────────

async function checkOllamaEmbed(
  baseUrl: string,
  model: string,
  timeoutMs: number,
  proxy?: RagConfig["embedding"]["proxy"]
): Promise<HealthCheckResult> {
  const url = `${baseUrl.replace(/\/+$/, "")}/embed`;
  try {
    const response = await postJson(
      url,
      { model, input: "health-check" },
      {},
      Math.min(timeoutMs, 15000),
      proxy
    );

    if (response.ok) {
      return { provider: "ollama", model, type: "embedding", status: "ok" };
    }

    const body = await response.text();
    if (isModelNotFoundError(body)) {
      return { provider: "ollama", model, type: "embedding", status: "missing" };
    }

    return { provider: "ollama", model, type: "embedding", status: "error", error: `HTTP ${response.status}: ${body.slice(0, 200)}` };
  } catch (err) {
    const msg = (err as Error).message || String(err);
    if (isConnectionError(msg)) {
      return { provider: "ollama", model, type: "embedding", status: "error", error: "Connection refused. Is Ollama running?" };
    }
    return { provider: "ollama", model, type: "embedding", status: "error", error: msg.slice(0, 200) };
  }
}

async function checkOllamaChat(
  baseUrl: string,
  model: string,
  timeoutMs: number,
  proxy?: { url?: string; username?: string; password?: string; noProxy?: string },
  type: "description" | "image_description" = "description"
): Promise<HealthCheckResult> {
  const url = `${baseUrl.replace(/\/+$/, "")}/chat`;
  try {
    const response = await postJson(
      url,
      { model, messages: [{ role: "user", content: "hi" }], stream: false },
      {},
      Math.min(timeoutMs, 15000),
      proxy
    );

    if (response.ok) {
      return { provider: "ollama", model, type, status: "ok" };
    }

    const body = await response.text();
    if (isModelNotFoundError(body)) {
      return { provider: "ollama", model, type, status: "missing" };
    }

    return { provider: "ollama", model, type, status: "error", error: `HTTP ${response.status}: ${body.slice(0, 200)}` };
  } catch (err) {
    const msg = (err as Error).message || String(err);
    if (isConnectionError(msg)) {
      return { provider: "ollama", model, type, status: "error", error: "Connection refused. Is Ollama running?" };
    }
    return { provider: "ollama", model, type, status: "error", error: msg.slice(0, 200) };
  }
}

// ── OpenAI-compatible checks ───────────────────────────────────

async function checkOpenAiEmbed(
  baseUrl: string,
  model: string,
  apiKey?: string,
  timeoutMs?: number,
  proxy?: RagConfig["embedding"]["proxy"]
): Promise<HealthCheckResult> {
  if (!apiKey) {
    return { provider: "openai", model, type: "embedding", status: "error", error: "No API key configured" };
  }

  // Use the models endpoint to validate the API key without consuming embedding tokens
  const url = `${baseUrl.replace(/\/+$/, "")}/models`;
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(Math.min(timeoutMs ?? 15000, 15000)),
    });

    if (response.ok) {
      return { provider: "openai", model, type: "embedding", status: "ok" };
    }

    if (response.status === 401 || response.status === 403) {
      return { provider: "openai", model, type: "embedding", status: "error", error: `Invalid API key (HTTP ${response.status})` };
    }

    const body = await response.text();
    return { provider: "openai", model, type: "embedding", status: "error", error: `HTTP ${response.status}: ${body.slice(0, 200)}` };
  } catch (err) {
    const msg = (err as Error).message || String(err);
    return { provider: "openai", model, type: "embedding", status: "error", error: msg.slice(0, 200) };
  }
}

async function checkOpenAiChat(
  baseUrl: string,
  model: string,
  apiKey?: string,
  timeoutMs?: number,
  proxy?: { url?: string; username?: string; password?: string; noProxy?: string },
  type: "description" | "image_description" = "description"
): Promise<HealthCheckResult> {
  if (!apiKey) {
    return { provider: "openai", model, type, status: "error", error: "No API key configured" };
  }

  const url = `${baseUrl.replace(/\/+$/, "")}/models`;
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(Math.min(timeoutMs ?? 15000, 15000)),
    });

    if (response.ok) {
      return { provider: "openai", model, type, status: "ok" };
    }

    if (response.status === 401 || response.status === 403) {
      return { provider: "openai", model, type, status: "error", error: `Invalid API key (HTTP ${response.status})` };
    }

    const body = await response.text();
    return { provider: "openai", model, type, status: "error", error: `HTTP ${response.status}: ${body.slice(0, 200)}` };
  } catch (err) {
    const msg = (err as Error).message || String(err);
    return { provider: "openai", model, type, status: "error", error: msg.slice(0, 200) };
  }
}

// ── Cohere check ───────────────────────────────────────────────

async function checkCohereEmbed(
  baseUrl: string,
  model: string,
  apiKey?: string,
  timeoutMs?: number,
  proxy?: RagConfig["embedding"]["proxy"]
): Promise<HealthCheckResult> {
  if (!apiKey) {
    return { provider: "cohere", model, type: "embedding", status: "error", error: "No API key configured" };
  }

  const url = `${baseUrl.replace(/\/+$/, "")}/embed`;
  try {
    const response = await postJson(
      url,
      { texts: ["health-check"], model, input_type: "search_document" },
      { Authorization: `Bearer ${apiKey}` },
      Math.min(timeoutMs ?? 15000, 15000),
      proxy
    );

    if (response.ok) {
      return { provider: "cohere", model, type: "embedding", status: "ok" };
    }

    const body = await response.text();
    return { provider: "cohere", model, type: "embedding", status: "error", error: `HTTP ${response.status}: ${body.slice(0, 200)}` };
  } catch (err) {
    const msg = (err as Error).message || String(err);
    return { provider: "cohere", model, type: "embedding", status: "error", error: msg.slice(0, 200) };
  }
}

// ── Anthropic check ────────────────────────────────────────────

async function checkAnthropicChat(
  baseUrl: string,
  model: string,
  apiKey?: string,
  timeoutMs?: number,
  type: "description" | "image_description" = "description"
): Promise<HealthCheckResult> {
  if (!apiKey) {
    return { provider: "anthropic", model, type, status: "error", error: "No API key configured" };
  }

  const url = `${baseUrl.replace(/\/+$/, "")}/messages`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
      signal: AbortSignal.timeout(Math.min(timeoutMs ?? 15000, 15000)),
    });

    if (response.ok) {
      return { provider: "anthropic", model, type, status: "ok" };
    }

    if (response.status === 401 || response.status === 403) {
      return { provider: "anthropic", model, type, status: "error", error: `Invalid API key (HTTP ${response.status})` };
    }

    const body = await response.text();
    return { provider: "anthropic", model, type, status: "error", error: `HTTP ${response.status}: ${body.slice(0, 200)}` };
  } catch (err) {
    const msg = (err as Error).message || String(err);
    return { provider: "anthropic", model, type, status: "error", error: msg.slice(0, 200) };
  }
}

// ── Google Gemini check ────────────────────────────────────────

async function checkGoogleChat(
  baseUrl: string,
  model: string,
  apiKey?: string,
  timeoutMs?: number,
  type: "description" | "image_description" = "description"
): Promise<HealthCheckResult> {
  if (!apiKey) {
    return { provider: "google", model, type, status: "error", error: "No API key configured" };
  }

  const url = `${baseUrl.replace(/\/+$/, "")}/models/${model}:generateContent?key=${apiKey}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "hi" }] }],
      }),
      signal: AbortSignal.timeout(Math.min(timeoutMs ?? 15000, 15000)),
    });

    if (response.ok) {
      return { provider: "google", model, type, status: "ok" };
    }

    if (response.status === 401 || response.status === 403) {
      return { provider: "google", model, type, status: "error", error: `Invalid API key (HTTP ${response.status})` };
    }

    const body = await response.text();
    return { provider: "google", model, type, status: "error", error: `HTTP ${response.status}: ${body.slice(0, 200)}` };
  } catch (err) {
    const msg = (err as Error).message || String(err);
    return { provider: "google", model, type, status: "error", error: msg.slice(0, 200) };
  }
}

// ── Ollama model pull ──────────────────────────────────────────

/**
 * Pull missing Ollama models sequentially (embedding first, then description).
 * Streams progress to stdout.
 */
export async function pullOllamaModels(
  models: string[],
  onProgress?: (model: string, line: string) => void
): Promise<void> {
  for (const model of models) {
    try {
      const { stdout } = await execAsync(`ollama pull ${model}`, {
        timeout: 600_000, // 10 minute timeout per model
        maxBuffer: 10 * 1024 * 1024,
      });
      if (onProgress) {
        onProgress(model, stdout.trim());
      }
    } catch (err) {
      const msg = (err as Error).message || String(err);
      throw new Error(`Failed to pull ${model}: ${msg}`);
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────

function isModelNotFoundError(body: string): boolean {
  const lower = body.toLowerCase();
  return (
    lower.includes("not found") ||
    lower.includes("does not exist") ||
    lower.includes("model") && lower.includes("not") && lower.includes("available")
  );
}

function isConnectionError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes("econnrefused") ||
    lower.includes("connection refused") ||
    lower.includes("connect econnrefused")
  );
}
