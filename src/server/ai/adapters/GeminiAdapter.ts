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
      id: "gemini-3.6-flash",
      name: "Gemini 3.6 Flash (Fast & Recommended)",
      contextWindow: 1048576,
      isFree: true,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Next-gen multimodal workhorse model, highly optimized for math, LaTeX & reasoning.",
    },
    {
      id: "gemini-3.8-flash",
      name: "Gemini 3.8 Flash (General Tasks)",
      contextWindow: 1048576,
      isFree: true,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Balanced reasoning and high speed for academic document proofing.",
    },
    {
      id: "gemini-3.5-flash-lite",
      name: "Gemini 3.5 Flash Lite",
      contextWindow: 1048576,
      isFree: true,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Ultra-fast generation with light resource footprint.",
    },
    {
      id: "gemini-3.1-pro-preview",
      name: "Gemini 3.1 Pro (Complex STEM)",
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

    const ai = new GoogleGenAI({ apiKey: key });

    const config: any = {
      temperature: options?.temperature ?? request.temperature ?? 0.2,
    };
    if (request.systemPrompt) {
      config.systemInstruction = request.systemPrompt;
    }

    let selectedModel = model || "gemini-3.6-flash";
    // Normalize deprecated models automatically to prevent 404s
    if (
      selectedModel === "gemini-2.5-flash" ||
      selectedModel === "gemini-2.0-flash" ||
      selectedModel === "gemini-1.5-flash"
    ) {
      selectedModel = "gemini-3.6-flash";
    }

    let response: any;
    try {
      response = await ai.models.generateContent({
        model: selectedModel,
        contents: request.prompt,
        config,
      });
    } catch (err: any) {
      // If the selected model returns a 404/not available error, fallback to gemini-3.6-flash or gemini-3.8-flash
      if (
        (err?.status === 404 || String(err?.message || "").includes("no longer available") || String(err?.message || "").includes("NOT_FOUND")) &&
        selectedModel !== "gemini-3.6-flash"
      ) {
        response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: request.prompt,
          config,
        });
      } else {
        throw err;
      }
    }

    const inPrompt = request.systemPrompt
      ? `${request.systemPrompt}\n\n${request.prompt}`
      : request.prompt;
    const text = response.text || "";
    const inTokens = estimateTokenCount(inPrompt);
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
    const targetModel =
      model === "gemini-2.5-flash" ||
      model === "gemini-2.0-flash" ||
      model === "gemini-1.5-flash" ||
      !model
        ? "gemini-3.6-flash"
        : model;

    try {
      const res = await this.generate(
        { prompt: "Respond with the word 'OK' if you can read this." },
        key,
        targetModel,
        { timeoutMs }
      );

      const latency = Date.now() - startTime;
      if (res.text && res.text.length > 0) {
        return {
          success: true,
          providerId: this.id,
          providerName: this.name,
          model: targetModel,
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
        model: targetModel,
        latencyMs: latency,
        errorMessage: normalized.message,
        statusCode: normalized.statusCode,
        errorKind: normalized.kind,
      };
    }
  }
}
