import {
  maskApiKey,
  estimateTokenCount,
  type AIProviderAdapter,
  type AdapterOptions,
} from "./adapters/BaseAdapter.ts";
import { canonicalProviderId } from "../../shared/centralModelCatalog.ts";
import {
  providerRegistry,
  getProvider,
  listProviders,
} from "../../providers/index.ts";
import type {
  AIErrorCode,
  AIRequest,
  AIResponse,
  ApiKeyItem,
  ClientApiKeyItem,
  ClientProviderConfig,
  FallbackStep,
  ManagerConfig,
  ModelInfo,
  NormalizedAIError,
  ProviderConfig,
  ProviderStats,
  TestResult,
} from "./types.ts";
import { DEFAULT_MANAGER_CONFIG, getInitialProviders } from "./defaultConfig.ts";
import { assertSafeEndpoint } from "./safeUrl.ts";

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
}

/**
 * AIRequestManager
 *
 * Implements FormatAI's Authoritative Single Source of Truth Pipeline:
 * resolveProvider()
 * → resolveUserKey() (Strictly enabled === true for generation; explicit key for test)
 * → resolveModel()
 * → validateModel()
 * → buildRequest()
 * → sendRequest()
 * → classifyResponse()
 * → updateKeyStatus()
 */
export class AIRequestManager {
  private adapters: Map<string, AIProviderAdapter> = new Map();
  private templateProviders: ProviderConfig[] = [];

  constructor(_storagePath?: string) {
    this.registerAdapters();
    this.templateProviders = getInitialProviders();
  }

  private registerAdapters() {
    for (const adapter of listProviders()) {
      if (adapter.id) this.adapters.set(adapter.id, adapter);
    }
  }

  public registerCustomAdapter(adapter: AIProviderAdapter) {
    providerRegistry.register(adapter);
    if (adapter.id) this.adapters.set(adapter.id, adapter);
  }

  public getAdapter(providerId: string): AIProviderAdapter | undefined {
    const canonical = canonicalProviderId(providerId);
    return getProvider(canonical) || this.adapters.get(canonical) || this.adapters.get(providerId);
  }

  /**
   * Return static public provider metadata templates (available models, free tier limits, docs).
   */
  public getStaticProviderTemplates(): ClientProviderConfig[] {
    return this.templateProviders.map((p) => ({
      id: p.id,
      name: p.name,
      enabled: p.enabled,
      priority: p.priority,
      selectedModel: p.selectedModel,
      selectedKeyId: undefined,
      availableModels: p.availableModels || [],
      maxRetries: p.maxRetries,
      timeoutMs: p.timeoutMs,
      customEndpoint: p.customEndpoint,
      accountId: p.accountId,
      billingMode: p.billingMode,
      freeTier: p.freeTier,
      notes: p.notes,
      status: "active",
      keyCount: 0,
      activeKeyCount: 0,
      apiKeys: [],
    }));
  }

  public getClientProviders(): ClientProviderConfig[] {
    return this.getStaticProviderTemplates();
  }

  public getManagerConfig(): ManagerConfig {
    return { ...DEFAULT_MANAGER_CONFIG };
  }

