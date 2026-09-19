import { OpenAICompatibleAdapter } from "./OpenAICompatibleAdapter.ts";
import { ModelInfo } from "../types.ts";

export class OpenRouterAdapter extends OpenAICompatibleAdapter {
  constructor() {
    const defaultModels: ModelInfo[] = [
      {
        id: "meta-llama/llama-3.3-70b-instruct:free",
        name: "Llama 3.3 70B Instruct (Free)",
        contextWindow: 131072,
        isFree: true,
        capabilities: ["text", "math", "long_context", "json", "code"],
        description: "High-capability free open model routed via OpenRouter.",
      },
      {
        id: "google/gemini-2.0-flash-exp:free",
        name: "Google Gemini 2.0 Flash Exp (Free)",
        contextWindow: 1048576,
        isFree: true,
        capabilities: ["text", "math", "long_context", "json", "code"],
        description: "Google Gemini routed through OpenRouter's free tier.",
      },
      {
        id: "deepseek/deepseek-r1:free",
        name: "DeepSeek R1 (Free / Reasoning)",
        contextWindow: 64000,
        isFree: true,
        capabilities: ["text", "math", "long_context", "json", "code"],
        description: "High-level mathematical & logical reasoning open model.",
      },
      {
        id: "mistralai/mistral-7b-instruct:free",
        name: "Mistral 7B Instruct (Free)",
        contextWindow: 32768,
        isFree: true,
        capabilities: ["text", "math", "json", "code"],
        description: "Efficient free tier Mistral model.",
      },
      {
        id: "anthropic/claude-3.5-haiku",
        name: "Anthropic Claude 3.5 Haiku",
        contextWindow: 200000,
        isFree: false,
        capabilities: ["text", "math", "long_context", "json", "code"],
        description: "Fast Anthropic model with exceptional markdown formatting (Paid).",
      },
      {
        id: "openai/gpt-4o-mini",
        name: "OpenAI GPT-4o Mini",
        contextWindow: 128000,
        isFree: false,
        capabilities: ["text", "math", "long_context", "json", "code"],
        description: "Cost-effective OpenAI model for standard formatting (Paid).",
      },
    ];

    super({
      id: "openrouter",
      name: "OpenRouter",
      defaultBaseUrl: "https://openrouter.ai/api/v1/chat/completions",
      defaultModels,
      customHeaders: {
        "HTTP-Referer": "https://github.com/google/notebooklm-to-docx",
        "X-Title": "NotebookLM to DOCX Converter",
      },
    });
  }

  // Dynamic model fetching from OpenRouter /api/v1/models if user requests or on init
  async fetchRemoteModels(apiKey?: string): Promise<ModelInfo[]> {
    try {
      const headers: Record<string, string> = {};
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

      const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers,
        signal: AbortSignal.timeout(6000),
      });

      if (!res.ok) return this.defaultModels;
      const data = await res.json();
      if (!Array.isArray(data?.data)) return this.defaultModels;

      const freeModels = data.data
        .filter((m: any) => m.id?.endsWith(":free"))
        .slice(0, 15)
        .map((m: any) => ({
          id: m.id,
          name: `${m.name || m.id} (Free)`,
          contextWindow: m.context_length || 32768,
          isFree: true,
          capabilities: ["text", "math", "long_context", "json"],
          description: m.description?.slice(0, 120) || "OpenRouter free model",
        }));

      if (freeModels.length > 0) {
        return freeModels;
      }
      return this.defaultModels;
    } catch {
      return this.defaultModels;
    }
  }
}
