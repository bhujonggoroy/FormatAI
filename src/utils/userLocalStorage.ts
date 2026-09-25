import {
  ManagerConfig,
  UserProviderConfig,
  ClientProviderConfig,
  UserPreferences,
  ProviderStats,
  FallbackLogEntry,
  FallbackStep,
  ModelInfo,
  UserApiKeyItem,
  AIErrorCode,
} from "../types/ai";
import {
  CENTRAL_CATALOG,
  DEPRECATED_OR_RETIRED_MODELS,
  getActiveReplacementModel,
  isModelSelectable,
} from "../shared/centralModelCatalog";
import { getActiveModels } from "../config/modelRegistry";

/**
 * FormatAI — STRICT USER-SPECIFIC LOCAL ISOLATION
 *
 * User-specific application state (API keys, provider ON/OFF, models, preferences)
 * is stored strictly in the user's browser localStorage under:
 * formatai:user:<userId>:ai-settings
 *
 * Default guest/local user:
 * formatai:user:local_default:ai-settings
 */

export const STORAGE_VERSION = 2;
export const MODEL_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function getUserSettingsStorageKey(userId?: string): string {
  const cleanId = userId?.trim() || "local_default";
  return `formatai:user:${cleanId}:ai-settings`;
}

export const STORAGE_KEYS = {
  LEGACY_SETTINGS: "formatAI.settings",
  LEGACY_PROVIDERS: "formatAI.providers",
  PREFERENCES: "formatAI.preferences",
  DOCUMENTS: "formatAI.documents",
  STATS: "formatAI.stats",
  LOGS: "formatAI.logs",
} as const;

export const DEFAULT_MANAGER_CONFIG: Readonly<ManagerConfig> = Object.freeze({
  mode: "automatic",
  activeProviderId: "gemini",
  activeModel: "gemini-3.8-flash",
  enableFallback: true,
  freeOnlyMode: true,
  billingMode: "free_only",
  enableModelFallback: true,
  defaultTimeoutMs: 45000,
});

export const DEFAULT_USER_PREFERENCES: Readonly<UserPreferences> = Object.freeze({
  docTitle: "FormatAI Document",
  fontFamily: "Times New Roman",
  accentColor: "#1A365D",
  equationFormat: "native",
  formatMode: "study_guide",
  viewLayout: "editor",
  customPrompt: "",
});

export interface UserAISettingsPackage {
  version: number;
  userId: string;
  config: ManagerConfig;
  providers: UserProviderConfig[];
  modelsCache?: Record<string, { models: ModelInfo[]; cachedAt: number }>;
  lastUpdated: number;
}

/**
 * Mask raw API key for safe UI display (e.g., "AIza************cOA8").
 */
export function maskApiKey(key: string): string {
  if (!key) return "";
  const trimmed = key.trim();
  if (trimmed.length <= 8) return "********";
  return `${trimmed.slice(0, 4)}************${trimmed.slice(-4)}`;
}

function safeGetItem(key: string): string | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    return window.localStorage.getItem(key);
  } catch (err) {
    console.warn(`FormatAI: Unable to read localStorage key '${key}':`, err);
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, value);
  } catch (err) {
    console.warn(`FormatAI: Unable to write localStorage key '${key}':`, err);
  }
}

function safeRemoveItem(key: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.removeItem(key);
  } catch (err) {
    console.warn(`FormatAI: Unable to remove localStorage key '${key}':`, err);
  }
}

/**
 * Perform self-healing migration and validation on loaded provider configs.
 * - Detects stale model IDs and replaces them with active models
 * - Ensures all keys have standard fields (id, name, maskedKey, enabled, status)
 * - Removes obsolete deprecated model selections
 */
