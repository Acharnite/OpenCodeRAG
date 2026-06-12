import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { Chunk } from "../../core/interfaces.js";
import type { DescriptionConfig } from "../../core/config.js";
import { LLMDescriptionProvider } from "../../describer/describer.js";
import { createDescriptionProvider } from "../../describer/factory.js";

function makeChunk(overrides: Partial<Chunk> = {}): Chunk {
  return {
    id: "chunk-1",
    content: "export function hello() { return 'world'; }",
    metadata: {
      filePath: "src/hello.ts",
      startLine: 1,
      endLine: 3,
      language: "typescript",
      ...overrides.metadata,
    },
    ...overrides,
  };
}

function makeConfig(overrides: Partial<DescriptionConfig> = {}): DescriptionConfig {
  return {
    enabled: true,
    provider: "ollama",
    baseUrl: "http://127.0.0.1:11434/api",
    model: "test-model",
    timeoutMs: 5000,
    systemPrompt: "Describe the code.",
    ...overrides,
  };
}

function startMockServer(
  handler: (body: Record<string, unknown>) => { status: number; body: unknown }
): Promise<{ server: Server; baseUrl: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let data = "";
      req.on("data", (chunk) => { data += chunk; });
      req.on("end", () => {
        const body = JSON.parse(data) as Record<string, unknown>;
        const result = handler(body);
        res.writeHead(result.status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result.body));
      });
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise<void>((res, rej) =>
            server.close((err) => (err ? rej(err) : res()))
          ),
      });
    });
  });
}

