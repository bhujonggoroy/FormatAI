import { OpenAICompatibleAdapter } from "./OpenAICompatibleAdapter.ts";
import type { ModelInfo } from "../types.ts";
import type { AdapterOptions } from "./BaseAdapter.ts";

export class GroqAdapter extends OpenAICompatibleAdapter {
  constructor() {
    const defaultModels: ModelInfo[] = [
      {
        id: "llama-3.3-70b-versatile",
        name: "Llama 3.3 70B Versatile",
        contextWindow: 128000,
        isFree: true,
        capabilities: ["text", "math", "long_context", "json", "code"],
        description: "Meta's flagship 70B parameter open model on Groq LPU with lightning-fast inference.",
      },
      {
        id: "llama-3.1-8b-instant",
        name: "Llama 3.1 8B Instant",
        contextWindow: 128000,
        isFree: true,
        capabilities: ["text", "math", "long_context", "json", "code"],
        description: "Extremely low latency model for quick note formatting and equations.",
      },
      {
        id: "mixtral-8x7b-32768",
        name: "Mixtral 8x7B Instruct",
        contextWindow: 32768,
        isFree: true,
        capabilities: ["text", "math", "long_context", "json", "code"],
        description: "Mistral's mixture-of-experts model on Groq.",
      },
      {
        id: "gemma2-9b-it",
        name: "Gemma 2 9B IT",
        contextWindow: 8192,
        isFree: true,
        capabilities: ["text", "math", "json", "code"],
        description: "Google lightweight open model on Groq.",
      },
    ];

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

      // Filter active chat models (excluding whisper/audio/embeddings)
      const chatModels = data.data.filter((m: any) => {
        const id = (m.id || "").toLowerCase();
        return (
          m.active !== false &&
          !id.includes("whisper") &&
          !id.includes("embed") &&
          !id.includes("guard")
        );
      });

      if (chatModels.length > 0) {
        return chatModels.map((m: any) => ({
          id: m.id,
          name: m.id.replace(/[-_]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
          contextWindow: m.context_window || 32768,
          isFree: true, // Groq free tier applies to all standard models
          capabilities: ["text", "math", "long_context", "json", "code"],
          description: `Groq LPU model (${m.id})`,
        }));
      }
      return this.defaultModels;
    } catch {
      return this.defaultModels;
    }
  }
}
