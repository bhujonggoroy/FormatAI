import { OpenAICompatibleAdapter } from "./OpenAICompatibleAdapter.ts";
import type { ModelInfo } from "../types.ts";

export class CustomAdapter extends OpenAICompatibleAdapter {
  constructor() {
    const defaultModels: ModelInfo[] = [
      {
        id: "default-model",
        name: "Custom / Local Model",
        contextWindow: 32768,
        isFree: true,
        capabilities: ["text", "math", "long_context", "json", "code"],
        description: "Custom self-hosted model or OpenAI-compatible reverse proxy endpoint.",
      },
    ];

    super({
      id: "custom",
      name: "Custom / Self-Hosted (OpenAI Format)",
      defaultBaseUrl: "http://localhost:11434/v1/chat/completions",
      defaultModels,
    });
  }
}
