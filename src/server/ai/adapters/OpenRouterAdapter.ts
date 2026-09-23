import { OpenAICompatibleAdapter } from "./OpenAICompatibleAdapter.ts";
import type { ModelInfo, NormalizedAIError } from "../types.ts";
import type { AdapterOptions } from "./BaseAdapter.ts";

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
        "HTTP-Referer": "https://formatai.ai.studio",
        "X-Title": "FormatAI",
      },
      modelsEndpoint: "https://openrouter.ai/api/v1/models",
    });
  }

  // Dynamic model fetching from OpenRouter /api/v1/models
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
        .filter((m: any) => m.id?.endsWith(":free"))
        .slice(0, 15)
        .map((m: any) => ({
          id: m.id,
          name: `${m.name || m.id} (Free)`,
          contextWindow: m.context_length || 32768,
          isFree: true,
          capabilities: ["text", "math", "long_context", "json", "code"],
          description: m.description?.slice(0, 140) || "OpenRouter free model",
        }));

      const topPaidModels: ModelInfo[] = data.data
        .filter((m: any) => !m.id?.endsWith(":free") && (m.id.includes("claude") || m.id.includes("gpt-4o") || m.id.includes("gemini") || m.id.includes("mistral")))
        .slice(0, 15)
        .map((m: any) => ({
          id: m.id,
          name: m.name || m.id,
          contextWindow: m.context_length || 32768,
          isFree: false,
          capabilities: ["text", "math", "long_context", "json", "code"],
          description: m.description?.slice(0, 140) || "OpenRouter paid model",
        }));

      const combined = [...freeModels, ...topPaidModels];
      return combined.length > 0 ? combined : this.defaultModels;
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
}
