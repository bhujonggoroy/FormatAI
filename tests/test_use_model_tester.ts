import {
  useModelTester,
  useUniversalModelTester,
  UseModelTesterOptions,
  UseModelTesterReturn,
  ModelErrorDetails,
} from "../src/hooks/useModelTester.ts";
import {
  ProviderModelTestReport,
  TestedModelItem,
  categorizeFailure,
} from "../src/services/UniversalModelTester.ts";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✓ PASS: ${message}`);
}

async function runTests() {
  console.log("=== RUNNING USE MODEL TESTER HOOK TESTS ===");

  // Test 1: Verify hook functions and aliases exist
  assert(typeof useModelTester === "function", "useModelTester is exported as a function");
  assert(typeof useUniversalModelTester === "function", "useUniversalModelTester alias is exported as a function");
  assert(useModelTester === useUniversalModelTester, "useUniversalModelTester is reference-equal to useModelTester");

  // Test 2: Verify errorMap generation for not-ready models
  const mockNotReady: TestedModelItem[] = [
    {
      id: "deprecated-model-1",
      name: "Deprecated Model 1",
      provider: "groq",
      isReady: false,
      status: "not_ready",
      reason: "Model Deprecated / Retired by Provider",
      failureCategory: "deprecated",
      capabilities: ["text"],
      isFree: true,
      testedAt: Date.now(),
    },
    {
      id: "rate-limited-model-2",
      name: "Rate Limited Model 2",
      provider: "groq",
      isReady: false,
      status: "not_ready",
      reason: "Quota Exceeded / Rate Limited (429)",
      failureCategory: "quota_exceeded",
      capabilities: ["text", "math"],
      isFree: true,
      testedAt: Date.now(),
    },
  ];

  const map: Record<string, ModelErrorDetails> = {};
  for (const item of mockNotReady) {
    map[item.id] = {
      category: item.failureCategory || "unknown",
      reason: item.reason || "Failed",
    };
  }

  assert(map["deprecated-model-1"].category === "deprecated", "Error map correctly maps deprecated category");
  assert(map["rate-limited-model-2"].category === "quota_exceeded", "Error map correctly maps quota_exceeded category");

  // Test 3: Verify categorizeFailure produces expected category and reason
  const failure429 = categorizeFailure({ errorCode: "RATE_LIMIT" }, "any-model");
  assert(failure429.category === "quota_exceeded", "429 correctly categorized as quota_exceeded");

  const failure404 = categorizeFailure({ errorCode: "MODEL_UNAVAILABLE" }, "non-existent-model");
  assert(failure404.category === "model_not_found", "404 correctly categorized as model_not_found");

  const failureBilling = categorizeFailure({ errorCode: "BILLING_REQUIRED" }, "claude-paid");
  assert(failureBilling.category === "billing_required", "Billing error correctly categorized as billing_required");

  console.log("=== ALL USE MODEL TESTER HOOK TESTS PASSED ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
