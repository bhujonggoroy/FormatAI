/**
 * Verification test for IAIProviderAdapter interface compliance
 */

import { strict as assert } from "assert";
import type { IAIProviderAdapter } from "../src/providers/IAIProviderAdapter.ts";
import {
  GeminiAdapter,
  GroqAdapter,
  OpenRouterAdapter,
  MistralAdapter,
  CohereAdapter,
  HuggingFaceAdapter,
  CloudflareAdapter,
  CustomAdapter,
} from "../src/providers/index.ts";

console.log("=== VERIFYING IAIProviderAdapter INTERFACE ===");

// 1. Strict implementation matching the exact user prompt signature:
class StrictUserAdapter implements IAIProviderAdapter {
  id = "strict-test";
  name = "Strict Test Provider";

  async getModels(apiKey: string): Promise<string[]> {
    assert(typeof apiKey === "string", "apiKey should be passed");
    return ["test-model-1", "test-model-2"];
  }

  async test(apiKey: string, modelId: string): Promise<boolean> {
    assert(Boolean(apiKey && modelId), "apiKey and modelId are required");
    return true;
  }

  async generate(apiKey: string, modelId: string, request: any): Promise<any> {
    return {
      text: `Processed ${request.prompt || "math"} using ${modelId}`,
      key: apiKey,
    };
  }

  classifyError(error: any): string {
    if (error?.status === 401) return "INVALID_API_KEY";
    return "UNKNOWN_ERROR";
  }
}

// Instantiate and test
const userAdapter: IAIProviderAdapter = new StrictUserAdapter();

async function runTests() {
  // Test getModels
  const models = await userAdapter.getModels("mock-key-123");
  assert(Array.isArray(models), "getModels returns an array");
  assert(models.length === 2, "getModels returns 2 models");
  console.log("✓ PASS: Strict user adapter getModels(apiKey) -> Promise<string[]> works");

  // Test test
  const testOk = await userAdapter.test("mock-key-123", "test-model-1");
  assert(testOk === true, "test returns boolean true");
  console.log("✓ PASS: Strict user adapter test(apiKey, modelId) -> Promise<boolean> works");

  // Test generate
  const genResult = await userAdapter.generate("mock-key-123", "test-model-1", { prompt: "\\int x dx" });
  assert(genResult.text.includes("test-model-1"), "generate returns expected payload");
  console.log("✓ PASS: Strict user adapter generate(apiKey, modelId, request) -> Promise<any> works");

  // Test classifyError
  const errCode = userAdapter.classifyError({ status: 401 });
  assert(errCode === "INVALID_API_KEY", "classifyError returns string");
  console.log("✓ PASS: Strict user adapter classifyError(error) -> string works");

  // Verify all default built-in adapters also adhere to IAIProviderAdapter
  const adapters: IAIProviderAdapter[] = [
    new GeminiAdapter(),
    new GroqAdapter(),
    new OpenRouterAdapter(),
    new MistralAdapter(),
    new CohereAdapter(),
    new HuggingFaceAdapter(),
    new CloudflareAdapter(),
    new CustomAdapter(),
  ];

  for (const adapter of adapters) {
    assert(typeof adapter.getModels === "function", `${adapter.id} has getModels`);
    assert(typeof adapter.test === "function", `${adapter.id} has test`);
    assert(typeof adapter.generate === "function", `${adapter.id} has generate`);
    assert(typeof adapter.classifyError === "function", `${adapter.id} has classifyError`);
  }
  console.log("✓ PASS: All built-in adapters implement IAIProviderAdapter interface methods");

  console.log("=== IAIProviderAdapter TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
