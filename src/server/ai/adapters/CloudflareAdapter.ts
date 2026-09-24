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
import { CENTRAL_CATALOG } from "../../../shared/centralModelCatalog.ts";

export const CLOUDFLARE_DEFAULT_MODELS: ModelInfo[] = CENTRAL_CATALOG.cloudflare;

export class CloudflareAdapter implements AIProviderAdapter {
  readonly id = "cloudflare";
  readonly name = "Cloudflare Workers AI";
  private defaultAccountId: string = process.env.CLOUDFLARE_ACCOUNT_ID || "";

  async getModels(): Promise<ModelInfo[]> {
    return CLOUDFLARE_DEFAULT_MODELS;
  }

  async listModels(): Promise<ModelInfo[]> {
    return this.getModels();
  }

  supportsCapability(capability: string, modelId: string): boolean {
    const model = CLOUDFLARE_DEFAULT_MODELS.find((m) => m.id === modelId);
    if (!model) return true;
    return model.capabilities.includes(capability);
  }

  classifyError(error: any): NormalizedAIError {
    const message = error?.message || (typeof error === "string" ? error : JSON.stringify(error));
    const status = error?.status || error?.statusCode;
    const msgLower = message.toLowerCase();

    if (status === 404 || msgLower.includes("model not found") || msgLower.includes("could not find model")) {
      return {
        code: "MODEL_UNAVAILABLE",
        kind: "model_unavailable",
        statusCode: 404,
        title: "❌ Cloudflare Model Unavailable",
        message: "Cloudflare model not found or currently unavailable.",
        userFacingMessage: "The selected Cloudflare Workers AI model is not available.",
        retryable: false,
        rawError: error,
      };
    }

    if (status === 401 || msgLower.includes("unauthorized") || msgLower.includes("invalid api key") || msgLower.includes("invalid token")) {
      return {
        code: "INVALID_API_KEY",
        kind: "invalid_key",
        statusCode: 401,
        title: "❌ Invalid Cloudflare API Token",
        message: "Cloudflare Workers AI API token is invalid or lacks Workers AI read/run permissions.",
        userFacingMessage: "Invalid Cloudflare API token. Please verify your token and account permissions.",
        retryable: false,
        rawError: error,
      };
    }

    if (status === 403 || msgLower.includes("forbidden") || msgLower.includes("access denied")) {
      return {
        code: "FORBIDDEN",
        kind: "permission_denied",
        statusCode: 403,
        title: "❌ Cloudflare Permission Denied (403)",
        message: "Cloudflare permission denied. Ensure Account ID is correct and API token has Workers AI permission.",
        userFacingMessage: "Permission denied on Cloudflare. Check your Account ID and token permissions.",
        retryable: false,
        rawError: error,
      };
    }

    if (status === 429 || msgLower.includes("rate limit") || msgLower.includes("neuron") || msgLower.includes("daily limit")) {
      return {
        code: "RATE_LIMIT",
        kind: "rate_limit",
        statusCode: 429,
        title: "⚠️ Cloudflare Rate Limit Exceeded",
        message: "Cloudflare Workers AI rate limit or neuron quota exceeded (429).",
        userFacingMessage: "Cloudflare daily neuron quota or rate limit exceeded.",
        retryable: true,
        rawError: error,
      };
    }

    if (status === 408 || status === 504 || msgLower.includes("timeout") || msgLower.includes("abort")) {
      return {
        code: "TIMEOUT",
        kind: "timeout",
        statusCode: status || 408,
        title: "⚠️ Cloudflare Request Timeout",
        message: "Cloudflare Workers AI request timed out.",
        userFacingMessage: "Request timed out waiting for Cloudflare Workers AI.",
        retryable: true,
        rawError: error,
      };
    }

    if (status && status >= 500) {
      return {
        code: "SERVER_ERROR",
        kind: "server_error",
        statusCode: status,
        title: `⚠️ Cloudflare Server Error (${status})`,
        message: `Cloudflare server error (${status}): ${message}`,
        userFacingMessage: "Cloudflare Workers AI servers are experiencing temporary issues.",
        retryable: true,
        rawError: error,
      };
    }

    return {
      code: "UNKNOWN_ERROR",
      kind: "unknown",
      statusCode: status,
      title: "❌ Cloudflare Error",
      message: message || "Unknown error occurred with Cloudflare Workers AI.",
      userFacingMessage: message || "An unexpected error occurred with Cloudflare Workers AI.",
      retryable: false,
      rawError: error,
    };
  }

