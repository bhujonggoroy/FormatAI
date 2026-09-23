import {
  ManagerConfig,
  UserProviderConfig,
  ClientProviderConfig,
  UserPreferences,
  ProviderStats,
  FallbackLogEntry,
  FallbackStep,
  ModelInfo,
} from "../types/ai";

/**
 * FormatAI — STRICT USER-SPECIFIC LOCAL ISOLATION
 *
 * User-specific application state (API keys, provider ON/OFF, models, preferences)
 * is stored strictly on the client in the current browser/profile environment (localStorage).
 *
 * The server never maintains global user state or persists user keys.
 */

export const STORAGE_KEYS = {
  SETTINGS: "formatAI.settings",
  PROVIDERS: "formatAI.providers",
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
 * Load user-specific AI Manager configuration.
 * Returns clean isolated copy of defaults if not present.
 */
export function getUserSettings(): ManagerConfig {
  const raw = safeGetItem(STORAGE_KEYS.SETTINGS);
  if (!raw) {
    return structuredClone(DEFAULT_MANAGER_CONFIG) as ManagerConfig;
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULT_MANAGER_CONFIG),
      ...parsed,
    };
  } catch {
    return structuredClone(DEFAULT_MANAGER_CONFIG) as ManagerConfig;
  }
}

/**
 * Save user-specific AI Manager configuration to current browser environment.
 */
export function saveUserSettings(config: ManagerConfig): void {
  safeSetItem(STORAGE_KEYS.SETTINGS, JSON.stringify(config));
}

/**
 * Load user-specific providers and API keys.
 * If not present in current browser, initializes from provided metadata templates or defaults.
 */
export function getUserProviders(
  metadataTemplates?: ClientProviderConfig[]
): UserProviderConfig[] {
  const raw = safeGetItem(STORAGE_KEYS.PROVIDERS);
  let storedProviders: UserProviderConfig[] = [];

  if (raw) {
    try {
      storedProviders = JSON.parse(raw);
    } catch (err) {
      console.warn("FormatAI: Failed to parse stored providers:", err);
      storedProviders = [];
    }
  }

  // If already stored and no new templates, return as is
  if (storedProviders.length > 0 && !metadataTemplates) {
    return storedProviders;
  }

  // If we have templates from server (static metadata), reconcile them:
  if (metadataTemplates && metadataTemplates.length > 0) {
    const storedMap = new Map(storedProviders.map((p) => [p.id, p]));

    const reconciled: UserProviderConfig[] = metadataTemplates.map((template) => {
      const existing = storedMap.get(template.id);
      if (existing) {
        return {
          ...template,
          enabled: existing.enabled,
          priority: existing.priority ?? template.priority,
          selectedModel: existing.selectedModel || template.selectedModel,
          selectedKeyId: existing.selectedKeyId,
          customEndpoint: existing.customEndpoint || template.customEndpoint,
          accountId: existing.accountId || template.accountId,
          billingMode: existing.billingMode || template.billingMode,
          apiKeys: existing.apiKeys || [],
          status: existing.status || template.status,
          lastError: existing.lastError,
        };
      } else {
        // Fresh provider for this user
        return {
          id: template.id,
          name: template.name,
          enabled: template.enabled,
          priority: template.priority,
          apiKeys: [],
          selectedModel: template.selectedModel,
          availableModels: template.availableModels || [],
          maxRetries: template.maxRetries,
          timeoutMs: template.timeoutMs,
          customEndpoint: template.customEndpoint,
          accountId: template.accountId,
          billingMode: template.billingMode,
          freeTier: template.freeTier,
          notes: template.notes,
          status: template.status || "active",
        };
      }
    });

    // Save reconciled providers back to local storage
    safeSetItem(STORAGE_KEYS.PROVIDERS, JSON.stringify(reconciled));
    return reconciled;
  }

  return storedProviders;
}

/**
 * Save user-specific providers and keys to current browser environment.
 */
