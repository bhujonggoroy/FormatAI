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

export const FORMATAI_DIAGNOSTIC_PROMPT =
  "Format the following mathematical expression into standard LaTeX notation: Var(X) = E[X^2] - (E[X])^2. Respond ONLY with the formatted math notation.";

export interface OpenAICompatibleAdapterConfig {
  id: string;
  name: string;
  defaultBaseUrl: string;
  defaultModels: ModelInfo[];
  authHeaderPrefix?: string; // default "Bearer"
  customHeaders?: Record<string, string>;
  modelsEndpoint?: string;
}

export class OpenAICompatibleAdapter implements AIProviderAdapter {
  readonly id: string;
  readonly name: string;
  protected defaultBaseUrl: string;
  protected defaultModels: ModelInfo[];
  protected authHeaderPrefix: string;
  protected customHeaders: Record<string, string>;
  protected modelsEndpoint?: string;

  constructor(config: OpenAICompatibleAdapterConfig) {
    this.id = config.id;
    this.name = config.name;
    this.defaultBaseUrl = config.defaultBaseUrl;
    this.defaultModels = config.defaultModels;
    this.authHeaderPrefix = config.authHeaderPrefix ?? "Bearer";
    this.customHeaders = config.customHeaders ?? {};
    this.modelsEndpoint = config.modelsEndpoint;
  }

