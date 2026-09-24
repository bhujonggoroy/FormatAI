import {
  categorizeFailure,
  saveModelTestReport,
  getCachedModelTestReport,
  ProviderModelTestReport,
} from "../src/services/UniversalModelTester.ts";
import { getActiveModels } from "../src/config/modelRegistry.ts";
import { CENTRAL_CATALOG } from "../src/shared/centralModelCatalog.ts";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✓ PASS: ${message}`);
}

async function runTests() {
  console.log("=== RUNNING UNIVERSAL MODEL TESTER TESTS ===");

  // Test 1: Categorize failure properly for 429 Quota Exceeded
  const quotaFail = categorizeFailure(
    { errorCode: "RATE_LIMIT", errorKind: "rate_limit", errorMessage: "429 Quota Exceeded" },
    "gemini-2.5-flash"
  );
  assert(quotaFail.category === "quota_exceeded", "Categorizes 429 as quota_exceeded");
  assert(quotaFail.reason.includes("Quota Exceeded"), "Reason includes Quota Exceeded");

  // Test 2: Categorize failure properly for 404 Model Not Found
  const notFoundFail = categorizeFailure(
    { errorCode: "MODEL_UNAVAILABLE", errorKind: "model_unavailable", errorMessage: "Model not found" },
    "old-model-xyz"
  );
  assert(notFoundFail.category === "model_not_found", "Categorizes 404 as model_not_found");

  // Test 3: Categorize failure for Deprecated models
  const depFail = categorizeFailure(
    { errorCode: "MODEL_UNAVAILABLE", errorMessage: "deprecated" },
    "gemini-3.8-flash"
  );
  assert(depFail.category === "deprecated", "Categorizes legacy gemini-3.8-flash as deprecated");

  // Test 4: Categorize failure for Billing Required
  const billFail = categorizeFailure(
    { errorCode: "BILLING_REQUIRED", errorKind: "billing_required", errorMessage: "Payment method required" },
    "claude-3-opus"
  );
  assert(billFail.category === "billing_required", "Categorizes billing errors as billing_required");

  // Test 5: Verify Active Models for Gemini has gemini-2.5-flash as primary
  const geminiModels = getActiveModels("gemini");
  assert(geminiModels.length > 0, "Gemini has active models");
  assert(geminiModels[0].id === "gemini-2.5-flash", "Gemini primary active model is gemini-2.5-flash");
  assert(
    !geminiModels.some((m) => m.id === "gemini-3.8-flash"),
    "Legacy gemini-3.8-flash is not in active models list"
  );

  // Test 6: Verify Groq active models
  const groqModels = getActiveModels("groq");
  assert(groqModels.length > 0, "Groq has active models");
  assert(
    !groqModels.some((m) => m.id === "llama-3.1-8b-instant"),
    "Retired Groq models are removed"
  );

  // Test 7: Verify OpenRouter active models
  const openrouterModels = getActiveModels("openrouter");
  assert(openrouterModels.length > 0, "OpenRouter has active models");
  assert(
    openrouterModels.every((m) => m.isFree || m.free),
    "OpenRouter models shown are free-tier eligible"
  );

  // Test 8: STRICT PROVIDER ISOLATION
  // Verify Gemini models contain ONLY Gemini models
  assert(
    geminiModels.every((m) => m.provider === "gemini" && !m.id.startsWith("gpt-") && !m.id.startsWith("claude-")),
    "STRICT ISOLATION: Gemini active models contain ONLY Gemini models"
  );

  // Verify OpenAI models contain ONLY OpenAI models
  const openaiModels = getActiveModels("openai");
  assert(openaiModels.length > 0, "OpenAI has active models");
  assert(
    openaiModels.every((m) => m.provider === "openai" && !m.id.startsWith("gemini-") && !m.id.startsWith("claude-")),
    "STRICT ISOLATION: OpenAI active models contain ONLY OpenAI models"
  );

  // Verify Claude models contain ONLY Claude models
  const claudeModels = getActiveModels("claude");
  assert(claudeModels.length > 0, "Claude has active models");
  assert(
    claudeModels.every((m) => (m.provider === "claude" || m.provider === "anthropic") && !m.id.startsWith("gemini-") && !m.id.startsWith("gpt-")),
    "STRICT ISOLATION: Claude active models contain ONLY Claude models"
  );

  // Test 9: getActiveModels with no arguments returns empty array (NEVER leaks all providers' models)
  const emptyQuery = getActiveModels();
  assert(emptyQuery.length === 0, "STRICT ISOLATION: getActiveModels() with no provider returns empty array");

  // Test 10: Canonical Provider ID Resolution
  const { canonicalProviderId } = await import("../src/shared/centralModelCatalog.ts");
  assert(canonicalProviderId("google-gemini") === "gemini", "Resolves google-gemini to gemini");
  assert(canonicalProviderId("anthropic") === "claude", "Resolves anthropic to claude");
  assert(canonicalProviderId("open-router") === "openrouter", "Resolves open-router to openrouter");

  // Test 11: Provider-Scoped Results Data Structure (Requirement 14)
  const { getModelTestResults } = await import("../src/services/UniversalModelTester.ts");
  const mockReport: ProviderModelTestReport = {
    providerId: "gemini",
    testedAt: 1700000000000,
    apiKeyMasked: "AIza...1234",
    readyModels: [
      {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        provider: "gemini",
        isReady: true,
        status: "ready",
        reason: "Ready for Deployment (Verified responsive)",
        latencyMs: 142,
        capabilities: ["text", "math"],
        isFree: true,
        testedAt: 1700000000000,
      },
    ],
    notReadyModels: [
      {
        id: "gemini-3.8-flash",
        name: "Gemini 3.8 Flash",
        provider: "gemini",
        isReady: false,
        status: "not_ready",
        reason: "Model Deprecated / Retired by Provider",
        latencyMs: 0,
        capabilities: ["text"],
        isFree: true,
        testedAt: 1700000000000,
      },
    ],
    totalTested: 2,
    status: "completed",
  };

  saveModelTestReport(mockReport);

  const scopedResults = getModelTestResults("google-gemini");
  assert(scopedResults !== null, "Successfully retrieves provider-scoped results by alias 'google-gemini'");
  assert(scopedResults?.providerId === "gemini", "Scoped results providerId is 'gemini'");
  assert(scopedResults?.models.length === 2, "Contains 2 tested models");
  assert(scopedResults?.models[0].providerId === "gemini", "Model 1 strictly contains providerId 'gemini'");
  assert(scopedResults?.models[0].status === "ready", "Model 1 status is 'ready'");
  assert(scopedResults?.models[0].responseTime === 142, "Model 1 responseTime is 142ms");
  assert(scopedResults?.models[1].status === "not_ready", "Model 2 status is 'not_ready'");

  // Verify another provider has separate results and was NOT overwritten
  const openaiResults = getModelTestResults("openai");
  assert(
    openaiResults === null || openaiResults.providerId === "openai",
    "OpenAI results remain strictly isolated from Gemini test results"
  );

  console.log("=== ALL UNIVERSAL MODEL TESTER TESTS PASSED ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
