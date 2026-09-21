import { AIRequestManager } from "../src/server/ai/AIRequestManager.ts";
import { AIProviderAdapter, AdapterOptions } from "../src/server/ai/adapters/BaseAdapter.ts";
import { AIRequest, ModelInfo, NormalizedAIError, TestResult } from "../src/server/ai/types.ts";

// Mock Adapter for deterministic simulation of 429, 401, timeout, and success
class MockTestAdapter implements AIProviderAdapter {
  readonly id: string;
  readonly name: string;
  private callCount: Map<string, number> = new Map();
  public behavior: "success" | "rate_limit" | "invalid_key" | "fail_then_success" = "success";
  public models: ModelInfo[];

  constructor(id: string, name: string, models?: ModelInfo[]) {
    this.id = id;
    this.name = name;
    this.models = models || [
      {
        id: "mock-free-model",
        name: "Mock Free Model",
        contextWindow: 32000,
        isFree: true,
        capabilities: ["text", "math", "long_context"],
      },
    ];
  }

  async listModels(): Promise<ModelInfo[]> {
    return this.models;
  }

  supportsCapability(capability: string, modelId: string): boolean {
    const m = this.models.find((mod) => mod.id === modelId) || this.models[0];
    return m.capabilities.includes(capability);
  }

  normalizeError(error: any): NormalizedAIError {
    const msg = String(error?.message || error);
    if (msg.includes("429")) {
      return { kind: "rate_limit", statusCode: 429, message: "Rate limit reached", retryable: true };
    }
    if (msg.includes("401")) {
      return { kind: "invalid_key", statusCode: 401, message: "Invalid API Key", retryable: false };
    }
    return { kind: "unknown", message: msg, retryable: false };
  }

  async generate(request: AIRequest, key: string, model: string, options?: AdapterOptions): Promise<{ text: string }> {
    const current = (this.callCount.get(key) || 0) + 1;
    this.callCount.set(key, current);

    if (this.behavior === "rate_limit") {
      throw new Error("HTTP 429: Rate limit exceeded");
    }
    if (this.behavior === "invalid_key") {
      throw new Error("HTTP 401: Invalid API Key");
    }
    if (this.behavior === "fail_then_success") {
      if (current === 1) {
        throw new Error("HTTP 429: Rate limit on first call");
      }
    }
    return { text: `[Processed by ${this.name} using ${model} and key ${key}]` };
  }

  async testConnection(key: string, model: string): Promise<TestResult> {
    return { success: true, providerId: this.id, providerName: this.name, model, latencyMs: 25 };
  }
}

