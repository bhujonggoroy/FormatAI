/**
 * Central AI Model Catalog & Status Registry
 *
 * Authoritative single source of truth for all supported AI providers and models in FormatAI.
 * Enforces:
 * 1. Current, active, genuine free-tier API models only.
 * 2. Strict distinction between open-source models vs. models with actual current free API access.
 * 3. Complete model status lifecycle: "active" | "preview" | "deprecated" | "retired" | "unavailable".
 * 4. Transparent free-tier quotas and limits ("Free tier — subject to provider limits").
 * 5. Automatic migration / replacement for legacy, deprecated, or decommissioned model IDs.
 */

export type ModelStatus = "active" | "preview" | "deprecated" | "retired" | "unavailable";

export interface ModelInfo {
  id: string;
  name: string;
  provider?: string;
  status: ModelStatus;
  free: boolean;
  isFree: boolean;
  apiAvailable: boolean;
  deprecated: boolean;
  retired: boolean;
  freeTier: string; // e.g. "Free tier — 15 RPM, 1500 RPD"
  contextWindow: number;
  capabilities: string[]; // ["text", "math", "long_context", "json", "code"]
  description?: string;
}

/**
 * Canonical provider ID normalizer
 * Maps aliases like 'google-gemini' -> 'gemini', 'anthropic' -> 'claude', 'open-router' -> 'openrouter', etc.
 */
export function canonicalProviderId(id?: string): string {
  if (!id) return "";
  const clean = id.toLowerCase().trim();
  switch (clean) {
    case "google-gemini":
    case "google_gemini":
    case "google":
    case "gemini":
      return "gemini";
    case "anthropic":
    case "claude":
      return "claude";
    case "open-ai":
    case "open_ai":
    case "openai":
      return "openai";
    case "open-router":
    case "open_router":
    case "openrouter":
      return "openrouter";
    case "groq":
      return "groq";
    case "mistral":
    case "mistralai":
      return "mistral";
    case "cohere":
      return "cohere";
    case "hugging-face":
    case "hugging_face":
    case "hf":
    case "huggingface":
      return "huggingface";
    case "cloudflare-workers-ai":
    case "cloudflare":
    case "cf":
      return "cloudflare";
    case "custom":
      return "custom";
    default:
      return clean;
  }
}

/**
 * Filter models that are selectable in the standard active model selector:
 * Must be status === "active" (or genuine free usable "preview")
 * AND free === true
 * AND apiAvailable === true
 * AND NOT deprecated
 * AND NOT retired
 */
export function isModelSelectable(model: any): boolean {
  if (!model) return false;
  const isFree = model.free === true || model.isFree === true;
  const isAvailable = model.apiAvailable !== false;
  const notDeprecated = !model.deprecated && !model.retired;
  const activeOrPreview = !model.status || model.status === "active" || model.status === "preview";
  return isFree && isAvailable && notDeprecated && activeOrPreview;
}

/**
 * Filter list of models to only currently active, free, available models.
 */
export function filterSelectableFreeModels(models: ModelInfo[]): ModelInfo[] {
  return (models || []).filter(isModelSelectable);
}

/**
 * Known deprecated or decommissioned model IDs that MUST NOT be used or selected.
 */
