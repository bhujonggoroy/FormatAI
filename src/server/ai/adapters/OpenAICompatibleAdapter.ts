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

  async listModels(): Promise<ModelInfo[]> {
    return this.defaultModels;
  }

  supportsCapability(capability: string, modelId: string): boolean {
    const model = this.defaultModels.find((m) => m.id === modelId) || this.defaultModels[0];
    if (!model) return true;
    return model.capabilities.includes(capability);
  }

  normalizeError(error: any): NormalizedAIError {
    const message = error?.message || String(error);
    const status = error?.status || error?.statusCode;

    if (status === 401 || /invalid[_\s]?api[_\s]?key|unauthorized|authentication|401/i.test(message)) {
      return {
        kind: "invalid_key",
        statusCode: 401,
        message: `${this.name} API key is invalid or unauthorized.`,
        retryable: false,
        rawError: error,
      };
    }

    if (status === 403 || /forbidden|permission|access denied|403/i.test(message)) {
      return {
        kind: "permission_denied",
        statusCode: 403,
        message: `${this.name} permission denied or blocked.`,
        retryable: false,
        rawError: error,
      };
    }

    if (
      status === 429 ||
      /rate[_\s]?limit|too many requests|quota|exceeded your current quota|429/i.test(message)
    ) {
      return {
        kind: "rate_limit",
        statusCode: 429,
        message: `${this.name} rate limit or quota exceeded (429).`,
        retryable: true,
        rawError: error,
      };
    }

    if (
      status === 408 ||
      status === 504 ||
      /timeout|timed out|aborted|ETIMEDOUT|ECONNRESET/i.test(message)
    ) {
      return {
        kind: "timeout",
        statusCode: status || 408,
        message: `${this.name} request timed out.`,
        retryable: true,
        rawError: error,
      };
    }

    if (/context[_\s]?length|token limit|maximum context|prompt too long/i.test(message)) {
      return {
        kind: "token_limit",
        statusCode: 400,
        message: `${this.name} model context window or token limit exceeded.`,
        retryable: false,
        rawError: error,
      };
    }

    if (status === 404 || /model[_\s]?not[_\s]?found|does not exist|unavailable/i.test(message)) {
      return {
        kind: "model_unavailable",
        statusCode: 404,
        message: `Requested model is unavailable on ${this.name}.`,
        retryable: false,
        rawError: error,
      };
    }

    if (status >= 500 && status < 600) {
      return {
        kind: "server_error",
        statusCode: status,
        message: `${this.name} server error (${status}).`,
        retryable: true,
        rawError: error,
      };
    }

    if (/fetch failed|network|getaddrinfo|econnrefused/i.test(message)) {
      return {
        kind: "network_error",
        message: `Network failure connecting to ${this.name}.`,
        retryable: true,
        rawError: error,
      };
    }

    return {
      kind: "unknown",
      statusCode: status,
      message: message || `Unknown ${this.name} error`,
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
      throw new Error(`No API key provided for ${this.name}.`);
    }

    const endpoint = options?.customEndpoint || this.defaultBaseUrl;
    const effectiveModel = model || this.defaultModels[0]?.id;

    const messages: Array<{ role: string; content: string }> = [];
    if (request.systemPrompt) {
      messages.push({ role: "system", content: request.systemPrompt });
    }
    messages.push({ role: "user", content: request.prompt });

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
          temperature: options?.temperature ?? request.temperature ?? 0.2,
          max_tokens: options?.maxTokens ?? request.maxTokens ?? 4096,
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
        const errMsg =
          data?.error?.message ||
          data?.message ||
          data?.detail ||
          `HTTP ${response.status} from ${this.name}`;
        throw {
          statusCode: response.status,
          message: errMsg,
          status: response.status,
        };
      }

      const text =
        data?.choices?.[0]?.message?.content ||
        data?.choices?.[0]?.text ||
        data?.output ||
        "";

      const inTokens =
        data?.usage?.prompt_tokens ??
        estimateTokenCount(request.prompt + (request.systemPrompt || ""));
      const outTokens =
        data?.usage?.completion_tokens ?? estimateTokenCount(text);

      return { text, inputTokens: inTokens, outputTokens: outTokens };
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

  async testConnection(
    key: string,
    model: string,
    customEndpoint?: string,
    timeoutMs: number = 15000
  ): Promise<TestResult> {
    const startTime = Date.now();
    const effectiveModel = model || this.defaultModels[0]?.id;

    try {
      const res = await this.generate(
        { prompt: "Respond with the single word 'OK'." },
        key,
        effectiveModel,
        { timeoutMs, customEndpoint, maxTokens: 10 }
      );

      const latency = Date.now() - startTime;
      if (res.text && res.text.length > 0) {
        return {
          success: true,
          providerId: this.id,
          providerName: this.name,
          model: effectiveModel,
          latencyMs: latency,
        };
      }

      throw new Error(`Empty response returned from ${this.name} test.`);
    } catch (err: any) {
      const latency = Date.now() - startTime;
      const normalized = this.normalizeError(err);
      return {
        success: false,
        providerId: this.id,
        providerName: this.name,
        model: effectiveModel,
        latencyMs: latency,
        errorMessage: normalized.message,
        statusCode: normalized.statusCode,
        errorKind: normalized.kind,
      };
    }
  }
}
