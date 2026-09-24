import { OpenAICompatibleAdapter } from "./OpenAICompatibleAdapter.ts";
import type { ModelInfo, NormalizedAIError } from "../types.ts";
import type { AdapterOptions } from "./BaseAdapter.ts";
import { CENTRAL_CATALOG, normalizeModelInfo, DEPRECATED_OR_RETIRED_MODELS } from "../../../shared/centralModelCatalog.ts";

export class OpenRouterAdapter extends OpenAICompatibleAdapter {
  constructor() {
    const defaultModels: ModelInfo[] = CENTRAL_CATALOG.openrouter;

    super({
      id: "openrouter",
      name: "OpenRouter",
      defaultBaseUrl: "https://openrouter.ai/api/v1/chat/completions",
      defaultModels,
      customHeaders: {
        "HTTP-Referer": "https://formatai.ai.studio",
        "X-Title": "FormatAI",
      },
      modelsEndpoint: "https://openrouter.ai/api/v1/models",
    });
  }

  // Dynamic model fetching from OpenRouter /api/v1/models with strict $0 free verification
  async getModels(apiKey?: string, options?: AdapterOptions): Promise<ModelInfo[]> {
    try {
      const headers: Record<string, string> = { ...this.customHeaders };
      if (apiKey?.trim()) headers["Authorization"] = `Bearer ${apiKey.trim()}`;

      const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers,
        signal: AbortSignal.timeout(options?.timeoutMs || 8000),
      });

      if (!res.ok) return this.defaultModels;
      const data = await res.json();
      if (!Array.isArray(data?.data)) return this.defaultModels;

      const freeModels: ModelInfo[] = data.data
        .filter((m: any) => {
          const isFreeId = m.id?.endsWith(":free");
          const promptPrice = parseFloat(m.pricing?.prompt || "1");
          const completionPrice = parseFloat(m.pricing?.completion || "1");
          const isZeroPrice = promptPrice === 0 && completionPrice === 0;
          return (isFreeId || isZeroPrice) && !DEPRECATED_OR_RETIRED_MODELS[m.id];
        })
        .slice(0, 20)
        .map((m: any) =>
          normalizeModelInfo(
            {
              id: m.id,
              name: `${m.name || m.id} (Free)`,
              status: "active",
              free: true,
              isFree: true,
              apiAvailable: true,
              deprecated: false,
              retired: false,
              freeTier: "Free tier ($0 prompt / $0 completion)",
              contextWindow: m.context_length || 32768,
              capabilities: ["text", "math", "long_context", "json", "code"],
              description: m.description?.slice(0, 140) || "OpenRouter verified $0 free model",
            },
            "openrouter"
          )
        );

      return freeModels.length > 0 ? freeModels : this.defaultModels;
    } catch {
      return this.defaultModels;
    }
  }

  async fetchRemoteModels(apiKey?: string): Promise<ModelInfo[]> {
    return this.getModels(apiKey);
  }

  override classifyError(error: any): NormalizedAIError {
    const message = error?.message || (typeof error === "string" ? error : JSON.stringify(error));
    const status = error?.status || error?.statusCode;
    const msgLower = message.toLowerCase();

    // Specific OpenRouter Rule: "Requested model is unavailable on OpenRouter." MUST NOT become "Invalid API key."
    if (
      status === 404 ||
      msgLower.includes("requested model is unavailable on openrouter") ||
      msgLower.includes("no endpoints available for model") ||
      msgLower.includes("model unavailable") ||
      msgLower.includes("model not found") ||
      msgLower.includes("does not exist on openrouter") ||
      msgLower.includes("unknown model")
    ) {
      return {
        code: "MODEL_UNAVAILABLE",
        kind: "model_unavailable",
        statusCode: status || 404,
        title: "❌ Model Unavailable on OpenRouter",
        message: `Requested model is unavailable on OpenRouter: ${message}`,
        userFacingMessage: "The selected model is unavailable on OpenRouter. Click 'Refresh Models' to update available models, or select another free model.",
        retryable: false,
        rawError: error,
      };
    }

    // OpenRouter 429 MUST NOT become invalid key
    if (status === 429 || msgLower.includes("rate limit") || msgLower.includes("quota")) {
      return {
        code: "RATE_LIMIT",
        kind: "rate_limit",
        statusCode: 429,
        title: "⚠️ OpenRouter Rate Limit Exceeded",
        message: `OpenRouter rate limit or credit quota exceeded (429): ${message}`,
        userFacingMessage: "OpenRouter rate limit reached. Please wait a moment or switch to another provider.",
        retryable: true,
        rawError: error,
      };
    }

    return super.classifyError(error);
  }

  override async generate(
    requestOrKey: any,
    keyOrModelId?: string,
    modelOrRequest?: any,
    options?: AdapterOptions
  ) {
    // If user provides a model ID that matches one of our registered free models without :free, append :free
    let modelToUse = typeof modelOrRequest === "string" ? modelOrRequest : (requestOrKey?.model || keyOrModelId || "");
    if (typeof requestOrKey === "string" && keyOrModelId && !modelOrRequest) {
      modelToUse = keyOrModelId;
    }
    if (modelToUse && !modelToUse.endsWith(":free")) {
      const match = this.defaultModels.find(
        (m) => m.id === `${modelToUse}:free` || m.id.replace(/:free$/, "") === modelToUse
      );
      if (match) {
        if (typeof modelOrRequest === "string") {
          modelOrRequest = match.id;
        } else if (typeof requestOrKey !== "string" && requestOrKey) {
          requestOrKey.model = match.id;
        } else if (typeof requestOrKey === "string") {
          keyOrModelId = match.id;
        }
      }
    }
    return super.generate(requestOrKey, keyOrModelId, modelOrRequest, options);
  }
}
