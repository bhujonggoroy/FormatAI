import { OpenAICompatibleAdapter } from "./OpenAICompatibleAdapter.ts";
import type { ModelInfo } from "../types.ts";
import type { AdapterOptions } from "./BaseAdapter.ts";
import { CENTRAL_CATALOG, normalizeModelInfo } from "../../../shared/centralModelCatalog.ts";

export class OpenAIAdapter extends OpenAICompatibleAdapter {
  constructor() {
    const defaultModels: ModelInfo[] = CENTRAL_CATALOG.openai || [];

    super({
      id: "openai",
      name: "OpenAI",
      defaultBaseUrl: "https://api.openai.com/v1/chat/completions",
      defaultModels,
      modelsEndpoint: "https://api.openai.com/v1/models",
      customHeaders: {
        "User-Agent": "formatai/2.0",
      },
    });
  }

  override async getModels(apiKey?: string, options?: AdapterOptions): Promise<ModelInfo[]> {
    if (!apiKey?.trim()) return this.defaultModels;
    try {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        signal: AbortSignal.timeout(options?.timeoutMs || 8000),
      });

      if (!res.ok) return this.defaultModels;
      const data = await res.json();
      if (!Array.isArray(data?.data)) return this.defaultModels;

      // Filter active chat models accessible to this API key
      const chatModels = data.data.filter((m: any) => {
        const id = (m.id || "").toLowerCase();
        return (
          (id.startsWith("gpt-") || id.startsWith("o1-") || id.startsWith("o3-") || id.startsWith("chatgpt-")) &&
          !id.includes("realtime") &&
          !id.includes("audio") &&
          !id.includes("transcribe") &&
          !id.includes("moderation") &&
          !id.includes("embedding") &&
          !id.includes("tts") &&
          !id.includes("dall-e")
        );
      });

      if (chatModels.length > 0) {
        return chatModels.slice(0, 20).map((m: any) =>
          normalizeModelInfo(
            {
              id: m.id,
              name: m.id.replace(/[-_]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
              status: "active",
              free: false,
              isFree: false,
              apiAvailable: true,
              deprecated: false,
              retired: false,
              freeTier: "OpenAI developer tier / pay-as-you-go",
              contextWindow: 128000,
              capabilities: ["text", "math", "long_context", "json", "code"],
              description: `OpenAI chat model (${m.id})`,
            },
            "openai"
          )
        );
      }
      return this.defaultModels;
    } catch {
      return this.defaultModels;
    }
  }
}