  /**
   * Dynamically fetch live models from official provider catalog.
   */
  public async fetchProviderModels(
    providerId: string,
    apiKey?: string,
    customEndpoint?: string
  ): Promise<{ success: boolean; models: ModelInfo[]; error?: string }> {
    const canonical = canonicalProviderId(providerId);
    const adapter = this.adapters.get(canonical) || this.adapters.get(providerId) || getProvider(canonical);
    if (!adapter) {
      return { success: false, models: [], error: `Unknown provider '${providerId}'.` };
    }

    if (customEndpoint && customEndpoint.trim()) {
      try {
        assertSafeEndpoint(customEndpoint.trim());
      } catch (err: any) {
        return {
          success: false,
          models: this.templateProviders.find(p => p.id === canonical || p.id === providerId)?.availableModels || [],
          error: err?.message || "Invalid or prohibited custom endpoint.",
        };
      }
    }

    try {
      const rawModels = await adapter.getModels(apiKey, { customEndpoint });
      const models: ModelInfo[] = (rawModels || []).map((m: any) =>
        typeof m === "string"
          ? { id: m, name: m, contextWindow: 32000, isFree: false, capabilities: ["text", "math"] }
          : { ...m, provider: canonical }
      );
      const fallbackModels = this.templateProviders.find(p => p.id === canonical || p.id === providerId)?.availableModels || [];
      return { success: true, models: models.length > 0 ? models : fallbackModels };
    } catch (err: any) {
      const errorMessage = typeof err === "string" ? err : err?.message || "Failed to fetch models catalog";
      return {
        success: false,
        models: this.templateProviders.find(p => p.id === canonical || p.id === providerId)?.availableModels || [],
        error: errorMessage,
      };
    }
  }

  /**
   * Explicitly test a single key + model connection.
   *
   * NEVER silently uses environment keys or another key in array.
   * Strictly tests THAT exact key and THAT exact model.
   * Can test keys where enabled === false (OFF).
   */
  public async testApiConnection(
    providerId: string,
    keyId: string,
    modelId: string,
    apiKey: string,
    options?: AdapterOptions
  ): Promise<TestResult> {
    const canonical = canonicalProviderId(providerId);
    const adapter = this.adapters.get(canonical) || this.adapters.get(providerId) || getProvider(canonical);
    const providerTemplate = this.templateProviders.find((p) => p.id === canonical || p.id === providerId);
    const providerName = providerTemplate?.name || adapter?.name || providerId;
    const cleanKey = apiKey ? apiKey.trim() : "";
    const masked = maskApiKey(cleanKey);

    if (!adapter) {
      return {
        success: false,
        providerId,
        providerName,
        model: modelId || "unknown",
        keyId,
        maskedKey: masked,
        latencyMs: 0,
        errorCode: "BAD_REQUEST",
        errorTitle: "❌ Unknown Provider",
        errorMessage: `Unknown provider adapter '${providerId}'.`,
        userFacingMessage: `The provider adapter '${providerId}' is not supported.`,
      };
    }

    const effectiveModel =
      modelId?.trim() ||
      providerTemplate?.selectedModel ||
      providerTemplate?.availableModels[0]?.id ||
      "default";

    // Enforce explicit key requirement: never silently inject environment key for user test
    if (!cleanKey && providerId !== "custom") {
      return {
        success: false,
        providerId,
        providerName,
        model: effectiveModel,
        keyId,
        maskedKey: "no-key",
        latencyMs: 0,
        errorCode: "INVALID_API_KEY",
        errorKind: "invalid_key",
        errorTitle: "❌ Missing API Key",
        errorMessage: "No API key was provided to test. Please enter a valid API key.",
        userFacingMessage: "Please enter or paste an API key before testing.",
        diagnostic: {
          provider: providerName,
          keyId: keyId || "unassigned",
          modelId: effectiveModel,
          endpoint: options?.customEndpoint || "default",
          maskedKey: "no-key",
          result: "MISSING_KEY",
          latencyMs: 0,
          rawMessage: "No key provided.",
        },
      };
    }

    if (options?.customEndpoint && options.customEndpoint.trim()) {
      try {
        assertSafeEndpoint(options.customEndpoint.trim());
      } catch (err: any) {
        return {
          success: false,
          providerId,
          providerName,
          model: effectiveModel,
          keyId,
          maskedKey: masked,
          latencyMs: 0,
          errorCode: "INVALID_ENDPOINT" as any,
          errorKind: "invalid_key",
          errorTitle: "❌ Prohibited Endpoint",
          errorMessage: err.message,
          userFacingMessage: err.message,
          diagnostic: {
            provider: providerName,
            keyId: keyId || "unassigned",
            modelId: effectiveModel,
            endpoint: options.customEndpoint,
            maskedKey: masked,
            result: "FORBIDDEN_ENDPOINT" as any,
            latencyMs: 0,
            rawMessage: err.message,
          },
        };
      }
    }

    try {
      const result = await adapter.test(cleanKey, effectiveModel, {
        keyId,
        customEndpoint: options?.customEndpoint,
        accountId: options?.accountId,
        timeoutMs: options?.timeoutMs || 15000,
      });

      const testObj = typeof result === "object" && result !== null ? result : { success: Boolean(result), latencyMs: 0 };
      return {
        ...testObj,
        keyId,
        model: effectiveModel,
        providerId,
        providerName,
        maskedKey: masked,
      };
    } catch (err: any) {
      const norm: NormalizedAIError = adapter.normalizeError
        ? adapter.normalizeError(err)
        : {
            kind: typeof adapter.classifyError === "function" ? (adapter.classifyError(err) as any) : "unknown",
            message: err?.message || String(err),
            retryable: false,
          };
      return {
        success: false,
        providerId,
        providerName,
        model: effectiveModel,
        keyId,
        maskedKey: masked,
        latencyMs: 0,
        errorCode: (norm.code as any) || "UNKNOWN_ERROR",
        errorKind: norm.kind,
        errorTitle: norm.title || "❌ Connection Failed",
        errorMessage: norm.message,
        statusCode: norm.statusCode,
        userFacingMessage: norm.userFacingMessage || norm.message,
        diagnostic: {
          provider: providerName,
          keyId: keyId || "unassigned",
          modelId: effectiveModel,
          endpoint: options?.customEndpoint || "default",
          maskedKey: masked,
          result: (norm.code as any) || "FAILED",
          latencyMs: 0,
          rawMessage: norm.message,
        },
      };
    }
  }

