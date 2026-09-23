/**
 * Central AI Provider Registry
 *
 * Single Source of Truth for all AI Provider Adapters:
 * Gemini, Groq, OpenRouter, Mistral, Cohere, Hugging Face, Cloudflare, Custom, etc.
 */

import {
  type IAIProviderAdapter,
  type AIProviderAdapter,
  type AdapterOptions,
  type GenerationResult,
} from "./IAIProviderAdapter.ts";
import {
  maskApiKey,
  estimateTokenCount,
} from "../server/ai/adapters/BaseAdapter.ts";
import { GeminiAdapter } from "../server/ai/adapters/GeminiAdapter.ts";
import { GroqAdapter } from "../server/ai/adapters/GroqAdapter.ts";
import { OpenRouterAdapter } from "../server/ai/adapters/OpenRouterAdapter.ts";
import { MistralAdapter } from "../server/ai/adapters/MistralAdapter.ts";
import { CohereAdapter } from "../server/ai/adapters/CohereAdapter.ts";
import { HuggingFaceAdapter } from "../server/ai/adapters/HuggingFaceAdapter.ts";
import { CloudflareAdapter } from "../server/ai/adapters/CloudflareAdapter.ts";
import { CustomAdapter } from "../server/ai/adapters/CustomAdapter.ts";
import { OpenAICompatibleAdapter } from "../server/ai/adapters/OpenAICompatibleAdapter.ts";

export interface ProviderRegistry {
  register(adapter: AIProviderAdapter): void;
  getProvider(id: string): AIProviderAdapter | undefined;
  listProviders(): AIProviderAdapter[];
  hasProvider(id: string): boolean;
  get(id: string): AIProviderAdapter | undefined;
  list(): AIProviderAdapter[];
  has(id: string): boolean;
  getAll(): Record<string, AIProviderAdapter>;
}

class CentralProviderRegistry implements ProviderRegistry {
  private adapters: Map<string, AIProviderAdapter> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults() {
    const defaultAdapters: AIProviderAdapter[] = [
      new GeminiAdapter(),
      new GroqAdapter(),
      new OpenRouterAdapter(),
      new MistralAdapter(),
      new CohereAdapter(),
      new HuggingFaceAdapter(),
      new CloudflareAdapter(),
      new CustomAdapter(),
    ];

    for (const adapter of defaultAdapters) {
      this.register(adapter);
    }
  }

  public register(adapter: AIProviderAdapter): void {
    if (!adapter || !adapter.id) return;
    this.adapters.set(adapter.id.toLowerCase(), adapter);
  }

  public getProvider(id: string): AIProviderAdapter | undefined {
    if (!id) return undefined;
    return this.adapters.get(id.toLowerCase());
  }

  public listProviders(): AIProviderAdapter[] {
    return Array.from(this.adapters.values());
  }

  public hasProvider(id: string): boolean {
    if (!id) return false;
    return this.adapters.has(id.toLowerCase());
  }

  // Developer ergonomics aliases
  public get(id: string): AIProviderAdapter | undefined {
    return this.getProvider(id);
  }

  public list(): AIProviderAdapter[] {
    return this.listProviders();
  }

  public has(id: string): boolean {
    return this.hasProvider(id);
  }

  public getAll(): Record<string, AIProviderAdapter> {
    const result: Record<string, AIProviderAdapter> = {};
    for (const [key, value] of this.adapters.entries()) {
      result[key] = value;
    }
    return result;
  }
}

// Authoritative Singleton Registry Instance
export const providerRegistry = new CentralProviderRegistry();

// Authoritative Accessor Functions
export function getProvider(id: string): AIProviderAdapter | undefined {
  return providerRegistry.getProvider(id);
}

export function listProviders(): AIProviderAdapter[] {
  return providerRegistry.listProviders();
}

export function registerProvider(adapter: AIProviderAdapter): void {
  providerRegistry.register(adapter);
}

export function hasProvider(id: string): boolean {
  return providerRegistry.hasProvider(id);
}

// Export Types and Utilities
export type { IAIProviderAdapter, AIProviderAdapter, AdapterOptions, GenerationResult };
export {
  GeminiAdapter,
  GroqAdapter,
  OpenRouterAdapter,
  MistralAdapter,
  CohereAdapter,
  HuggingFaceAdapter,
  CloudflareAdapter,
  CustomAdapter,
  OpenAICompatibleAdapter,
  maskApiKey,
  estimateTokenCount,
};
