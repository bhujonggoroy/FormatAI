/**
 * FormatAI — Centralized Typed Model Status Registry
 * 
 * Requirement 10:
 * 1. AIModel interface with required status, free-tier, and capability fields.
 * 2. Centralized MODEL_REGISTRY constant object containing all active, free-tier models
 *    for Gemini, Groq, OpenRouter, Mistral, Cohere, Hugging Face, and Cloudflare.
 * 3. Getter function getActiveModels(provider) that returns only models where
 *    status === 'active', free === true, and apiAvailable === true.
 */

export type ModelStatus = "active" | "preview" | "deprecated" | "retired" | "unavailable";

export type AIProviderId =
  | "gemini"
  | "groq"
  | "openrouter"
  | "mistral"
  | "cohere"
  | "huggingface"
  | "cloudflare";

/**
 * Academic workload & technical capabilities for mathematical formatting
 */
export type AcademicCapability =
  | "latex_typesetting"
  | "formula_derivation"
  | "notation_standardization"
  | "theorem_proof_structuring"
  | "matrix_tabular_math"
  | "long_academic_context"
  | "symbolic_computation"
  | "code_synthesis"
  | "json_schema_conformance"
  | "text"
  | "math"
  | "code"
  | "json"
  | "long_context";

/**
 * AIModel interface defining model metadata, status lifecycle, and capability fields
 */
export interface AIModel {
  id: string;
  name: string;
  provider: AIProviderId | string;
  status: ModelStatus;
  free: boolean;
  isFree: boolean;
  apiAvailable: boolean;
  deprecated?: boolean;
  retired?: boolean;
  freeTier: string; // e.g. "Free tier (15 RPM, 1,500 RPD)"
  contextWindow: number;
  capabilities: (AcademicCapability | string)[];
  academicCapabilities?: AcademicCapability[];
  description?: string;
  replacementModelId?: string;
}

// Backward-compatible alias
export type RegistryModel = AIModel;

/**
 * Centralized MODEL_REGISTRY constant object containing all active, free-tier models
 * for Google Gemini, Groq, OpenRouter, Mistral, Cohere, Hugging Face, and Cloudflare.
 */