export const DEPRECATED_OR_RETIRED_MODELS: Record<string, string> = {
  // Google Gemini retired / obsolete legacy models (migrated to Gemini 3.8 Flash)
  "gemini-2.5-flash": "gemini-3.8-flash",
  "gemini-2.0-flash": "gemini-3.8-flash",
  "gemini-2.0-flash-lite": "gemini-3.5-flash-lite",
  "gemini-1.5-flash": "gemini-3.8-flash",
  "gemini-1.5-pro": "gemini-3.1-pro-preview",
  "gemini-2.0-flash-exp": "gemini-3.8-flash",
  "gemini-1.5-flash-latest": "gemini-3.8-flash",
  "gemini-pro": "gemini-3.8-flash",

  // Groq decommissioned / retired models
  "mixtral-8x7b-32768": "openai/gpt-oss-120b",
  "gemma2-9b-it": "qwen/qwen3.8-27b",
  "llama3-70b-8192": "openai/gpt-oss-120b",
  "llama3-8b-8192": "openai/gpt-oss-20b",
  "llama-3.3-70b-versatile": "openai/gpt-oss-120b",
  "llama-3.1-8b-instant": "openai/gpt-oss-20b",
  "qwen/qwen3-32b": "qwen/qwen3.8-27b",
  "qwen-2.5-32b": "qwen/qwen3.8-27b",
  "qwen/qwen3.6-27b": "qwen/qwen3.8-27b",
  "minimax/minimax-m2.7": "minimaxai/minimax-m2.7",
  "groq/compound": "openai/gpt-oss-120b",
  "groq/compound-mini": "openai/gpt-oss-20b",

  // Mistral retired models
  "mistral-small-latest": "mistral-small-4",
  "codestral-latest": "mistral-medium-3.5",
  "ministral-8b-latest": "ministral-3-8b",
  "mistral-large-latest": "mistral-large-3",
  "open-mistral-7b": "mistral-small-4",
  "codestral-2405": "mistral-medium-3.5",

  // Cohere retired models
  "command-r": "command-a-03-2025",
  "command-r7b-12-2024": "command-a-03-2025",
  "command-r-plus": "command-a-plus-05-2026",
  "command-light": "command-a-03-2025",
  "cohere/north-mini-code": "command-a-03-2025",

  // Hugging Face retired serverless models
  "Qwen/Qwen2.5-7B-Instruct": "Qwen/Qwen3.8-27B",
  "Qwen/Qwen2.5-72B-Instruct": "Qwen/Qwen3.8-27B",
  "meta-llama/Llama-3.1-8B-Instruct": "google/gemma-4-31B-it",
  "meta-llama/Llama-3.3-70B-Instruct": "google/gemma-4-31B-it",
  "mistralai/Mistral-7B-Instruct-v0.3": "zai-org/GLM-5.3",

  // Cloudflare retired models
  "@cf/meta/llama-3.3-70b-instruct": "@cf/qwen/qwen3.8-27b",
  "@cf/meta/llama-3.1-8b-instruct": "@cf/zai-org/glm-4.7-flash",
  "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b": "@cf/deepseek-ai/deepseek-v4-pro-0813",
  "@cf/mistral/mistral-7b-instruct-v0.2": "@cf/zai-org/glm-5.3-flash",
};

/**
 * Get active replacement for an obsolete or deprecated model ID
 */
export function getActiveReplacementModel(providerId: string, modelId: string): string {
  if (DEPRECATED_OR_RETIRED_MODELS[modelId]) {
    return DEPRECATED_OR_RETIRED_MODELS[modelId];
  }
  const defaults = CENTRAL_CATALOG[providerId.toLowerCase()];
  if (defaults && defaults.length > 0) {
    const active = defaults.find(isModelSelectable);
    if (active) return active.id;
    return defaults[0].id;
  }
  return modelId;
}

/**
 * Normalize and ensure all standard ModelInfo fields are populated
 */
export function normalizeModelInfo(raw: Partial<ModelInfo> & { id: string }, providerId: string): ModelInfo {
  const isDep = Boolean(raw.deprecated || DEPRECATED_OR_RETIRED_MODELS[raw.id]);
  const isRet = Boolean(raw.retired);
  const isFree = raw.free !== undefined ? Boolean(raw.free) : (raw.isFree !== undefined ? Boolean(raw.isFree) : true);
  const status: ModelStatus = raw.status || (isDep ? "deprecated" : isRet ? "retired" : "active");

  return {
    id: raw.id,
    name: raw.name || raw.id,
    provider: providerId,
    status,
    free: isFree,
    isFree,
    apiAvailable: raw.apiAvailable !== false && !isDep && !isRet,
    deprecated: isDep,
    retired: isRet,
    freeTier: raw.freeTier || (isFree ? "Free tier — subject to provider limits" : "Paid only"),
    contextWindow: raw.contextWindow || 32768,
    capabilities: Array.isArray(raw.capabilities) && raw.capabilities.length > 0
      ? raw.capabilities
      : ["text", "math", "long_context", "json", "code"],
    description: raw.description,
  };
}

/**
 * Official Central Model Catalog by Provider
 */
