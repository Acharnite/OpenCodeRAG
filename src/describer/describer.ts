import type { Chunk, DescriptionProvider } from "../core/interfaces.js";
import type { DescriptionConfig, ProxyConfig } from "../core/config.js";
import { postJson } from "../embedder/http.js";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatResponse {
  message?: { content?: string };
  choices?: Array<{ message?: { content?: string } }>;
}

export class LLMDescriptionProvider implements DescriptionProvider {
  private readonly config: DescriptionConfig;

  constructor(config: DescriptionConfig) {
    this.config = config;
  }

  async generateDescription(chunk: Chunk): Promise<string> {
    const baseUrl = this.config.baseUrl.replace(/\/+$/, "").replace(/\/api$/, "");
    const isOllama = this.config.provider === "ollama";

    const messages: ChatMessage[] = [
      { role: "system", content: this.config.systemPrompt },
      {
        role: "user",
        content: buildUserMessage(chunk),
      },
    ];

    const url = isOllama
      ? `${baseUrl}/api/chat`
      : `${baseUrl}/v1/chat/completions`;

    const body = isOllama
      ? { model: this.config.model, messages, stream: false }
      : { model: this.config.model, messages };

    const headers: Record<string, string> = {};
    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }

    const response = await postJson(
      url,
      body,
      headers,
      this.config.timeoutMs ?? 60000,
      this.config.proxy
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Description LLM request failed (${response.status}): ${text}`
      );
    }

    const json = (await response.json()) as ChatResponse;
    return extractResponseText(json, isOllama);
  }
}

function buildUserMessage(chunk: Chunk): string {
  const parts: string[] = [];

  if (chunk.metadata.filePath) {
    parts.push(`File: ${chunk.metadata.filePath}`);
  }
  if (chunk.metadata.language) {
    parts.push(`Language: ${chunk.metadata.language}`);
  }
  parts.push(`Lines: ${chunk.metadata.startLine}-${chunk.metadata.endLine}`);
  parts.push("");
  parts.push("```" + (chunk.metadata.language || ""));
  parts.push(chunk.content);
  parts.push("```");

  return parts.join("\n");
}

function extractResponseText(json: ChatResponse, isOllama: boolean): string {
  if (isOllama) {
    const content = json.message?.content;
    if (typeof content === "string" && content.trim().length > 0) {
      return content.trim();
    }
  }

  const content = json.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim().length > 0) {
    return content.trim();
  }

  throw new Error(
    `Description LLM returned empty response: ${JSON.stringify(json)}`
  );
}
