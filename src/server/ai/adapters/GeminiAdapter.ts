import { GoogleGenAI } from "@google/genai";
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

export class GeminiAdapter implements AIProviderAdapter {
  readonly id = "gemini";
  readonly name = "Google Gemini";

  private defaultModels: ModelInfo[] = [
    {
      id: "gemini-2.5-flash",
      name: "Gemini 2.5 Flash (Fast & Recommended)",
      contextWindow: 1048576,
      isFree: true,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Next-gen multimodal workhorse model, highly optimized for math & reasoning.",
    },
    {
      id: "gemini-2.0-flash",
      name: "Gemini 2.0 Flash",
      contextWindow: 1048576,
      isFree: true,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Ultra-fast generation with high accuracy on technical formatting.",
    },
    {
      id: "gemini-1.5-flash",
      name: "Gemini 1.5 Flash",
      contextWindow: 1048576,
      isFree: true,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Production-proven model with large 1M token context window.",
    },
    {
      id: "gemini-2.5-pro",
      name: "Gemini 2.5 Pro (High Reasoning)",
      contextWindow: 2097152,
      isFree: false,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "State-of-the-art complex technical and mathematical problem solving.",
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
    const status = error?.status || error?.statusCode || error?.response?.status;

    if (status === 401 || /api[_\s]?key|unauthenticated|unauthorized|API_KEY_INVALID/i.test(message)) {
      return {
        kind: "invalid_key",
        statusCode: 401,
        message: "Gemini API key is invalid or unauthenticated.",
        retryable: false,
        rawError: error,
      };
    }

    if (status === 403 || /permission[_\s]?denied|forbidden/i.test(message)) {
      return {
        kind: "permission_denied",
        statusCode: 403,
        message: "Gemini API permission denied or project restriction.",
        retryable: false,
        rawError: error,
      };
    }

    if (
      status === 429 ||
      /resource[_\s]?exhausted|quota|rate[_\s]?limit|429/i.test(message)
    ) {
      return {
        kind: "rate_limit",
        statusCode: 429,
        message: "Gemini free rate limit or quota exceeded (429).",
        retryable: true,
        rawError: error,
      };
    }

    if (
      status === 408 ||
      /timeout|timed out|aborted|ETIMEDOUT|ECONNRESET/i.test(message)
    ) {
      return {
        kind: "timeout",
        statusCode: status || 408,
        message: "Gemini API request timed out.",
        retryable: true,
        rawError: error,
      };
    }

    if (
      /context length|maximum context|token limit|too many tokens/i.test(
        message
      )
    ) {
      return {
        kind: "token_limit",
        statusCode: 400,
        message: "Gemini context window or token limit exceeded.",
        retryable: false,
        rawError: error,
      };
    }

    if (status >= 500 && status < 600) {
      return {
        kind: "server_error",
        statusCode: status,
        message: `Gemini service temporarily unavailable (${status}).`,
        retryable: true,
        rawError: error,
      };
    }

    if (/fetch failed|network|dns|getaddrinfo/i.test(message)) {
      return {
        kind: "network_error",
        message: "Network error connecting to Gemini API.",
        retryable: true,
        rawError: error,
      };
    }

    return {
      kind: "unknown",
      statusCode: status,
      message: message || "Unknown Gemini error",
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
      throw new Error("No API key provided for Google Gemini.");
    }

    const ai = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        timeout: options?.timeoutMs || 45000,
        headers: { "User-Agent": "notebooklm-docx-converter/1.0" },
      },
    });

    const fullPrompt = request.systemPrompt
      ? `${request.systemPrompt}\n\n${request.prompt}`
      : request.prompt;

    const response = await ai.models.generateContent({
      model: model || "gemini-2.5-flash",
      contents: fullPrompt,
      config: {
        temperature: options?.temperature ?? request.temperature ?? 0.2,
      },
    });

    const text = response.text || "";
    const inTokens = estimateTokenCount(fullPrompt);
    const outTokens = estimateTokenCount(text);

    return { text, inputTokens: inTokens, outputTokens: outTokens };
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
        { prompt: "Respond with the word 'OK' if you can read this." },
        key,
        model || "gemini-2.5-flash",
        { timeoutMs }
      );

      const latency = Date.now() - startTime;
      if (res.text && res.text.length > 0) {
        return {
          success: true,
          providerId: this.id,
          providerName: this.name,
          model: model || "gemini-2.5-flash",
          latencyMs: latency,
        };
      }

      throw new Error("Empty response returned from Gemini test.");
    } catch (err: any) {
      const latency = Date.now() - startTime;
      const normalized = this.normalizeError(err);
      return {
        success: false,
        providerId: this.id,
        providerName: this.name,
        model: model || "gemini-2.5-flash",
        latencyMs: latency,
        errorMessage: normalized.message,
        statusCode: normalized.statusCode,
        errorKind: normalized.kind,
      };
    }
  }
}
