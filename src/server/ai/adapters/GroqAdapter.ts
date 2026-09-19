import { OpenAICompatibleAdapter } from "./OpenAICompatibleAdapter.ts";
import { ModelInfo } from "../types.ts";

export class GroqAdapter extends OpenAICompatibleAdapter {
  constructor() {
    const defaultModels: ModelInfo[] = [
      {
        id: "llama-3.3-70b-versatile",
        name: "Llama 3.3 70B Versatile (Free Tier Favorite)",
        contextWindow: 128000,
        isFree: true,
        capabilities: ["text", "math", "long_context", "json", "code"],
        description: "Meta's flagship 70B parameter open model on Groq LPU with lightning-fast inference.",
      },
      {
        id: "llama-3.1-8b-instant",
        name: "Llama 3.1 8B Instant (Ultra-fast)",
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
        description: "Mistral's popular mixture-of-experts model.",
      },
      {
        id: "gemma2-9b-it",
        name: "Gemma 2 9B IT",
        contextWindow: 8192,
        isFree: true,
        capabilities: ["text", "math", "json", "code"],
        description: "Google's lightweight open model optimized for academic instruction.",
      },
    ];

    super({
      id: "groq",
      name: "Groq (Fast LPU)",
      defaultBaseUrl: "https://api.groq.com/openai/v1/chat/completions",
      defaultModels,
      customHeaders: {
        "User-Agent": "notebooklm-docx-converter/1.0",
      },
    });
  }
}
