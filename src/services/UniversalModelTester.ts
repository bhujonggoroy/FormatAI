/**
 * Universal AI Provider Model Testing System
 *
 * Provides reusable, provider-agnostic model discovery, API key testing,
 * live progress reporting, and classification into:
 * - READY TO DEPLOY
 * - NOT READY (with specific diagnostic reasons)
 */

import { ModelInfo, TestResult } from "../types/ai";
import {
  CENTRAL_CATALOG,
  isModelSelectable,
  DEPRECATED_OR_RETIRED_MODELS,
  canonicalProviderId,
} from "../shared/centralModelCatalog";
import { getActiveModels } from "../config/modelRegistry";
import { maskApiKey } from "../utils/userLocalStorage";

export type TestingStage =
  | "idle"
  | "validating_key"
  | "discovering_models"
  | "testing_models"
  | "completed"
  | "cancelled"
  | "error";

export type FailureCategory =
  | "quota_exceeded"
  | "model_not_found"
  | "billing_required"
  | "permission_denied"
  | "rate_limited"
  | "timeout"
  | "server_error"
  | "invalid_response"
  | "deprecated"
  | "unknown";

export interface TestedModelItem {
  id: string;
  name: string;
  provider: string;
  isReady: boolean;
  status: "ready" | "not_ready";
  reason: string;
  failureCategory?: FailureCategory;
  latencyMs?: number;
  capabilities: string[];
  freeTier?: string;
  contextWindow?: number;
  isFree: boolean;
  testedAt: number;
}

/**
 * Requirement 14: Provider-scoped model result format
 */
export interface ProviderScopedModelResult {
  providerId: string;
  modelId: string;
  status: "ready" | "not_ready";
  reason: string;
  responseTime: number;
  capabilities: string[];
  testedAt: number;
}

/**
 * Requirement 14: Provider-scoped test results container
 */
export interface ProviderScopedTestResults {
  providerId: string;
  testedAt: number;
  models: ProviderScopedModelResult[];
}

export type GlobalModelTestResultsMap = Record<string, ProviderScopedTestResults>;

/**
 * Requirement 2: Provider-bound test job
 */
export interface ModelTestJob {
  providerId: string;
  apiKeyId?: string;
  models: ModelInfo[];
  results: TestedModelItem[];
  progress: ModelTestingProgress;
  status: TestingStage;
}

export interface ModelTestingProgress {
  providerId: string;
  stage: TestingStage;
  totalModels: number;
  testedCount: number;
  readyCount: number;
  notReadyCount: number;
  currentModelId?: string;
  currentModelName?: string;
  progressPercent: number;
  errorMessage?: string;
}

export interface ProviderModelTestReport {
  providerId: string;
  testedAt: number;
  apiKeyMasked: string;
  readyModels: TestedModelItem[];
  notReadyModels: TestedModelItem[];
  totalTested: number;
  status: "completed" | "error" | "cancelled";
  errorMessage?: string;
}

export interface UniversalTestOptions {
  customEndpoint?: string;
  accountId?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

const STORAGE_PREFIX = "formatai:models_tested:";
const GLOBAL_STORAGE_KEY = "formatai:model_test_results";

// In-memory fallback when localStorage is unavailable (e.g. Node tests/SSR)
const memoryStorage: Record<string, string> = {};

function safeGetItem(key: string): string | null {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memoryStorage[key] || null;
    }
  }
  return memoryStorage[key] || null;
}

function safeSetItem(key: string, value: string): void {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(key, value);
      return;
    } catch {}
  }
  memoryStorage[key] = value;
}

function safeRemoveItem(key: string): void {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.removeItem(key);
    } catch {}
  }
  delete memoryStorage[key];
}

