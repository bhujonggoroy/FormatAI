export type AIErrorCode =
  | "INVALID_API_KEY"
  | "MODEL_UNAVAILABLE"
  | "RATE_LIMIT"
  | "QUOTA_EXCEEDED"
  | "BILLING_REQUIRED"
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
  | "billing_required"     // HTTP 402 / Billing required
  | "timeout"              // HTTP 408 / Timeout
  | "server_error"         // HTTP 500, 502, 503
  | "token_limit"          // Context / token limit exceeded
  | "model_unavailable"    // Model not found or deprecated
  | "network_error"        // Network disconnect or DNS failure
  | "unsupported_capability" // Model lacks required capabilities (e.g., math)
  | "unknown";

export interface NormalizedAIError {
  code?: AIErrorCode;
  kind: AIErrorKind;
  statusCode?: number;
  title?: string;
  message: string;
  userFacingMessage?: string;
  retryable: boolean;
  rawError?: any;
}

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
  capabilities: string[]; // e.g. ["text", "math", "long_context", "json", "code"]
  description?: string;
}

export interface FreeTierMetadata {
  enabled: boolean;
  limits: {
    requestsPerMinute?: number;
    requestsPerDay?: number;
    tokensPerMinute?: number;
    tokensPerDay?: number;
  };
  notes?: string;
}

/**
 * Server-side representation of an individual API Key.
 * Crucial: enabled MUST be true for this key to ever be used in AI requests.
 * By default, any newly added key has enabled: false.
 */
export interface ApiKeyItem {
  id: string;                 // unique identifier, e.g. "gemini-key-1"
  name: string;               // human-readable label, e.g. "Key 1"
  key: string;                // raw API key (kept strictly on server)
  enabled: boolean;           // ON / OFF toggle for this key
  envVarName?: string;        // e.g. "GEMINI_API_KEY_1"
  status?: "active" | "rate_limited" | "invalid" | "disabled";
  lastTestedAt?: number;
  lastTestLatencyMs?: number;
  lastTestedModel?: string;
  lastErrorCode?: AIErrorCode;
  lastError?: string;
}

/**
 * Client-sanitized representation of an API Key.
 * The raw key is NEVER returned to the client; only maskedKey is displayed.
 */
export interface ClientApiKeyItem {
  id: string;
  name: string;
  maskedKey: string;          // e.g. "AIza************ZrsI"
  enabled: boolean;           // ON / OFF switch in UI
  envVarName?: string;
  status?: "active" | "rate_limited" | "invalid" | "disabled" | "model_unavailable";
  lastTestedAt?: number;
  lastTestLatencyMs?: number;
  lastTestedModel?: string;
  lastErrorCode?: AIErrorCode;
  lastError?: string;
}

export interface ProviderConfig {
  id: string;
  name: string;
  enabled: boolean;           // Provider ON / OFF
  priority: number;
  apiKeys: ApiKeyItem[];      // Multiple keys per provider, each with its own ON / OFF
  selectedModel: string;
  selectedKeyId?: string;     // Which key is chosen for manual/primary mode
  availableModels: ModelInfo[];
  maxRetries: number;
  timeoutMs: number;
  customEndpoint?: string;
  accountId?: string;         // Used by Cloudflare Workers AI
  billingMode: "free_only" | "free_and_paid" | "disabled";
  freeTier?: FreeTierMetadata;
  notes?: string;
}

export interface ClientProviderConfig {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  apiKeys: ClientApiKeyItem[];
  keyCount: number;
  activeKeyCount: number;     // Count of keys with enabled === true
  selectedModel: string;
  selectedKeyId?: string;
  availableModels: ModelInfo[];
  maxRetries: number;
  timeoutMs: number;
  customEndpoint?: string;
  accountId?: string;
  billingMode: "free_only" | "free_and_paid" | "disabled";
  freeTier?: FreeTierMetadata;
  notes?: string;
  status: "active" | "degraded" | "rate_limited" | "invalid_key" | "offline";
  lastError?: string;
}

export interface ManagerConfig {
  mode: "automatic" | "manual";
  // Active AI Configuration section
  activeProviderId: string;
  activeModel: string;
  activeKeyId?: string;
  
  enableFallback: boolean;
  freeOnlyMode: boolean;
  billingMode: "free_only" | "free_and_paid";
  enableModelFallback: boolean;
  defaultTimeoutMs: number;
}

export interface AIRequest {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: string;
  capabilities?: string[]; // e.g., ["text", "math", "long_context"]
  clientSettings?: {
    config?: Partial<ManagerConfig> | null;
    providers?: Array<{
      id: string;
      enabled?: boolean;
      priority?: number;
      selectedModel?: string;
      selectedKeyId?: string;
      customEndpoint?: string;
      accountId?: string;
      billingMode?: "free_only" | "free_and_paid" | "disabled";
    }> | null;
    keys?: Array<{
      id?: string;
      providerId: string;
      name?: string;
      key: string;
      enabled?: boolean;
    }> | null;
  };
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
    | "rate_limit"
    | "invalid_key"
    | "permission_denied"
    | "timeout"
    | "server_error"
    | "token_limit"
    | "skipped_paid"
    | "network_error"
    | "capability_mismatch"
    | "unsupported_capability"
    | "model_unavailable"
    | "unknown";
  errorMessage?: string;
  latencyMs: number;
  timestamp: number;
}

export interface AIResponse {
  text: string;
  providerId: string;
  providerName: string;
  model: string;
  keyMasked: string;
  keyName?: string;
  latencyMs: number;
  inputTokensEst?: number;
  outputTokensEst?: number;
  fallbackChain: FallbackStep[];
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

export interface ProviderStats {
  providerId: string;
  providerName: string;
  requestCount: number;
  successCount: number;
  failureCount: number;
  rateLimitCount: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  lastSuccessAt?: number;
  lastErrorAt?: number;
  lastErrorMessage?: string;
  averageLatencyMs: number;
}