export function healAndNormalizeProviders(
  providers: UserProviderConfig[],
  templates?: ClientProviderConfig[]
): UserProviderConfig[] {
  const templateMap = new Map((templates || []).map((t) => [t.id, t]));

  return providers.map((provider) => {
    const tmpl = templateMap.get(provider.id);
    const catalogModels = CENTRAL_CATALOG[provider.id.toLowerCase()];
    const activeRegistryModels = getActiveModels(provider.id);

    // Sanitize available models: prioritize active free models from getActiveModels
    let available: ModelInfo[] = [];
    if (activeRegistryModels && activeRegistryModels.length > 0) {
      available = activeRegistryModels.map((m) => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
        status: m.status,
        free: m.free,
        isFree: m.isFree,
        apiAvailable: m.apiAvailable,
        deprecated: false,
        retired: false,
        freeTier: m.freeTier,
        contextWindow: m.contextWindow,
        capabilities: m.capabilities as string[],
        description: m.description,
      }));
    } else if (provider.availableModels && provider.availableModels.length > 0) {
      available = provider.availableModels.filter(
        (m) => !DEPRECATED_OR_RETIRED_MODELS[m.id] && !m.deprecated && !m.retired
      );
    } else {
      available = tmpl?.availableModels || catalogModels || [];
    }

    if (available.length === 0 && catalogModels && catalogModels.length > 0) {
      available = catalogModels;
    }

    // 1. Stale model repair:
    let selectedModel = provider.selectedModel;
    if (DEPRECATED_OR_RETIRED_MODELS[selectedModel]) {
      selectedModel = getActiveReplacementModel(provider.id, selectedModel);
    }

    // Check if selectedModel is valid in available list (except for custom provider)
    if (available.length > 0 && provider.id !== "custom") {
      const exists = available.some((m) => m.id === selectedModel);
      if (!exists) {
        const firstActive = available.find(isModelSelectable) || available[0];
        selectedModel = firstActive.id;
      }
    }

    // 2. Normalize API keys:
    const apiKeys: UserApiKeyItem[] = (provider.apiKeys || []).map((keyItem, idx) => ({
      id: keyItem.id || `key-${idx + 1}`,
      name: keyItem.name || `API Key ${idx + 1}`,
      key: keyItem.key || "",
      maskedKey: keyItem.maskedKey || maskApiKey(keyItem.key),
      enabled: typeof keyItem.enabled === "boolean" ? keyItem.enabled : true,
      status: keyItem.status || "active",
      lastTestedAt: keyItem.lastTestedAt,
      lastTestLatencyMs: keyItem.lastTestLatencyMs,
      lastTestedModel: keyItem.lastTestedModel,
      lastErrorCode: keyItem.lastErrorCode,
      lastError: keyItem.lastError,
      cooldownUntil: keyItem.cooldownUntil,
    }));

    // 3. Ensure unconfigured providers without keys are not accidentally enabled by stale legacy defaults
    let isEnabled = provider.enabled;
    if (provider.id === "cloudflare") {
      const hasCloudflareCredentials = apiKeys.some((k) => k.enabled && k.key && k.key.trim().length > 0);
      if (!hasCloudflareCredentials) {
        isEnabled = false;
      }
    }

    return {
      ...provider,
      enabled: isEnabled,
      selectedModel,
      availableModels: available,
      apiKeys,
    };
  });
}

/**
 * Load complete UserAISettingsPackage with self-healing migration.
 */
