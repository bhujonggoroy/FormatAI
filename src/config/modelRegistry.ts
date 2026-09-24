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

import { canonicalProviderId } from "../shared/centralModelCatalog";

export type ModelStatus = "active" | "preview" | "deprecated" | "retired" | "unavailable";

export type AIProviderId =
  | "gemini"
  | "openai"
  | "claude"
  | "anthropic"
  | "groq"
  | "openrouter"
  | "mistral"
  | "cohere"
  | "huggingface"
  | "cloudflare"
  | "custom";

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
        "formula_derivation",
        "notation_standardization",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "notation_standardization",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "notation_standardization",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "theorem_proof_structuring",
        "matrix_tabular_math",
        "long_academic_context",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "matrix_tabular_math",
        "long_academic_context",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "notation_standardization",
        "theorem_proof_structuring",
        "matrix_tabular_math",
        "long_academic_context",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "notation_standardization",
        "matrix_tabular_math",
        "long_academic_context",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "notation_standardization",
        "theorem_proof_structuring",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "notation_standardization",
        "theorem_proof_structuring",
        "matrix_tabular_math",
        "long_academic_context",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "notation_standardization",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "theorem_proof_structuring",
        "matrix_tabular_math",
        "long_academic_context",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "notation_standardization",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "theorem_proof_structuring",
        "matrix_tabular_math",
        "long_academic_context",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "notation_standardization",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "notation_standardization",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "notation_standardization",
        "theorem_proof_structuring",
        "matrix_tabular_math",
        "long_academic_context",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "notation_standardization",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "theorem_proof_structuring",
        "symbolic_computation",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "notation_standardization",
        "theorem_proof_structuring",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "notation_standardization",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "notation_standardization",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "symbolic_computation",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "notation_standardization",
        "long_academic_context",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "matrix_tabular_math",
        "code_synthesis",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "theorem_proof_structuring",
        "long_academic_context",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "notation_standardization",
        "long_academic_context",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "notation_standardization",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "notation_standardization",
        "theorem_proof_structuring",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "notation_standardization",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "symbolic_computation",
        "theorem_proof_structuring",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "notation_standardization",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "notation_standardization",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "notation_standardization",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "formula_derivation",
        "matrix_tabular_math",
      ],
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
      academicCapabilities: [
        "latex_typesetting",
        "notation_standardization",
        "long_academic_context",
      ],
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
      academicCapabilities: ["latex_typesetting", "formula_derivation", "notation_standardization"],
      description: "Fast, cost-efficient OpenAI model optimized for mathematical notation and formatting.",
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
      academicCapabilities: ["latex_typesetting", "formula_derivation", "theorem_proof_structuring", "matrix_tabular_math"],
      description: "Flagship omni model with advanced technical reasoning across mathematical proofs.",
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
      academicCapabilities: ["latex_typesetting", "formula_derivation", "symbolic_computation"],
      description: "High-intelligence STEM reasoning model with specialized mathematical problem solving.",
    },
    {
      id: "o1",
      name: "o1",
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
      academicCapabilities: ["latex_typesetting", "formula_derivation", "theorem_proof_structuring"],
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
      academicCapabilities: ["latex_typesetting", "formula_derivation"],
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
      academicCapabilities: ["latex_typesetting", "formula_derivation", "theorem_proof_structuring", "matrix_tabular_math"],
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
      academicCapabilities: ["latex_typesetting", "formula_derivation", "notation_standardization"],
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
      academicCapabilities: ["latex_typesetting", "notation_standardization"],
      description: "Ultra-fast, responsive model for instant note cleanup and symbol standardization.",
    },
  ],
};

// Aliases for provider keys
(MODEL_REGISTRY as any)["google-gemini"] = MODEL_REGISTRY.gemini;
(MODEL_REGISTRY as any)["anthropic"] = MODEL_REGISTRY.claude;
(MODEL_REGISTRY as any)["open-router"] = MODEL_REGISTRY.openrouter;

/**
 * Unified list of all registered models across all providers
 */
export const UNIFIED_MODEL_REGISTRY: AIModel[] = Object.values(MODEL_REGISTRY).flat();

/**
 * STRICTLY PROVIDER-SCOPED Getter: getActiveModels(provider)
 *
 * MUST ONLY return models belonging to the specified provider.
 * Under NO circumstances does this function return models from other providers.
 * If provider is omitted, empty, or unrecognized, returns an EMPTY array [].
 *
 * @param provider Provider ID (e.g. 'gemini', 'google-gemini', 'openai', 'claude', 'groq', etc.)
 * @returns Filtered array of active, API-available AIModel instances for THAT provider ONLY
 */
export function getActiveModels(provider?: AIProviderId | string): AIModel[] {
  if (!provider) {
    // STRICT ISOLATION: Never return models from other providers when provider is omitted
    return [];
  }

  const canonical = canonicalProviderId(provider);
  const candidateModels = MODEL_REGISTRY[canonical] || MODEL_REGISTRY[provider.toLowerCase().trim()] || [];

  return candidateModels.filter(
    (m) =>
      (m.status === "active" || m.status === "preview") &&
      m.apiAvailable === true
  );
}

/**
 * Explicit global helper if all active models across the entire registry are needed
 */
export function getAllActiveModels(): AIModel[] {
  return Object.values(MODEL_REGISTRY)
    .flat()
    .filter(
      (m) =>
        (m.status === "active" || m.status === "preview") &&
        m.apiAvailable === true
    );
}

/**
 * STRICTLY PROVIDER-SCOPED Helper to get models for a provider
 */
export function getModelsByProvider(provider: AIProviderId | string): AIModel[] {
  if (!provider) return [];
  const canonical = canonicalProviderId(provider);
  return MODEL_REGISTRY[canonical] || MODEL_REGISTRY[provider.toLowerCase().trim()] || [];
}

/**
 * Helper to find a model by its ID
 */
export function getModelById(modelId: string): AIModel | undefined {
  if (!modelId) return undefined;
  const idLower = modelId.toLowerCase().trim();
  return UNIFIED_MODEL_REGISTRY.find((m) => m.id.toLowerCase() === idLower);
}
