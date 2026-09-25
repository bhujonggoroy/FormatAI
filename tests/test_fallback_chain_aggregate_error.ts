import assert from "node:assert";
import { AIRequestManager } from "../src/server/ai/AIRequestManager.ts";
import { AIProviderAdapter, AdapterOptions } from "../src/server/ai/adapters/BaseAdapter.ts";
import { AIRequest, ModelInfo, NormalizedAIError, ProviderConfig, ManagerConfig } from "../src/server/ai/types.ts";
import { classifyFallbackChain, classifyErrorDetails } from "../src/utils/aiStatusClassifier.ts";
import { getInitialProviders } from "../src/server/ai/defaultConfig.ts";
import { FallbackStep } from "../src/types/ai.ts";

console.log("=== START TEST: Fallback Chain Aggregate Error & Classification ===");

// --------------------------------------------------------------------------------
// Test 1: Cloudflare Workers AI is disabled by default in defaultConfig
// --------------------------------------------------------------------------------
console.log("\nTest 1: Cloudflare Workers AI defaultConfig check...");
const initialProviders = getInitialProviders();
const cloudflareInitial = initialProviders.find((p) => p.id === "cloudflare");
assert.ok(cloudflareInitial, "Cloudflare provider should exist in template providers");
assert.strictEqual(
  cloudflareInitial.enabled,
  false,
  "Cloudflare Workers AI must be enabled: false by default since it requires account ID and API token"
);
console.log("✓ Test 1 Passed: Cloudflare Workers AI is enabled: false by default.");

// --------------------------------------------------------------------------------
// Test 2: AIRequestManager excludes Cloudflare if it has no configured keys
// --------------------------------------------------------------------------------
console.log("\nTest 2: Cloudflare exclusion from fallback chain when unconfigured...");

class FailingMockAdapter implements AIProviderAdapter {
  readonly id: string;
  readonly name: string;
  public models: ModelInfo[];

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.models = [{ id: `${id}-model`, name: `${name} Model`, isFree: true, capabilities: ["text"] }];
  }
  async listModels(): Promise<ModelInfo[]> { return this.models; }
  async getModels(): Promise<ModelInfo[]> { return this.models; }
  async test(): Promise<boolean> { return false; }
  classifyError(error: any): string { return "rate_limit"; }
  supportsCapability(): boolean { return true; }
  normalizeError(error: any): NormalizedAIError {
    return { kind: "rate_limit", statusCode: 429, message: "Resource exhausted (429 Rate limit)", retryable: false };
  }
  async generate(): Promise<{ text: string }> {
    throw new Error("Resource exhausted (429 Rate limit)");
  }
}

const manager = new AIRequestManager();
const geminiAdapter = new FailingMockAdapter("gemini", "Google Gemini");
const groqAdapter = new FailingMockAdapter("groq", "Groq");
(manager as any).adapters.set("gemini", geminiAdapter);
(manager as any).adapters.set("groq", groqAdapter);

const testScopedProviders: ProviderConfig[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    enabled: true,
    priority: 1,
    selectedModel: "gemini-model",
    availableModels: geminiAdapter.models,
    apiKeys: [{ id: "k1", name: "Gemini Key", key: "AIzaTestGeminiKey12345", enabled: true, status: "active" }],
  } as any,
  {
    id: "groq",
    name: "Groq",
    enabled: true,
    priority: 2,
    selectedModel: "groq-model",
    availableModels: groqAdapter.models,
    apiKeys: [{ id: "k2", name: "Groq Key", key: "gsk_test_groq_key_12345", enabled: true, status: "active" }],
  } as any,
  {
    id: "cloudflare",
    name: "Cloudflare Workers AI",
    enabled: true, // Suppose client sent enabled: true, but NO keys!
    priority: 3,
    selectedModel: "cf-model",
    availableModels: [],
    apiKeys: [], // No keys!
  } as any,
];

const testManagerConfig: ManagerConfig = {
  mode: "automatic",
  activeProviderId: "gemini",
  activeModel: "gemini-model",
  enableFallback: true,
  freeOnlyMode: false,
  billingMode: "free_only",
  enableModelFallback: true,
  defaultTimeoutMs: 5000,
};

let capturedError: any = null;
try {
  await manager.executeRequestScoped(
    { prompt: "Test prompt" },
    testManagerConfig,
    testScopedProviders
  );
} catch (err: any) {
  capturedError = err;
}

assert.ok(capturedError, "Request should have failed because mock adapters throw errors");
const chain: FallbackStep[] = capturedError.fallbackChain;
assert.ok(chain && chain.length > 0, "fallbackChain should be attached to error");

console.log("Captured fallback chain providers:", chain.map((s) => s.providerName));

