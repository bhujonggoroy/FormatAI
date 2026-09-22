import { AIRequestManager } from "../src/server/ai/AIRequestManager.ts";
import { AIProviderAdapter, AdapterOptions } from "../src/server/ai/adapters/BaseAdapter.ts";
import { AIRequest, ModelInfo, NormalizedAIError, TestResult, ProviderConfig, ManagerConfig } from "../src/server/ai/types.ts";

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

  const manager = new AIRequestManager();

  // Register mock providers for precise simulation
  const mockP1 = new MockTestAdapter("gemini", "Google Gemini");
  const mockP2 = new MockTestAdapter("groq", "Groq (Fast LPU)");
  const mockP3 = new MockTestAdapter("openrouter", "OpenRouter");

  manager.registerCustomAdapter(mockP1);
  manager.registerCustomAdapter(mockP2);
  manager.registerCustomAdapter(mockP3);

  // Test 1: Successful Primary Provider with Scoped Providers
  const userProviders1: any[] = [
    {
      id: "gemini",
      name: "Google Gemini",
      enabled: true,
      priority: 1,
      selectedModel: "mock-free-model",
      availableModels: mockP1.models,
      billingMode: "free_only",
      maxRetries: 1,
      timeoutMs: 5000,
      apiKeys: [{ id: "k1", name: "Primary Key", key: "mock-gemini-key-1", enabled: true }],
    },
  ];

  mockP1.behavior = "success";
  const res1 = await manager.executeRequestScoped(
    { prompt: "Standardize LaTeX equations" },
    { mode: "automatic", enableFallback: true, freeOnlyMode: false } as any,
    userProviders1
  );
  assert(res1.providerId === "gemini", "Test 1: Primary provider handles request directly when available");
  assert(res1.fallbackChain.length === 1 && res1.fallbackChain[0].status === "success", "Test 1: Fallback chain has 1 successful hop");

  // Test 2: Rate Limit on Key 1 -> Rotates to Key 2
  const mockRotator = new MockTestAdapter("gemini", "Google Gemini");
  manager.registerCustomAdapter(mockRotator);

  const userProviders2: any[] = [
    {
      id: "gemini",
      name: "Google Gemini",
      enabled: true,
      priority: 1,
      selectedModel: "mock-free-model",
      availableModels: mockRotator.models,
      billingMode: "free_only",
      maxRetries: 1,
      timeoutMs: 5000,
      apiKeys: [
        { id: "k1", name: "Key 1", key: "gemini-key-1", enabled: true },
        { id: "k2", name: "Key 2", key: "gemini-key-2", enabled: true },
      ],
    },
  ];

  mockRotator.generate = async (req, key) => {
    if (key === "gemini-key-1") throw new Error("HTTP 429: Rate limit");
    return { text: "Success on key 2" };
  };

  const res2 = await manager.executeRequestScoped(
    { prompt: "Calculate normal distribution" },
    { mode: "automatic", enableFallback: true, freeOnlyMode: false } as any,
    userProviders2
  );
  assert(res2.text === "Success on key 2", "Test 2: Key 1 (429) automatically rotates to Key 2");
  assert(res2.fallbackChain.some((s) => s.status === "rate_limited" || s.status === "rate_limit"), "Test 2: Records rate-limited hop for key 1");
  assert(res2.fallbackChain.some((s) => s.status === "success"), "Test 2: Records success on key 2");

  // Test 3: Key exhaustion -> Provider Fallback (Gemini -> Groq)
  const mockGeminiFail = new MockTestAdapter("gemini", "Google Gemini");
  mockGeminiFail.behavior = "rate_limit";
  const mockGroqSuccess = new MockTestAdapter("groq", "Groq (Fast LPU)");
  mockGroqSuccess.behavior = "success";

  manager.registerCustomAdapter(mockGeminiFail);
  manager.registerCustomAdapter(mockGroqSuccess);

  const userProviders3: any[] = [
    {
      id: "gemini",
      name: "Google Gemini",
      enabled: true,
      priority: 1,
      selectedModel: "mock-free-model",
      availableModels: mockGeminiFail.models,
      billingMode: "free_only",
      maxRetries: 1,
      timeoutMs: 5000,
      apiKeys: [{ id: "k1", name: "Exhausted Key", key: "gemini-key-exhausted", enabled: true }],
    },
    {
      id: "groq",
      name: "Groq (Fast LPU)",
      enabled: true,
      priority: 2,
      selectedModel: "mock-free-model",
      availableModels: mockGroqSuccess.models,
      billingMode: "free_only",
      maxRetries: 1,
      timeoutMs: 5000,
      apiKeys: [{ id: "k2", name: "Groq Key", key: "groq-key-working", enabled: true }],
    },
  ];

  const res3 = await manager.executeRequestScoped(
    { prompt: "Transform thermodynamic notes" },
    { mode: "automatic", enableFallback: true, freeOnlyMode: false } as any,
    userProviders3
  );
  assert(res3.providerId === "groq", "Test 3: Automatically falls back to Groq when Gemini is exhausted");
  assert(
    res3.fallbackChain[0].providerId === "gemini" &&
      (res3.fallbackChain[0].status === "rate_limited" || res3.fallbackChain[0].status === "rate_limit"),
    "Test 3: First hop logged as Gemini 429"
  );
  assert(res3.fallbackChain.some((s) => s.providerId === "groq" && s.status === "success"), "Test 3: Later hop logged as Groq success");

  // Test 4: Invalid API key (401) is marked invalid and not repeatedly retried
  const mock401 = new MockTestAdapter("gemini", "Google Gemini");
  mock401.behavior = "invalid_key";
  const mockBackup = new MockTestAdapter("groq", "Groq");
  mockBackup.behavior = "success";

  manager.registerCustomAdapter(mock401);
  manager.registerCustomAdapter(mockBackup);

  const userProviders4: any[] = [
    {
      id: "gemini",
      name: "Google Gemini",
      enabled: true,
      priority: 1,
      selectedModel: "mock-free-model",
      availableModels: mock401.models,
      billingMode: "free_only",
      maxRetries: 2,
      timeoutMs: 5000,
      apiKeys: [{ id: "bad", name: "Bad Key", key: "bad-key-401", enabled: true }],
    },
    {
      id: "groq",
      name: "Groq",
      enabled: true,
      priority: 2,
      selectedModel: "mock-free-model",
      availableModels: mockBackup.models,
      billingMode: "free_only",
      maxRetries: 1,
      timeoutMs: 5000,
      apiKeys: [{ id: "good", name: "Good Key", key: "good-backup-key", enabled: true }],
    },
  ];

  const res4 = await manager.executeRequestScoped(
    { prompt: "Format statistics notes" },
    { mode: "automatic", enableFallback: true, freeOnlyMode: false } as any,
    userProviders4
  );
  assert(res4.providerId === "groq", "Test 4: 401 Invalid Key skips retries and continues to Groq");
  const geminiHop = res4.fallbackChain.find((h) => h.providerId === "gemini");
  assert(geminiHop?.status === "invalid_key", "Test 4: Hop logged with invalid_key status");

  // Test 5: Cost Protection / Free-Only Mode prevents paid fallbacks
  const mockPaidProvider = new MockTestAdapter("cohere", "Cohere Paid", [
    { id: "paid-model", name: "Paid Model", contextWindow: 32000, isFree: false, capabilities: ["text", "math"] },
  ]);
  manager.registerCustomAdapter(mockPaidProvider);

  const userProviders5: any[] = [
    {
      id: "cohere",
      name: "Cohere Paid",
      enabled: true,
      priority: 1,
      selectedModel: "paid-model",
      availableModels: mockPaidProvider.models,
      billingMode: "free_and_paid",
      maxRetries: 1,
      timeoutMs: 5000,
      apiKeys: [{ id: "c1", name: "Cohere Key", key: "cohere-key", enabled: true }],
    },
  ];

  try {
    await manager.executeRequestScoped(
      { prompt: "Try paid model under free-only" },
      { mode: "automatic", enableFallback: true, freeOnlyMode: true, enableModelFallback: false } as any,
      userProviders5
    );
    assert(false, "Test 5: Should not allow paid model execution when freeOnlyMode is on");
  } catch (err: any) {
    assert(err.message.includes("All configured AI providers failed"), "Test 5: Cost protection blocks paid fallback execution");
  }

  // Test 6: Capability Matching (rejects models without 'math')
  const mockNoMath = new MockTestAdapter("gemini", "Gemini Non-Math", [
    { id: "no-math-model", name: "No Math", contextWindow: 4000, isFree: true, capabilities: ["text"] },
  ]);
  const mockWithMath = new MockTestAdapter("groq", "Groq Math", [
    { id: "math-model", name: "Math Model", contextWindow: 32000, isFree: true, capabilities: ["text", "math"] },
  ]);
  manager.registerCustomAdapter(mockNoMath);
  manager.registerCustomAdapter(mockWithMath);

  const userProviders6: any[] = [
    {
      id: "gemini",
      name: "Gemini Non-Math",
      enabled: true,
      priority: 1,
      selectedModel: "no-math-model",
      availableModels: mockNoMath.models,
      billingMode: "free_only",
      maxRetries: 1,
      timeoutMs: 5000,
      apiKeys: [{ id: "k1", name: "K1", key: "k1", enabled: true }],
    },
    {
      id: "groq",
      name: "Groq Math",
      enabled: true,
      priority: 2,
      selectedModel: "math-model",
      availableModels: mockWithMath.models,
      billingMode: "free_only",
      maxRetries: 1,
      timeoutMs: 5000,
      apiKeys: [{ id: "k2", name: "K2", key: "k2", enabled: true }],
    },
  ];

  const res6 = await manager.executeRequestScoped(
    { prompt: "Equation test", capabilities: ["math"] },
    { mode: "automatic", enableFallback: true, freeOnlyMode: false } as any,
    userProviders6
  );
  assert(res6.providerId === "groq", "Test 6: Capability matching skips models without math capability");

  console.log(`\n=== SUMMARY: ${passed}/${total} TESTS PASSED ===\n`);
}

runTests().catch((e) => {
  console.error("Test runner failed:", e);
  process.exit(1);
});