  async getModels(apiKey?: string, options?: AdapterOptions): Promise<ModelInfo[]> {
    const endpoint =
      this.modelsEndpoint ||
      options?.customEndpoint?.replace(/\/chat\/completions\/?$/, "/models") ||
      this.defaultBaseUrl.replace(/\/chat\/completions\/?$/, "/models");

    if (endpoint && endpoint !== this.defaultBaseUrl) {
      try {
        const headers: Record<string, string> = { ...this.customHeaders };
        if (apiKey?.trim()) {
          headers["Authorization"] = `${this.authHeaderPrefix} ${apiKey.trim()}`;
        }
        const res = await fetch(endpoint, {
          headers,
          signal: AbortSignal.timeout(options?.timeoutMs || 8000),
        });

        if (res.ok) {
          const data = await res.json();
          const rawList = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : null;
          if (rawList && rawList.length > 0) {
            const mapped: ModelInfo[] = rawList
              .filter((m: any) => m && (m.id || m.name))
              .slice(0, 30)
              .map((m: any) => {
                const id = m.id || m.name;
                const isFree = Boolean(m.is_free || m.pricing?.prompt === 0 || id.includes(":free"));
                return {
                  id,
                  name: m.name || id,
                  contextWindow: m.context_length || m.max_tokens || 32768,
                  isFree,
                  capabilities: ["text", "math", "long_context", "json", "code"],
                  description: m.description?.slice(0, 140) || `${this.name} model (${id})`,
                };
              });

            if (mapped.length > 0) {
              return mapped;
            }
          }
        }
      } catch {
        // Fall back to default catalog on network or parse failure
      }
    }
    return this.defaultModels;
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

    // 1. Model unavailable check (MUST precede 400/401 checks to prevent false key error)
    if (
      status === 404 ||
      msgLower.includes("model unavailable") ||
      msgLower.includes("requested model is unavailable") ||
      msgLower.includes("no endpoints available for model") ||
      msgLower.includes("model not found") ||
      msgLower.includes("does not exist") ||
      msgLower.includes("is decommissioned") ||
      msgLower.includes("unknown model") ||
      msgLower.includes("is not supported")
    ) {
      return {
        code: "MODEL_UNAVAILABLE",
        kind: "model_unavailable",
        statusCode: status || 404,
        title: "❌ Model Unavailable",
        message: `Requested model is unavailable on ${this.name}: ${message}`,
        userFacingMessage: `The selected model is unavailable on ${this.name}. Please click 'Refresh Models' or select a different model.`,
        retryable: false,
        rawError: error,
      };
    }

    // 2. Rate limit / Quota (MUST NOT be mislabeled as invalid key)
    if (
      status === 429 ||
      msgLower.includes("rate limit") ||
      msgLower.includes("rate_limit") ||
      msgLower.includes("too many requests") ||
      msgLower.includes("resource exhausted") ||
      msgLower.includes("resource_exhausted") ||
      msgLower.includes("quota exceeded") ||
      msgLower.includes("exceeded your current quota")
    ) {
      return {
        code: "RATE_LIMIT",
        kind: "rate_limit",
        statusCode: 429,
        title: "⚠️ Rate Limit / Quota Exceeded",
        message: `${this.name} rate limit or quota exceeded (429): ${message}`,
        userFacingMessage: `${this.name} rate limit reached. Please wait a moment, use a different key, or switch provider.`,
        retryable: true,
        rawError: error,
      };
    }

    // 3. Invalid API key / Authentication
    if (
      status === 401 ||
      msgLower.includes("invalid api key") ||
      msgLower.includes("invalid_api_key") ||
      msgLower.includes("incorrect api key") ||
      msgLower.includes("unauthenticated") ||
      msgLower.includes("unauthorized") ||
      msgLower.includes("invalid auth") ||
      msgLower.includes("token invalid")
    ) {
      return {
        code: "INVALID_API_KEY",
        kind: "invalid_key",
        statusCode: 401,
        title: "❌ Invalid API Key",
        message: `${this.name} API key is invalid or unauthorized.`,
        userFacingMessage: `The API key was rejected by ${this.name}. Please verify your key.`,
        retryable: false,
        rawError: error,
      };
    }

    // 4. Forbidden / Permission denied
    if (
      status === 403 ||
      msgLower.includes("forbidden") ||
      msgLower.includes("permission denied") ||
      msgLower.includes("permission_denied") ||
      msgLower.includes("access denied") ||
      msgLower.includes("account suspended") ||
      msgLower.includes("country, region, or territory not supported")
    ) {
      return {
        code: "FORBIDDEN",
        kind: "permission_denied",
        statusCode: 403,
        title: "❌ Permission Denied (403)",
        message: `${this.name} permission denied or region restricted.`,
        userFacingMessage: `This API key does not have permission for ${this.name} or access is region-restricted.`,
        retryable: false,
        rawError: error,
      };
    }

    // 5. Token Limit
    if (
      msgLower.includes("context length") ||
      msgLower.includes("maximum context") ||
      msgLower.includes("token limit") ||
      msgLower.includes("prompt too long")
    ) {
      return {
        code: "BAD_REQUEST",
        kind: "token_limit",
        statusCode: 400,
        title: "⚠️ Token Limit Exceeded",
        message: `${this.name} model context window or token limit exceeded.`,
        userFacingMessage: `The document exceeds the maximum context length for this model.`,
        retryable: false,
        rawError: error,
      };
    }

    // 6. Timeout
    if (
      status === 408 ||
      status === 504 ||
      msgLower.includes("timeout") ||
      msgLower.includes("timed out") ||
      msgLower.includes("aborted") ||
      msgLower.includes("etimedout") ||
      msgLower.includes("econnreset")
    ) {
      return {
        code: "TIMEOUT",
        kind: "timeout",
        statusCode: status || 408,
        title: "⚠️ Request Timeout",
        message: `${this.name} request timed out.`,
        userFacingMessage: `The request to ${this.name} timed out waiting for a response.`,
        retryable: true,
        rawError: error,
      };
    }

    // 7. Server error (5xx)
    if (status && status >= 500 && status < 600) {
      return {
        code: "SERVER_ERROR",
        kind: "server_error",
        statusCode: status,
        title: `⚠️ Provider Server Error (${status})`,
        message: `${this.name} server error (${status}): ${message}`,
        userFacingMessage: `${this.name} servers are temporarily unavailable (${status}).`,
        retryable: true,
        rawError: error,
      };
    }

    // 8. Network / DNS error
    if (
      msgLower.includes("fetch failed") ||
      msgLower.includes("network") ||
      msgLower.includes("getaddrinfo") ||
      msgLower.includes("econnrefused")
    ) {
      return {
        code: "NETWORK_ERROR",
        kind: "network_error",
        title: "⚠️ Connection Problem",
        message: `Network failure connecting to ${this.name}: ${message}`,
        userFacingMessage: `Could not reach ${this.name} endpoint. Check internet connection.`,
        retryable: true,
        rawError: error,
      };
    }

    return {
      code: "UNKNOWN_ERROR",
      kind: "unknown",
      statusCode: status,
      title: "❌ Provider Error",
      message: message || `Unknown ${this.name} error`,
      userFacingMessage: message || `An error occurred while contacting ${this.name}.`,
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
      throw new Error(`No API key provided for ${this.name}.`);
    }

    const endpoint = options?.customEndpoint || this.defaultBaseUrl;
    const messages: Array<{ role: string; content: string }> = [];
    if (req.systemPrompt) {
      messages.push({ role: "system", content: req.systemPrompt });
    }
    messages.push({ role: "user", content: req.prompt });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `${this.authHeaderPrefix} ${key.trim()}`,
      ...this.customHeaders,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options?.timeoutMs || 45000);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
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
          status: response.status,
          message: `HTTP ${response.status}: ${responseBody.slice(0, 200)}`,
        };
      }

      if (!response.ok) {
        const errMsg =
          data?.error?.message ||
          data?.message ||
          data?.detail ||
          data?.error ||
          `HTTP ${response.status} from ${this.name}`;
        throw {
          statusCode: response.status,
          status: response.status,
          message: errMsg,
        };
      }

      const text =
        data?.choices?.[0]?.message?.content ||
        data?.choices?.[0]?.text ||
        data?.output ||
        "";

      const inTokens =
        data?.usage?.prompt_tokens ??
        estimateTokenCount(req.prompt + (req.systemPrompt || ""));
      const outTokens =
        data?.usage?.completion_tokens ?? estimateTokenCount(text);

      return {
        text,
        inputTokens: inTokens,
        outputTokens: outTokens,
        modelUsed: effectiveModel,
      };
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === "AbortError") {
        throw {
          status: 408,
          statusCode: 408,
          message: `Request to ${this.name} timed out after ${options?.timeoutMs || 45000}ms`,
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
    const endpoint = options?.customEndpoint || this.defaultBaseUrl;
    const masked = maskApiKey(apiKey);

    try {
      const res = await this.generate(
        { prompt: FORMATAI_DIAGNOSTIC_PROMPT },
        apiKey,
        effectiveModel,
        {
          timeoutMs: options?.timeoutMs || 15000,
          customEndpoint: endpoint,
          maxTokens: 50,
        }
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

      throw new Error(`Empty response returned from ${this.name} test.`);
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
