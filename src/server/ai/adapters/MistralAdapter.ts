import { OpenAICompatibleAdapter } from "./OpenAICompatibleAdapter.ts";
import type { ModelInfo } from "../types.ts";

export class MistralAdapter extends OpenAICompatibleAdapter {
  constructor() {
    const defaultModels: ModelInfo[] = [
      {
        id: "mistral-small-latest",
        name: "Mistral Small (Latest)",
        contextWindow: 32768,
        isFree: true,
        capabilities: ["text", "math", "long_context", "json", "code"],
        description: "Balanced reasoning, math, and code with generous free tier tiering.",
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
        description: "Trained on 80+ programming languages & mathematical notation.",
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
      defaultModels,
    });
  }
}
