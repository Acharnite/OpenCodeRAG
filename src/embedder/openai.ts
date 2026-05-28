import type { EmbeddingProvider } from "../core/interfaces.js";

export class OpenAIProvider implements EmbeddingProvider {
  readonly name = "openai";

  private baseUrl: string;
  private model: string;
  private apiKey: string;

  constructor(baseUrl: string, model: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.model = model;
    this.apiKey = apiKey;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, input: texts }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `OpenAI embedding failed (${response.status}): ${body}`
      );
    }

    const json = (await response.json()) as {
      data: { embedding: number[] }[];
    };

    if (!json.data || !Array.isArray(json.data)) {
      throw new Error(`OpenAI: unexpected response: ${JSON.stringify(json)}`);
    }

    return json.data
      .sort((a, b) => {
        // OpenAI returns data in correct order but with index field
        return 0;
      })
      .map((item) => item.embedding);
  }
}