// Verify Cloudflare was NOT included in the fallbackChain because it had no key
const hasCloudflareInChain = chain.some((s) => s.providerId === "cloudflare");
assert.strictEqual(
  hasCloudflareInChain,
  false,
  "Cloudflare Workers AI without keys must NOT be present in fallbackChain!"
);
console.log("✓ Test 2 Passed: Unconfigured Cloudflare was cleanly excluded from fallback chain.");

// --------------------------------------------------------------------------------
// Test 3: Aggregate error message contains step-by-step failure reasons
// --------------------------------------------------------------------------------
console.log("\nTest 3: Aggregate error message format validation...");
console.log("Error message:\n", capturedError.message);

assert.ok(
  capturedError.message.includes("All providers failed"),
  "Error message must start with aggregate failure notice"
);
assert.ok(
  capturedError.message.includes("1. Google Gemini"),
  "Error message must include step 1 with Google Gemini"
);
assert.ok(
  capturedError.message.includes("2. Groq"),
  "Error message must include step 2 with Groq"
);
assert.ok(
  capturedError.message.includes("Resource exhausted (429 Rate limit)"),
  "Error message must show the actual real error reason for providers"
);
console.log("✓ Test 3 Passed: Aggregate error message shows every provider and reason.");

// --------------------------------------------------------------------------------
// Test 4: Badge classification uses most informative failure from real providers
// --------------------------------------------------------------------------------
console.log("\nTest 4: Badge classification using informative failure...");

// Case A: Gemini failed with 429, last provider in chain was an unconfigured key or generic error
const simulatedChain: FallbackStep[] = [
  {
    providerId: "gemini",
    providerName: "Google Gemini",
    keyMasked: "AIza************1234",
    model: "gemini-3.8-flash",
    status: "rate_limited",
    errorMessage: "Quota exceeded: 429 Resource has been exhausted (rate limit)",
    latencyMs: 120,
    timestamp: Date.now() - 500,
  },
  {
    providerId: "groq",
    providerName: "Groq",
    keyMasked: "gsk_************5678",
    model: "openai/gpt-oss-120b",
    status: "rate_limited",
    errorMessage: "429 Rate limit reached on Groq LPU",
    latencyMs: 80,
    timestamp: Date.now() - 200,
  },
  {
    providerId: "cloudflare",
    providerName: "Cloudflare Workers AI",
    keyMasked: "none",
    model: "cf-model",
    status: "invalid_key",
    errorMessage: "Provider has no enabled API keys (all keys are turned OFF or unconfigured).",
    latencyMs: 0,
    timestamp: Date.now(),
  },
];

const classification = classifyFallbackChain(simulatedChain, "Generic error message");
console.log("Classified badge:", {
  badgeLabel: classification.badgeLabel,
  errorCategory: classification.errorCategory,
  title: classification.title,
  providerName: classification.providerName,
});

assert.strictEqual(
  classification.badgeLabel,
  "RATE LIMIT",
  "Badge must be classified as RATE LIMIT (from Gemini/Groq 429) rather than KEY MISSING (from Cloudflare)!"
);
assert.strictEqual(
  classification.errorCategory,
  "rate_limit",
  "Error category must be rate_limit"
);
assert.strictEqual(
  classification.providerName,
  "Google Gemini",
  "Provider name should be the active configured provider that failed"
);

console.log("✓ Test 4 Passed: Status badge accurately reflected primary provider rate limit, ignoring unconfigured fallback.");

// Case B: Primary provider had invalid API key (401), followed by unconfigured fallback
const authSimulatedChain: FallbackStep[] = [
  {
    providerId: "gemini",
    providerName: "Google Gemini",
    keyMasked: "AIza************bad1",
    model: "gemini-3.8-flash",
    status: "invalid_key",
    errorMessage: "API_KEY_INVALID: User API key is not authorized for Gemini API",
    latencyMs: 95,
    timestamp: Date.now(),
  },
  {
    providerId: "cloudflare",
    providerName: "Cloudflare Workers AI",
    keyMasked: "none",
    model: "cf-model",
    status: "invalid_key",
    errorMessage: "Provider has no enabled API keys",
    latencyMs: 0,
    timestamp: Date.now(),
  },
];

const authClassification = classifyFallbackChain(authSimulatedChain);
assert.strictEqual(
  authClassification.badgeLabel,
  "INVALID KEY",
  "Badge must be INVALID KEY from the actual user key error"
);
console.log("✓ Test 4b Passed: Status badge accurately identified INVALID KEY on primary provider.");

console.log("\n=== ALL FALLBACK CHAIN & AGGREGATE ERROR TESTS PASSED SUCCESSFULLY ===");