export const CENTRAL_CATALOG: Record<string, ModelInfo[]> = {
  gemini: [
    {
      id: "gemini-3.8-flash",
      name: "Gemini 3.8 Flash",
      provider: "gemini",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (15 RPM, 1,500 RPD)",
      contextWindow: 1048576,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Google's flagship fast model for academic notes, LaTeX, and mathematical formatting.",
    },
    {
      id: "gemini-3.7-flash",
      name: "Gemini 3.7 Flash",
      provider: "gemini",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (15 RPM, 1,500 RPD)",
      contextWindow: 1048576,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Next-gen hybrid reasoning and multimodal model with responsive speed.",
    },
    {
      id: "gemini-3.6-flash",
      name: "Gemini 3.6 Flash",
      provider: "gemini",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (15 RPM, 1,500 RPD)",
      contextWindow: 1048576,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "High-efficiency Flash model with balanced speed and technical formatting accuracy.",
    },
    {
      id: "gemini-3.5-flash",
      name: "Gemini 3.5 Flash",
      provider: "gemini",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (15 RPM, 1,500 RPD)",
      contextWindow: 1048576,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Reliable multimodal Flash model for structured document typesetting.",
    },
    {
      id: "gemini-3.5-flash-lite",
      name: "Gemini 3.5 Flash-Lite",
      provider: "gemini",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (30 RPM, 1,500 RPD)",
      contextWindow: 1048576,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Ultra-low latency, lightweight model for instant note cleanup and formatting.",
    },
    {
      id: "gemini-3.1-flash-lite",
      name: "Gemini 3.1 Flash-Lite",
      provider: "gemini",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (30 RPM, 1,500 RPD)",
      contextWindow: 1048576,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Fast lightweight model optimized for high-throughput notation corrections.",
    },
    {
      id: "gemini-3.1-pro-preview",
      name: "Gemini 3.1 Pro Preview",
      provider: "gemini",
      status: "preview",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (Preview access: 15 RPM)",
      contextWindow: 2097152,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Advanced pro-tier reasoning preview model with 2M token context.",
    },
    {
      id: "gemini-3-flash-preview",
      name: "Gemini 3 Flash Preview",
      provider: "gemini",
      status: "preview",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (Preview access: 15 RPM)",
      contextWindow: 1048576,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Experimental preview release of Gemini 3 Flash.",
    },
  ],

  groq: [
    {
      id: "openai/gpt-oss-120b",
      name: "GPT-OSS 120B",
      provider: "groq",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (30 RPM on Groq LPU)",
      contextWindow: 131072,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Flagship 120B open-weights model on Groq LPU with exceptional math and LaTeX performance.",
    },
    {
      id: "openai/gpt-oss-20b",
      name: "GPT-OSS 20B",
      provider: "groq",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (30 RPM on Groq LPU)",
      contextWindow: 131072,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Ultra-fast 20B Mixture-of-Experts model for near-instant text and document formatting.",
    },
    {
      id: "qwen/qwen3.8-27b",
      name: "Qwen 3.8 27B",
      provider: "groq",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (30 RPM on Groq LPU)",
      contextWindow: 131072,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Multimodal and text model with deep thinking mode and structured JSON support.",
    },
    {
      id: "minimaxai/minimax-m2.7",
      name: "MiniMax M2.7",
      provider: "groq",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (30 RPM on Groq LPU)",
      contextWindow: 131072,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Advanced reasoning and writing model with large context on Groq LPU.",
    },
  ],

  openrouter: [
    {
      id: "zai-org/glm-5.3-prime:free",
      name: "GLM 5.3 Prime (Free)",
      provider: "openrouter",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier ($0 prompt / $0 completion)",
      contextWindow: 1048576,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "GLM 5.3 Prime flagship model with deep mathematical and scientific reasoning.",
    },
    {
      id: "qwen/qwen3.8-max-prime:free",
      name: "Qwen3.8 Max Prime (Free)",
      provider: "openrouter",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier ($0 prompt / $0 completion)",
      contextWindow: 1048576,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Qwen3.8 Max Prime leading open model for technical LaTeX and STEM formatting.",
    },
    {
      id: "cohere/command-a-plus:free",
      name: "Command A+ (Free)",
      provider: "openrouter",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier ($0 prompt / $0 completion)",
      contextWindow: 262144,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Cohere Command A+ agentic reasoning model for structured academic analysis.",
    },
    {
      id: "openai/gpt-6-luna:free",
      name: "GPT-6 Luna (Free)",
      provider: "openrouter",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier ($0 prompt / $0 completion)",
      contextWindow: 524288,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "GPT-6 Luna fast multimodal intelligence with advanced mathematical formatting.",
    },
    {
      id: "openai/gpt-6-luna-pro:free",
      name: "GPT-6 Luna Pro (Free)",
      provider: "openrouter",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier ($0 prompt / $0 completion)",
      contextWindow: 1048576,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "GPT-6 Luna Pro high-performance reasoning model for rigorous LaTeX document synthesis.",
    },
    {
      id: "openai/gpt-6-sol:free",
      name: "GPT-6 Sol (Free)",
      provider: "openrouter",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier ($0 prompt / $0 completion)",
      contextWindow: 524288,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "GPT-6 Sol model specialized for speed, symbolic logic, and academic typesetting.",
    },
    {
      id: "openai/gpt-6-sol-pro:free",
      name: "GPT-6 Sol Pro (Free)",
      provider: "openrouter",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier ($0 prompt / $0 completion)",
      contextWindow: 1048576,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "GPT-6 Sol Pro premier model with maximum thinking effort and long context proofs.",
    },
  ],

  mistral: [
    {
      id: "mistral-medium-3.5",
      name: "Mistral Medium 3.5",
      provider: "mistral",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (La Plateforme experiment tier)",
      contextWindow: 65536,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Balanced reasoning, math, and code on Mistral official API.",
    },
    {
      id: "mistral-small-4",
      name: "Mistral Small 4",
      provider: "mistral",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (La Plateforme experiment tier)",
      contextWindow: 65536,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "High-speed 4th generation Small model for prompt note cleanup and equations.",
    },
    {
      id: "mistral-large-3",
      name: "Mistral Large 3",
      provider: "mistral",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (La Plateforme experiment tier)",
      contextWindow: 128000,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Flagship Mistral reasoning model with deep mathematical and multilingual abilities.",
    },
    {
      id: "ministral-3-14b",
      name: "Ministral 3 14B",
      provider: "mistral",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (La Plateforme experiment tier)",
      contextWindow: 128000,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "14B edge instruction model with high throughput and long context.",
    },
    {
      id: "ministral-3-8b",
      name: "Ministral 3 8B",
      provider: "mistral",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (La Plateforme experiment tier)",
      contextWindow: 128000,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Efficient 8B edge model for fast transformations and academic syntax proofing.",
    },
    {
      id: "ministral-3-3b",
      name: "Ministral 3 3B",
      provider: "mistral",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (La Plateforme experiment tier)",
      contextWindow: 65536,
      capabilities: ["text", "math", "json", "code"],
      description: "Ultra-compact 3B model for instant formatting and edge inference.",
    },
  ],

  cohere: [
    {
      id: "command-a-plus-05-2026",
      name: "Command A+ (05-2026)",
      provider: "cohere",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (Trial API key: 20 RPM, 1,000 calls/month)",
      contextWindow: 262144,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Cohere flagship Command A+ model with deep multi-step technical reasoning.",
    },
    {
      id: "command-a-03-2025",
      name: "Command A (03-2025)",
      provider: "cohere",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (Trial API key: 20 RPM, 1,000 calls/month)",
      contextWindow: 131072,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Fast, balanced enterprise model for structured text and academic document editing.",
    },
    {
      id: "command-a-reasoning-08-2025",
      name: "Command A Reasoning (08-2025)",
      provider: "cohere",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (Trial API key: 20 RPM, 1,000 calls/month)",
      contextWindow: 131072,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Specialized STEM reasoning model for mathematical proofs and complex logic.",
    },
    {
      id: "command-a-vision-07-2025",
      name: "Command A Vision (07-2025)",
      provider: "cohere",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (Trial API key: 20 RPM, 1,000 calls/month)",
      contextWindow: 131072,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Multimodal technical vision model for extracting and formatting diagrams and formulas.",
    },
  ],

  huggingface: [
    {
      id: "Qwen/Qwen3.8-27B",
      name: "Qwen 3.8 27B",
      provider: "huggingface",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (Serverless Inference API)",
      contextWindow: 131072,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Premier 27B open model with exceptional LaTeX, math, and STEM reasoning on HF serverless.",
    },
    {
      id: "zai-org/GLM-5.3",
      name: "Zai-Org GLM 5.3",
      provider: "huggingface",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (Serverless Inference API)",
      contextWindow: 131072,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "High-capability reasoning model for technical document structuring.",
    },
    {
      id: "zai-org/GLM-5.3-Flash",
      name: "Zai-Org GLM 5.3 Flash",
      provider: "huggingface",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (Serverless Inference API)",
      contextWindow: 131072,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Ultra-fast flash edition for immediate notation cleanup.",
    },
    {
      id: "deepseek-ai/DeepSeek-V4.1-Flash",
      name: "DeepSeek V4.1 Flash",
      provider: "huggingface",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (Serverless Inference API)",
      contextWindow: 131072,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "High-speed reasoning model with deep math proofing capabilities.",
    },
    {
      id: "deepseek-ai/DeepSeek-V4-Flash-Vision-Exp",
      name: "DeepSeek V4 Flash Vision Exp",
      provider: "huggingface",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (Serverless Inference API)",
      contextWindow: 131072,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Multimodal experimental reasoning model with vision support for formulas.",
    },
    {
      id: "google/gemma-4-31B-it",
      name: "Google Gemma 4 31B IT",
      provider: "huggingface",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (Serverless Inference API)",
      contextWindow: 131072,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Google Gemma 4 31B instruction-tuned model on Hugging Face serverless.",
    },
    {
      id: "Qwen/Qwen3-Coder-480B-A35B-Instruct",
      name: "Qwen 3 Coder 480B A35B Instruct",
      provider: "huggingface",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (Serverless Inference API)",
      contextWindow: 131072,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Massive Mixture-of-Experts coder model for technical and LaTeX syntax generation.",
    },
    {
      id: "moonshotai/Kimi-K3",
      name: "Moonshot Kimi K3",
      provider: "huggingface",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (Serverless Inference API)",
      contextWindow: 200000,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Ultra-long context reasoning model for entire manuscripts and books.",
    },
    {
      id: "moonshotai/Kimi-K2.6",
      name: "Moonshot Kimi K2.6",
      provider: "huggingface",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (Serverless Inference API)",
      contextWindow: 131072,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Balanced long context model with fast inference on HF.",
    },
    {
      id: "MiniMaxAI/MiniMax-M2.7",
      name: "MiniMax M2.7",
      provider: "huggingface",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (Serverless Inference API)",
      contextWindow: 131072,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "MiniMax M2.7 high-quality writing and mathematical model.",
    },
    {
      id: "stepfun-ai/Step-3.5-Flash",
      name: "Step 3.5 Flash",
      provider: "huggingface",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (Serverless Inference API)",
      contextWindow: 131072,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "StepFun high-efficiency Flash model for instant formatting.",
    },
  ],

  cloudflare: [
    {
      id: "@cf/zai-org/glm-5.3",
      name: "GLM 5.3",
      provider: "cloudflare",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (10,000 free neurons daily)",
      contextWindow: 128000,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Flagship GLM 5.3 model hosted on Cloudflare Workers AI edge GPUs.",
    },
    {
      id: "@cf/zai-org/glm-5.3-flash",
      name: "GLM 5.3 Flash",
      provider: "cloudflare",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (10,000 free neurons daily)",
      contextWindow: 128000,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Ultra-fast GLM 5.3 Flash running on Cloudflare global edge network.",
    },
    {
      id: "@cf/deepseek-ai/deepseek-v4-pro-0813",
      name: "DeepSeek V4 Pro (0813)",
      provider: "cloudflare",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (10,000 free neurons daily)",
      contextWindow: 128000,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Deep reasoning model with specialized mathematical proofing on Cloudflare.",
    },
    {
      id: "@cf/deepseek-ai/deepseek-v4-flash-0731",
      name: "DeepSeek V4 Flash (0731)",
      provider: "cloudflare",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (10,000 free neurons daily)",
      contextWindow: 128000,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Fast reasoning model with low-latency execution on Cloudflare edge.",
    },
    {
      id: "@cf/qwen/qwen3.8-27b",
      name: "Qwen 3.8 27B",
      provider: "cloudflare",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (10,000 free neurons daily)",
      contextWindow: 128000,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "High-capability 27B model on Cloudflare Workers AI edge GPUs.",
    },
    {
      id: "@cf/zai-org/glm-5.2",
      name: "GLM 5.2",
      provider: "cloudflare",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (10,000 free neurons daily)",
      contextWindow: 128000,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "GLM 5.2 reasoning architecture for technical documents.",
    },
    {
      id: "@cf/zai-org/glm-4.7-flash",
      name: "GLM 4.7 Flash",
      provider: "cloudflare",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (10,000 free neurons daily)",
      contextWindow: 128000,
      capabilities: ["text", "math", "json", "code"],
      description: "Ultra-low latency edge model for prompt LaTeX cleanup.",
    },
    {
      id: "@cf/qwen/qwen3-30b-a3b-fp8",
      name: "Qwen 3 30B A3B FP8",
      provider: "cloudflare",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (10,000 free neurons daily)",
      contextWindow: 128000,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Quantized 30B MoE model delivering high throughput on edge.",
    },
    {
      id: "@cf/google/gemma-4-31b-it",
      name: "Google Gemma 4 31B IT",
      provider: "cloudflare",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (10,000 free neurons daily)",
      contextWindow: 128000,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Google Gemma 4 31B hosted on Cloudflare Workers AI edge.",
    },
  ],

  openai: [
    {
      id: "gpt-4o-mini",
      name: "GPT-4o Mini",
      provider: "openai",
      status: "active",
      free: false,
      isFree: false,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "OpenAI developer tier / pay-as-you-go",
      contextWindow: 128000,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Fast, intelligent small model optimized for academic notes and LaTeX formatting.",
    },
    {
      id: "gpt-4o",
      name: "GPT-4o",
      provider: "openai",
      status: "active",
      free: false,
      isFree: false,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "OpenAI developer tier / pay-as-you-go",
      contextWindow: 128000,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Flagship high-intelligence multimodal model for complex technical documents.",
    },
    {
      id: "o3-mini",
      name: "o3-mini",
      provider: "openai",
      status: "active",
      free: false,
      isFree: false,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "OpenAI developer tier / pay-as-you-go",
      contextWindow: 200000,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Deep reasoning model specialized for advanced mathematics, physics, and STEM formatting.",
    },
    {
      id: "o1-mini",
      name: "o1-mini",
      provider: "openai",
      status: "active",
      free: false,
      isFree: false,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "OpenAI developer tier / pay-as-you-go",
      contextWindow: 128000,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Reasoning model designed for STEM workflows and complex LaTeX notations.",
    },
  ],

  claude: [
    {
      id: "claude-3-7-sonnet-latest",
      name: "Claude 3.7 Sonnet",
      provider: "claude",
      status: "active",
      free: false,
      isFree: false,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Anthropic API tier / pay-as-you-go",
      contextWindow: 200000,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Anthropic's hybrid reasoning model for sophisticated scientific and academic manuscripts.",
    },
    {
      id: "claude-3-5-sonnet-latest",
      name: "Claude 3.5 Sonnet",
      provider: "claude",
      status: "active",
      free: false,
      isFree: false,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Anthropic API tier / pay-as-you-go",
      contextWindow: 200000,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Premier model for structured LaTeX, proof formatting, and clear exposition.",
    },
    {
      id: "claude-3-5-haiku-latest",
      name: "Claude 3.5 Haiku",
      provider: "claude",
      status: "active",
      free: false,
      isFree: false,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Anthropic API tier / pay-as-you-go",
      contextWindow: 200000,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Ultra-fast, responsive model for instant note cleanup and symbol standardization.",
    },
  ],

  anthropic: [
    {
      id: "claude-3-7-sonnet-latest",
      name: "Claude 3.7 Sonnet",
      provider: "anthropic",
      status: "active",
      free: false,
      isFree: false,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Anthropic API tier / pay-as-you-go",
      contextWindow: 200000,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Anthropic's hybrid reasoning model for sophisticated scientific and academic manuscripts.",
    },
    {
      id: "claude-3-5-sonnet-latest",
      name: "Claude 3.5 Sonnet",
      provider: "anthropic",
      status: "active",
      free: false,
      isFree: false,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Anthropic API tier / pay-as-you-go",
      contextWindow: 200000,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Premier model for structured LaTeX, proof formatting, and clear exposition.",
    },
    {
      id: "claude-3-5-haiku-latest",
      name: "Claude 3.5 Haiku",
      provider: "anthropic",
      status: "active",
      free: false,
      isFree: false,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Anthropic API tier / pay-as-you-go",
      contextWindow: 200000,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Ultra-fast, responsive model for instant note cleanup and symbol standardization.",
    },
  ],
};

// Aliases for provider keys
(CENTRAL_CATALOG as any)["google-gemini"] = CENTRAL_CATALOG.gemini;
(CENTRAL_CATALOG as any)["open-router"] = CENTRAL_CATALOG.openrouter;

/**
 * Get catalog models for a provider ID
 */
export function getCatalogModels(providerId: string): ModelInfo[] {
  const canonical = canonicalProviderId(providerId);
  const list = CENTRAL_CATALOG[canonical] || CENTRAL_CATALOG[providerId.toLowerCase()];
  return list ? [...list] : [];
}