  /**
   * Scoped test for a provider key and model (backward-compatibility alias).
   */
  public async testProviderScoped(
    providerId: string,
    apiKey?: string,
    model?: string,
    customEndpoint?: string,
    accountId?: string
  ): Promise<TestResult> {
    const cleanKey = apiKey?.trim() || "";
    return this.testApiConnection(providerId, "probe-key", model || "", cleanKey, {
      customEndpoint,
      accountId,
    });
  }

  /**
   * Batch test active providers scoped to a user's request.
   */
  public async testAllScoped(providers: any[]): Promise<TestResult[]> {
    const results: TestResult[] = [];
    for (const p of providers) {
      if (!p.enabled) continue;
      // Test the first enabled key, or first available key
      const keyObj = (p.apiKeys || []).find((k: any) => k.enabled && k.key) || (p.apiKeys || [])[0];
      const res = await this.testApiConnection(
        p.id,
        keyObj?.id || "key-1",
        p.selectedModel,
        keyObj?.key || "",
        { customEndpoint: p.customEndpoint, accountId: p.accountId }
      );
      results.push(res);
    }
    return results;
  }

  /**
   * Resolves available server-side environment keys for a given provider if present.
   */
  public getServerEnvironmentKeys(providerId: string): string[] {
    if (process.env.ALLOW_SERVER_KEYS_FOR_ANON === "false") {
      return [];
    }
    const keys: string[] = [];
    const addKey = (k?: string) => {
      const trimmed = k?.trim();
      if (trimmed && !keys.includes(trimmed)) keys.push(trimmed);
    };

    switch (providerId) {
      case "gemini":
        addKey(process.env.GEMINI_API_KEY);
        addKey(process.env.GEMINI_API_KEY_1);
        addKey(process.env.GEMINI_API_KEY_2);
        break;
      case "groq":
        addKey(process.env.GROQ_API_KEY);
        addKey(process.env.GROQ_API_KEY_1);
        break;
      case "openrouter":
        addKey(process.env.OPENROUTER_API_KEY);
        break;
      case "mistral":
        addKey(process.env.MISTRAL_API_KEY);
        break;
      case "cohere":
        addKey(process.env.COHERE_API_KEY);
        break;
      case "huggingface":
        addKey(process.env.HUGGINGFACE_API_KEY);
        addKey(process.env.HF_API_KEY);
        addKey(process.env.HUGGING_FACE_HUB_TOKEN);
        break;
      case "cloudflare":
        addKey(process.env.CLOUDFLARE_API_KEY);
        addKey(process.env.CLOUDFLARE_API_TOKEN);
        break;
    }
    return keys;
  }

