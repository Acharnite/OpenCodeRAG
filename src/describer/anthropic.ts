import type { Chunk, DescriptionProvider } from "../core/interfaces.js";
import type { DescriptionConfig, ProxyConfig } from "../core/config.js";
import { postJson } from "../embedder/http.js";
import { buildUserMessage, buildBatchUserMessage, parseBatchResponse, sleep, runBatchDescriptions } from "./shared.js";

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

interface AnthropicResponse {
  content?: Array<{ type?: string; text?: string }>;
}

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

export class AnthropicDescriptionProvider implements DescriptionProvider {
  private readonly config: DescriptionConfig;

  constructor(config: DescriptionConfig) {
    this.config = config;
  }

  async generateDescription(chunk: Chunk): Promise<string> {
    const messages: AnthropicMessage[] = [
      { role: "user", content: buildUserMessage(chunk) },
    ];

    return this.chatRequest(messages, this.config.timeoutMs ?? 60000);
  }

  async generateBatchDescriptions(chunks: Chunk[]): Promise<Map<string, string>> {
    return runBatchDescriptions(
      chunks,
      this.config.batchMaxChunks ?? 25,
      this.config.batchConcurrency ?? 3,
      (batch) => this.executeBatch(batch),
      (chunk) => this.generateDescription(chunk),
    );
  }

  private async executeBatch(chunks: Chunk[]): Promise<Map<string, string>> {
    const messages: AnthropicMessage[] = [
      { role: "user", content: buildBatchUserMessage(chunks) },
    ];

    const timeoutMs = this.config.batchTimeoutMs ?? 120000;
    const responseText = await this.chatRequest(messages, timeoutMs);

    return parseBatchResponse(responseText, chunks);
  }

  private async chatRequest(
    messages: AnthropicMessage[],
    timeoutMs: number,
  ): Promise<string> {
    const baseUrl = this.config.baseUrl.replace(/\/+$/, "");
    const apiKey = this.config.apiKey ?? "";
    const systemPrompt = this.config.systemPrompt;

    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: 4096,
      messages: [{ role: "user", content: systemPrompt + "\n\n" + messages.map((m) => `${m.role}: ${m.content}`).join("\n\n") + "\n\nassistant:" }],
    };

    const headers: Record<string, string> = {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    };

    const retryMax = this.config.retryMax ?? 3;
    const retryBaseDelayMs = this.config.retryBaseDelayMs ?? 1000;

    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= retryMax; attempt++) {
      const response = await postJson(
        `${baseUrl}/messages`,
        body,
        headers,
        timeoutMs,
        this.config.proxy,
      );

      if (response.ok) {
        const json = (await response.json()) as AnthropicResponse;
        const text = json.content?.[0]?.text;
        if (text && text.trim().length > 0) {
          return text.trim();
        }
        throw new Error(`Anthropic returned empty response: ${JSON.stringify(json)}`);
      }

      const text = await response.text();
      const error = new Error(
        `Anthropic LLM request failed (${response.status}): ${text}`,
      );

      if (!RETRYABLE_STATUSES.has(response.status) || attempt === retryMax) {
        throw error;
      }

      lastError = error;
      const delayMs = retryBaseDelayMs * Math.pow(2, attempt);
      await sleep(delayMs);
    }

    throw lastError ?? new Error("Anthropic LLM request failed: unknown error");
  }
}