  normalizeError(error: any): NormalizedAIError {
    return this.classifyError(error);
  }

  private resolveAccountId(options?: AdapterOptions): string {
    if (options?.accountId?.trim()) {
      return options.accountId.trim();
    }
    if (options?.customEndpoint && options.customEndpoint.includes("/accounts/")) {
      const match = options.customEndpoint.match(/\/accounts\/([^/]+)/);
      if (match && match[1]) return match[1];
    }
    return this.defaultAccountId;
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
      effectiveModel = keyOrModelId || CLOUDFLARE_DEFAULT_MODELS[0].id;
      req = (modelOrRequest as AIRequest) || { prompt: "" };
    } else {
      req = requestOrKey;
      key = keyOrModelId || "";
      effectiveModel = (typeof modelOrRequest === "string" ? modelOrRequest : "") || req.model || CLOUDFLARE_DEFAULT_MODELS[0].id;
    }

    if (!key) {
      throw new Error("No API key/token provided for Cloudflare Workers AI.");
    }

    const accountId = this.resolveAccountId(options);
    if (!accountId) {
      throw new Error(
        "Missing Cloudflare Account ID. Please configure your Account ID in AI Settings or provide a full custom endpoint."
      );
    }

    const url =
      options?.customEndpoint ||
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${effectiveModel}`;

    const messages: Array<{ role: string; content: string }> = [];
    if (req.systemPrompt) {
      messages.push({ role: "system", content: req.systemPrompt });
    }
    messages.push({ role: "user", content: req.prompt });

    const controller = new AbortController();
    const timeoutMs = options?.timeoutMs || 45000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages,
          max_tokens: options?.maxTokens ?? req.maxTokens ?? 2048,
          temperature: options?.temperature ?? req.temperature ?? 0.2,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      const raw = await res.text();
      let data: any;
      try {
        data = JSON.parse(raw);
      } catch {
        throw {
          status: res.status,
          statusCode: res.status,
          message: `Cloudflare returned non-JSON response (HTTP ${res.status}): ${raw.slice(0, 160)}`,
        };
      }

      if (!res.ok || data?.success === false) {
        const errMessage =
          data?.errors?.[0]?.message ||
          data?.messages?.[0] ||
          `Cloudflare request failed with HTTP ${res.status}`;
        throw {
          status: res.status,
          statusCode: res.status,
          message: errMessage,
        };
      }

      const text =
        data?.result?.response ||
        data?.result?.choices?.[0]?.message?.content ||
        "";

      return {
        text,
        inputTokens: estimateTokenCount(req.prompt + (req.systemPrompt || "")),
        outputTokens: estimateTokenCount(text),
        modelUsed: effectiveModel,
      };
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === "AbortError") {
        const timeoutErr: any = new Error(`Request to Cloudflare timed out after ${timeoutMs}ms.`);
        timeoutErr.status = 408;
        throw timeoutErr;
      }
      throw err;
    }
  }

  async test(
    apiKey: string,
    modelId: string,
    options?: AdapterOptions
  ): Promise<TestResult> {
    const start = Date.now();
    const effectiveModel = modelId || CLOUDFLARE_DEFAULT_MODELS[0].id;
    const masked = maskApiKey(apiKey);
    const accountId = this.resolveAccountId(options);
    const endpoint = options?.customEndpoint || `https://api.cloudflare.com/client/v4/accounts/${accountId || "{account_id}"}/ai/run/${effectiveModel}`;

    try {
      const result = await this.generate(
        {
          prompt: "Respond with the single word 'OK'.",
          maxTokens: 10,
          temperature: 0.1,
        },
        apiKey,
        effectiveModel,
        options
      );

      const latency = Date.now() - start;
      return {
        success: Boolean(result.text && result.text.length > 0),
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
    } catch (err: any) {
      const latency = Date.now() - start;
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
    timeoutMs = 15000
  ): Promise<TestResult> {
    return this.test(key, model, { customEndpoint, timeoutMs });
  }
}