export function getModelTestResultsMap(): GlobalModelTestResultsMap {
  try {
    const raw = safeGetItem(GLOBAL_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function getModelTestResults(providerId: string): ProviderScopedTestResults | null {
  if (!providerId) return null;
  const canonical = canonicalProviderId(providerId);
  const map = getModelTestResultsMap();
  return map[canonical] || map[providerId.toLowerCase().trim()] || null;
}

export function getCachedModelTestReport(providerId: string): ProviderModelTestReport | null {
  if (!providerId) return null;
  const canonical = canonicalProviderId(providerId);
  try {
    const raw =
      safeGetItem(`${STORAGE_PREFIX}${canonical}`) ||
      safeGetItem(`${STORAGE_PREFIX}${providerId.toLowerCase().trim()}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveModelTestReport(report: ProviderModelTestReport): void {
  if (!report?.providerId) return;
  const canonical = canonicalProviderId(report.providerId);
  const normalizedReport: ProviderModelTestReport = {
    ...report,
    providerId: canonical,
    readyModels: (report.readyModels || []).map((m) => ({ ...m, provider: canonical })),
    notReadyModels: (report.notReadyModels || []).map((m) => ({ ...m, provider: canonical })),
  };

  try {
    // 1. Save provider-isolated report
    safeSetItem(
      `${STORAGE_PREFIX}${canonical}`,
      JSON.stringify(normalizedReport)
    );
    if (canonical !== report.providerId.toLowerCase().trim()) {
      safeSetItem(
        `${STORAGE_PREFIX}${report.providerId.toLowerCase().trim()}`,
        JSON.stringify(normalizedReport)
      );
    }

    // 2. Requirement 14: Save explicitly provider-scoped results structure
    const map = getModelTestResultsMap();
    const scopedModels: ProviderScopedModelResult[] = [
      ...normalizedReport.readyModels.map((m) => ({
        providerId: canonical,
        modelId: m.id,
        status: "ready" as const,
        reason: m.reason || "Ready for Deployment",
        responseTime: m.latencyMs || 0,
        capabilities: m.capabilities || ["text", "math"],
        testedAt: m.testedAt || normalizedReport.testedAt,
      })),
      ...normalizedReport.notReadyModels.map((m) => ({
        providerId: canonical,
        modelId: m.id,
        status: "not_ready" as const,
        reason: m.reason || "Not Ready",
        responseTime: m.latencyMs || 0,
        capabilities: m.capabilities || ["text", "math"],
        testedAt: m.testedAt || normalizedReport.testedAt,
      })),
    ];

    map[canonical] = {
      providerId: canonical,
      testedAt: normalizedReport.testedAt,
      models: scopedModels,
    };
    safeSetItem(GLOBAL_STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn("Failed to cache model test report:", err);
  }
}

export function clearModelTestReport(providerId: string): void {
  if (!providerId) return;
  const canonical = canonicalProviderId(providerId);
  try {
    safeRemoveItem(`${STORAGE_PREFIX}${canonical}`);
    safeRemoveItem(`${STORAGE_PREFIX}${providerId.toLowerCase().trim()}`);
    const map = getModelTestResultsMap();
    delete map[canonical];
    delete map[providerId.toLowerCase().trim()];
    safeSetItem(GLOBAL_STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

/**
 * Classify a test failure into a standard failure category and user-facing explanation
 */
export function categorizeFailure(result: Partial<TestResult>, modelId: string): { category: FailureCategory; reason: string } {
  if (DEPRECATED_OR_RETIRED_MODELS[modelId]) {
    return {
      category: "deprecated",
      reason: "Model Deprecated / Retired by Provider",
    };
  }

  const code = (result.errorCode || "").toUpperCase();
  const kind = (result.errorKind || "").toLowerCase();
  const msg = (result.errorMessage || result.userFacingMessage || "").toLowerCase();

  if (code === "RATE_LIMIT" || kind === "rate_limit" || msg.includes("quota") || msg.includes("resource_exhausted") || msg.includes("429")) {
    return {
      category: "quota_exceeded",
      reason: "Quota Exceeded / Rate Limited (429)",
    };
  }

  if (code === "MODEL_UNAVAILABLE" || kind === "model_unavailable" || msg.includes("not found") || msg.includes("404") || msg.includes("unsupported")) {
    return {
      category: "model_not_found",
      reason: "Model Not Found or Not Available on API",
    };
  }

  if (code === "BILLING_REQUIRED" || kind === "billing_required" || msg.includes("billing") || msg.includes("payment")) {
    return {
      category: "billing_required",
      reason: "Billing Required / Account Upgrade Needed",
    };
  }

  if (code === "FORBIDDEN" || kind === "permission_denied" || msg.includes("permission") || msg.includes("403") || msg.includes("access denied")) {
    return {
      category: "permission_denied",
      reason: "Access Forbidden / Region Not Supported (403)",
    };
  }

  if (code === "TIMEOUT" || kind === "timeout" || msg.includes("timeout") || msg.includes("aborted")) {
    return {
      category: "timeout",
      reason: "Connection Timeout / Unresponsive",
    };
  }

  if (code === "NETWORK_ERROR" || kind === "network_error" || msg.includes("fetch failed") || msg.includes("network")) {
    return {
      category: "server_error",
      reason: "Network / Provider Connectivity Error",
    };
  }

  return {
    category: "unknown",
    reason: result.userFacingMessage || result.errorMessage || "Model Diagnostic Request Failed",
  };
}

/**
 * Universal AI Provider Model Testing Engine
 *
 * Runs full discovery and testing workflow:
 * 1. Validates API Key first
 * 2. Fetches current provider model list
 * 3. Tests each model with diagnostic request
 * 4. Yields live progress
 * 5. Returns segregated READY TO DEPLOY vs NOT READY models
 */
export async function runUniversalModelTest(
  providerId: string,
  apiKey: string,
  options?: UniversalTestOptions,
  onProgress?: (progress: ModelTestingProgress) => void
): Promise<ProviderModelTestReport> {
  const pId = canonicalProviderId(providerId);
  const cleanKey = apiKey?.trim() || "";
  const maskedKey = maskApiKey(cleanKey);

  if (!pId) {
    const err = "No valid provider ID specified for model scan.";
    onProgress?.({
      providerId: "unknown",
      stage: "error",
      totalModels: 0,
      testedCount: 0,
      readyCount: 0,
      notReadyCount: 0,
      progressPercent: 0,
      errorMessage: err,
    });
    return {
      providerId: "unknown",
      testedAt: Date.now(),
      apiKeyMasked: "none",
      readyModels: [],
      notReadyModels: [],
      totalTested: 0,
      status: "error",
      errorMessage: err,
    };
  }

  // 1. Initial Key Presence Check
  if (!cleanKey && pId !== "gemini") {
    const err = `No API key provided for ${pId}. Please enter an API key to test models.`;
    onProgress?.({
      providerId: pId,
      stage: "error",
      totalModels: 0,
      testedCount: 0,
      readyCount: 0,
      notReadyCount: 0,
      progressPercent: 0,
      errorMessage: err,
    });
    return {
      providerId: pId,
      testedAt: Date.now(),
      apiKeyMasked: "none",
      readyModels: [],
      notReadyModels: [],
      totalTested: 0,
      status: "error",
      errorMessage: err,
    };
  }

  // 2. Validate API Key First (Distinguish KEY problem vs MODEL problem)
  onProgress?.({
    providerId: pId,
    stage: "validating_key",
    totalModels: 0,
    testedCount: 0,
    readyCount: 0,
    notReadyCount: 0,
    progressPercent: 5,
  });

  if (options?.signal?.aborted) {
    return createCancelledReport(pId, maskedKey);
  }

  // Probe with default catalog model to ensure key itself is not 401 Unauthorized
  const initialCandidates = CENTRAL_CATALOG[pId] || [];
  const probeModelId = initialCandidates[0]?.id || "default";

  try {
    const keyProbeRes = await fetch("/api/ai/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerId: pId,
        apiKey: cleanKey,
        modelId: probeModelId,
        customEndpoint: options?.customEndpoint,
        accountId: options?.accountId,
        timeoutMs: 10000,
      }),
      signal: options?.signal,
    });

    const keyProbeData: TestResult = await keyProbeRes.json();

    if (keyProbeData.errorCode === "INVALID_API_KEY" || keyProbeData.errorKind === "invalid_key") {
      const err = `Invalid API Key: The key provided for ${pId} was rejected by the provider. Please check your credentials.`;
      onProgress?.({
        providerId: pId,
        stage: "error",
        totalModels: 0,
        testedCount: 0,
        readyCount: 0,
        notReadyCount: 0,
        progressPercent: 0,
        errorMessage: err,
      });
      return {
        providerId: pId,
        testedAt: Date.now(),
        apiKeyMasked: maskedKey,
        readyModels: [],
        notReadyModels: [],
        totalTested: 0,
        status: "error",
        errorMessage: err,
      };
    }
  } catch (err: any) {
    if (options?.signal?.aborted) return createCancelledReport(pId, maskedKey);
    // Proceed to discovery even if probe timed out, but continue
  }

  // 3. Model Discovery (Strictly Scoped to THIS Provider)
  onProgress?.({
    providerId: pId,
    stage: "discovering_models",
    totalModels: 0,
    testedCount: 0,
    readyCount: 0,
    notReadyCount: 0,
    progressPercent: 15,
  });

  let discoveredModels: ModelInfo[] = [];

  try {
    const discoveryRes = await fetch("/api/ai/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerId: pId,
        apiKey: cleanKey,
        customEndpoint: options?.customEndpoint,
      }),
      signal: options?.signal,
    });
    const discoveryData = await discoveryRes.json();
    if (discoveryData.success && Array.isArray(discoveryData.models) && discoveryData.models.length > 0) {
      discoveredModels = discoveryData.models;
    }
  } catch {
    // fallback to central catalog if network/endpoint fails
  }

  if (discoveredModels.length === 0) {
    const regModels = getActiveModels(pId);
    discoveredModels = regModels.length > 0 ? (regModels as any) : (CENTRAL_CATALOG[pId] || []);
  }

  // STRICT PROVIDER ISOLATION:
  // Candidate pool MUST ONLY contain models belonging to THIS provider.
  // Never merge models from any other providers.
  const seenIds = new Set<string>();
  const candidatePool: ModelInfo[] = [];

  for (const m of discoveredModels) {
    if (!m || !m.id) continue;
    const modelIdClean = m.id.trim();
    if (seenIds.has(modelIdClean)) continue;

    // Reject models explicitly tagged with another provider
    if (m.provider) {
      const modelProv = canonicalProviderId(m.provider);
      if (modelProv && modelProv !== pId && pId !== "custom" && pId !== "openrouter") {
        continue;
      }
    }

    // Direct provider anti-contamination checks:
    const idLower = modelIdClean.toLowerCase();
    if (pId === "gemini") {
      if (idLower.startsWith("gpt-") || idLower.startsWith("o1-") || idLower.startsWith("o3-") || idLower.startsWith("claude-") || idLower.startsWith("llama-") || idLower.startsWith("mistral-")) {
        continue;
      }
    } else if (pId === "openai") {
      if (idLower.startsWith("gemini-") || idLower.startsWith("claude-") || idLower.startsWith("llama-") || idLower.startsWith("mistral-")) {
        continue;
      }
    } else if (pId === "claude") {
      if (idLower.startsWith("gemini-") || idLower.startsWith("gpt-") || idLower.startsWith("o1-") || idLower.startsWith("o3-") || idLower.startsWith("llama-") || idLower.startsWith("mistral-")) {
        continue;
      }
    } else if (pId === "groq") {
      if (idLower.startsWith("gemini-") || idLower.startsWith("claude-")) {
        continue;
      }
    } else if (pId === "mistral") {
      if (idLower.startsWith("gemini-") || idLower.startsWith("gpt-") || idLower.startsWith("claude-")) {
        continue;
      }
    } else if (pId === "cohere") {
      if (idLower.startsWith("gemini-") || idLower.startsWith("gpt-") || idLower.startsWith("claude-")) {
        continue;
      }
    }

    seenIds.add(modelIdClean);
    candidatePool.push({
      ...m,
      id: modelIdClean,
      provider: pId,
    });
  }

  const total = candidatePool.length;

  if (total === 0) {
    const err = `No models discovered for provider ${pId}.`;
    onProgress?.({
      providerId: pId,
      stage: "error",
      totalModels: 0,
      testedCount: 0,
      readyCount: 0,
      notReadyCount: 0,
      progressPercent: 0,
      errorMessage: err,
    });
    return {
      providerId: pId,
      testedAt: Date.now(),
      apiKeyMasked: maskedKey,
      readyModels: [],
      notReadyModels: [],
      totalTested: 0,
      status: "error",
      errorMessage: err,
    };
  }

  // 4. Test Each Model Individually (STRICTLY for this provider)
  const readyModels: TestedModelItem[] = [];
  const notReadyModels: TestedModelItem[] = [];

  for (let i = 0; i < total; i++) {
    if (options?.signal?.aborted) {
      return createCancelledReport(pId, maskedKey, readyModels, notReadyModels);
    }

    const model = candidatePool[i];
    const currentName = model.name || model.id;

    onProgress?.({
      providerId: pId,
      stage: "testing_models",
      totalModels: total,
      testedCount: i,
      readyCount: readyModels.length,
      notReadyCount: notReadyModels.length,
      currentModelId: model.id,
      currentModelName: currentName,
      progressPercent: Math.round(15 + ((i) / total) * 80),
    });

    try {
      const testRes = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: pId,
          apiKey: cleanKey,
          modelId: model.id,
          customEndpoint: options?.customEndpoint,
          accountId: options?.accountId,
          timeoutMs: options?.timeoutMs || 15000,
        }),
        signal: options?.signal,
      });

      const result: TestResult = await testRes.json();

      if (result.success) {
        readyModels.push({
          id: model.id,
          name: currentName,
          provider: pId,
          isReady: true,
          status: "ready",
          reason: "Ready for Deployment (Verified responsive)",
          latencyMs: result.latencyMs,
          capabilities: model.capabilities || ["text", "math"],
          freeTier: model.freeTier || (model.free ? "Free tier" : undefined),
          contextWindow: model.contextWindow,
          isFree: model.free !== false && model.isFree !== false,
          testedAt: Date.now(),
        });
      } else {
        const failure = categorizeFailure(result, model.id);
        notReadyModels.push({
          id: model.id,
          name: currentName,
          provider: pId,
          isReady: false,
          status: "not_ready",
          reason: failure.reason,
          failureCategory: failure.category,
          latencyMs: result.latencyMs,
          capabilities: model.capabilities || ["text", "math"],
          freeTier: model.freeTier,
          contextWindow: model.contextWindow,
          isFree: model.free !== false && model.isFree !== false,
          testedAt: Date.now(),
        });
      }
    } catch (err: any) {
      if (options?.signal?.aborted) {
        return createCancelledReport(pId, maskedKey, readyModels, notReadyModels);
      }
      notReadyModels.push({
        id: model.id,
        name: currentName,
        provider: pId,
        isReady: false,
        status: "not_ready",
        reason: err.name === "AbortError" ? "Test timed out" : err.message || "Diagnostic failed",
        failureCategory: "timeout",
        capabilities: model.capabilities || ["text", "math"],
        freeTier: model.freeTier,
        contextWindow: model.contextWindow,
        isFree: model.free !== false && model.isFree !== false,
        testedAt: Date.now(),
      });
    }

    // Update progress after each tested model
    onProgress?.({
      providerId: pId,
      stage: "testing_models",
      totalModels: total,
      testedCount: i + 1,
      readyCount: readyModels.length,
      notReadyCount: notReadyModels.length,
      currentModelId: model.id,
      currentModelName: currentName,
      progressPercent: Math.round(15 + ((i + 1) / total) * 80),
    });
  }

  // 5. Finalize Report
  const finalReport: ProviderModelTestReport = {
    providerId: pId,
    testedAt: Date.now(),
    apiKeyMasked: maskedKey,
    readyModels,
    notReadyModels,
    totalTested: total,
    status: "completed",
  };

  saveModelTestReport(finalReport);

  onProgress?.({
    providerId: pId,
    stage: "completed",
    totalModels: total,
    testedCount: total,
    readyCount: readyModels.length,
    notReadyCount: notReadyModels.length,
    progressPercent: 100,
  });

  return finalReport;
}

function createCancelledReport(
  providerId: string,
  apiKeyMasked: string,
  readyModels: TestedModelItem[] = [],
  notReadyModels: TestedModelItem[] = []
): ProviderModelTestReport {
  return {
    providerId,
    testedAt: Date.now(),
    apiKeyMasked,
    readyModels,
    notReadyModels,
    totalTested: readyModels.length + notReadyModels.length,
    status: "cancelled",
    errorMessage: "Model testing was cancelled by the user.",
  };
}
