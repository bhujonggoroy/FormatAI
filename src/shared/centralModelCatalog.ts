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
  // Groq decommissioned / retired models
  "mixtral-8x7b-32768": "openai/gpt-oss-120b",
  "gemma2-9b-it": "qwen/qwen3.8-27b",
  "llama3-70b-8192": "openai/gpt-oss-120b",
  "llama3-8b-8192": "openai/gpt-oss-20b",
  "llama-3.3-70b-versatile": "openai/gpt-oss-120b",
  "llama-3.1-8b-instant": "openai/gpt-oss-20b",
  "qwen/qwen3-32b": "qwen/qwen3.8-27b",
  "qwen-2.5-32b": "qwen/qwen3.6-27b",
  // Google Gemini retired / obsolete legacy models (migrated to Gemini 2.5 Flash)
  "gemini-2.0-flash-exp": "gemini-2.5-flash",
  "gemini-3.6-flash": "gemini-2.5-flash",
  "gemini-3.7-flash": "gemini-2.5-flash",
  "gemini-3.8-flash": "gemini-2.5-flash",
  "gemini-1.5-flash-latest": "gemini-2.5-flash",
  "gemini-pro": "gemini-2.5-flash",
  // Mistral retired models
  "open-mistral-7b": "mistral-small-latest",
  "codestral-2405": "codestral-latest",
  // Cohere retired models
  "command-light": "command-r",
  // Hugging Face serverless 503 models (require dedicated endpoints)
  "Qwen/Qwen2.5-72B-Instruct": "Qwen/Qwen2.5-7B-Instruct",
  "meta-llama/Llama-3.3-70B-Instruct": "meta-llama/Llama-3.1-8B-Instruct",
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
      id: "gemini-2.5-flash",
      name: "Gemini 2.5 Flash",
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
      id: "gemini-2.0-flash",
      name: "Gemini 2.0 Flash",
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
      id: "gemini-2.0-flash-lite",
      name: "Gemini 2.0 Flash-Lite",
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
      id: "gemini-1.5-flash",
      name: "Gemini 1.5 Flash",
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
      description: "Proven multimodal workhorse model with 1M context window for large documents.",
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
      id: "qwen/qwen3.6-27b",
      name: "Qwen 3.6 27B",
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
      description: "High-efficiency 27B model on Groq LPU optimized for fast, accurate formatting.",
    },
    {
      id: "minimax/minimax-m2.7",
      name: "MiniMax M2.7 [Preview]",
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
      description: "Advanced preview reasoning and writing model with large context on Groq LPU.",
    },
    {
      id: "groq/compound",
      name: "Groq Compound",
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
      description: "Groq compound reasoning and routing system designed for multi-step technical workloads.",
    },
    {
      id: "groq/compound-mini",
      name: "Groq Compound Mini",
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
      description: "Compact compound system providing high-throughput and low-latency academic formatting.",
    },
  ],

  openrouter: [
    {
      id: "nvidia/nemotron-3-ultra:free",
      name: "NVIDIA Nemotron 3 Ultra",
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
      description: "NVIDIA 550B flagship MoE reasoning model with 1M token context.",
    },
    {
      id: "poolside/laguna-s-2.1:free",
      name: "Poolside Laguna S 2.1",
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
      description: "Open-weight 118B MoE coding model with 1M context optimized for complex reasoning.",
    },
    {
      id: "inclusionai/ling-3.0-flash-fin:free",
      name: "InclusionAI Ling 3.0 Flash Fin",
      provider: "openrouter",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier ($0 prompt / $0 completion)",
      contextWindow: 131072,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "124B parameter finance-specific MoE model for quantitative reasoning and formulas.",
    },
    {
      id: "dots-studio/dots-3-note-preview:free",
      name: "Dots3-Note Preview",
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
      description: "280B open-weight multimodal MoE model with 512K context designed for academic notes.",
    },
    {
      id: "nvidia/nemotron-3.5-lightning:free",
      name: "NVIDIA Nemotron 3.5 Lightning",
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
      description: "Ultra-fast lightning-inference model by NVIDIA optimized for quick text and LaTeX cleanup.",
    },
    {
      id: "nex-agi/nex-n2.5-pro:free",
      name: "Nex-N2.5-Pro",
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
      description: "Goal-oriented agentic model with visual feedback loops and rigorous reasoning.",
    },
    {
      id: "stealth/space-bunny-alpha:free",
      name: "Space Bunny Alpha",
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
      description: "High-speed reasoning model with adjustable thinking effort and 1M token context.",
    },
    {
      id: "thinking-machines/inkling:free",
      name: "Thinking Machines Inkling",
      provider: "openrouter",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier ($0 prompt / $0 completion)",
      contextWindow: 300000,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "975B hybrid MoE Transformer-Mamba multimodal model with deep technical reasoning.",
    },
    {
      id: "nvidia/nemotron-3-super:free",
      name: "NVIDIA Nemotron 3 Super",
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
      description: "Supercharged Nemotron architecture for deep research and heavy technical documentation.",
    },
    {
      id: "inclusionai/ling-3.0-flash-sante:free",
      name: "InclusionAI Ling 3.0 Flash Sante",
      provider: "openrouter",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier ($0 prompt / $0 completion)",
      contextWindow: 131072,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Health and life-science domain-specialized MoE model with clinical-grade accuracy.",
    },
    {
      id: "nex-agi/nex-n2.5-mini:free",
      name: "Nex-N2.5-Mini",
      provider: "openrouter",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier ($0 prompt / $0 completion)",
      contextWindow: 131072,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Lightweight agentic model engineered for responsive document cleanup.",
    },
    {
      id: "thinking-machines/inkling-small:free",
      name: "Thinking Machines Inkling Small",
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
      description: "Efficient 276B MoE model with 1M token context for instant academic processing.",
    },
    {
      id: "cohere/north-mini-code:free",
      name: "Cohere North Mini Code",
      provider: "openrouter",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier ($0 prompt / $0 completion)",
      contextWindow: 131072,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Cohere's 30B MoE code and technical model optimized for structured math and programming.",
    },
    {
      id: "poolside/laguna-xs-2.1:free",
      name: "Poolside Laguna XS 2.1",
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
      description: "33B MoE model with 3B activated parameters designed for high-precision technical text.",
    },
    {
      id: "nvidia/nemotron-3-nano-omni:free",
      name: "NVIDIA Nemotron 3 Nano Omni",
      provider: "openrouter",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier ($0 prompt / $0 completion)",
      contextWindow: 131072,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Compact multimodal and technical model with rapid edge inference.",
    },
    {
      id: "meta-llama/llama-3.3-70b-instruct:free",
      name: "Llama 3.3 70B Instruct (Free)",
      provider: "openrouter",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier ($0 prompt / $0 completion)",
      contextWindow: 131072,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Flagship 70B open model routed through OpenRouter's genuine $0 free tier.",
    },
    {
      id: "deepseek/deepseek-r1:free",
      name: "DeepSeek R1 (Free)",
      provider: "openrouter",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier ($0 prompt / $0 completion)",
      contextWindow: 64000,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Mathematical & logical reasoning model with complete step-by-step proofs.",
    },
    {
      id: "qwen/qwen-2.5-72b-instruct:free",
      name: "Qwen 2.5 72B Instruct (Free)",
      provider: "openrouter",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier ($0 prompt / $0 completion)",
      contextWindow: 131072,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Premier open model for technical LaTeX notation and STEM notes.",
    },
  ],

  mistral: [
    {
      id: "mistral-small-latest",
      name: "Mistral Small (Latest / 24B)",
      provider: "mistral",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (La Plateforme experiment tier)",
      contextWindow: 32768,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Balanced reasoning, math, and code on Mistral official API.",
    },
    {
      id: "codestral-latest",
      name: "Codestral (Latest / Code & Math)",
      provider: "mistral",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (La Plateforme experiment tier)",
      contextWindow: 32768,
      capabilities: ["text", "math", "long_context", "code"],
      description: "Mistral's model for code completion and mathematical syntax proofing.",
    },
    {
      id: "ministral-8b-latest",
      name: "Ministral 8B (Latest)",
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
      description: "Ultra-fast edge instruction follower with long context support.",
    },
    {
      id: "mistral-large-latest",
      name: "Mistral Large (Paid)",
      provider: "mistral",
      status: "active",
      free: false,
      isFree: false,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Paid tier only",
      contextWindow: 128000,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Flagship Mistral reasoning model (Paid).",
    },
  ],

  cohere: [
    {
      id: "cohere/north-mini-code",
      name: "Cohere North Mini Code",
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
      description: "Cohere 30B MoE code and technical model optimized for structured math and programming.",
    },
    {
      id: "command-r",
      name: "Command R",
      provider: "cohere",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (Trial API key: 20 RPM, 1,000 calls/month)",
      contextWindow: 128000,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Cohere enterprise-grade model with 128k context and trial key eligibility.",
    },
    {
      id: "command-r7b-12-2024",
      name: "Command R7B",
      provider: "cohere",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (Trial API key: 20 RPM, 1,000 calls/month)",
      contextWindow: 128000,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Efficient 7B parameter reasoning model on Cohere trial API.",
    },
    {
      id: "command-r-plus",
      name: "Command R+",
      provider: "cohere",
      status: "active",
      free: false,
      isFree: false,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Paid tier (limited trial evaluation only)",
      contextWindow: 128000,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Cohere flagship reasoning model for multi-step tasks.",
    },
  ],

  huggingface: [
    {
      id: "Qwen/Qwen2.5-7B-Instruct",
      name: "Qwen 2.5 7B Instruct",
      provider: "huggingface",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (Serverless Inference API)",
      contextWindow: 32768,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "High-capability 7B open model with premier LaTeX, math, and STEM reasoning on HF serverless.",
    },
    {
      id: "meta-llama/Llama-3.1-8B-Instruct",
      name: "Meta Llama 3.1 8B Instruct",
      provider: "huggingface",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (Serverless Inference API)",
      contextWindow: 128000,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Meta 8B instruction model reliably hosted on Hugging Face free serverless inference router.",
    },
    {
      id: "mistralai/Mistral-7B-Instruct-v0.3",
      name: "Mistral 7B Instruct v0.3",
      provider: "huggingface",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (Serverless Inference API)",
      contextWindow: 32768,
      capabilities: ["text", "math", "json", "code"],
      description: "Compact, reliable open instruction model on HF serverless router.",
    },
  ],

  cloudflare: [
    {
      id: "@cf/meta/llama-3.3-70b-instruct",
      name: "Llama 3.3 70B Instruct",
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
      description: "Meta flagship 70B hosted on Cloudflare Workers AI edge GPUs.",
    },
    {
      id: "@cf/meta/llama-3.1-8b-instruct",
      name: "Llama 3.1 8B Instruct",
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
      description: "Ultra-low latency edge model for fast transformations.",
    },
    {
      id: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
      name: "DeepSeek R1 Distill Qwen 32B",
      provider: "cloudflare",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (10,000 free neurons daily)",
      contextWindow: 64000,
      capabilities: ["text", "math", "long_context", "json", "code"],
      description: "Distilled reasoning model with deep mathematical and formula proofing.",
    },
    {
      id: "@cf/mistral/mistral-7b-instruct-v0.2",
      name: "Mistral 7B Instruct v0.2",
      provider: "cloudflare",
      status: "active",
      free: true,
      isFree: true,
      apiAvailable: true,
      deprecated: false,
      retired: false,
      freeTier: "Free tier (10,000 free neurons daily)",
      contextWindow: 32768,
      capabilities: ["text", "math", "json", "code"],
      description: "Compact, dependable open instruction model on Cloudflare edge.",
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
