import { OpenAICompatibleAdapter } from "./OpenAICompatibleAdapter.ts";
import type { ModelInfo, NormalizedAIError } from "../types.ts";
import type { AdapterOptions } from "./BaseAdapter.ts";
import { CENTRAL_CATALOG, normalizeModelInfo, DEPRECATED_OR_RETIRED_MODELS } from "../../../shared/centralModelCatalog.ts";

export class MistralAdapter extends OpenAICompatibleAdapter {
  constructor() {
    const defaultModels: ModelInfo[] = CENTRAL_CATALOG.mistral;

    super({
      id: "mistral",
      name: "Mistral AI",
      defaultBaseUrl: "https://api.mistral.ai/v1/chat/completions",
      modelsEndpoint: "https://api.mistral.ai/v1/models",
      defaultModels,
    });
  }

  override async getModels(apiKey?: string, options?: AdapterOptions): Promise<ModelInfo[]> {
    if (!apiKey?.trim()) return this.defaultModels;
    try {
      const res = await fetch("https://api.mistral.ai/v1/models", {
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        signal: AbortSignal.timeout(options?.timeoutMs || 8000),
      });

      if (!res.ok) return this.defaultModels;
      const data = await res.json();
      if (!Array.isArray(data?.data)) return this.defaultModels;

      const chatModels = data.data.filter((m: any) => {
        const id = (m.id || "").toLowerCase();
        return (
          !id.includes("embed") &&
          !id.includes("moderation") &&
          !DEPRECATED_OR_RETIRED_MODELS[m.id]
        );
      });

      if (chatModels.length > 0) {
        return chatModels.map((m: any) => {
          const isPaid = m.id.includes("large") || m.id.includes("pixtral-large");
          return normalizeModelInfo(
            {
              id: m.id,
              name: m.name || m.id,
              status: "active",
              free: !isPaid,
              isFree: !isPaid,
              apiAvailable: true,
              deprecated: false,
              retired: false,
              freeTier: !isPaid ? "Free tier (La Plateforme experiment tier)" : "Paid tier only",
              contextWindow: m.max_context_length || 32768,
              capabilities: ["text", "math", "long_context", "json", "code"],
              description: m.description?.slice(0, 140) || `Mistral model (${m.id})`,
            },
            "mistral"
          );
        });
      }
      return this.defaultModels;
    } catch {
      return this.defaultModels;
    }
  }

  override classifyError(error: any): NormalizedAIError {
    const status = error?.status || error?.statusCode;
    const msg = (error?.message || "").toLowerCase();

    // Specific Mistral Rule: HTTP 429 MUST NOT become "Invalid API key"
    if (status === 429 || msg.includes("rate limit") || msg.includes("too many requests") || msg.includes("quota")) {
      return {
        code: "RATE_LIMIT",
        kind: "rate_limit",
        statusCode: 429,
        title: "⚠️ Mistral Rate Limit Exceeded",
        message: `Mistral rate limit or quota exceeded (429): ${error?.message || "Too many requests"}`,
        userFacingMessage: "Mistral rate limit reached. Please wait a moment or try another provider.",
        retryable: true,
        rawError: error,
      };
    }

    return super.classifyError(error);
  }
}
