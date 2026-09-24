import { OpenAICompatibleAdapter } from "./OpenAICompatibleAdapter.ts";
import type { ModelInfo } from "../types.ts";
import { CENTRAL_CATALOG } from "../../../shared/centralModelCatalog.ts";

export class HuggingFaceAdapter extends OpenAICompatibleAdapter {
  constructor() {
    const defaultModels: ModelInfo[] = CENTRAL_CATALOG.huggingface;

    super({
      id: "huggingface",
      name: "Hugging Face Inference",
      defaultBaseUrl: "https://router.huggingface.co/hf-inference/v1/chat/completions",
      defaultModels,
      customHeaders: {
        "User-Agent": "formatai/2.0",
      },
    });
  }
}
