import { OpenAICompatibleAdapter } from "./OpenAICompatibleAdapter.ts";
import { ModelInfo } from "../types.ts";

export class HuggingFaceAdapter extends OpenAICompatibleAdapter {
  constructor() {
    const defaultModels: ModelInfo[] = [
      {
        id: "Qwen/Qwen2.5-72B-Instruct",
        name: "Qwen 2.5 72B Instruct (Math Leader)",
        contextWindow: 32768,
        isFree: true,
        capabilities: ["text", "math", "long_context", "json", "code"],
        description: "Alibaba Cloud's open weights model with premier LaTeX & math reasoning.",
      },
      {
        id: "meta-llama/Llama-3.3-70B-Instruct",
        name: "Meta Llama 3.3 70B Instruct",
        contextWindow: 128000,
        isFree: true,
        capabilities: ["text", "math", "long_context", "json", "code"],
        description: "Meta's flagship open model hosted on Hugging Face Inference API.",
      },
      {
        id: "mistralai/Mistral-7B-Instruct-v0.3",
        name: "Mistral 7B Instruct v0.3",
        contextWindow: 32768,
        isFree: true,
        capabilities: ["text", "math", "json", "code"],
        description: "Lightweight, reliable instruction follower.",
      },
    ];

    super({
      id: "huggingface",
      name: "Hugging Face Inference",
      defaultBaseUrl: "https://router.huggingface.co/hf-inference/v1/chat/completions",
      defaultModels,
      customHeaders: {
        "User-Agent": "notebooklm-docx-converter/1.0",
      },
    });
  }
}
