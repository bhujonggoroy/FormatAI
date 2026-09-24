import {
  estimateTokenCount,
  maskApiKey,
  type AIProviderAdapter,
  type AdapterOptions,
} from "./BaseAdapter.ts";
import type {
  AIRequest,
  ModelInfo,
  NormalizedAIError,
  TestResult,
} from "../types.ts";
import { CENTRAL_CATALOG, normalizeModelInfo } from "../../../shared/centralModelCatalog.ts";
import { FORMATAI_DIAGNOSTIC_PROMPT } from "./OpenAICompatibleAdapter.ts";

export class AnthropicAdapter implements AIProviderAdapter {
  readonly id = "claude";
  readonly name = "Anthropic Claude";

  private defaultModels: ModelInfo[] = CENTRAL_CATALOG.claude || [];

  async getModels(apiKey?: string, options?: AdapterOptions): Promise<ModelInfo[]> {
    if (!apiKey?.trim()) return this.defaultModels;

    try {
      // Query Anthropic official /v1/models endpoint
      const res = await fetch("https://api.anthropic.com/v1/models", {
        headers: {
          "x-api-key": apiKey.trim(),
          "anthropic-version": "2023-06-01",
        },
        signal: AbortSignal.timeout(options?.timeoutMs || 8000),
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.data) && data.data.length > 0) {
          return data.data
            .filter((m: any) => m?.id && m.type === "model")
            .map((m: any) =>
              normalizeModelInfo(
                {
                  id: m.id,
                  name: m.display_name || m.id,
                  status: "active",
                  free: false,
                  isFree: false,
                  apiAvailable: true,
                  deprecated: false,
                  retired: false,
                  freeTier: "Anthropic API tier / pay-as-you-go",
                  contextWindow: 200000,
                  capabilities: ["text", "math", "long_context", "json", "code"],
                  description: `Anthropic Claude model (${m.id})`,
                },
                "claude"
              )
            );
        }
      }
    } catch {
      // Fall through to known active models if models endpoint is unavailable on this key tier
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

    // 1. Model unavailable
    if (
      status === 404 ||
      msgLower.includes("not_found_error") ||
      msgLower.includes("model not found") ||
      msgLower.includes("does not exist") ||
      msgLower.includes("model is not available")
    ) {
      return {
        code: "MODEL_UNAVAILABLE",
        kind: "model_unavailable",
        statusCode: status || 404,
        title: "❌ Model Unavailable on Claude",
        message: `Requested Claude model is unavailable: ${message}`,
        userFacingMessage: "The selected model is unavailable on Anthropic. Please select an active Claude model (e.g., claude-3-7-sonnet-latest).",
        retryable: false,
        rawError: error,
      };
    }

    // 2. Rate limit / Overloaded
    if (
      status === 429 ||
      msgLower.includes("rate_limit_error") ||
      msgLower.includes("overloaded_error") ||
      msgLower.includes("too many requests")
    ) {
      return {
        code: "RATE_LIMIT",
        kind: "rate_limit",
        statusCode: 429,
        title: "⚠️ Claude Rate Limit Exceeded",
        message: `Claude rate limit reached: ${message}`,
        userFacingMessage: "Anthropic Claude rate limit reached. Please wait a moment before trying again.",
        retryable: true,
        rawError: error,
      };
    }

    // 3. Invalid API Key
    if (
      status === 401 ||
      msgLower.includes("authentication_error") ||
      msgLower.includes("invalid x-api-key") ||
      msgLower.includes("invalid api key")
    ) {
      return {
        code: "INVALID_API_KEY",
        kind: "invalid_key",
        statusCode: 401,
        title: "❌ Invalid Anthropic API Key",
        message: `Anthropic rejected API key: ${message}`,
        userFacingMessage: "Your Anthropic API key was rejected. Please check your credentials at console.anthropic.com.",
        retryable: false,
        rawError: error,
      };
    }

    // 4. Billing / Credit Required
    if (
      status === 400 && msgLower.includes("credit balance") ||
      msgLower.includes("plans & billing") ||
      msgLower.includes("insufficient balance") ||
      msgLower.includes("purchase credits")
    ) {
      return {
        code: "BILLING_REQUIRED",
        kind: "billing_required",
        statusCode: status || 402,
        title: "💳 Anthropic Billing Required",
        message: `Anthropic account requires active credits: ${message}`,
        userFacingMessage: "Your Anthropic account requires prepaid credits. Visit console.anthropic.com to top up your balance.",
        retryable: false,
        rawError: error,
      };
    }

    // 5. Permission Denied (403)
    if (status === 403 || msgLower.includes("permission_error")) {
      return {
        code: "FORBIDDEN",
        kind: "permission_denied",
        statusCode: 403,
        title: "❌ Anthropic Access Forbidden (403)",
        message: `Anthropic permission denied: ${message}`,
        userFacingMessage: "This API key does not have permission for the requested Claude model or region.",
        retryable: false,
        rawError: error,
      };
    }

    // 6. Network / Timeout
    if (
      status === 408 ||
      status === 504 ||
      msgLower.includes("timeout") ||
      msgLower.includes("fetch failed") ||
      msgLower.includes("network")
    ) {
      return {
        code: "TIMEOUT",
        kind: "timeout",
        statusCode: status || 408,
        title: "⚠️ Anthropic Connection Timeout",
        message: `Connection to Anthropic timed out: ${message}`,
        userFacingMessage: "Request to Anthropic Claude timed out. Please retry.",
        retryable: true,
        rawError: error,
      };
    }

    return {
      code: "UNKNOWN_ERROR",
      kind: "unknown",
      statusCode: status,
      title: "❌ Anthropic Error",
      message: message || "Unknown Anthropic error",
      userFacingMessage: message || "An error occurred while communicating with Anthropic Claude.",
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
      throw new Error("No API key provided for Anthropic Claude.");
    }

    const payload: any = {
      model: effectiveModel,
      max_tokens: options?.maxTokens || 4096,
      messages: [{ role: "user", content: req.prompt }],
    };

    if (req.systemPrompt) {
      payload.system = req.systemPrompt;
    }
    if (options?.temperature !== undefined || req.temperature !== undefined) {
      payload.temperature = options?.temperature ?? req.temperature;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key.trim(),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(options?.timeoutMs || 45000),
    });

    const bodyText = await response.text();
    let data: any;
    try {
      data = JSON.parse(bodyText);
    } catch {
      throw {
        status: response.status,
        statusCode: response.status,
        message: `HTTP ${response.status}: ${bodyText.slice(0, 200)}`,
      };
    }

    if (!response.ok) {
      throw {
        status: response.status,
        statusCode: response.status,
        message: data?.error?.message || data?.message || `HTTP ${response.status} from Anthropic`,
      };
    }

    const contentBlocks = data?.content || [];
    const text = contentBlocks
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n");

    const inTokens = data?.usage?.input_tokens ?? estimateTokenCount(req.prompt + (req.systemPrompt || ""));
    const outTokens = data?.usage?.output_tokens ?? estimateTokenCount(text);

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
    const endpoint = "https://api.anthropic.com/v1/messages";

    try {
      const res = await this.generate(
        { prompt: FORMATAI_DIAGNOSTIC_PROMPT },
        apiKey,
        effectiveModel,
        {
          timeoutMs: options?.timeoutMs || 15000,
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

      throw new Error("Empty response returned from Claude test.");
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
