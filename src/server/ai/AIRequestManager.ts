import {
  AIProviderAdapter,
  maskApiKey,
  estimateTokenCount,
} from "./adapters/BaseAdapter.ts";
import { GeminiAdapter } from "./adapters/GeminiAdapter.ts";
import { GroqAdapter } from "./adapters/GroqAdapter.ts";
import { OpenRouterAdapter } from "./adapters/OpenRouterAdapter.ts";
import { MistralAdapter } from "./adapters/MistralAdapter.ts";
import { CohereAdapter } from "./adapters/CohereAdapter.ts";
import { HuggingFaceAdapter } from "./adapters/HuggingFaceAdapter.ts";
import { CloudflareAdapter } from "./adapters/CloudflareAdapter.ts";
import { CustomAdapter } from "./adapters/CustomAdapter.ts";
import {
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
 * Implements FormatAI's STRICT USER-SPECIFIC LOCAL ISOLATION architecture:
 * - The server does NOT maintain global mutable user configuration.
 * - The server does NOT persist user API keys to disk, database, or shared memory.
 * - AI requests are executed with REQUEST-SCOPED configuration and keys passed directly from the client.
 * - Concurrent requests from different users/browsers execute with absolute isolation and zero cross-talk.
 */
export class AIRequestManager {
  private adapters: Map<string, AIProviderAdapter> = new Map();
  private templateProviders: ProviderConfig[] = [];

  constructor(_storagePath?: string) {
    this.registerAdapters();
    this.templateProviders = getInitialProviders();
  }

  private registerAdapters() {
    const defaultAdapters: AIProviderAdapter[] = [
      new GeminiAdapter(),
      new GroqAdapter(),
      new OpenRouterAdapter(),
      new MistralAdapter(),
      new CohereAdapter(),
      new HuggingFaceAdapter(),
      new CloudflareAdapter(),
      new CustomAdapter(),
    ];

    for (const adapter of defaultAdapters) {
      this.adapters.set(adapter.id, adapter);
    }
  }

  public registerCustomAdapter(adapter: AIProviderAdapter) {
    this.adapters.set(adapter.id, adapter);
  }

  /**
   * Return static public provider metadata templates (available models, free tier limits, docs).
   * Notice: all `apiKeys` are empty arrays. User-specific keys are stored strictly on the client.
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

  // Backward compatibility alias
  public getClientProviders(): ClientProviderConfig[] {
    return this.getStaticProviderTemplates();
  }

  public getManagerConfig(): ManagerConfig {
    return { ...DEFAULT_MANAGER_CONFIG };
  }

  // --- REQUEST-SCOPED AI EXECUTION ENGINE ---

  /**
   * Central AI Request Execution with strict request-scoped isolation.
   *
   * @param request The AI request payload (prompt, systemPrompt, capabilities, etc.)
   * @param scopedConfig Optional user-specific manager configuration (mode, freeOnlyMode, fallback, etc.)
   * @param scopedProviders Optional user-specific providers and API keys
   */
  public async executeRequestScoped(
    request: AIRequest,
    scopedConfig?: Partial<ManagerConfig>,
    scopedProviders?: any[]
  ): Promise<AIResponse> {
    const overallStartTime = Date.now();
    const fallbackChain: FallbackStep[] = [];
    const requiredCapabilities = request.capabilities || ["text", "math"];

    // 1. Resolve local request configuration (never mutate defaults)
    const config: ManagerConfig = {
      ...DEFAULT_MANAGER_CONFIG,
      ...(scopedConfig || {}),
    };

    // 2. Resolve candidate providers for this request
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

    // 3. Determine candidate providers according to Mode and ON/OFF switch
    if (config.mode === "manual") {
      const activePId = config.activeProviderId || "gemini";
      const manualProvider = candidateProviders.find((p) => p.id === activePId);

      if (manualProvider && manualProvider.enabled) {
        candidateProviders = [manualProvider];
        if (config.enableFallback) {
          const others = candidateProviders
            .filter((p) => p.enabled && p.id !== activePId)
            .sort((a, b) => a.priority - b.priority);
          candidateProviders.push(...others);
        }
      } else {
        throw new Error(
          `Selected provider '${manualProvider?.name || activePId}' is currently turned OFF. Please turn it ON or switch to Automatic mode.`
        );
      }
    } else {
      candidateProviders = candidateProviders
        .filter((p) => p.enabled)
        .sort((a, b) => a.priority - b.priority);
    }

    if (candidateProviders.length === 0) {
      throw new Error(
        "All enabled AI providers are currently unavailable. Please turn ON at least one provider and active API key in AI Settings."
      );
    }

    let hadFreeEligibleProvider = false;

    // 4. Iterate through candidate providers in priority sequence
    for (const provider of candidateProviders) {
      if (!provider.enabled) continue;

      const adapter = this.adapters.get(provider.id);
      if (!adapter) continue;

      let activeKeys = (provider.apiKeys || []).filter((k) => k.enabled && k.key);

      // Silent server-side Gemini environment key fallback (if user has not provided their own key)
      if (
        activeKeys.length === 0 &&
        provider.id === "gemini" &&
        process.env.GEMINI_API_KEY
      ) {
        activeKeys = [
          {
            id: "system-gemini-fallback",
            name: "Server Gemini",
            key: process.env.GEMINI_API_KEY,
            enabled: true,
            status: "active",
          },
        ];
      }

      if (activeKeys.length === 0) {
        fallbackChain.push({
          providerId: provider.id,
          providerName: provider.name,
          keyMasked: "none",
          keyName: "No Active Keys",
          model: provider.selectedModel,
          status: "invalid_key",
          errorMessage: "Provider has no enabled API keys (all keys are turned OFF or unconfigured).",
          latencyMs: 0,
          timestamp: Date.now(),
        });
        continue;
      }

      // Determine model to use
      let modelToUse = provider.selectedModel;
      if (config.mode === "manual" && provider.id === config.activeProviderId && config.activeModel) {
        modelToUse = config.activeModel;
      }

      let modelInfo = provider.availableModels.find((m) => m.id === modelToUse);

      // Check Cost Guardrail: Free-Only Mode
      const isFreeOnly =
        config.freeOnlyMode ||
        config.billingMode === "free_only" ||
        provider.billingMode === "free_only";

      if (isFreeOnly) {
        if (modelInfo && !modelInfo.isFree) {
          if (config.enableModelFallback) {
            const freeAlternative = provider.availableModels.find((m) => m.isFree);
            if (freeAlternative) {
              modelToUse = freeAlternative.id;
              modelInfo = freeAlternative;
              hadFreeEligibleProvider = true;
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
        } else {
          hadFreeEligibleProvider = true;
        }
      }

      // Capability matching check
      const missingCapability = requiredCapabilities.find(
        (cap) => !adapter.supportsCapability(cap, modelToUse)
      );

      if (missingCapability) {
        if (config.enableModelFallback) {
          const compatibleModel = provider.availableModels.find((m) =>
            requiredCapabilities.every((cap) => adapter.supportsCapability(cap, m.id))
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

      // Try each enabled API key for this provider
      for (let keyIdx = 0; keyIdx < orderedKeys.length; keyIdx++) {
        const keyItem = orderedKeys[keyIdx];
        const apiKey = keyItem.key;
        const masked = maskApiKey(apiKey);

        let attempt = 0;
        const maxRetries = Math.max(1, provider.maxRetries || 2);

        while (attempt < maxRetries) {
          attempt++;
          const callStart = Date.now();

          try {
            const result = await adapter.generate(
              { ...request, model: modelToUse },
              apiKey,
              modelToUse,
              {
                timeoutMs: provider.timeoutMs || config.defaultTimeoutMs,
                customEndpoint: provider.customEndpoint,
                temperature: request.temperature,
                maxTokens: request.maxTokens,
              }
            );

            const latency = Date.now() - callStart;

            fallbackChain.push({
              providerId: provider.id,
              providerName: provider.name,
              keyMasked: masked,
              keyName: keyItem.name,
              model: modelToUse,
              status: "success",
              latencyMs: latency,
              timestamp: Date.now(),
            });

            return {
              text: result.text,
              providerId: provider.id,
              providerName: provider.name,
              model: modelToUse,
              keyMasked: masked,
              keyName: keyItem.name,
              latencyMs: Date.now() - overallStartTime,
              inputTokensEst: result.inputTokens,
              outputTokensEst: result.outputTokens,
              fallbackChain,
            };
          } catch (callErr: any) {
            const latency = Date.now() - callStart;
            const norm = adapter.normalizeError(callErr);

            fallbackChain.push({
              providerId: provider.id,
              providerName: provider.name,
              keyMasked: masked,
              keyName: keyItem.name,
              model: modelToUse,
              status: norm.kind,
              errorMessage: `[Attempt ${attempt}/${maxRetries}] ${norm.message}`,
              latencyMs: latency,
              timestamp: Date.now(),
            });

            if (norm.kind === "invalid_key") {
              break; // Don't retry invalid key
            }

            if (attempt < maxRetries) {
              const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
              await new Promise((r) => setTimeout(r, backoff));
            }
          }
        } // while attempt
      } // for keyIdx

      if (config.mode === "manual" && !config.enableFallback) {
        break;
      }
    } // for candidateProviders

    const isFreeOnlyActive = config.freeOnlyMode || config.billingMode === "free_only";
    const errorMessage =
      isFreeOnlyActive && !hadFreeEligibleProvider
        ? "All configured AI providers failed. All enabled free AI providers are currently unavailable."
        : "All configured AI providers failed. All enabled AI providers are currently unavailable.";

    const error = new Error(errorMessage);
    (error as any).fallbackChain = fallbackChain;
    throw error;
  }

  /**
   * Execute using default configuration (backward-compatible fallback).
   */
  public async execute(request: AIRequest): Promise<AIResponse> {
    return this.executeRequestScoped(request);
  }

  /**
   * Scoped test for a specific provider key and model.
   * Completely isolated; never saves key or configuration to server memory or disk.
   */
  public async testProviderScoped(
    providerId: string,
    apiKey?: string,
    model?: string,
    customEndpoint?: string,
    accountId?: string
  ): Promise<TestResult> {
    const adapter = this.adapters.get(providerId);
    if (!adapter) {
      return {
        success: false,
        providerId,
        providerName: providerId,
        model: model || "unknown",
        latencyMs: 0,
        errorMessage: `Unknown provider adapter '${providerId}'.`,
      };
    }

    const providerTemplate = this.templateProviders.find((p) => p.id === providerId);
    const providerName = providerTemplate?.name || adapter.name;
    const modelToUse =
      model ||
      providerTemplate?.selectedModel ||
      providerTemplate?.availableModels[0]?.id ||
      "default";

    let keyToUse = apiKey?.trim();
    if (!keyToUse && providerId === "gemini" && process.env.GEMINI_API_KEY) {
      keyToUse = process.env.GEMINI_API_KEY;
    }

    if (!keyToUse && providerId !== "custom") {
      return {
        success: false,
        providerId,
        providerName,
        model: modelToUse,
        latencyMs: 0,
        errorMessage: "No API key provided to test. Please enter a valid API key.",
        errorKind: "invalid_key",
      };
    }

    const start = Date.now();
    try {
      const testRes = await adapter.testConnection(
        keyToUse || "",
        modelToUse,
        customEndpoint,
        15000
      );
      return {
        ...testRes,
        providerId,
        providerName,
        model: modelToUse,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      const normalized = adapter.normalizeError(err);
      return {
        success: false,
        providerId,
        providerName,
        model: modelToUse,
        latencyMs,
        errorMessage: normalized.message,
        statusCode: normalized.statusCode,
        errorKind: normalized.kind,
      };
    }
  }

  /**
   * Batch test multiple providers scoped to a user's request.
   */
  public async testAllScoped(providers: any[]): Promise<TestResult[]> {
    const results: TestResult[] = [];
    for (const p of providers) {
      if (!p.enabled) continue;
      const activeKey = (p.apiKeys || []).find((k: any) => k.enabled && k.key);
      const res = await this.testProviderScoped(
        p.id,
        activeKey?.key,
        p.selectedModel,
        p.customEndpoint,
        p.accountId
      );
      results.push(res);
    }
    return results;
  }

  // --- No-Op compatibility stubs (settings are stored on the client) ---
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

// Global Singleton instance for server runtime (stateless request dispatcher)
export const aiRequestManager = new AIRequestManager();
