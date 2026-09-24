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

  console.log("=== ALL UNIVERSAL MODEL TESTER TESTS PASSED ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