async function runTests() {
  console.log("=== STARTING MULTI-PROVIDER AI MANAGER TESTS ===\n");
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string) {
    total++;
    if (condition) {
      console.log(`✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${testName}`);
      process.exitCode = 1;
    }
  }

  const manager = new AIRequestManager("/tmp/test-ai-settings.json");

  // Register mock providers for precise simulation
  const mockP1 = new MockTestAdapter("gemini", "Google Gemini");
  const mockP2 = new MockTestAdapter("groq", "Groq (Fast LPU)");
  const mockP3 = new MockTestAdapter("openrouter", "OpenRouter");

  manager.registerCustomAdapter(mockP1);
  manager.registerCustomAdapter(mockP2);
  manager.registerCustomAdapter(mockP3);

  // Test 1: Successful Primary Provider
  manager.getClientProviders().forEach((p) => {
    manager.updateProvider(p.id, { apiKeys: [] } as any);
  });
  mockP1.behavior = "success";
  manager.addApiKey("gemini", "mock-gemini-key-1");
  const res1 = await manager.execute({ prompt: "Standardize LaTeX equations" });
  assert(res1.providerId === "gemini", "Test 1: Primary provider handles request directly when available");
  assert(res1.fallbackChain.length === 1 && res1.fallbackChain[0].status === "success", "Test 1: Fallback chain has 1 successful hop");

  // Test 2: Rate Limit on Key 1 -> Rotates to Key 2
  manager.resetToDefaults();
  const mockRotator = new MockTestAdapter("gemini", "Google Gemini");
  manager.registerCustomAdapter(mockRotator);
  // Clear any env keys for gemini in test instance
  (manager as any).providers.get("gemini").apiKeys = [];
  manager.addApiKey("gemini", "gemini-key-1");
  manager.addApiKey("gemini", "gemini-key-2");

  mockRotator.generate = async (req, key) => {
    if (key === "gemini-key-1") throw new Error("HTTP 429: Rate limit");
    return { text: "Success on key 2" };
  };

  const res2 = await manager.execute({ prompt: "Calculate normal distribution" });
  assert(res2.text === "Success on key 2", "Test 2: Key 1 (429) automatically rotates to Key 2");
  assert(res2.fallbackChain.some((s) => s.status === "rate_limited"), "Test 2: Records rate-limited hop for key 1");
  assert(res2.fallbackChain.some((s) => s.status === "success"), "Test 2: Records success on key 2");

  // Test 3: Key exhaustion -> Provider Fallback (Gemini -> Groq)
  manager.resetToDefaults();
  const mockGeminiFail = new MockTestAdapter("gemini", "Google Gemini");
  mockGeminiFail.behavior = "rate_limit";
  const mockGroqSuccess = new MockTestAdapter("groq", "Groq (Fast LPU)");
  mockGroqSuccess.behavior = "success";

  manager.registerCustomAdapter(mockGeminiFail);
  manager.registerCustomAdapter(mockGroqSuccess);

  (manager as any).providers.get("gemini").apiKeys = [];
  (manager as any).providers.get("groq").apiKeys = [];
  manager.updateProvider("gemini", { maxRetries: 1 });
  manager.addApiKey("gemini", "gemini-key-exhausted");
  manager.addApiKey("groq", "groq-key-working");

  const res3 = await manager.execute({ prompt: "Transform thermodynamic notes" });
  assert(res3.providerId === "groq", "Test 3: Automatically falls back to Groq when Gemini is exhausted");
  assert(res3.fallbackChain[0].providerId === "gemini" && res3.fallbackChain[0].status === "rate_limited", "Test 3: First hop logged as Gemini 429");
  assert(res3.fallbackChain.some((s) => s.providerId === "groq" && s.status === "success"), "Test 3: Later hop logged as Groq success");

  // Test 4: Invalid API key (401) is marked invalid and not repeatedly retried
  manager.resetToDefaults();
  const mock401 = new MockTestAdapter("gemini", "Google Gemini");
  mock401.behavior = "invalid_key";
  const mockBackup = new MockTestAdapter("groq", "Groq");
  mockBackup.behavior = "success";

  manager.registerCustomAdapter(mock401);
  manager.registerCustomAdapter(mockBackup);
  (manager as any).providers.get("gemini").apiKeys = [];
  (manager as any).providers.get("groq").apiKeys = [];
  manager.addApiKey("gemini", "bad-key-401");
  manager.addApiKey("groq", "good-backup-key");

  const res4 = await manager.execute({ prompt: "Format statistics notes" });
  assert(res4.providerId === "groq", "Test 4: 401 Invalid Key skips retries and continues to Groq");
  const geminiHop = res4.fallbackChain.find((h) => h.providerId === "gemini");
  assert(geminiHop?.status === "invalid_key", "Test 4: Hop logged with invalid_key status");

  // Test 5: Cost Protection / Free-Only Mode prevents paid fallbacks
  manager.resetToDefaults();
  const mockPaidProvider = new MockTestAdapter("cohere", "Cohere Paid", [
    { id: "paid-model", name: "Paid Model", contextWindow: 32000, isFree: false, capabilities: ["text", "math"] },
  ]);
  manager.registerCustomAdapter(mockPaidProvider);
  (manager as any).providers.get("cohere").apiKeys = [];
  manager.addApiKey("cohere", "cohere-key");
  manager.updateProvider("cohere", {
    selectedModel: "paid-model",
    billingMode: "free_and_paid",
    availableModels: mockPaidProvider.models,
  });
  manager.updateManagerConfig({ freeOnlyMode: true, enableModelFallback: false });

  // Disable all other providers so only paid exists
  manager.getClientProviders().forEach((p) => {
    if (p.id !== "cohere") manager.updateProvider(p.id, { enabled: false });
  });

  try {
    await manager.execute({ prompt: "Try paid model under free-only" });
    assert(false, "Test 5: Should not allow paid model execution when freeOnlyMode is on");
  } catch (err: any) {
    assert(err.message.includes("All configured AI providers failed"), "Test 5: Cost protection blocks paid fallback execution");
  }

  // Test 6: Capability Matching (rejects models without 'math')
  manager.resetToDefaults();
  const mockNoMath = new MockTestAdapter("gemini", "Gemini Non-Math", [
    { id: "no-math-model", name: "No Math", contextWindow: 4000, isFree: true, capabilities: ["text"] },
  ]);
  const mockWithMath = new MockTestAdapter("groq", "Groq Math", [
    { id: "math-model", name: "Math Model", contextWindow: 32000, isFree: true, capabilities: ["text", "math"] },
  ]);
  manager.registerCustomAdapter(mockNoMath);
  manager.registerCustomAdapter(mockWithMath);
  manager.addApiKey("gemini", "k1");
  manager.addApiKey("groq", "k2");
  manager.updateProvider("gemini", { selectedModel: "no-math-model" });

  const res6 = await manager.execute({ prompt: "Equation test", capabilities: ["math"] });
  assert(res6.providerId === "groq", "Test 6: Capability matching skips models without math capability");

  // Test 7: Audit Log Tracking
  const logs = manager.getRecentLogs();
  assert(logs.length >= 4, "Test 7: Fallback audit logs recorded in circular buffer");
  assert(logs[0].chain.length > 0, "Test 7: Log entry preserves entire fallback trace");

  console.log(`\n=== SUMMARY: ${passed}/${total} TESTS PASSED ===\n`);
}

runTests().catch((e) => {
  console.error("Test runner failed:", e);
  process.exit(1);
});
