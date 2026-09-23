import type {
  AIRequest,
  ModelInfo,
  NormalizedAIError,
  TestResult,
} from "../types.ts";
import type {
  IAIProviderAdapter,
  AIProviderAdapter,
  AdapterOptions,
  GenerationResult,
} from "../../../providers/IAIProviderAdapter.ts";

export type {
  IAIProviderAdapter,
  AIProviderAdapter,
  AdapterOptions,
  GenerationResult,
};

export function maskApiKey(key: string): string {
  if (!key) return "no-key";
  const trimmed = key.trim();
  if (trimmed.length <= 8) return "********";
  const prefix = trimmed.slice(0, 4);
  const suffix = trimmed.slice(-4);
  return `${prefix}${"*".repeat(Math.min(12, trimmed.length - 8))}${suffix}`;
}

export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  // Approximation: ~4 chars per token for English / markdown / math
  return Math.ceil(text.length / 4);
}
