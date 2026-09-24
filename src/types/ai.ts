export type AIErrorCode =
  | "INVALID_API_KEY"
  | "MODEL_UNAVAILABLE"
  | "RATE_LIMIT"
  | "QUOTA_EXCEEDED"
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "SERVER_ERROR"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "UNKNOWN_ERROR";

export type AIErrorKind =
  | "invalid_key"          // HTTP 401
  | "permission_denied"    // HTTP 403
  | "rate_limit"           // HTTP 429 / Quota exceeded
  | "timeout"              // HTTP 408 / Timeout
  | "server_error"         // HTTP 500, 502, 503
  | "token_limit"          // Context / token limit exceeded
  | "model_unavailable"    // Model not found or deprecated
  | "network_error"        // Network disconnect or DNS failure
  | "unsupported_capability" // Model lacks required capabilities
  | "unknown";

export type ModelStatus = "active" | "preview" | "deprecated" | "retired" | "unavailable";

export interface ModelInfo {
  id: string;
  name: string;
  provider?: string;
  status?: ModelStatus;
  free?: boolean;
  isFree: boolean;
  apiAvailable?: boolean;
  deprecated?: boolean;
  retired?: boolean;
  freeTier?: string;
  contextWindow: number;
  capabilities: string[];
  description?: string;
}

export interface UserApiKeyItem {
  id: string;
  name: string;
  key: string; // Raw API key stored strictly in local browser storage
  maskedKey: string; // Masked key for UI display e.g. "AIza************cOA8"
  enabled: boolean; // ON / OFF toggle
  status?: "active" | "rate_limited" | "invalid" | "disabled" | "model_unavailable";
  lastTestedAt?: number;
  lastTestLatencyMs?: number;
  lastTestedModel?: string;
  lastErrorCode?: AIErrorCode;
  lastError?: string;
  cooldownUntil?: number;
}

export interface UserProviderConfig {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  apiKeys: UserApiKeyItem[];
  selectedModel: string;
  selectedKeyId?: string;
  availableModels: ModelInfo[];
  maxRetries?: number;
  timeoutMs?: number;
  customEndpoint?: string;
  accountId?: string;
  billingMode?: "free_only" | "free_and_paid" | "disabled";
  freeTier?: {
    enabled: boolean;
    limits?: {
      requestsPerMinute?: number;
      requestsPerDay?: number;
      tokensPerMinute?: number;
    };
    notes?: string;
  };
  notes?: string;
  status: "active" | "degraded" | "rate_limited" | "invalid_key" | "offline";
  lastError?: string;
}

export interface UserPreferences {
  docTitle: string;
  fontFamily: string;
  accentColor: string;
  equationFormat: "native" | "latex" | "unicode";
  formatMode: "auto" | "study_guide" | "exam_bank";
  viewLayout: "split" | "editor" | "preview";
  customPrompt?: string;
}

export interface ClientApiKeyItem {
  id: string;
  name: string;
  maskedKey: string;
  enabled: boolean;
  envVarName?: string;
  status?: "active" | "rate_limited" | "invalid" | "disabled" | "model_unavailable";
  lastTestedAt?: number;
  lastTestLatencyMs?: number;
  lastTestedModel?: string;
  lastErrorCode?: string;
  lastError?: string;
}

export interface ClientProviderConfig {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  apiKeys: ClientApiKeyItem[];
  keyCount: number;
  activeKeyCount: number;
  selectedModel: string;
  selectedKeyId?: string;
  availableModels: ModelInfo[];
  maxRetries?: number;
  timeoutMs?: number;
  customEndpoint?: string;
  accountId?: string;
  billingMode?: "free_only" | "free_and_paid" | "disabled";
  freeTier?: {
    enabled: boolean;
    limits?: {
      requestsPerMinute?: number;
      requestsPerDay?: number;
      tokensPerMinute?: number;
    };
    notes?: string;
  };
  notes?: string;
  status: "active" | "degraded" | "rate_limited" | "invalid_key" | "offline";
  lastError?: string;
}

export interface ManagerConfig {
  mode: "automatic" | "manual";
  activeProviderId: string;
  activeModel: string;
  activeKeyId?: string;
  enableFallback: boolean;
  freeOnlyMode: boolean;
  billingMode: "free_only" | "free_and_paid";
  enableModelFallback: boolean;
  defaultTimeoutMs: number;
}

export interface ProviderStats {
  providerId: string;
  providerName: string;
  requestCount: number;
  successCount: number;
  failureCount: number;
  rateLimitCount: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  averageLatencyMs: number;
  lastSuccessAt?: number;
  lastErrorAt?: number;
  lastErrorMessage?: string;
}

export interface FallbackStep {
  providerId: string;
  providerName: string;
  keyMasked: string;
  keyName?: string;
  model: string;
  status:
    | "success"
    | "rate_limited"
    | "invalid_key"
    | "permission_denied"
    | "timeout"
    | "server_error"
    | "token_limit"
    | "skipped_paid"
    | "network_error"
    | "capability_mismatch";
  errorMessage?: string;
  latencyMs: number;
  timestamp: number;
}

export interface FallbackLogEntry {
  id: string;
  timestamp: number;
  requestSummary: string;
  finalProvider: string;
  finalModel: string;
  hopsCount: number;
  totalLatencyMs: number;
  success: boolean;
  chain: FallbackStep[];
  isSimulation?: boolean;
}

export type AIStatusType =
  | "ai_working"
  | "local_format"
  | "ai_fallback"
  | "warning"
  | "ai_failed"
  | "api_error"
  | "quota"
  | "ai_off"
  | "simulation";

export interface AIStatusNotification {
  type: AIStatusType;
  badgeLabel: string;
  badgeIcon: string;
  badgeColor: "emerald" | "amber" | "rose" | "slate" | "blue";
  title: string;
  secondaryText: string;
  primaryProvider?: string;
  fallbackProvider?: string;
  providerName?: string;
  modelName?: string;
  latencyMs?: number;
  timestamp: number;
  actionType?: "settings" | "retry" | "another_provider" | "audit";
  actionLabel?: string;
  secondaryActionLabel?: string;
  technicalDetails?: {
    provider?: string;
    model?: string;
    requestStatus?: string;
    errorCategory?: string;
    fallbackAttempt?: string;
    executionTime?: string;
    technicalErrorMessage?: string;
    rawChain?: FallbackStep[];
  };
}

export interface TestResult {
  success: boolean;
  providerId: string;
  providerName: string;
  model: string;
  keyId?: string;
  keyName?: string;
  maskedKey?: string;
  endpoint?: string;
  latencyMs: number;
  errorCode?: AIErrorCode;
  errorKind?: AIErrorKind;
  errorTitle?: string;
  userFacingMessage?: string;
  errorMessage?: string;
  statusCode?: number;
  diagnostic?: {
    provider: string;
    keyId: string;
    modelId: string;
    endpoint: string;
    maskedKey: string;
    result: string;
    latencyMs: number;
    rawMessage?: string;
  };
}
