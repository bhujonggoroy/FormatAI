import { OpenAICompatibleAdapter } from "./OpenAICompatibleAdapter.ts";
import type { ModelInfo, NormalizedAIError } from "../types.ts";
import type { AdapterOptions } from "./BaseAdapter.ts";

export class MistralAdapter extends OpenAICompatibleAdapter {
  constructor() {
    const defaultModels: ModelInfo[] = [
      {
        id: "mistral-small-latest",
        name: "Mistral Small (Latest)",
        contextWindow: 32768,
        isFree: true,
        capabilities: ["text", "math", "long_context", "json", "code"],
        description: "Balanced reasoning, math, and code on Mistral free/experiment tier.",
      },
      {
        id: "open-mistral-7b",
        name: "Open Mistral 7B",
        contextWindow: 32768,
        isFree: true,
        capabilities: ["text", "math", "json", "code"],
        description: "Fast base instruction model.",
      },
      {
        id: "codestral-latest",
        name: "Codestral (Latest / Math & Code)",
        contextWindow: 32768,
        isFree: true,
        capabilities: ["text", "math", "long_context", "code"],
        description: "Trained on programming languages & mathematical notation.",
      },
      {
        id: "mistral-large-latest",
        name: "Mistral Large (Paid)",
        contextWindow: 128000,
        isFree: false,
        capabilities: ["text", "math", "long_context", "json", "code"],
        description: "Top-tier flagship reasoning model.",
      },
    ];

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
        return !id.includes("embed") && !id.includes("moderation");
      });

      if (chatModels.length > 0) {
        return chatModels.map((m: any) => {
          const isPaid = m.id.includes("large") || m.id.includes("pixtral-large");
          return {
            id: m.id,
            name: m.name || m.id,
            contextWindow: m.max_context_length || 32768,
            isFree: !isPaid,
            capabilities: ["text", "math", "long_context", "json", "code"],
            description: m.description?.slice(0, 140) || `Mistral model (${m.id})`,
          };
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
