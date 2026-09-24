import { GoogleGenAI } from "@google/genai";
import {
  estimateTokenCount,
  maskApiKey,
  type AIProviderAdapter,
  type AdapterOptions,
} from "./BaseAdapter.ts";
import type {
  AIErrorCode,
  AIErrorKind,
  AIRequest,
  ModelInfo,
  NormalizedAIError,
  TestResult,
} from "../types.ts";
import { CENTRAL_CATALOG, normalizeModelInfo, DEPRECATED_OR_RETIRED_MODELS } from "../../../shared/centralModelCatalog.ts";
import { FORMATAI_DIAGNOSTIC_PROMPT } from "./OpenAICompatibleAdapter.ts";

export class GeminiAdapter implements AIProviderAdapter {
  readonly id = "gemini";
  readonly name = "Google Gemini";

  private defaultModels: ModelInfo[] = CENTRAL_CATALOG.gemini;

  async getModels(apiKey?: string, options?: AdapterOptions): Promise<ModelInfo[]> {
    const key = apiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
    if (!key) return this.defaultModels;

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, {
        signal: AbortSignal.timeout(options?.timeoutMs || 8000),
      });

      if (!res.ok) return this.defaultModels;
      const data = await res.json();
      if (!Array.isArray(data?.models)) return this.defaultModels;