export const MODEL_REGISTRY: Record<string, AIModel[]> = {
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "notation_standardization",
        "theorem_proof_structuring",
        "matrix_tabular_math",
        "long_academic_context",
        "json_schema_conformance",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "notation_standardization",
        "theorem_proof_structuring",
        "matrix_tabular_math",
        "long_academic_context",
        "json_schema_conformance",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "notation_standardization",
        "matrix_tabular_math",
        "long_academic_context",
      ],
      description: "High-efficiency Flash model with balanced speed and technical accuracy.",
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
      freeTier: "Free tier (15 RPM, 1,500 RPD)",
      contextWindow: 1048576,
      capabilities: ["text", "math", "long_context", "json", "code"],
      academicCapabilities: [
        "latex_typesetting",
        "notation_standardization",
        "matrix_tabular_math",
      ],
      description: "Ultra-low latency, lightweight model for instant note cleanup and formatting.",
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "notation_standardization",
        "theorem_proof_structuring",
        "matrix_tabular_math",
        "long_academic_context",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "notation_standardization",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "theorem_proof_structuring",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "notation_standardization",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "matrix_tabular_math",
        "long_academic_context",
      ],
      description: "Advanced preview reasoning and writing model with large context on Groq LPU.",
    },
    {
      id: "llama-3.3-70b-versatile",
      name: "Llama 3.3 70B",
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "notation_standardization",
        "theorem_proof_structuring",
        "matrix_tabular_math",
        "long_academic_context",
      ],
      description: "Meta's state-of-the-art 70B model with high reasoning and academic typesetting capabilities.",
    },
    {
      id: "llama-3.1-8b-instant",
      name: "Llama 3.1 8B",
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
      academicCapabilities: [
        "latex_typesetting",
        "notation_standardization",
        "matrix_tabular_math",
      ],
      description: "Blazing fast 8B parameter model for instant mathematical note formatting.",
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "notation_standardization",
        "theorem_proof_structuring",
        "matrix_tabular_math",
        "long_academic_context",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "notation_standardization",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "notation_standardization",
        "theorem_proof_structuring",
        "matrix_tabular_math",
        "long_academic_context",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "theorem_proof_structuring",
        "matrix_tabular_math",
        "long_academic_context",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "notation_standardization",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "notation_standardization",
        "matrix_tabular_math",
        "long_academic_context",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "notation_standardization",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "theorem_proof_structuring",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "theorem_proof_structuring",
        "long_academic_context",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "notation_standardization",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "theorem_proof_structuring",
        "matrix_tabular_math",
        "long_academic_context",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "notation_standardization",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "notation_standardization",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "notation_standardization",
        "matrix_tabular_math",
        "long_academic_context",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "notation_standardization",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "notation_standardization",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "notation_standardization",
        "theorem_proof_structuring",
        "matrix_tabular_math",
        "long_academic_context",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "symbolic_computation",
        "theorem_proof_structuring",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "notation_standardization",
        "matrix_tabular_math",
        "long_academic_context",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "notation_standardization",
        "theorem_proof_structuring",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "matrix_tabular_math",
        "code_synthesis",
        "symbolic_computation",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "notation_standardization",
        "long_academic_context",
      ],
      description: "Ultra-fast edge instruction follower with long context support.",
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "notation_standardization",
        "theorem_proof_structuring",
        "matrix_tabular_math",
        "long_academic_context",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "notation_standardization",
        "long_academic_context",
      ],
      description: "Efficient 7B parameter reasoning model on Cohere trial API.",
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "notation_standardization",
        "theorem_proof_structuring",
        "matrix_tabular_math",
      ],
      description: "Premier 7B open model with exceptional LaTeX, math, and STEM reasoning on HF serverless.",
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
      academicCapabilities: [
        "latex_typesetting",
        "notation_standardization",
        "long_academic_context",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "notation_standardization",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "notation_standardization",
        "theorem_proof_structuring",
        "matrix_tabular_math",
        "long_academic_context",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "notation_standardization",
        "long_academic_context",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "symbolic_computation",
        "theorem_proof_structuring",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "notation_standardization",
        "matrix_tabular_math",
      ],
      description: "Compact, dependable open instruction model on Cloudflare edge.",
    },
  ],
};

/**
 * Unified list of all registered models across all providers
 */
export const UNIFIED_MODEL_REGISTRY: AIModel[] = Object.values(MODEL_REGISTRY).flat();

/**
 * Getter function getActiveModels(provider) that returns only models
 * where status is 'active', free is true, and apiAvailable is true.
 *
 * @param provider Optional provider ID (e.g. 'gemini', 'groq', 'openrouter', 'mistral', 'cohere', 'huggingface', 'cloudflare')
 * @returns Filtered array of active, free-tier, API-available AIModel instances
 */
export function getActiveModels(provider?: AIProviderId | string): AIModel[] {
  let candidateModels: AIModel[] = [];

  if (provider) {
    const key = provider.toLowerCase().trim();
    candidateModels = MODEL_REGISTRY[key] || [];
  } else {
    candidateModels = Object.values(MODEL_REGISTRY).flat();
  }

  return candidateModels.filter(
    (m) =>
      (m.status === "active" || m.status === "preview") &&
      m.free === true &&
      m.apiAvailable === true
  );
}

/**
 * Helper to get models for a provider
 */
export function getModelsByProvider(provider: AIProviderId | string): AIModel[] {
  const key = provider.toLowerCase().trim();
  return MODEL_REGISTRY[key] || [];
}

/**
 * Helper to find a model by its ID
 */
export function getModelById(modelId: string): AIModel | undefined {
  if (!modelId) return undefined;
  const idLower = modelId.toLowerCase().trim();
  return UNIFIED_MODEL_REGISTRY.find((m) => m.id.toLowerCase() === idLower);
}