export function saveUserProviders(providers: UserProviderConfig[]): void {
  safeSetItem(STORAGE_KEYS.PROVIDERS, JSON.stringify(providers));
}

/**
 * Convert user provider configs (with raw keys) into sanitized client configs (masked keys + counts).
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
 * Load user document state (input text and cleaned markdown).
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
 * Default initialized baseline provider statistics for telemetry.
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
    providerId: "cerebras",
    providerName: "Cerebras Fast Inference",
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
    providerId: "deepseek",
    providerName: "DeepSeek",
    requestCount: 0,
    successCount: 0,
    failureCount: 0,
    rateLimitCount: 0,
    estimatedInputTokens: 0,
    estimatedOutputTokens: 0,
    averageLatencyMs: 0,
  },
];

export const DEFAULT_INITIAL_LOGS: FallbackLogEntry[] = [
  {
    id: "init-log-01",
    timestamp: Date.now() - 1000 * 60 * 5,
    requestSummary: "System Initialized: Academic Normalizer Ready",
    finalProvider: "FormatAI",
    finalModel: "standard-academic-engine",
    hopsCount: 0,
    totalLatencyMs: 14,
    success: true,
    chain: [
      {
        providerId: "formatai",
        providerName: "FormatAI Engine",
        keyMasked: "Local Deterministic",
        model: "standard-academic",
        status: "success",
        latencyMs: 14,
        timestamp: Date.now() - 1000 * 60 * 5,
      },
    ],
  },
];

/**
 * Load user-specific provider statistics.
 */
export function getUserStats(): ProviderStats[] {
  const raw = safeGetItem(STORAGE_KEYS.STATS);
  if (!raw) {
    saveUserStats(DEFAULT_PROVIDER_STATS);
    return structuredClone(DEFAULT_PROVIDER_STATS);
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      saveUserStats(DEFAULT_PROVIDER_STATS);
      return structuredClone(DEFAULT_PROVIDER_STATS);
    }
    // Ensure all 8 providers + FormatAI are represented
    const existingIds = new Set(parsed.map((p: ProviderStats) => p.providerId.toLowerCase()));
    let hasAdditions = false;
    for (const def of DEFAULT_PROVIDER_STATS) {
      if (!existingIds.has(def.providerId.toLowerCase())) {
        parsed.push({ ...def });
        hasAdditions = true;
      }
    }
    if (hasAdditions) {
      saveUserStats(parsed);
    }
    return parsed;
  } catch {
    saveUserStats(DEFAULT_PROVIDER_STATS);
    return structuredClone(DEFAULT_PROVIDER_STATS);
  }
}

/**
 * Save user-specific provider statistics.
 */
export function saveUserStats(stats: ProviderStats[]): void {
  safeSetItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
}

/**
 * Record a live metric event for a provider (requests, latency, success, rate limits, token usage).
 */
export function recordProviderMetric(
  providerId: string,
  providerName: string,
  success: boolean,
  latencyMs: number,
  isRateLimit: boolean = false,
  inputTokensEst: number = 0,
  outputTokensEst: number = 0,
  errorMessage?: string
): void {
  const stats = getUserStats();
  const normId = (providerId || "formatai").toLowerCase();
  const index = stats.findIndex((s) => s.providerId.toLowerCase() === normId);
  const now = Date.now();

  if (index >= 0) {
    const current = stats[index];
    current.requestCount = (current.requestCount || 0) + 1;
    if (success) {
      current.successCount = (current.successCount || 0) + 1;
      current.lastSuccessAt = now;
    } else {
      current.failureCount = (current.failureCount || 0) + 1;
      current.lastErrorAt = now;
      if (errorMessage) current.lastErrorMessage = errorMessage;
    }
    if (isRateLimit) {
      current.rateLimitCount = (current.rateLimitCount || 0) + 1;
    }
    current.estimatedInputTokens = (current.estimatedInputTokens || 0) + Math.max(0, inputTokensEst);
    current.estimatedOutputTokens = (current.estimatedOutputTokens || 0) + Math.max(0, outputTokensEst);

    if (latencyMs > 0) {
      const validCount = Math.max(1, current.requestCount);
      const prevAvg = current.averageLatencyMs || latencyMs;
      current.averageLatencyMs = Math.round((prevAvg * (validCount - 1) + latencyMs) / validCount);
    }
  } else {
    stats.push({
      providerId: normId,
      providerName: providerName || providerId,
      requestCount: 1,
      successCount: success ? 1 : 0,
      failureCount: success ? 0 : 1,
      rateLimitCount: isRateLimit ? 1 : 0,
      estimatedInputTokens: Math.max(0, inputTokensEst),
      estimatedOutputTokens: Math.max(0, outputTokensEst),
      averageLatencyMs: latencyMs,
      lastSuccessAt: success ? now : undefined,
      lastErrorAt: !success ? now : undefined,
      lastErrorMessage: errorMessage,
    });
  }
  saveUserStats(stats);
}

