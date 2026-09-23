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

export const CLOUDFLARE_DEFAULT_MODELS: ModelInfo[] = [
  {
    id: "@cf/meta/llama-3.3-70b-instruct",
    name: "Llama 3.3 70B Instruct (Workers AI)",
    contextWindow: 128000,
    isFree: true,
    capabilities: ["text", "math", "long_context", "json", "code"],
    description: "Meta flagship 70B hosted on Cloudflare Workers AI edge.",
  },
  {
    id: "@cf/meta/llama-3.1-8b-instruct",
    name: "Llama 3.1 8B Instruct (Workers AI)",
    contextWindow: 128000,
    isFree: true,
    capabilities: ["text", "math", "long_context", "json", "code"],
    description: "Ultra-low latency edge model for fast transformations.",
  },
  {
    id: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
    name: "DeepSeek R1 Distill Qwen 32B (Workers AI)",
    contextWindow: 64000,
    isFree: true,
    capabilities: ["text", "math", "long_context", "json", "code"],
    description: "Reasoning model with deep mathematical and formula proofing.",
  },
  {
    id: "@cf/mistral/mistral-7b-instruct-v0.2",
    name: "Mistral 7B Instruct v0.2 (Workers AI)",
    contextWindow: 32768,
    isFree: true,
    capabilities: ["text", "math", "json", "code"],
    description: "Compact, dependable open instruction model.",
  },
];

export class CloudflareAdapter implements AIProviderAdapter {
  readonly id = "cloudflare";
  readonly name = "Cloudflare Workers AI";
  private defaultAccountId: string = process.env.CLOUDFLARE_ACCOUNT_ID || "";

  async listModels(): Promise<ModelInfo[]> {
    return CLOUDFLARE_DEFAULT_MODELS;
  }

  supportsCapability(capability: string, modelId: string): boolean {
    const model = CLOUDFLARE_DEFAULT_MODELS.find((m) => m.id === modelId);
    if (!model) return true;
    return model.capabilities.includes(capability);
  }

  normalizeError(error: any): NormalizedAIError {
    const message = error?.message || String(error);
    const status = error?.status || error?.statusCode;

    if (status === 401 || /unauthorized|invalid api key|invalid token|401/i.test(message)) {
      return {
        kind: "invalid_key",
        statusCode: 401,
        message: "Cloudflare Workers AI API token is invalid or lacks Workers AI read/run permissions.",
        retryable: false,
        rawError: error,
      };
    }

    if (status === 403 || /forbidden|403|access denied/i.test(message)) {
      return {
        kind: "permission_denied",
        statusCode: 403,
        message: "Cloudflare permission denied. Ensure Account ID is correct and API token has Workers AI permission.",
        retryable: false,
        rawError: error,
      };
    }

    if (status === 429 || /rate[_\s]?limit|too many requests|daily limit|neuron/i.test(message)) {
      return {
        kind: "rate_limit",
        statusCode: 429,
        message: "Cloudflare Workers AI rate limit or neuron quota exceeded (429).",
        retryable: true,
        rawError: error,
      };
    }

    if (status === 404 || /model not found|could not find model/i.test(message)) {
      return {
        kind: "model_unavailable",
        statusCode: 404,
        message: "Cloudflare model not found or currently unavailable.",
        retryable: false,
        rawError: error,
      };
    }

    if (status === 408 || status === 504 || /timeout|timed out|abort/i.test(message)) {
      return {
        kind: "timeout",
        statusCode: status || 408,
        message: "Cloudflare Workers AI request timed out.",
        retryable: true,
        rawError: error,
      };
    }

    if (status && status >= 500) {
      return {
        kind: "server_error",
        statusCode: status,
        message: `Cloudflare server error (${status}).`,
        retryable: true,
        rawError: error,
      };
    }

    return {
      kind: "unknown",
      statusCode: status,
      message: message || "Unknown error occurred with Cloudflare Workers AI.",
      retryable: false,
      rawError: error,
    };
  }

  private resolveAccountId(options?: AdapterOptions): string {
    if (options?.customEndpoint && options.customEndpoint.includes("/accounts/")) {
      const match = options.customEndpoint.match(/\/accounts\/([^/]+)/);
      if (match && match[1]) return match[1];
    }
    return process.env.CLOUDFLARE_ACCOUNT_ID || this.defaultAccountId || "dummy-account";
  }

  async generate(
    request: AIRequest,
    key: string,
    model: string,
    options?: AdapterOptions
  ): Promise<{ text: string; inputTokens?: number; outputTokens?: number }> {
    const accountId = this.resolveAccountId(options);
    const timeoutMs = options?.timeoutMs || 45000;
    const cleanModel = model.startsWith("@cf/") ? model : `@cf/${model}`;

    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${cleanModel}`;

    const messages: Array<{ role: string; content: string }> = [];
    if (request.systemPrompt) {
      messages.push({ role: "system", content: request.systemPrompt });
    }
    messages.push({ role: "user", content: request.prompt });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages,
          max_tokens: request.maxTokens || 4096,
          temperature: request.temperature ?? 0.2,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        let errData: any = {};
        try {
          errData = await response.json();
        } catch {
          // ignore json parse error
        }
        const errorMsg =
          errData?.errors?.[0]?.message ||
          errData?.error ||
          `Cloudflare HTTP ${response.status}: ${response.statusText}`;
        const err: any = new Error(errorMsg);
        err.status = response.status;
        err.raw = errData;
        throw err;
      }

      const data = await response.json();
      const text =
        data?.result?.response ||
        data?.result?.choices?.[0]?.message?.content ||
        "";

      return {
        text,
        inputTokens: estimateTokenCount(request.prompt + (request.systemPrompt || "")),
        outputTokens: estimateTokenCount(text),
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

  async testConnection(
    key: string,
    model: string,
    customEndpoint?: string,
    timeoutMs = 15000
  ): Promise<TestResult> {
    const start = Date.now();
    try {
      const result = await this.generate(
        {
          prompt: "Echo the word 'Ready' and compute 2 + 2.",
          systemPrompt: "You are a fast healthcheck probe. Answer concisely.",
          maxTokens: 30,
          temperature: 0.1,
        },
        key,
        model || CLOUDFLARE_DEFAULT_MODELS[0].id,
        { timeoutMs, customEndpoint }
      );

      return {
        success: Boolean(result.text && result.text.length > 0),
        providerId: this.id,
        providerName: this.name,
        model: model || CLOUDFLARE_DEFAULT_MODELS[0].id,
        latencyMs: Date.now() - start,
      };
    } catch (err: any) {
      const norm = this.normalizeError(err);
      return {
        success: false,
        providerId: this.id,
        providerName: this.name,
        model: model || CLOUDFLARE_DEFAULT_MODELS[0].id,
        latencyMs: Date.now() - start,
        errorMessage: norm.message,
        statusCode: norm.statusCode,
        errorKind: norm.kind,
      };
    }
  }
}
