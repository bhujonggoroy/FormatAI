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
      description: "Cohere flagship model for complex instructions.",
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

  async getModels(apiKey?: string, options?: AdapterOptions): Promise<ModelInfo[]> {
    if (!apiKey?.trim()) return this.defaultModels;
    try {
      const res = await fetch("https://api.cohere.com/v1/models", {
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        signal: AbortSignal.timeout(options?.timeoutMs || 8000),
      });

      if (!res.ok) return this.defaultModels;
      const data = await res.json();
      if (!Array.isArray(data?.models)) return this.defaultModels;

      const chatModels = data.models.filter((m: any) => {
        const endpoints = m.endpoints || [];
        return endpoints.includes("chat") || endpoints.includes("generate");
      });

      if (chatModels.length > 0) {
        return chatModels.map((m: any) => ({
          id: m.name || m.id,
          name: m.name || m.id,
          contextWindow: m.context_length || 32768,
          isFree: !m.name?.includes("plus"),
          capabilities: ["text", "math", "long_context", "json", "code"],
          description: `Cohere model (${m.name})`,
        }));
      }
      return this.defaultModels;
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
    const status = error?.status || error?.statusCode;
    const msgLower = message.toLowerCase();

    if (
      status === 404 ||
      msgLower.includes("model not found") ||
      msgLower.includes("does not exist") ||
      msgLower.includes("model unavailable")
    ) {
      return {
        code: "MODEL_UNAVAILABLE",
        kind: "model_unavailable",
        statusCode: 404,
        title: "❌ Model Unavailable on Cohere",
        message: `Cohere model unavailable: ${message}`,
        userFacingMessage: "The selected Cohere model is unavailable. Please select another model.",
        retryable: false,
        rawError: error,
      };
    }

    if (
      status === 429 ||
      msgLower.includes("rate limit") ||
      msgLower.includes("quota") ||
      msgLower.includes("trial key rate limit")
    ) {
      return {
        code: "RATE_LIMIT",
        kind: "rate_limit",
        statusCode: 429,
        title: "⚠️ Cohere Rate Limit Exceeded",
        message: `Cohere rate limit reached (429): ${message}`,
        userFacingMessage: "Cohere trial rate limit exceeded. Please wait a moment or switch provider.",
        retryable: true,
        rawError: error,
      };
    }

    if (status === 401 || msgLower.includes("invalid api key") || msgLower.includes("unauthorized")) {
      return {
        code: "INVALID_API_KEY",
        kind: "invalid_key",
        statusCode: 401,
        title: "❌ Invalid Cohere API Key",
        message: "Cohere API key is invalid or unauthorized.",
        userFacingMessage: "The Cohere API key is invalid. Please check your key in AI Settings.",
        retryable: false,
        rawError: error,
      };
    }

    if (status === 403 || msgLower.includes("forbidden") || msgLower.includes("blocked")) {
      return {
        code: "FORBIDDEN",
        kind: "permission_denied",
        statusCode: 403,
        title: "❌ Cohere Permission Denied (403)",
        message: `Cohere permission denied: ${message}`,
        userFacingMessage: "Access to this Cohere model is forbidden with your current key.",
        retryable: false,
        rawError: error,
      };
    }

    if (status >= 500 && status < 600) {
      return {
        code: "SERVER_ERROR",
        kind: "server_error",
        statusCode: status,
        title: `⚠️ Cohere Server Error (${status})`,
        message: `Cohere server error: ${message}`,
        userFacingMessage: "Cohere service is temporarily unavailable.",
        retryable: true,
        rawError: error,
      };
    }

    return {
      code: "UNKNOWN_ERROR",
      kind: "unknown",
      statusCode: status,
      title: "❌ Cohere Error",
      message: message || "Unknown Cohere error",
      userFacingMessage: message || "An unexpected error occurred with Cohere.",
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
      throw new Error("No API key provided for Cohere.");
    }

    const endpoint = options?.customEndpoint || "https://api.cohere.com/v2/chat";
    const messages: Array<{ role: string; content: string }> = [];
    if (req.systemPrompt) {
      messages.push({ role: "system", content: req.systemPrompt });
    }
    messages.push({ role: "user", content: req.prompt });

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
          temperature: options?.temperature ?? req.temperature ?? 0.2,
          max_tokens: options?.maxTokens ?? req.maxTokens ?? 4096,
        }),
      });

      clearTimeout(timeout);
      const responseBody = await response.text();
      let data: any;
      try {
        data = JSON.parse(responseBody);
      } catch {
        throw {
          statusCode: response.status,
          message: `HTTP ${response.status}: ${responseBody.slice(0, 200)}`,
        };
      }

      if (!response.ok) {
        throw {
          statusCode: response.status,
          message: data?.message || `HTTP ${response.status} from Cohere`,
        };
      }

      let text = "";
      if (Array.isArray(data?.message?.content)) {
        text = data.message.content.map((c: any) => c.text || "").join("\n");
      } else if (typeof data?.text === "string") {
        text = data.text;
      }

      const inTokens = data?.usage?.tokens?.input_tokens ?? estimateTokenCount(req.prompt);
      const outTokens = data?.usage?.tokens?.output_tokens ?? estimateTokenCount(text);

      return { text, inputTokens: inTokens, outputTokens: outTokens, modelUsed: effectiveModel };
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

  async test(
    apiKey: string,
    modelId: string,
    options?: AdapterOptions
  ): Promise<TestResult> {
    const startTime = Date.now();
    const effectiveModel = modelId || this.defaultModels[0]?.id;
    const endpoint = options?.customEndpoint || "https://api.cohere.com/v2/chat";
    const masked = maskApiKey(apiKey);

    try {
      const res = await this.generate(
        { prompt: "Reply with the single word OK." },
        apiKey,
        effectiveModel,
        { timeoutMs: options?.timeoutMs || 15000, customEndpoint: endpoint }
      );

      const latency = Date.now() - startTime;
      if (res.text) {
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
      throw new Error("Empty response from Cohere.");
    } catch (err: any) {
      const latency = Date.now() - startTime;
      const norm = this.classifyError(err);
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
        errorCode: norm.code,
        errorKind: norm.kind,
        errorTitle: norm.title,
        userFacingMessage: norm.userFacingMessage,
        errorMessage: norm.message,
        statusCode: norm.statusCode,
        diagnostic: {
          provider: this.name,
          keyId: options?.keyId || "key_selected",
          modelId: effectiveModel,
          endpoint,
          maskedKey: masked,
          result: norm.code || "FAILED",
          latencyMs: latency,
          rawMessage: norm.message,
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