export function loadUserAISettingsPackage(
  userId = "local_default",
  templates?: ClientProviderConfig[]
): UserAISettingsPackage {
  const storageKey = getUserSettingsStorageKey(userId);
  const raw = safeGetItem(storageKey);

  if (raw) {
    try {
      const parsed: UserAISettingsPackage = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.providers)) {
        // Self-heal loaded settings
        const healedProviders = healAndNormalizeProviders(parsed.providers, templates);
        const healedConfig = { ...DEFAULT_MANAGER_CONFIG, ...(parsed.config || {}) };
        if (DEPRECATED_OR_RETIRED_MODELS[healedConfig.activeModel]) {
          healedConfig.activeModel = getActiveReplacementModel(
            healedConfig.activeProviderId || "gemini",
            healedConfig.activeModel
          );
        }

        const healedPkg: UserAISettingsPackage = {
          version: STORAGE_VERSION,
          userId,
          config: healedConfig,
          providers: healedProviders,
          modelsCache: parsed.modelsCache || {},
          lastUpdated: Date.now(),
        };
        safeSetItem(storageKey, JSON.stringify(healedPkg));
        return healedPkg;
      }
    } catch (e) {
      console.warn("FormatAI: Failed parsing user settings package, checking legacy backups:", e);
    }
  }

  // --- SELF-HEALING MIGRATION FROM LEGACY STORAGE FORMATS ---
  let legacyProviders: UserProviderConfig[] = [];
  let legacyConfig: ManagerConfig = { ...DEFAULT_MANAGER_CONFIG };

  // Check legacy formatAI.providers
  const rawLegacyProviders = safeGetItem(STORAGE_KEYS.LEGACY_PROVIDERS);
  if (rawLegacyProviders) {
    try {
      legacyProviders = JSON.parse(rawLegacyProviders);
    } catch {}
  }

  // Check legacy formatAI.settings
  const rawLegacySettings = safeGetItem(STORAGE_KEYS.LEGACY_SETTINGS);
  if (rawLegacySettings) {
    try {
      legacyConfig = { ...legacyConfig, ...JSON.parse(rawLegacySettings) };
    } catch {}
  }

  // Check raw keys from localAISettings if available
  const rawLegacyRawKeys = safeGetItem("formatai_local_raw_api_keys_v1");
  if (rawLegacyRawKeys) {
    try {
      const parsedRawKeys: Array<{ providerId: string; rawKey: string; name?: string; enabled?: boolean; id?: string }> = JSON.parse(rawLegacyRawKeys);
      if (Array.isArray(parsedRawKeys)) {
        for (const item of parsedRawKeys) {
          let p = legacyProviders.find((lp) => lp.id === item.providerId);
          if (!p) {
            p = {
              id: item.providerId,
              name: item.providerId,
              enabled: true,
              priority: 99,
              apiKeys: [],
              selectedModel: "default",
              availableModels: [],
              maxRetries: 2,
              timeoutMs: 45000,
              billingMode: "free_only",
              status: "active",
            };
            legacyProviders.push(p);
          }
          if (!p.apiKeys) p.apiKeys = [];
          if (!p.apiKeys.some((k) => k.key === item.rawKey)) {
            p.apiKeys.push({
              id: item.id || `key-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: item.name || `Key ${p.apiKeys.length + 1}`,
              key: item.rawKey,
              maskedKey: maskApiKey(item.rawKey),
              enabled: item.enabled ?? true,
              status: "active",
            });
          }
        }
      }
    } catch {}
  }

  // Reconcile with templates if provided
  let initialProviders = legacyProviders;
  if (templates && templates.length > 0) {
    const existingMap = new Map(legacyProviders.map((p) => [p.id, p]));
    initialProviders = templates.map((tmpl) => {
      const existing = existingMap.get(tmpl.id);
      if (existing) {
        return {
          ...tmpl,
          enabled: existing.enabled,
          priority: existing.priority ?? tmpl.priority,
          selectedModel: existing.selectedModel || tmpl.selectedModel,
          selectedKeyId: existing.selectedKeyId,
          customEndpoint: existing.customEndpoint || tmpl.customEndpoint,
          accountId: existing.accountId || tmpl.accountId,
          billingMode: existing.billingMode || tmpl.billingMode,
          apiKeys: existing.apiKeys || [],
          status: existing.status || tmpl.status,
          lastError: existing.lastError,
        };
      }
      return {
        id: tmpl.id,
        name: tmpl.name,
        enabled: tmpl.enabled,
        priority: tmpl.priority,
        apiKeys: [],
        selectedModel: tmpl.selectedModel,
        availableModels: tmpl.availableModels || [],
        maxRetries: tmpl.maxRetries,
        timeoutMs: tmpl.timeoutMs,
        customEndpoint: tmpl.customEndpoint,
        accountId: tmpl.accountId,
        billingMode: tmpl.billingMode,
        freeTier: tmpl.freeTier,
        notes: tmpl.notes,
        status: tmpl.status || "active",
      };
    });
  }

  const healed = healAndNormalizeProviders(initialProviders, templates);
  const newPkg: UserAISettingsPackage = {
    version: STORAGE_VERSION,
    userId,
    config: legacyConfig,
    providers: healed,
    modelsCache: {},
    lastUpdated: Date.now(),
  };

  safeSetItem(storageKey, JSON.stringify(newPkg));
  return newPkg;
}

/**
 * Save complete UserAISettingsPackage.
 */
export function saveUserAISettingsPackage(pkg: UserAISettingsPackage): void {
  const storageKey = getUserSettingsStorageKey(pkg.userId);
  pkg.lastUpdated = Date.now();
  safeSetItem(storageKey, JSON.stringify(pkg));

  // Mirror to legacy keys for seamless backward compatibility
  safeSetItem(STORAGE_KEYS.LEGACY_SETTINGS, JSON.stringify(pkg.config));
  safeSetItem(STORAGE_KEYS.LEGACY_PROVIDERS, JSON.stringify(pkg.providers));
}

/**
 * Load user-specific AI Manager configuration.
 */
export function getUserSettings(userId = "local_default"): ManagerConfig {
  const pkg = loadUserAISettingsPackage(userId);
  return pkg.config;
}

/**
 * Save user-specific AI Manager configuration.
 */
export function saveUserSettings(config: ManagerConfig, userId = "local_default"): void {
  const pkg = loadUserAISettingsPackage(userId);
  pkg.config = { ...pkg.config, ...config };
  saveUserAISettingsPackage(pkg);
}

/**
 * Load user-specific providers and API keys.
 */
export function getUserProviders(
  metadataTemplates?: ClientProviderConfig[],
  userId = "local_default"
): UserProviderConfig[] {
  const pkg = loadUserAISettingsPackage(userId, metadataTemplates);
  return pkg.providers;
}

/**
 * Save user-specific providers and keys.
 */
export function saveUserProviders(
  providers: UserProviderConfig[],
  userId = "local_default"
): void {
  const pkg = loadUserAISettingsPackage(userId);
  pkg.providers = healAndNormalizeProviders(providers);
  saveUserAISettingsPackage(pkg);
}

/**
 * Update ONLY a specific key's status, leaving all other keys and providers untouched.
 */
export function updateProviderKeyStatus(
  providerId: string,
  keyId: string,
  updates: Partial<UserApiKeyItem>,
  userId = "local_default"
): UserProviderConfig[] {
  const pkg = loadUserAISettingsPackage(userId);
  const provider = pkg.providers.find((p) => p.id === providerId);
  if (!provider) return pkg.providers;

  const keyItem = (provider.apiKeys || []).find((k) => k.id === keyId);
  if (keyItem) {
    Object.assign(keyItem, updates);
  }

  saveUserAISettingsPackage(pkg);
  return pkg.providers;
}

/**
 * Model Cache Management (24 hour TTL)
 */
export function getCachedProviderModels(
  providerId: string,
  userId = "local_default"
): ModelInfo[] | null {
  const pkg = loadUserAISettingsPackage(userId);
  const entry = pkg.modelsCache?.[providerId];
  if (!entry) return null;

  if (Date.now() - entry.cachedAt > MODEL_CACHE_TTL_MS) {
    return null; // Expired
  }
  return entry.models;
}

export function setCachedProviderModels(
  providerId: string,
  models: ModelInfo[],
  userId = "local_default"
): void {
  const pkg = loadUserAISettingsPackage(userId);
  if (!pkg.modelsCache) pkg.modelsCache = {};
  pkg.modelsCache[providerId] = {
    models,
    cachedAt: Date.now(),
  };

  // Also update provider's availableModels in providers array
  const provider = pkg.providers.find((p) => p.id === providerId);
  if (provider) {
    provider.availableModels = models;
    // If selected model is not in new list, pick the first one
    if (models.length > 0 && !models.some((m) => m.id === provider.selectedModel)) {
      provider.selectedModel = models[0].id;
    }
  }

  saveUserAISettingsPackage(pkg);
}

export function invalidateProviderModelCache(
  providerId: string,
  userId = "local_default"
): void {
  const pkg = loadUserAISettingsPackage(userId);
  if (pkg.modelsCache && pkg.modelsCache[providerId]) {
    delete pkg.modelsCache[providerId];
    saveUserAISettingsPackage(pkg);
  }
}

/**
 * Convert user provider configs into sanitized client configs for UI.
 */
export function toClientProviders(
  providers: UserProviderConfig[]
): ClientProviderConfig[] {
  return providers.map((p) => ({
    id: p.id,
    name: p.name,
    enabled: p.enabled,
    priority: p.priority,
    selectedModel: p.selectedModel,
    selectedKeyId: p.selectedKeyId,
    availableModels: p.availableModels || [],
    maxRetries: p.maxRetries,
    timeoutMs: p.timeoutMs,
    customEndpoint: p.customEndpoint,
    accountId: p.accountId,
    billingMode: p.billingMode,
    freeTier: p.freeTier,
    notes: p.notes,
    status: p.status,
    lastError: p.lastError,
    keyCount: (p.apiKeys || []).length,
    activeKeyCount: (p.apiKeys || []).filter((k) => k.enabled).length,
    apiKeys: (p.apiKeys || []).map((k) => ({
      id: k.id,
      name: k.name,
      maskedKey: k.maskedKey || maskApiKey(k.key),
      enabled: k.enabled,
      status: k.status,
      lastTestedAt: k.lastTestedAt,
      lastTestLatencyMs: k.lastTestLatencyMs,
      lastTestedModel: k.lastTestedModel,
      lastErrorCode: k.lastErrorCode,
      lastError: k.lastError,
    })),
  }));
}

/**
 * Load user formatting preferences.
 */
export function getUserPreferences(): UserPreferences {
  const raw = safeGetItem(STORAGE_KEYS.PREFERENCES);
  if (!raw) {
    return structuredClone(DEFAULT_USER_PREFERENCES) as UserPreferences;
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULT_USER_PREFERENCES),
      ...parsed,
    };
  } catch {
    return structuredClone(DEFAULT_USER_PREFERENCES) as UserPreferences;
  }
}

/**
 * Save user formatting preferences.
 */
export function saveUserPreferences(prefs: Partial<UserPreferences>): void {
  const current = getUserPreferences();
  const updated = { ...current, ...prefs };
  safeSetItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(updated));
}

/**
 * Load user document state.
 */
export function getUserDocuments(): { inputText: string; cleanedMarkdown: string | null } {
  const raw = safeGetItem(STORAGE_KEYS.DOCUMENTS);
  if (!raw) {
    return { inputText: "", cleanedMarkdown: null };
  }
  try {
    return JSON.parse(raw);
  } catch {
    return { inputText: "", cleanedMarkdown: null };
  }
}

/**
 * Save user document state.
 */
export function saveUserDocuments(doc: { inputText: string; cleanedMarkdown: string | null }): void {
  safeSetItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(doc));
}

/**
 * Telemetry and Stats
 */
export const DEFAULT_PROVIDER_STATS: ProviderStats[] = [
  {
    providerId: "formatai",
    providerName: "FormatAI (Deterministic Engine)",
    requestCount: 1,
    successCount: 1,
    failureCount: 0,
    rateLimitCount: 0,
    estimatedInputTokens: 320,
    estimatedOutputTokens: 320,
    averageLatencyMs: 14,
    lastSuccessAt: Date.now() - 60000,
  },
  {
    providerId: "gemini",
    providerName: "Google Gemini",
    requestCount: 0,
    successCount: 0,
    failureCount: 0,
    rateLimitCount: 0,
    estimatedInputTokens: 0,
    estimatedOutputTokens: 0,
    averageLatencyMs: 0,
  },
  {
    providerId: "groq",
    providerName: "Groq LPU (Ultra-Fast)",
    requestCount: 0,
    successCount: 0,
    failureCount: 0,
    rateLimitCount: 0,
    estimatedInputTokens: 0,
    estimatedOutputTokens: 0,
    averageLatencyMs: 0,
  },
  {
    providerId: "openrouter",
    providerName: "OpenRouter (Free Aggregator)",
    requestCount: 0,
    successCount: 0,
    failureCount: 0,
    rateLimitCount: 0,
    estimatedInputTokens: 0,
    estimatedOutputTokens: 0,
    averageLatencyMs: 0,
  },
  {
    providerId: "mistral",
    providerName: "Mistral AI",
    requestCount: 0,
    successCount: 0,
    failureCount: 0,
    rateLimitCount: 0,
    estimatedInputTokens: 0,
    estimatedOutputTokens: 0,
    averageLatencyMs: 0,
  },
  {
    providerId: "huggingface",
    providerName: "Hugging Face Inference",
    requestCount: 0,
    successCount: 0,
    failureCount: 0,
    rateLimitCount: 0,
    estimatedInputTokens: 0,
    estimatedOutputTokens: 0,
    averageLatencyMs: 0,
  },
  {
    providerId: "cohere",
    providerName: "Cohere",
    requestCount: 0,
    successCount: 0,
    failureCount: 0,
    rateLimitCount: 0,
    estimatedInputTokens: 0,
    estimatedOutputTokens: 0,
    averageLatencyMs: 0,
  },
  {
    providerId: "cloudflare",
    providerName: "Cloudflare Workers AI",
    requestCount: 0,
    successCount: 0,
    failureCount: 0,
    rateLimitCount: 0,
    estimatedInputTokens: 0,
    estimatedOutputTokens: 0,
    averageLatencyMs: 0,
  },
  {
    providerId: "custom",
    providerName: "Custom / Self-Hosted",
    requestCount: 0,
    successCount: 0,
    failureCount: 0,
    rateLimitCount: 0,
    estimatedInputTokens: 0,
    estimatedOutputTokens: 0,
    averageLatencyMs: 0,
  },
];

export function getUserStats(): ProviderStats[] {
  const raw = safeGetItem(STORAGE_KEYS.STATS);
  if (!raw) return DEFAULT_PROVIDER_STATS;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_PROVIDER_STATS;
  } catch {
    return DEFAULT_PROVIDER_STATS;
  }
}

export function saveUserStats(stats: ProviderStats[]): void {
  safeSetItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
}

export function recordProviderMetric(
  providerId: string,
  arg2: boolean | string,
  arg3?: number | boolean,
  arg4?: number,
  arg5?: number | boolean,
  arg6?: string | number,
  arg7?: number,
  arg8?: string
): void {
  let success: boolean;
  let latencyMs: number;
  let inTokens = 0;
  let outTokens = 0;
  let errorMsg: string | undefined;

  if (typeof arg2 === "string") {
    // Signature: (providerId, providerName, success, latencyMs, isFallback, inTokens, outTokens, errorMsg)
    success = Boolean(arg3);
    latencyMs = typeof arg4 === "number" ? arg4 : 0;
    inTokens = typeof arg6 === "number" ? arg6 : 0;
    outTokens = typeof arg7 === "number" ? arg7 : 0;
    errorMsg = arg8;
  } else {
    // Signature: (providerId, success, latencyMs, inTokens, outTokens, errorMsg)
    success = Boolean(arg2);
    latencyMs = typeof arg3 === "number" ? arg3 : 0;
    inTokens = typeof arg4 === "number" ? arg4 : 0;
    outTokens = typeof arg5 === "number" ? arg5 : 0;
    errorMsg = typeof arg6 === "string" ? arg6 : undefined;
  }

  const stats = getUserStats();
  const existing = stats.find((s) => s.providerId === providerId);
  const now = Date.now();

  if (existing) {
    existing.requestCount += 1;
    if (success) {
      existing.successCount += 1;
      existing.lastSuccessAt = now;
      existing.averageLatencyMs = Math.round(
        (existing.averageLatencyMs * (existing.successCount - 1) + latencyMs) / existing.successCount
      );
    } else {
      existing.failureCount += 1;
      existing.lastErrorAt = now;
      existing.lastErrorMessage = errorMsg;
      if (errorMsg?.toLowerCase().includes("rate limit") || errorMsg?.includes("429")) {
        existing.rateLimitCount += 1;
      }
    }
    existing.estimatedInputTokens += inTokens;
    existing.estimatedOutputTokens += outTokens;
  }
  saveUserStats(stats);
}

export function getUserLogs(): FallbackLogEntry[] {
  const raw = safeGetItem(STORAGE_KEYS.LOGS);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveUserLogs(logs: FallbackLogEntry[]): void {
  safeSetItem(STORAGE_KEYS.LOGS, JSON.stringify(logs.slice(0, 50)));
}

export function clearUserLogs(): void {
  safeRemoveItem(STORAGE_KEYS.LOGS);
}

export function recordAuditLogEntry(entry: Omit<FallbackLogEntry, "id" | "timestamp">): void {
  const logs = getUserLogs();
  const newEntry: FallbackLogEntry = {
    ...entry,
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
  };
  logs.unshift(newEntry);
  saveUserLogs(logs);
}

export function resetAllUserData(userId = "local_default"): void {
  safeRemoveItem(getUserSettingsStorageKey(userId));
  safeRemoveItem(STORAGE_KEYS.LEGACY_SETTINGS);
  safeRemoveItem(STORAGE_KEYS.LEGACY_PROVIDERS);
  safeRemoveItem(STORAGE_KEYS.PREFERENCES);
  safeRemoveItem(STORAGE_KEYS.DOCUMENTS);
  safeRemoveItem(STORAGE_KEYS.STATS);
  safeRemoveItem(STORAGE_KEYS.LOGS);
}
