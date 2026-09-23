import type {
  AIRequest,
  ModelInfo,
  NormalizedAIError,
  TestResult,
} from "../types.ts";

export interface AdapterOptions {
  timeoutMs?: number;
  customEndpoint?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIProviderAdapter {
  readonly id: string;
  readonly name: string;

  generate(
    request: AIRequest,
    key: string,
    model: string,
    options?: AdapterOptions
  ): Promise<{ text: string; inputTokens?: number; outputTokens?: number }>;

  testConnection(
    key: string,
    model: string,
    customEndpoint?: string,
    timeoutMs?: number
  ): Promise<TestResult>;

  listModels(): Promise<ModelInfo[]>;

  normalizeError(error: any): NormalizedAIError;

  supportsCapability(capability: string, modelId: string): boolean;
}

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
