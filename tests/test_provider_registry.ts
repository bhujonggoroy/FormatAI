import {
  providerRegistry,
  getProvider,
  listProviders,
  registerProvider,
  hasProvider,
  type AIProviderAdapter,
} from "../src/providers/index.ts";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`✗ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✓ PASS: ${msg}`);
}

async function runTests() {
  console.log("=== RUNNING PROVIDER REGISTRY TESTS ===");

  // 1. Verify listProviders() returns all registered adapters
  const allProviders = listProviders();
  assert(Array.isArray(allProviders), "listProviders() returns an array");
  assert(allProviders.length >= 8, `listProviders() contains at least 8 default providers (found: ${allProviders.length})`);

  const ids = allProviders.map((p) => p.id);
  console.log("Registered providers:", ids.join(", "));

  // 2. Check key adapters exist
  const expectedAdapters = ["gemini", "groq", "openrouter", "mistral", "cohere", "huggingface", "cloudflare", "custom"];
  for (const exp of expectedAdapters) {
    assert(ids.includes(exp), `Provider '${exp}' is in listProviders()`);
    const prov = getProvider(exp);
    assert(Boolean(prov), `getProvider('${exp}') returns adapter`);
    assert(prov?.id === exp, `getProvider('${exp}').id matches`);
    assert(hasProvider(exp), `hasProvider('${exp}') is true`);
  }

  // 3. Check case-insensitivity in getProvider
  const geminiUpper = getProvider("GEMINI");
  assert(geminiUpper?.id === "gemini", "getProvider is case-insensitive ('GEMINI' -> 'gemini')");

  // 4. Verify providerRegistry object methods
  assert(providerRegistry.getProvider("groq")?.id === "groq", "providerRegistry.getProvider works");
  assert(providerRegistry.listProviders().length === allProviders.length, "providerRegistry.listProviders works");
  assert(providerRegistry.hasProvider("openrouter"), "providerRegistry.hasProvider works");
  assert(providerRegistry.get("gemini")?.id === "gemini", "providerRegistry.get alias works");
  assert(providerRegistry.list().length === allProviders.length, "providerRegistry.list alias works");
  assert(providerRegistry.has("cloudflare"), "providerRegistry.has alias works");
  assert(typeof providerRegistry.getAll() === "object", "providerRegistry.getAll returns record");

  // 5. Test dynamic registration
  const mockAdapter: AIProviderAdapter = {
    id: "test-new-ai",
    name: "Test New AI",
    getModels: async () => [],
    test: async () => ({
      success: true,
      latencyMs: 10,
      providerId: "test-new-ai",
      providerName: "Test New AI",
      model: "test-model",
    }),
    generate: async () => ({ text: "hello" }),
    classifyError: () => ({ kind: "unknown", message: "err", retryable: false }),
    supportsCapability: () => true,
  };

  registerProvider(mockAdapter);
  assert(hasProvider("test-new-ai"), "hasProvider reflects newly registered adapter");
  assert(getProvider("test-new-ai")?.name === "Test New AI", "getProvider retrieves registered adapter");

  // 6. Verify all registered adapters enforce getModels, test, generate, and classifyError
  for (const prov of listProviders()) {
    assert(typeof prov.getModels === "function", `Provider '${prov.id}' implements getModels()`);
    assert(typeof prov.test === "function", `Provider '${prov.id}' implements test()`);
    assert(typeof prov.generate === "function", `Provider '${prov.id}' implements generate()`);
    assert(typeof prov.classifyError === "function", `Provider '${prov.id}' implements classifyError()`);
  }
  console.log("✓ PASS: All provider adapters strictly implement getModels, test, generate, and classifyError");

  console.log("=== ALL PROVIDER REGISTRY TESTS PASSED ===");
}

runTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