      const chatModels: ModelInfo[] = data.models
        .filter((m: any) => {
          const methods = m.supportedGenerationMethods || [];
          const name = m.name || "";
          const rawId = name.replace(/^models\//, "");
          return (
            methods.includes("generateContent") &&
            !name.includes("embedding") &&
            !name.includes("aqa") &&
            !name.includes("imagen") &&
            !rawId.includes("exp") && // No obsolete preview endpoints
            !DEPRECATED_OR_RETIRED_MODELS[rawId]
          );
        })
        .map((m: any) => {
          const rawId = m.name.replace(/^models\//, "");
          const isPro = rawId.includes("pro");
          return normalizeModelInfo(
            {
              id: rawId,
              name: m.displayName || rawId,
              status: "active",
              free: !isPro,
              isFree: !isPro,
              apiAvailable: true,
              deprecated: false,
              retired: false,
              freeTier: !isPro ? "Free tier (15 RPM, 1,500 RPD)" : "Paid only",
              contextWindow: m.inputTokenLimit || 1048576,
              capabilities: ["text", "math", "long_context", "json", "code"],
              description: m.description?.slice(0, 140) || `Google Gemini model (${rawId})`,
            },
            "gemini"
          );
        });

      return chatModels.length > 0 ? chatModels : this.defaultModels;
    } catch {
      return this.defaultModels;
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    return this.getModels();
  }

  supportsCapability(capability: string, modelId: string): boolean {
    const model = this.defaultModels.find((m) => m.id === modelId) || this.defaultModels[0];
    if (!model) return true;
    return model.capabilities.includes(capability);
  }

  classifyError(error: any): NormalizedAIError {
    const message = error?.message || (typeof error === "string" ? error : JSON.stringify(error));
    const status = error?.status || error?.statusCode || error?.response?.status;
    const msgLower = message.toLowerCase();

    // 1. Model unavailable / Not found (Must check before 400 generic)
    if (
      status === 404 ||
      msgLower.includes("not_found") ||
      msgLower.includes("models/") && msgLower.includes("not found") ||
      msgLower.includes("model not found") ||
      msgLower.includes("is not found for api version") ||
      msgLower.includes("is not supported for generatecontent") ||
      msgLower.includes("model is deprecated") ||
      msgLower.includes("model unavailable")
    ) {
      return {
        code: "MODEL_UNAVAILABLE",
        kind: "model_unavailable",
        statusCode: status || 404,
        title: "❌ Model Unavailable on Gemini",
        message: `The requested Gemini model is not found or unsupported: ${message}`,
        userFacingMessage: "The selected model is unavailable on Gemini. Click 'Refresh Models' or select an active model (e.g. gemini-3.8-flash).",
        retryable: false,
        rawError: error,
      };
    }

    // 2. Rate limit / Quota exceeded
    if (
      status === 429 ||
      msgLower.includes("resource_exhausted") ||
      msgLower.includes("quota") ||
      msgLower.includes("rate limit") ||
      msgLower.includes("too many requests") ||
      msgLower.includes("exceeded your current quota")
    ) {
      return {
        code: "RATE_LIMIT",
        kind: "rate_limit",
        statusCode: 429,
        title: "⚠️ Gemini Rate Limit Exceeded",
        message: `Gemini free tier quota or rate limit reached (429): ${message}`,
        userFacingMessage: "Gemini rate limit or quota exceeded. Please wait a moment or switch to another provider.",
        retryable: true,
        rawError: error,
      };
    }

    // 3. Invalid API Key
    if (
      status === 401 ||
      msgLower.includes("api_key_invalid") ||
      msgLower.includes("invalid api key") ||
      msgLower.includes("unauthenticated") ||
      msgLower.includes("api key not valid")
    ) {
      return {
        code: "INVALID_API_KEY",
        kind: "invalid_key",
        statusCode: 401,
        title: "❌ Invalid Gemini API Key",
        message: "Gemini API key is invalid or unauthorized.",
        userFacingMessage: "The Gemini API key was rejected as invalid. Please check the key in AI Settings.",
        retryable: false,
        rawError: error,
      };
    }

    // 4. Permission Denied / Forbidden
    if (
      status === 403 ||
      msgLower.includes("permission_denied") ||
      msgLower.includes("forbidden") ||
      msgLower.includes("access denied") ||
      msgLower.includes("user location is not supported")
    ) {
      return {
        code: "FORBIDDEN",
        kind: "permission_denied",
        statusCode: 403,
        title: "❌ Gemini Permission Denied (403)",
        message: `Gemini access forbidden: ${message}`,
        userFacingMessage: "This API key does not have permission or Gemini is not supported in the current region.",
        retryable: false,
        rawError: error,
      };
    }

    // 5. Token Limit
    if (
      msgLower.includes("context length") ||
      msgLower.includes("maximum context") ||
      msgLower.includes("token limit") ||
      msgLower.includes("too many tokens")
    ) {
      return {
        code: "BAD_REQUEST",
        kind: "token_limit",
        statusCode: 400,
        title: "⚠️ Context Window Exceeded",
        message: "Gemini context window or token limit exceeded.",
        userFacingMessage: "The document is too large for the model's context window.",
        retryable: false,
        rawError: error,
      };
    }

    // 6. Timeout
    if (
      status === 408 ||
      status === 504 ||
      msgLower.includes("timeout") ||
      msgLower.includes("deadline_exceeded") ||
      msgLower.includes("aborted")
    ) {
      return {
        code: "TIMEOUT",
        kind: "timeout",
        statusCode: status || 408,
        title: "⚠️ Gemini Request Timeout",
        message: "Gemini API request timed out.",
        userFacingMessage: "The request timed out waiting for Gemini to respond.",
        retryable: true,
        rawError: error,
      };
    }

    // 7. Server error (5xx / UNAVAILABLE / Overloaded)
    if (
      (status && status >= 500 && status < 600) ||
      msgLower.includes("unavailable") ||
      msgLower.includes("high demand") ||
      msgLower.includes("spikes in demand") ||
      msgLower.includes("overloaded")
    ) {
      return {
        code: "SERVER_ERROR",
        kind: "server_error",
        statusCode: status || 503,
        title: "⚠️ Gemini Service Temporarily Unavailable",
        message: `Gemini service unavailable: ${message}`,
        userFacingMessage: "Google Gemini servers are experiencing temporary high demand (503).",
        retryable: true,
        rawError: error,
      };
    }

    // 8. Network Error
    if (
      msgLower.includes("fetch failed") ||
      msgLower.includes("network") ||
      msgLower.includes("dns") ||
      msgLower.includes("getaddrinfo")
    ) {
      return {
        code: "NETWORK_ERROR",
        kind: "network_error",
        title: "⚠️ Connection Problem",
        message: `Network error connecting to Gemini API: ${message}`,
        userFacingMessage: "Could not establish a network connection to Google Gemini.",
        retryable: true,
        rawError: error,
      };
    }

    return {
      code: "UNKNOWN_ERROR",
      kind: "unknown",
      statusCode: status,
      title: "❌ Gemini Error",
      message: message || "Unknown Gemini error",
      userFacingMessage: message || "An unexpected error occurred while communicating with Gemini.",
      retryable: false,
      rawError: error,
    };
  }

  normalizeError(error: any): NormalizedAIError {
    return this.classifyError(error);
  }

  async generate(
    requestOrKey: AIRequest | string,
    keyOrModelId?: string,
    modelOrRequest?: string | AIRequest,
    options?: AdapterOptions
  ): Promise<{ text: string; inputTokens?: number; outputTokens?: number; modelUsed?: string }> {
    let req: AIRequest;
    let key: string;
    let effectiveModel: string;

    if (typeof requestOrKey === "string") {
      key = requestOrKey;
      effectiveModel = keyOrModelId || this.defaultModels[0]?.id;
      req = (modelOrRequest as AIRequest) || { prompt: "" };
    } else {
      req = requestOrKey;
      key = keyOrModelId || "";
      effectiveModel = (typeof modelOrRequest === "string" ? modelOrRequest : "") || req.model || this.defaultModels[0]?.id;
    }

    if (!key) {
      throw new Error("No API key provided for Google Gemini.");
    }

    const ai = new GoogleGenAI({ apiKey: key.trim() });
    const config: any = {
      temperature: options?.temperature ?? req.temperature ?? 0.2,
    };
    if (req.systemPrompt) {
      config.systemInstruction = req.systemPrompt;
    }

    const response = await ai.models.generateContent({
      model: effectiveModel,
      contents: req.prompt,
      config,
    });

    const inPrompt = req.systemPrompt ? `${req.systemPrompt}\n\n${req.prompt}` : req.prompt;
    const text = response?.text || "";
    const inTokens = estimateTokenCount(inPrompt);
    const outTokens = estimateTokenCount(text);

    return {
      text,
      inputTokens: inTokens,
      outputTokens: outTokens,
      modelUsed: effectiveModel,
    };
  }

  async test(
    apiKey: string,
    modelId: string,
    options?: AdapterOptions
  ): Promise<TestResult> {
    const startTime = Date.now();
    const effectiveModel = modelId || this.defaultModels[0]?.id;
    const masked = maskApiKey(apiKey);
    const endpoint = "https://generativelanguage.googleapis.com";

    try {
      const res = await this.generate(
        { prompt: FORMATAI_DIAGNOSTIC_PROMPT },
        apiKey,
        effectiveModel,
        { timeoutMs: options?.timeoutMs || 15000 }
      );

      const latency = Date.now() - startTime;
      if (res.text && res.text.length > 0) {
        return {
          success: true,
          providerId: this.id,
          providerName: this.name,
          model: effectiveModel,
          keyId: options?.keyId,
          keyName: options?.keyName,
          maskedKey: masked,
          endpoint,
          latencyMs: latency,
          diagnostic: {
            provider: this.name,
            keyId: options?.keyId || "key_selected",
            modelId: effectiveModel,
            endpoint,
            maskedKey: masked,
            result: "SUCCESS",
            latencyMs: latency,
          },
        };
      }

      throw new Error("Empty response returned from Gemini test.");
    } catch (err: any) {
      const latency = Date.now() - startTime;
      const normalized = this.classifyError(err);
      return {
        success: false,
        providerId: this.id,
        providerName: this.name,
        model: effectiveModel,
        keyId: options?.keyId,
        keyName: options?.keyName,
        maskedKey: masked,
        endpoint,
        latencyMs: latency,
        errorCode: normalized.code,
        errorKind: normalized.kind,
        errorTitle: normalized.title,
        userFacingMessage: normalized.userFacingMessage,
        errorMessage: normalized.message,
        statusCode: normalized.statusCode,
        diagnostic: {
          provider: this.name,
          keyId: options?.keyId || "key_selected",
          modelId: effectiveModel,
          endpoint,
          maskedKey: masked,
          result: normalized.code || "FAILED",
          latencyMs: latency,
          rawMessage: normalized.message,
        },
      };
    }
  }

  async testConnection(
    key: string,
    model: string,
    customEndpoint?: string,
    timeoutMs: number = 15000
  ): Promise<TestResult> {
    return this.test(key, model, { customEndpoint, timeoutMs });
  }
}
