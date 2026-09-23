import { AIRequestManager } from "../src/server/ai/AIRequestManager.ts";
import {
  healAndNormalizeProviders,
  getUserSettingsStorageKey,
  loadUserAISettingsPackage,
  setCachedProviderModels,
  getCachedProviderModels,
  invalidateProviderModelCache,
  maskApiKey,
} from "../src/utils/userLocalStorage.ts";
import type { UserProviderConfig, ModelInfo } from "../src/types/ai.ts";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`✗ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✓ PASS: ${msg}`);
}

async function runTests() {
  console.log("=== RUNNING AI CONNECTION & ARCHITECTURE TESTS ===");

  const manager = new AIRequestManager();

  // Test 1: Mask raw key safely
  const masked1 = maskApiKey("gsk_1234567890abcdefghijklmnopqrstuvwxyz");
  assert(masked1.startsWith("gsk_") && masked1.endsWith("wxyz") && masked1.includes("************"), "Test 1: maskApiKey masks middle characters safely");
  assert(!masked1.includes("1234567890"), "Test 1: maskApiKey does not expose secret middle bytes");

  // Test 2: Test button with explicit key + model testing (stateless, independent of ON/OFF state)
  const probeKeyRes = await manager.testApiConnection("openrouter", "key_probe_02", "meta-llama/llama-3.3-70b-instruct:free", "sk-or-test-probe-key-12345");
  assert(probeKeyRes.providerId === "openrouter", "Test 2: Provider ID matches tested provider");
  assert(probeKeyRes.keyId === "key_probe_02", "Test 2: Key ID matches explicit target key");
  assert(probeKeyRes.model === "meta-llama/llama-3.3-70b-instruct:free", "Test 2: Model matches explicit target model");
  assert(Boolean(probeKeyRes.diagnostic), "Test 2: Diagnostic object is generated");
  assert(Boolean(probeKeyRes.diagnostic?.maskedKey?.includes("************")), "Test 2: Diagnostic masks API key safely");

  // Test 3: Missing key during explicit test produces INVALID_API_KEY error
  const emptyKeyRes = await manager.testApiConnection("groq", "key_empty", "llama-3.3-70b-versatile", "");
  assert(!emptyKeyRes.success, "Test 3: Empty key test fails");
  assert(emptyKeyRes.errorCode === "INVALID_API_KEY", "Test 3: Empty key classified as INVALID_API_KEY");

  // Test 4: Dynamic model catalog endpoint returns models for providers
  const modelsRes = await manager.fetchProviderModels("gemini");
  assert(modelsRes.success && modelsRes.models.length > 0, "Test 4: fetchProviderModels returns catalog for gemini");
  assert(modelsRes.models.some((m) => m.id === "gemini-2.5-flash"), "Test 4: Gemini model list contains gemini-2.5-flash");

  // Test 5: Self-healing migration updates obsolete/stale model IDs
  const staleProviders: UserProviderConfig[] = [
    {
      id: "gemini",
      name: "Google Gemini",
      enabled: true,
      priority: 1,
      selectedModel: "gemini-3.6-flash", // Obsolete model ID
      availableModels: [
        { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", isFree: true, contextWindow: 1048576, capabilities: ["text", "math"] },
        { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", isFree: false, contextWindow: 2097152, capabilities: ["text", "math"] },
      ],
      apiKeys: [
        { id: "k1", name: "Key 1", key: "AIzaSyTestKey12345", maskedKey: "AIza************2345", enabled: false }, // OFF Key
      ],
      maxRetries: 2,
      timeoutMs: 45000,
      billingMode: "free_only",
      status: "active",
    },
  ];

  const healed = healAndNormalizeProviders(staleProviders);
  assert(healed[0].selectedModel === "gemini-2.5-flash", "Test 5: Stale gemini-3.6-flash is self-healed to active gemini-2.5-flash");
  assert(healed[0].apiKeys[0].maskedKey.includes("************"), "Test 5: Healed keys receive safe masked keys");

  // Test 6: Normal generation strictly skips keys where enabled === false
  try {
    await manager.executeRequestScoped(
      { prompt: "Test OFF key" },
      { mode: "manual", activeProviderId: "gemini", enableFallback: false } as any,
      healed
    );
    assert(false, "Test 6: Should not generate with OFF key");
  } catch (err: any) {
    assert(err.message.includes("All configured AI providers failed"), "Test 6: Normal generation refuses to use disabled (OFF) keys");
  }

  // Test 7: User-scoped storage isolation key
  const defaultKey = getUserSettingsStorageKey();
  const customUserKey = getUserSettingsStorageKey("user_42");
  assert(defaultKey === "formatai:user:local_default:ai-settings", "Test 7: Default guest storage key follows formatai:user:local_default:ai-settings format");
  assert(customUserKey === "formatai:user:user_42:ai-settings", "Test 7: User-specific storage key follows formatai:user:<userId>:ai-settings format");

  console.log("=== ALL ARCHITECTURE TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
