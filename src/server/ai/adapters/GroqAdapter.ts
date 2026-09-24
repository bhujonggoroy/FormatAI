import { OpenAICompatibleAdapter } from "./OpenAICompatibleAdapter.ts";
import type { ModelInfo } from "../types.ts";
import type { AdapterOptions } from "./BaseAdapter.ts";
import { CENTRAL_CATALOG, normalizeModelInfo, DEPRECATED_OR_RETIRED_MODELS } from "../../../shared/centralModelCatalog.ts";

export class GroqAdapter extends OpenAICompatibleAdapter {
  constructor() {
    const defaultModels: ModelInfo[] = CENTRAL_CATALOG.groq;

    super({
      id: "groq",
      name: "Groq (Fast LPU)",
      defaultBaseUrl: "https://api.groq.com/openai/v1/chat/completions",
      defaultModels,
      modelsEndpoint: "https://api.groq.com/openai/v1/models",
      customHeaders: {
        "User-Agent": "formatai/2.0",
      },
    });
  }

  override async getModels(apiKey?: string, options?: AdapterOptions): Promise<ModelInfo[]> {
    if (!apiKey?.trim()) return this.defaultModels;
    try {
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        signal: AbortSignal.timeout(options?.timeoutMs || 8000),
      });

      if (!res.ok) return this.defaultModels;
      const data = await res.json();
      if (!Array.isArray(data?.data)) return this.defaultModels;

      // Filter active chat models (excluding whisper/audio/embeddings/safeguard and decommissioned models)
      const chatModels = data.data.filter((m: any) => {
        const id = (m.id || "").toLowerCase();
        return (
          m.active !== false &&
          !id.includes("whisper") &&
          !id.includes("embed") &&
          !id.includes("guard") &&
          !DEPRECATED_OR_RETIRED_MODELS[m.id]
        );
      });

      if (chatModels.length > 0) {
        return chatModels.map((m: any) =>
          normalizeModelInfo(
            {
              id: m.id,
              name: m.id.replace(/[-_]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
              status: "active",
              free: true,
              isFree: true,
              apiAvailable: true,
              deprecated: false,
              retired: false,
              freeTier: "Free tier (30 RPM on Groq LPU)",
              contextWindow: m.context_window || 131072,
              capabilities: ["text", "math", "long_context", "json", "code"],
              description: `Groq LPU model (${m.id})`,
            },
            "groq"
          )
        );
      }
      return this.defaultModels;
    } catch {
      return this.defaultModels;
    }
  }
}
