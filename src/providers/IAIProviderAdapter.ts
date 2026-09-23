/**
 * IAIProviderAdapter
 *
 * Base TypeScript interface for AI provider adapters.
 * Standardizes provider implementations across all AI services with:
 * - getModels(apiKey: string): Promise<string[]> (or Promise<ModelInfo[]>)
 * - test(apiKey: string, modelId: string): Promise<boolean> (or Promise<TestResult>)
 * - generate(apiKey: string, modelId: string, request: any): Promise<any>
 * - classifyError(error: any): string (or NormalizedAIError)
 */

import type {
  AIRequest,
  ModelInfo,
  NormalizedAIError,
  TestResult,
} from "../server/ai/types.ts";

export interface AdapterOptions {
  timeoutMs?: number;
  customEndpoint?: string;
  temperature?: number;
  maxTokens?: number;
  accountId?: string;
  keyId?: string;
  keyName?: string;
}

export interface GenerationResult {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  modelUsed?: string;
}

/**
 * Standard IAIProviderAdapter Interface
 */
export interface IAIProviderAdapter {
  /**
   * Unique identifier of the provider (e.g., "gemini", "groq", "openrouter")
   */
  readonly id?: string;

  /**
   * Human-readable display name of the provider
   */
  readonly name?: string;

  /**
   * 1. Model Catalog Retrieval
   * Retrieves available models from the provider.
   * Supports returning array of model ID strings (Promise<string[]>) or detailed model metadata (Promise<ModelInfo[]>).
   *
   * @param apiKey The API key for authenticated catalog access
   * @param options Additional adapter options
   */
  getModels(apiKey?: string, options?: AdapterOptions): Promise<string[] | ModelInfo[]>;

  /**
   * 2. Connection & Authentication Test
   * Tests whether the provided API key and model ID are valid and responsive.
   * Returns boolean (true/false) or structured TestResult.
   *
   * @param apiKey The API key to validate
   * @param modelId The model ID to test
   * @param options Additional adapter options
   */
  test(apiKey: string, modelId: string, options?: AdapterOptions): Promise<boolean | TestResult>;

  /**
   * 3. Text Generation
   * Generates AI responses / mathematical document transformations.
   * Supports both:
   *   generate(apiKey: string, modelId: string, request: any, options?: AdapterOptions): Promise<any>
   *   generate(request: AIRequest, key: string, model: string, options?: AdapterOptions): Promise<GenerationResult>
   */
  generate(
    arg1: any,
    arg2?: any,
    arg3?: any,
    options?: AdapterOptions
  ): Promise<any>;

  /**
   * 4. Error Classification
   * Normalizes vendor-specific error responses into a standard error classification string or NormalizedAIError.
   *
   * @param error Raw error object/exception from the provider
   */
  classifyError(error: any): string | NormalizedAIError;

  /**
   * Optional capability checker
   */
  supportsCapability?(capability: string, modelId: string): boolean;

  /**
   * Optional backward-compatibility helpers
   */
  testConnection?(key: string, model: string, customEndpoint?: string, timeoutMs?: number): Promise<TestResult>;
  listModels?(): Promise<ModelInfo[]>;
  normalizeError?(error: any): NormalizedAIError;
}

/**
 * Standard alias for backward compatibility with existing adapters
 */
export type AIProviderAdapter = IAIProviderAdapter;