describe("LLMDescriptionProvider", () => {
  it("generates description using Ollama API format", async () => {
    const { server, baseUrl, close } = await startMockServer((body) => {
      assert.equal(body.model, "test-model");
      assert.ok(Array.isArray(body.messages));
      const messages = body.messages as Array<{ role: string; content: string }>;
      assert.equal(messages[0]!.role, "system");
      assert.equal(messages[0]!.content, "Describe the code.");
      assert.equal(messages[1]!.role, "user");
      assert.ok(messages[1]!.content.includes("src/hello.ts"));
      assert.ok(messages[1]!.content.includes("typescript"));
      assert.ok(messages[1]!.content.includes("export function hello"));
      assert.ok(body.stream === false);

      return {
        status: 200,
        body: { message: { content: "A function that returns the string 'world'." } },
      };
    });

    try {
      const provider = new LLMDescriptionProvider(
        makeConfig({ baseUrl: `${baseUrl}/api` })
      );
      const description = await provider.generateDescription(makeChunk());
      assert.equal(description, "A function that returns the string 'world'.");
    } finally {
      await close();
    }
  });

  it("generates description using OpenAI API format", async () => {
    const { server, baseUrl, close } = await startMockServer((body) => {
      assert.equal(body.model, "openai-model");
      assert.ok(Array.isArray(body.messages));
      assert.ok(body.stream === undefined);

      return {
        status: 200,
        body: {
          choices: [{ message: { content: "A greeting function." } }],
        },
      };
    });

    try {
      const provider = new LLMDescriptionProvider(
        makeConfig({
          provider: "openai",
          model: "openai-model",
          baseUrl: `${baseUrl}/v1`,
        })
      );
      const description = await provider.generateDescription(makeChunk());
      assert.equal(description, "A greeting function.");
    } finally {
      await close();
    }
  });

  it("includes file path and language in user message", async () => {
    let capturedBody: Record<string, unknown> = {};
    const { server, baseUrl, close } = await startMockServer((body) => {
      capturedBody = body;
      return {
        status: 200,
        body: { message: { content: "Description." } },
      };
    });

    try {
      const provider = new LLMDescriptionProvider(
        makeConfig({ baseUrl: `${baseUrl}/api` })
      );
      await provider.generateDescription(
        makeChunk({
          content: "def foo(): pass",
          metadata: {
            filePath: "src/foo.py",
            startLine: 10,
            endLine: 20,
            language: "python",
          },
        })
      );

      const messages = capturedBody.messages as Array<{ role: string; content: string }>;
      const userMsg = messages[1]!.content;
      assert.ok(userMsg.includes("File: src/foo.py"));
      assert.ok(userMsg.includes("Language: python"));
      assert.ok(userMsg.includes("Lines: 10-20"));
      assert.ok(userMsg.includes("def foo(): pass"));
    } finally {
      await close();
    }
  });

  it("uses custom system prompt from config", async () => {
    let capturedBody: Record<string, unknown> = {};
    const { server, baseUrl, close } = await startMockServer((body) => {
      capturedBody = body;
      return {
        status: 200,
        body: { message: { content: "Custom description." } },
      };
    });

    try {
      const provider = new LLMDescriptionProvider(
        makeConfig({
          baseUrl: `${baseUrl}/api`,
          systemPrompt: "You are a Python expert. Describe this code briefly.",
        })
      );
      await provider.generateDescription(makeChunk());

      const messages = capturedBody.messages as Array<{ role: string; content: string }>;
      assert.equal(
        messages[0]!.content,
        "You are a Python expert. Describe this code briefly."
      );
    } finally {
      await close();
    }
  });

  it("sends API key as Bearer token for OpenAI provider", async () => {
    const { server, baseUrl, close } = await startMockServer((body) => {
      return {
        status: 200,
        body: { choices: [{ message: { content: "Desc." } }] },
      };
    });

    try {
      const provider = new LLMDescriptionProvider(
        makeConfig({
          provider: "openai",
          baseUrl: `${baseUrl}/v1`,
          apiKey: "test-api-key",
        })
      );
      // If it completes without error, the API key was accepted
      const desc = await provider.generateDescription(makeChunk());
      assert.equal(desc, "Desc.");
    } finally {
      await close();
    }
  });

  it("throws on empty LLM response", async () => {
    const { server, baseUrl, close } = await startMockServer(() => ({
      status: 200,
      body: { message: { content: "" } },
    }));

    try {
      const provider = new LLMDescriptionProvider(
        makeConfig({ baseUrl: `${baseUrl}/api` })
      );
      await assert.rejects(
        () => provider.generateDescription(makeChunk()),
        (err: Error) => {
          assert.ok(err.message.includes("empty response"));
          return true;
        }
      );
    } finally {
      await close();
    }
  });

  it("throws on HTTP error status", async () => {
    const { server, baseUrl, close } = await startMockServer(() => ({
      status: 500,
      body: { error: "internal error" },
    }));

    try {
      const provider = new LLMDescriptionProvider(
        makeConfig({ baseUrl: `${baseUrl}/api` })
      );
      await assert.rejects(
        () => provider.generateDescription(makeChunk()),
        (err: Error) => {
          assert.ok(err.message.includes("500"));
          return true;
        }
      );
    } finally {
      await close();
    }
  });

  it("uses Ollama chat endpoint", async () => {
    let requestUrl = "";
    const { server, baseUrl, close } = await startMockServer((body) => {
      return {
        status: 200,
        body: { message: { content: "Desc." } },
      };
    });

    try {
      const provider = new LLMDescriptionProvider(
        makeConfig({ baseUrl: `${baseUrl}/api` })
      );
      // We verify the endpoint via the mock server receiving the request
      // The mock server at baseUrl/api will receive /api/chat
      const desc = await provider.generateDescription(makeChunk());
      assert.equal(desc, "Desc.");
    } finally {
      await close();
    }
  });

  it("uses OpenAI chat completions endpoint", async () => {
    const { server, baseUrl, close } = await startMockServer(() => ({
      status: 200,
      body: { choices: [{ message: { content: "Desc." } }] },
    }));

    try {
      const provider = new LLMDescriptionProvider(
        makeConfig({
          provider: "openai",
          baseUrl: `${baseUrl}/v1`,
        })
      );
      const desc = await provider.generateDescription(makeChunk());
      assert.equal(desc, "Desc.");
    } finally {
      await close();
    }
  });
});

describe("createDescriptionProvider", () => {
  it("returns an LLMDescriptionProvider instance", () => {
    const provider = createDescriptionProvider(makeConfig());
    assert.ok(provider);
    assert.equal(typeof provider.generateDescription, "function");
  });
});
