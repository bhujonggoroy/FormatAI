import {
  ManagerConfig,
  UserProviderConfig,
  ClientProviderConfig,
  UserPreferences,
  ProviderStats,
  FallbackLogEntry,
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
 * Load user-specific provider statistics.
 */
export function getUserStats(): ProviderStats[] {
  const raw = safeGetItem(STORAGE_KEYS.STATS);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Save user-specific provider statistics.
 */
export function saveUserStats(stats: ProviderStats[]): void {
  safeSetItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
}

/**
 * Load user-specific fallback/execution logs.
 */
export function getUserLogs(): FallbackLogEntry[] {
  const raw = safeGetItem(STORAGE_KEYS.LOGS);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
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
 * Reset all user-specific data in the current browser/profile environment to clean initial defaults.
 */
export function resetAllUserData(): void {
  Object.values(STORAGE_KEYS).forEach((k) => safeRemoveItem(k));
}