/**
 * Load user-specific fallback/execution logs.
 */
export function getUserLogs(): FallbackLogEntry[] {
  const raw = safeGetItem(STORAGE_KEYS.LOGS);
  if (!raw) {
    saveUserLogs(DEFAULT_INITIAL_LOGS);
    return structuredClone(DEFAULT_INITIAL_LOGS);
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      saveUserLogs(DEFAULT_INITIAL_LOGS);
      return structuredClone(DEFAULT_INITIAL_LOGS);
    }
    return parsed;
  } catch {
    saveUserLogs(DEFAULT_INITIAL_LOGS);
    return structuredClone(DEFAULT_INITIAL_LOGS);
  }
}

/**
 * Save logs array explicitly.
 */
export function saveUserLogs(logs: FallbackLogEntry[]): void {
  safeSetItem(STORAGE_KEYS.LOGS, JSON.stringify(logs.slice(0, 50)));
}

/**
 * Clear all audit logs.
 */
export function clearUserLogs(): void {
  saveUserLogs([]);
}

/**
 * Append an execution log entry to user-specific logs (capped at 50 entries).
 */
export function addUserLog(entry: FallbackLogEntry): void {
  const current = getUserLogs();
  const updated = [entry, ...current].slice(0, 50);
  safeSetItem(STORAGE_KEYS.LOGS, JSON.stringify(updated));
}

/**
 * Record a full structured fallback audit log entry.
 */
export function recordAuditLogEntry(entry: {
  requestSummary: string;
  finalProvider: string;
  finalModel: string;
  hopsCount?: number;
  totalLatencyMs: number;
  success: boolean;
  chain: FallbackStep[];
  isSimulation?: boolean;
}): FallbackLogEntry {
  const safeChain: FallbackStep[] = entry.chain && entry.chain.length > 0 ? entry.chain : [
    {
      providerId: (entry.finalProvider || "System").toLowerCase(),
      providerName: entry.finalProvider || "System Provider",
      keyMasked: "Client Key",
      model: entry.finalModel || "Default Model",
      status: entry.success ? "success" : "server_error",
      latencyMs: entry.totalLatencyMs || 0,
      timestamp: Date.now(),
    }
  ];

  const newLog: FallbackLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    requestSummary: entry.requestSummary || "Academic Notes Polish Execution",
    finalProvider: entry.finalProvider || "System",
    finalModel: entry.finalModel || "Default Model",
    hopsCount: entry.hopsCount !== undefined ? entry.hopsCount : Math.max(0, safeChain.length - 1),
    totalLatencyMs: entry.totalLatencyMs || 0,
    success: Boolean(entry.success),
    chain: safeChain,
    isSimulation: Boolean(entry.isSimulation || entry.requestSummary?.toLowerCase().includes("simulation")),
  };

  addUserLog(newLog);
  return newLog;
}

/**
 * Reset all user-specific data in the current browser/profile environment to clean initial defaults.
 */
export function resetAllUserData(): void {
  Object.values(STORAGE_KEYS).forEach((k) => safeRemoveItem(k));
}
