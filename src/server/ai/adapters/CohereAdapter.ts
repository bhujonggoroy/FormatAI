import {
  AIProviderAdapter,
  AdapterOptions,
  estimateTokenCount,
} from "./BaseAdapter.ts";
import {
  AIRequest,
  ModelInfo,
  NormalizedAIError,
  TestResult,
} from "../types.ts";

export class CohereAdapter implements AIProviderAdapter {
  readonly id = "cohere";
  readonly name = "Cohere";

  private defaultModels: ModelInfo[] = [
    {
      id: "command-r",
      name: "Command R (Free Trial Key)",
      contextWindow: 128000,
      isFree: true,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Optimized for enterprise reasoning, summarization, and LaTeX.",
    },
    {
      id: "command-r-plus",
      name: "Command R+",
      contextWindow: 128000,
      isFree: false,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Cohere's state-of-the-art model for complex instructions.",
    },
    {
      id: "command-light",
      name: "Command Light",
      contextWindow: 4096,
      isFree: true,
      capabilities: ["text", "math"],
      description: "Fast lightweight model for basic text conversion.",
    },
  ];

  async listModels(): Promise<ModelInfo[]> {
    return this.defaultModels;
  }

  supportsCapability(capability: string, modelId: string): boolean {
    const model = this.defaultModels.find((m) => m.id === modelId) || this.defaultModels[0];
    return model.capabilities.includes(capability);
  }

  normalizeError(error: any): NormalizedAIError {
    const message = error?.message || String(error);
    const status = error?.status || error?.statusCode;

    if (status === 401 || /invalid[_\s]?api[_\s]?key|unauthorized/i.test(message)) {
      return {
        kind: "invalid_key",
        statusCode: 401,
        message: "Cohere API key is invalid or expired.",
        retryable: false,
        rawError: error,
      };
    }

    if (status === 429 || /rate[_\s]?limit|trial limit|quota/i.test(message)) {
      return {
        kind: "rate_limit",
        statusCode: 429,
        message: "Cohere free trial rate limit or monthly call limit exceeded.",
        retryable: true,
        rawError: error,
      };
    }

    if (status === 408 || /timeout|aborted/i.test(message)) {
      return {
        kind: "timeout",
        statusCode: 408,
        message: "Cohere request timed out.",
        retryable: true,
        rawError: error,
      };
    }

    if (status >= 500) {
      return {
        kind: "server_error",
        statusCode: status,
        message: `Cohere server error (${status}).`,
        retryable: true,
        rawError: error,
      };
    }

    return {
      kind: "unknown",
      statusCode: status,
      message: message || "Unknown Cohere error",
      retryable: false,
      rawError: error,
    };
  }

  async generate(
    request: AIRequest,
    key: string,
    model: string,
    options?: AdapterOptions
  ): Promise<{ text: string; inputTokens?: number; outputTokens?: number }> {
    if (!key) {
      throw new Error("No API key provided for Cohere.");
    }

    const effectiveModel = model || "command-r";
    const endpoint = options?.customEndpoint || "https://api.cohere.com/v2/chat";

    const messages: Array<{ role: string; content: string }> = [];
    if (request.systemPrompt) {
      messages.push({ role: "system", content: request.systemPrompt });
    }
    messages.push({ role: "user", content: request.prompt });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options?.timeoutMs || 45000);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key.trim()}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: effectiveModel,
          messages,
          temperature: options?.temperature ?? request.temperature ?? 0.2,
        }),
      });

      clearTimeout(timeout);
      const data = await response.json();

      if (!response.ok) {
        throw {
          status: response.status,
          statusCode: response.status,
          message: data?.message || `HTTP ${response.status} from Cohere`,
        };
      }

      // Cohere v2 response parsing: message.content[0].text
      let text = "";
      if (Array.isArray(data?.message?.content)) {
        text = data.message.content.map((c: any) => c.text || "").join("\n");
      } else if (typeof data?.text === "string") {
        text = data.text;
      }

      const inTokens = data?.usage?.tokens?.input_tokens ?? estimateTokenCount(request.prompt);
      const outTokens = data?.usage?.tokens?.output_tokens ?? estimateTokenCount(text);

      return { text, inputTokens: inTokens, outputTokens: outTokens };
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === "AbortError") {
        throw {
          status: 408,
          statusCode: 408,
          message: `Cohere request timed out after ${options?.timeoutMs || 45000}ms`,
        };
      }
      throw err;
    }
  }

  async testConnection(
    key: string,
    model: string,
    customEndpoint?: string,
    timeoutMs: number = 15000
  ): Promise<TestResult> {
    const startTime = Date.now();
    try {
      const res = await this.generate(
        { prompt: "Reply with the single word OK." },
        key,
        model || "command-r",
        { timeoutMs, customEndpoint }
      );

      const latency = Date.now() - startTime;
      if (res.text) {
        return {
          success: true,
          providerId: this.id,
          providerName: this.name,
          model: model || "command-r",
          latencyMs: latency,
        };
      }
      throw new Error("Empty response from Cohere.");
    } catch (err: any) {
      const latency = Date.now() - startTime;
      const norm = this.normalizeError(err);
      return {
        success: false,
        providerId: this.id,
        providerName: this.name,
        model: model || "command-r",
        latencyMs: latency,
        errorMessage: norm.message,
        statusCode: norm.statusCode,
        errorKind: norm.kind,
      };
    }
  }
}
