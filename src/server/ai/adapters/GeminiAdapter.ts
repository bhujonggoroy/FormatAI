import { GoogleGenAI } from "@google/genai";
import {
  estimateTokenCount,
  type AIProviderAdapter,
  type AdapterOptions,
} from "./BaseAdapter.ts";
import type {
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
      id: "gemini-3.8-flash",
      name: "Gemini 3.8 Flash (Fast & Recommended)",
      contextWindow: 1048576,
      isFree: true,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Standard model for math, LaTeX, academic notes & reasoning.",
    },
    {
      id: "gemini-flash-latest",
      name: "Gemini Flash (Latest)",
      contextWindow: 1048576,
      isFree: true,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Latest stable Gemini Flash model alias.",
    },
    {
      id: "gemini-3.1-flash-lite",
      name: "Gemini 3.1 Flash Lite",
      contextWindow: 1048576,
      isFree: true,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Ultra-fast lightweight generation.",
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

    let selectedModel = model || "gemini-3.8-flash";
    // Normalize deprecated or unavailable models automatically to valid models
    if (
      selectedModel === "gemini-3.6-flash" ||
      selectedModel === "gemini-3.5-flash-lite" ||
      selectedModel === "gemini-2.5-flash" ||
      selectedModel === "gemini-2.0-flash" ||
      selectedModel === "gemini-1.5-flash"
    ) {
      selectedModel = "gemini-3.8-flash";
    }

    // Build ordered candidate models list for maximum resilience against demand spikes & 503 errors
    const candidateModels: string[] = [selectedModel];
    const fallbackOptions = ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
    for (const opt of fallbackOptions) {
      if (!candidateModels.includes(opt)) {
        candidateModels.push(opt);
      }
    }

    let response: any = null;
    let lastError: any = null;
    let successfulModel = selectedModel;

    for (let i = 0; i < candidateModels.length; i++) {
      const currentModel = candidateModels[i];
      try {
        response = await ai.models.generateContent({
          model: currentModel,
          contents: request.prompt,
          config,
        });
        successfulModel = currentModel;
        lastError = null;
        break;
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || "");
        const isAuthError =
          err?.status === 401 ||
          err?.status === 403 ||
          msg.includes("API_KEY_INVALID") ||
          msg.includes("unauthenticated") ||
          msg.includes("permission_denied");

        // Auth errors are not model-specific; don't cycle through models with bad credentials
        if (isAuthError) {
          throw err;
        }

        const isTransientOrModelError =
          err?.status === 503 ||
          err?.status === 429 ||
          err?.status === 500 ||
          err?.status === 404 ||
          msg.includes("high demand") ||
          msg.includes("Spikes in demand") ||
          msg.includes("UNAVAILABLE") ||
          msg.includes("RESOURCE_EXHAUSTED") ||
          msg.includes("quota") ||
          msg.includes("rate limit") ||
          msg.includes("no longer available") ||
          msg.includes("NOT_FOUND") ||
          msg.includes("Overloaded");

        // If there are more models to try and this is a transient model error, proceed to next model
        if (isTransientOrModelError && i < candidateModels.length - 1) {
          console.warn(
            `[GeminiAdapter] Model '${currentModel}' returned status ${err?.status || "error"} (${err?.message?.slice(0, 80)}...). Cascading to '${candidateModels[i + 1]}' for resilience...`
          );
          continue;
        }

        throw err;
      }
    }

    if (!response && lastError) {
      throw lastError;
    }

    const inPrompt = request.systemPrompt
      ? `${request.systemPrompt}\n\n${request.prompt}`
      : request.prompt;
    const text = response?.text || "";
    const inTokens = estimateTokenCount(inPrompt);
    const outTokens = estimateTokenCount(text);

    return { text, inputTokens: inTokens, outputTokens: outTokens, modelUsed: successfulModel } as any;
  }

  async testConnection(
    key: string,
    model: string,
    customEndpoint?: string,
    timeoutMs: number = 15000
  ): Promise<TestResult> {
    const startTime = Date.now();
    const targetModel =
      model === "gemini-3.6-flash" ||
      model === "gemini-3.5-flash-lite" ||
      model === "gemini-2.5-flash" ||
      model === "gemini-2.0-flash" ||
      model === "gemini-1.5-flash" ||
      !model
        ? "gemini-3.8-flash"
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
          model: (res as any).modelUsed || targetModel,
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