  // --- REQUEST-SCOPED AUTHORITATIVE GENERATION PIPELINE ---

  /**
   * Central AI Request Execution with strict request-scoped isolation.
   *
   * Pipeline steps:
   * 1. resolveProvider()
   * 2. resolveUserKey() (STRICTLY enabled === true)
   * 3. resolveModel()
   * 4. validateModel()
   * 5. buildRequest()
   * 6. sendRequest()
   * 7. classifyResponse()
   * 8. updateKeyStatus()
   */
  public async executeRequestScoped(
    request: AIRequest,
    scopedConfig?: Partial<ManagerConfig>,
    scopedProviders?: any[]
  ): Promise<AIResponse> {
    const overallStartTime = Date.now();
    const fallbackChain: FallbackStep[] = [];
    const requiredCapabilities = request.capabilities || ["text", "math"];

    // 1. Resolve configuration
    const config: ManagerConfig = {
      ...DEFAULT_MANAGER_CONFIG,
      ...(scopedConfig || {}),
    };

    // 2. Resolve candidate providers
    const templates = getInitialProviders();
    let candidateProviders: ProviderConfig[] = [];

    if (scopedProviders && Array.isArray(scopedProviders) && scopedProviders.length > 0) {
      candidateProviders = scopedProviders.map((sp: any) => {
        const tmpl = templates.find((t) => t.id === sp.id);
        return {
          id: sp.id,
          name: sp.name || tmpl?.name || sp.id,
          enabled: typeof sp.enabled === "boolean" ? sp.enabled : (tmpl?.enabled ?? true),
          priority: typeof sp.priority === "number" ? sp.priority : (tmpl?.priority ?? 99),
          selectedModel: sp.selectedModel || tmpl?.selectedModel || "default",
          selectedKeyId: sp.selectedKeyId,
          availableModels: sp.availableModels || tmpl?.availableModels || [],
          apiKeys: (sp.apiKeys || []).map((k: any) => ({
            id: k.id,
            name: k.name || "API Key",
            key: k.key || "",
            enabled: Boolean(k.enabled),
            status: k.status || "active",
          })),
          maxRetries: sp.maxRetries || tmpl?.maxRetries || 2,
          timeoutMs: sp.timeoutMs || tmpl?.timeoutMs || config.defaultTimeoutMs,
          customEndpoint: sp.customEndpoint || tmpl?.customEndpoint,
          accountId: sp.accountId || tmpl?.accountId,
          billingMode: sp.billingMode || tmpl?.billingMode || config.billingMode,
          freeTier: sp.freeTier || tmpl?.freeTier,
          notes: sp.notes || tmpl?.notes,
        } as ProviderConfig;
      });
    } else {
      candidateProviders = templates;
    }

    // 3. Determine candidate providers according to Mode and Provider ON/OFF switch
    if (config.mode === "manual") {
      const activePId = config.activeProviderId || "gemini";
      const manualProvider = candidateProviders.find((p) => p.id === activePId);

      if (manualProvider && manualProvider.enabled) {
        const others = candidateProviders
          .filter((p) => p.enabled && p.id !== activePId)
          .sort((a, b) => a.priority - b.priority);
        candidateProviders = [manualProvider];
        if (config.enableFallback) {
          candidateProviders.push(...others);
        }
      } else {
        throw new Error(
          `Selected provider '${manualProvider?.name || activePId}' is currently turned OFF. Please turn it ON in AI Settings or enable Automatic mode.`
        );
      }
    } else {
      candidateProviders = candidateProviders
        .filter((p) => p.enabled)
        .sort((a, b) => a.priority - b.priority);
    }

    // Exclude providers that have no enabled keys and no server env fallback
    // In particular, Cloudflare Workers AI must NEVER be included in fallback chain if it has no configured key/credentials
    candidateProviders = candidateProviders.filter((p) => {
      if (p.id === "cloudflare") {
        const hasKey = (p.apiKeys || []).some((k) => k.enabled && k.key && k.key.trim().length > 0);
        if (!hasKey) return false;
      }
      return true;
    });

    if (candidateProviders.length === 0) {
      throw new Error(
        "All enabled AI providers are currently unavailable. Please turn ON at least one provider and active API key in AI Settings."
      );
    }

    // 4. Iterate through candidate providers in priority sequence
    for (const provider of candidateProviders) {
      if (!provider.enabled) continue;

      const adapter = this.adapters.get(provider.id);
      if (!adapter) continue;

      if (provider.customEndpoint && provider.customEndpoint.trim()) {
        try {
          assertSafeEndpoint(provider.customEndpoint.trim());
        } catch (err: any) {
          fallbackChain.push({
            providerId: provider.id,
            providerName: provider.name,
            keyMasked: "none",
            keyName: "Endpoint Validation",
            model: provider.selectedModel,
            status: "network_error",
            errorMessage: err?.message || "Prohibited custom endpoint",
            latencyMs: 0,
            timestamp: Date.now(),
          });
          continue;
        }
      }

      // RESOLVE USER KEYS: ONLY enabled === true keys can be used for normal generation!
      const hasConfiguredKeys = Array.isArray(provider.apiKeys) && provider.apiKeys.length > 0;
      let activeKeys = (provider.apiKeys || []).filter((k) => k.enabled && k.key && k.key.trim());

      // If user has not added any custom keys, allow server environment fallback if available
      if (!hasConfiguredKeys && activeKeys.length === 0) {
        const envKeys = this.getServerEnvironmentKeys(provider.id);
        if (envKeys.length > 0) {
          activeKeys = envKeys.map((envKey, idx) => ({
            id: `server-${provider.id}-default-${idx + 1}`,
            name: `Server ${provider.name} Default`,
            key: envKey,
            enabled: true,
            status: "active" as const,
          }));
        }
      }

      // If this provider has NO enabled keys, record step and proceed to next provider
      if (activeKeys.length === 0) {
        fallbackChain.push({
          providerId: provider.id,
          providerName: provider.name,
          keyMasked: "none",
          keyName: "No Enabled Keys",
          model: provider.selectedModel,
          status: "invalid_key",
          errorMessage: "Provider has no enabled API keys (all keys are turned OFF or unconfigured).",
          latencyMs: 0,
          timestamp: Date.now(),
        });
        continue;
      }

      // RESOLVE MODEL
      let modelToUse = provider.selectedModel;
      if (config.mode === "manual" && provider.id === config.activeProviderId && config.activeModel) {
        modelToUse = config.activeModel;
      }

      // Check model in catalog
      let modelInfo = provider.availableModels.find((m) => m.id === modelToUse);
      if (!modelInfo && provider.availableModels.length > 0) {
        // Stale model detection: use first available model if stored model is no longer in catalog
        modelToUse = provider.availableModels[0].id;
        modelInfo = provider.availableModels[0];
      }

      // Check Free-Only Guardrail
      const isFreeOnly =
        config.freeOnlyMode ||
        config.billingMode === "free_only" ||
        provider.billingMode === "free_only";

      if (isFreeOnly && modelInfo && !modelInfo.isFree) {
        if (config.enableModelFallback) {
          const freeAlternative = provider.availableModels.find((m) => m.isFree);
          if (freeAlternative) {
            modelToUse = freeAlternative.id;
            modelInfo = freeAlternative;
          } else {
            fallbackChain.push({
              providerId: provider.id,
              providerName: provider.name,
              keyMasked: "all",
              model: modelToUse,
              status: "skipped_paid",
              errorMessage: "Provider has no free models; skipped due to Free-Only mode.",
              latencyMs: 0,
              timestamp: Date.now(),
            });
            continue;
          }
        } else {
          fallbackChain.push({
            providerId: provider.id,
            providerName: provider.name,
            keyMasked: "all",
            model: modelToUse,
            status: "skipped_paid",
            errorMessage: "Model is paid; skipped due to Free-Only mode.",
            latencyMs: 0,
            timestamp: Date.now(),
          });
          continue;
        }
      }

      // Capability matching check
      const supportsCap = (cap: string, mId: string) => {
        if (typeof (adapter as any).supportsCapability === "function") {
          return (adapter as any).supportsCapability(cap, mId);
        }
        return true;
      };

      const missingCapability = requiredCapabilities.find(
        (cap) => !supportsCap(cap, modelToUse)
      );

      if (missingCapability) {
        if (config.enableModelFallback) {
          const compatibleModel = provider.availableModels.find((m) =>
            requiredCapabilities.every((cap) => supportsCap(cap, m.id))
          );
          if (compatibleModel) {
            modelToUse = compatibleModel.id;
            modelInfo = compatibleModel;
          } else {
            fallbackChain.push({
              providerId: provider.id,
              providerName: provider.name,
              keyMasked: "all",
              model: modelToUse,
              status: "capability_mismatch",
              errorMessage: `Model lacks required capability: '${missingCapability}'`,
              latencyMs: 0,
              timestamp: Date.now(),
            });
            continue;
          }
        } else {
          continue;
        }
      }

      // Build ordered candidate models for this provider (modelToUse first, then alternatives)
      const candidateModels: string[] = [modelToUse];
      if (config.enableModelFallback !== false) {
        for (const avail of provider.availableModels || []) {
          if (!candidateModels.includes(avail.id)) {
            if (isFreeOnly && !avail.isFree) continue;
            if (requiredCapabilities.some((cap) => !supportsCap(cap, avail.id))) continue;
            candidateModels.push(avail.id);
          }
        }
      }

      // Reorder keys if manual mode specifies activeKeyId
      let orderedKeys: ApiKeyItem[] = [...activeKeys];
      if (
        config.mode === "manual" &&
        config.activeProviderId === provider.id &&
        config.activeKeyId
      ) {
        const specific = activeKeys.find((k) => k.id === config.activeKeyId);
        if (specific) {
          orderedKeys = [specific, ...activeKeys.filter((k) => k.id !== specific.id)];
        }
      }

      let providerHasSuccess = false;

      // Try candidate models and enabled API keys
      for (const currentModel of candidateModels) {
        if (providerHasSuccess) break;
        let skipRemainingKeysForThisModel = false;

        for (let keyIdx = 0; keyIdx < orderedKeys.length; keyIdx++) {
          if (skipRemainingKeysForThisModel) break;
          const keyItem = orderedKeys[keyIdx];
          const apiKey = keyItem.key;
          const masked = maskApiKey(apiKey);

          let attempt = 0;
          const maxRetries = Math.max(1, provider.maxRetries || 2);

          while (attempt < maxRetries) {
            attempt++;
            const callStart = Date.now();

            const callTimeoutMs =
              Number(process.env.AI_TIMEOUT_MS) ||
              provider.timeoutMs ||
              config.defaultTimeoutMs ||
              60000;
            const abortController = new AbortController();
            const timeoutTimer = setTimeout(() => {
              abortController.abort(
                new Error(
                  `AI request to provider "${provider.name}" (${currentModel}) timed out after ${callTimeoutMs}ms`
                )
              );
            }, callTimeoutMs);

            try {
              // BUILD & SEND REQUEST through Authoritative Adapter with AbortController timeout race
              const timeoutPromise = new Promise<never>((_, reject) => {
                abortController.signal.addEventListener("abort", () => {
                  const timeoutErr: any = new Error(
                    `AI request to provider "${provider.name}" (${currentModel}) timed out after ${callTimeoutMs}ms`
                  );
                  timeoutErr.name = "TimeoutError";
                  timeoutErr.code = "TIMEOUT";
                  timeoutErr.statusCode = 408;
                  timeoutErr.status = 408;
                  reject(timeoutErr);
                });
              });

              const result = await Promise.race([
                adapter.generate(
                  { ...request, model: currentModel },
                  apiKey,
                  currentModel,
                  {
                    timeoutMs: callTimeoutMs,
                    signal: abortController.signal,
                    customEndpoint: provider.customEndpoint,
                    accountId: provider.accountId,
                    temperature: request.temperature,
                    maxTokens: request.maxTokens,
                  }
                ),
                timeoutPromise,
              ]);
              clearTimeout(timeoutTimer);

              const latency = Date.now() - callStart;
              const effectiveModel = (result as any).modelUsed || currentModel;

              fallbackChain.push({
                providerId: provider.id,
                providerName: provider.name,
                keyMasked: masked,
                keyName: keyItem.name,
                model: effectiveModel,
                status: "success",
                latencyMs: latency,
                timestamp: Date.now(),
              });

              providerHasSuccess = true;
              return {
                text: result.text,
                providerId: provider.id,
                providerName: provider.name,
                model: effectiveModel,
                keyMasked: masked,
                keyName: keyItem.name,
                latencyMs: Date.now() - overallStartTime,
                inputTokensEst: result.inputTokens,
                outputTokensEst: result.outputTokens,
                fallbackChain,
              };
            } catch (err: any) {
              clearTimeout(timeoutTimer);
              const latency = Date.now() - callStart;
              const isTimeout =
                err?.name === "TimeoutError" ||
                err?.code === "TIMEOUT" ||
                err?.status === 408 ||
                err?.message?.toLowerCase().includes("timed out");

              const normalized: NormalizedAIError = isTimeout
                ? {
                    code: "TIMEOUT",
                    kind: "timeout",
                    statusCode: 408,
                    title: `⚠️ ${provider.name} Request Timeout`,
                    message: err?.message || `Request timed out after ${callTimeoutMs}ms`,
                    userFacingMessage: `The request timed out waiting for ${provider.name} to respond.`,
                    retryable: true,
                    rawError: err,
                  }
                : adapter.normalizeError
                ? adapter.normalizeError(err)
                : {
                    kind: typeof adapter.classifyError === "function" ? (adapter.classifyError(err) as any) : "unknown",
                    code: "UNKNOWN_ERROR",
                    message: err?.message || String(err),
                    retryable: true,
                  };

              const stepStatus =
                isTimeout || normalized.code === "TIMEOUT" || normalized.kind === "timeout"
                  ? "timeout"
                  : normalized.code === "RATE_LIMIT" || normalized.kind === "rate_limit"
                  ? "rate_limited"
                  : normalized.code === "INVALID_API_KEY" || normalized.kind === "invalid_key"
                  ? "invalid_key"
                  : normalized.code === "MODEL_UNAVAILABLE" || normalized.kind === "model_unavailable"
                  ? "model_unavailable"
                  : normalized.code === "FORBIDDEN" || normalized.kind === "permission_denied"
                  ? "permission_denied"
                  : "server_error";

              fallbackChain.push({
                providerId: provider.id,
                providerName: provider.name,
                keyMasked: masked,
                keyName: keyItem.name,
                model: currentModel,
                status: stepStatus as any,
                errorMessage: normalized.message,
                latencyMs: latency,
                timestamp: Date.now(),
              });

              // If non-retryable (invalid key, model unavailable, forbidden), stop retrying this specific key
              if (!normalized.retryable || normalized.kind === "invalid_key" || normalized.kind === "model_unavailable") {
                break;
              }

              // If model is experiencing temporary high demand (503) or unavailable, break to try next model in candidateModels
              const isOverloadedOrUnavailable =
                normalized.statusCode === 503 ||
                normalized.message?.includes("experiencing high demand") ||
                normalized.message?.includes("503");

              if (isOverloadedOrUnavailable && candidateModels.length > 1) {
                skipRemainingKeysForThisModel = true;
                break;
              }

              if (attempt < maxRetries && normalized.retryable) {
                await new Promise((r) => setTimeout(r, 400 * attempt));
              }
            }
          }
        }
      }
    }

    // Build aggregated error message showing every step in the fallbackChain
    let errorMessage: string;
    if (fallbackChain.length === 0) {
      errorMessage = "All configured AI providers failed. All enabled AI providers are currently unavailable.";
    } else if (fallbackChain.length === 1) {
      const step = fallbackChain[0];
      errorMessage = `All configured AI providers failed: AI request failed on ${step.providerName} (${step.model}): ${step.errorMessage}`;
    } else {
      const stepLines = fallbackChain.map((step, idx) => {
        const masked = step.keyMasked && step.keyMasked !== "none" ? ` [key: ${step.keyMasked}]` : "";
        return `  ${idx + 1}. ${step.providerName} (${step.model}${masked}): ${step.errorMessage}`;
      });
      errorMessage = `All configured AI providers failed (${fallbackChain.length} steps attempted):\n${stepLines.join("\n")}`;
    }

    // Determine the most informative failure step for classification and badge assignment
    // Prioritize actual remote API responses (rate_limit, invalid_key, timeout, etc.) over unconfigured fallbacks
    const informativeStep =
      fallbackChain.find(
        (s) =>
          s.status !== "invalid_key" &&
          !s.errorMessage?.toLowerCase().includes("no enabled api key") &&
          s.providerId !== "cloudflare"
      ) ||
      fallbackChain.find(
        (s) =>
          !s.errorMessage?.toLowerCase().includes("no enabled api key") &&
          s.providerId !== "cloudflare"
      ) ||
      fallbackChain.find((s) => s.providerId !== "cloudflare") ||
      fallbackChain[0];

    const error = new Error(errorMessage);
    (error as any).fallbackChain = fallbackChain;
    (error as any).informativeStep = informativeStep;
    (error as any).errorCategory = informativeStep?.status || "server_error";
    throw error;
  }

  public async execute(request: AIRequest): Promise<AIResponse> {
    return this.executeRequestScoped(request);
  }

  // Compatibility stubs
  public updateManagerConfig(_updates: Partial<ManagerConfig>) {}
  public updateProvider(_id: string, _updates: Partial<ProviderConfig>): boolean {
    return true;
  }
  public addApiKey(_providerId: string, _item: any) {
    return null;
  }
  public toggleApiKey(_providerId: string, _keyId: string, _enabled?: boolean): boolean {
    return true;
  }
  public removeApiKey(_providerId: string, _keyId: string) {}
  public reorderProviders(_orderedIds: string[]) {}
  public saveSettings(): boolean {
    return true;
  }
  public loadSavedSettings(): boolean {
    return true;
  }
  public loadKeysFromEnvironment() {}
  public getStats(): ProviderStats[] {
    return [];
  }
  public getRecentLogs(): FallbackLogEntry[] {
    return [];
  }
  public resetToDefaults() {}
}

export const aiRequestManager = new AIRequestManager();
