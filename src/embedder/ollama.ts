import type { EmbeddingProvider } from "../core/interfaces.js";

export class OllamaProvider implements EmbeddingProvider {
  readonly name = "ollama";

  private baseUrl: string;
  private model: string;
  private apiKey?: string;

  constructor(baseUrl: string, model: string, apiKey?: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.model = model;
    this.apiKey = apiKey;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];

    for (const text of texts) {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({ model: this.model, prompt: text }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `Ollama embedding failed (${response.status}): ${body}`
        );
      }

      const json = (await response.json()) as { embedding: number[] };
      if (!json.embedding || !Array.isArray(json.embedding)) {
        throw new Error(`Ollama: unexpected response: ${JSON.stringify(json)}`);
      }
      results.push(json.embedding);
    }

    return results;
  }
}
