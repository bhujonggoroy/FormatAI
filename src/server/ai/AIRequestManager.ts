import fs from "fs";
import path from "path";
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

export class AIRequestManager {
  private config: ManagerConfig;
  private providers: Map<string, ProviderConfig> = new Map();
  private adapters: Map<string, AIProviderAdapter> = new Map();
  private invalidKeys: Set<string> = new Set(); // Stores invalid keys to skip
  private keyCursors: Map<string, number> = new Map(); // Round-robin key cursor
  private stats: Map<string, ProviderStats> = new Map();
  private recentLogs: FallbackLogEntry[] = [];
  private readonly maxLogEntries = 50;
  private settingsFilePath: string;

  constructor(customSettingsPath?: string) {
    this.config = { ...DEFAULT_MANAGER_CONFIG };
    this.settingsFilePath =
      customSettingsPath || path.join(process.cwd(), "ai-settings.json");

    this.registerAdapters();
    this.initializeProviders();
    this.loadKeysFromEnvironment();
    this.loadSavedSettings();
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

  private initializeProviders() {
    const initial = getInitialProviders();
    for (const p of initial) {
      this.providers.set(p.id, {
        ...p,
        apiKeys: [],
      });
      this.stats.set(p.id, {
        providerId: p.id,
        providerName: p.name,
        requestCount: 0,
        successCount: 0,
        failureCount: 0,
        rateLimitCount: 0,
        estimatedInputTokens: 0,
        estimatedOutputTokens: 0,
        averageLatencyMs: 0,
      });
      this.keyCursors.set(p.id, 0);
    }
  }

  /**
   * Discovers and loads API keys from environment variables.
   * CRITICAL INTENT & SAFETY RULES:
   * 1. A newly detected environment key is NEVER enabled automatically
   *    (except for existing primary GEMINI_API_KEY Key 1 which is enabled by default
   *     to guarantee zero regressions for existing Gemini users).
   * 2. Every other key starts with `enabled: false`.
   * 3. Every other provider starts with `enabled: false`.
   */
  public loadKeysFromEnvironment() {
    // 1. Google Gemini
    if (process.env.GEMINI_API_KEY) {
      this.upsertEnvKey("gemini", process.env.GEMINI_API_KEY, "GEMINI_API_KEY", true);
    }
    for (let i = 1; i <= 5; i++) {
      const k = process.env[`GEMINI_API_KEY_${i}`];
      if (k) {
        this.upsertEnvKey("gemini", k, `GEMINI_API_KEY_${i}`, true);
      }
    }

    // 2. Groq
    if (process.env.GROQ_API_KEY) {
      this.upsertEnvKey("groq", process.env.GROQ_API_KEY, "GROQ_API_KEY", true);
    }
    for (let i = 1; i <= 5; i++) {
      const k = process.env[`GROQ_API_KEY_${i}`];
      if (k) this.upsertEnvKey("groq", k, `GROQ_API_KEY_${i}`, true);
    }

    // 3. OpenRouter
    if (process.env.OPENROUTER_API_KEY) {
      this.upsertEnvKey("openrouter", process.env.OPENROUTER_API_KEY, "OPENROUTER_API_KEY", true);
    }
    for (let i = 1; i <= 5; i++) {
      const k = process.env[`OPENROUTER_API_KEY_${i}`];
      if (k) this.upsertEnvKey("openrouter", k, `OPENROUTER_API_KEY_${i}`, true);
    }

    // 4. Mistral
    if (process.env.MISTRAL_API_KEY) {
      this.upsertEnvKey("mistral", process.env.MISTRAL_API_KEY, "MISTRAL_API_KEY", true);
    }
    for (let i = 1; i <= 5; i++) {
      const k = process.env[`MISTRAL_API_KEY_${i}`];
      if (k) this.upsertEnvKey("mistral", k, `MISTRAL_API_KEY_${i}`, true);
    }

    // 5. Cohere
    if (process.env.COHERE_API_KEY) {
      this.upsertEnvKey("cohere", process.env.COHERE_API_KEY, "COHERE_API_KEY", true);
    }
    for (let i = 1; i <= 5; i++) {
      const k = process.env[`COHERE_API_KEY_${i}`];
      if (k) this.upsertEnvKey("cohere", k, `COHERE_API_KEY_${i}`, true);
    }

    // 6. Hugging Face
    if (process.env.HF_API_KEY) {
      this.upsertEnvKey("huggingface", process.env.HF_API_KEY, "HF_API_KEY", true);
    }
    if (process.env.HUGGINGFACE_API_KEY) {
      this.upsertEnvKey("huggingface", process.env.HUGGINGFACE_API_KEY, "HUGGINGFACE_API_KEY", true);
    }
    for (let i = 1; i <= 5; i++) {
      const k = process.env[`HF_API_KEY_${i}`];
      if (k) this.upsertEnvKey("huggingface", k, `HF_API_KEY_${i}`, true);
    }

    // 7. Cloudflare Workers AI
    if (process.env.CLOUDFLARE_API_KEY) {
      this.upsertEnvKey("cloudflare", process.env.CLOUDFLARE_API_KEY, "CLOUDFLARE_API_KEY", true);
    }
    if (process.env.CLOUDFLARE_API_TOKEN) {
      this.upsertEnvKey("cloudflare", process.env.CLOUDFLARE_API_TOKEN, "CLOUDFLARE_API_TOKEN", true);
    }
    for (let i = 1; i <= 5; i++) {
      const k = process.env[`CLOUDFLARE_API_KEY_${i}`];
      if (k) this.upsertEnvKey("cloudflare", k, `CLOUDFLARE_API_KEY_${i}`, true);
    }
    if (process.env.CLOUDFLARE_ACCOUNT_ID) {
      const cf = this.providers.get("cloudflare");
      if (cf) cf.accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    }

    // 8. Custom AI Endpoint
    if (process.env.CUSTOM_AI_ENDPOINT) {
      const custom = this.providers.get("custom");
      if (custom) {
        custom.customEndpoint = process.env.CUSTOM_AI_ENDPOINT;
      }
    }
    if (process.env.CUSTOM_AI_KEY) {
      this.upsertEnvKey("custom", process.env.CUSTOM_AI_KEY, "CUSTOM_AI_KEY", true);
    }
  }

  private upsertEnvKey(
    providerId: string,
    rawKey: string,
    envVarName: string,
    defaultEnabled = true
  ) {
    if (!rawKey || !rawKey.trim()) return;
    const cleanKey = rawKey.trim();
    const provider = this.providers.get(providerId);
    if (!provider) return;

    if (!provider.apiKeys) provider.apiKeys = [];

    const existing = provider.apiKeys.find(
      (k) => k.key === cleanKey || k.envVarName === envVarName
    );

    if (!existing) {
      const nextIdx = provider.apiKeys.length + 1;
      provider.apiKeys.push({
        id: `${providerId}-key-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: `Key ${nextIdx} (${envVarName})`,
        key: cleanKey,
        enabled: defaultEnabled,
        envVarName,
        status: defaultEnabled ? "active" : "disabled",
      });
      if (defaultEnabled) {
        provider.enabled = true;
      }
    }
  }

  /**
   * Persist user-configured settings (provider status, key toggles, priorities, modes)
   */
  public saveSettings(): boolean {
    try {
      const serializedProviders: Record<string, any> = {};

      for (const [id, p] of this.providers.entries()) {
        serializedProviders[id] = {
          enabled: p.enabled,
          priority: p.priority,
          selectedModel: p.selectedModel,
          selectedKeyId: p.selectedKeyId,
          customEndpoint: p.customEndpoint,
          accountId: p.accountId,
          billingMode: p.billingMode,
          keys: p.apiKeys.map((k) => ({
            id: k.id,
            name: k.name,
            key: k.envVarName ? "" : k.key, // Environment keys are loaded dynamically from process.env, never stored on disk
            enabled: k.enabled,
            envVarName: k.envVarName,
            status: k.status,
          })),
        };
      }

      const payload = {
        config: this.config,
        providers: serializedProviders,
        savedAt: new Date().toISOString(),
      };

      fs.writeFileSync(this.settingsFilePath, JSON.stringify(payload, null, 2), "utf-8");
      return true;
    } catch (err) {
      console.warn("Could not save AI settings to disk:", err);
      return false;
    }
  }

  /**
   * Restore settings from disk if available
   */
  public loadSavedSettings(): boolean {
    try {
      if (!fs.existsSync(this.settingsFilePath)) return false;
      const raw = fs.readFileSync(this.settingsFilePath, "utf-8");
      const parsed = JSON.parse(raw);

      if (parsed.config) {
        this.config = { ...this.config, ...parsed.config };
      }

      if (parsed.providers) {
        for (const [id, savedP] of Object.entries<any>(parsed.providers)) {
          const p = this.providers.get(id);
          if (p) {
            if (savedP.enabled !== undefined) p.enabled = savedP.enabled;
            if (savedP.priority !== undefined) p.priority = savedP.priority;
            if (savedP.selectedModel !== undefined) p.selectedModel = savedP.selectedModel;
            if (savedP.selectedKeyId !== undefined) p.selectedKeyId = savedP.selectedKeyId;
            if (savedP.customEndpoint !== undefined) p.customEndpoint = savedP.customEndpoint;
            if (savedP.accountId !== undefined) p.accountId = savedP.accountId;
            if (savedP.billingMode !== undefined) p.billingMode = savedP.billingMode;

            // Merge keys, preserving user ON/OFF states
            if (Array.isArray(savedP.keys)) {
              for (const sKey of savedP.keys) {
                const existingKey = p.apiKeys.find(
                  (k) => k.id === sKey.id || (k.key && k.key === sKey.key)
                );
                if (existingKey) {
                  existingKey.enabled = Boolean(sKey.enabled);
                  if (sKey.name) existingKey.name = sKey.name;
                  if (sKey.status) existingKey.status = sKey.status;
                } else if (sKey.key) {
                  p.apiKeys.push({
                    id: sKey.id || `${id}-key-${Date.now()}`,
                    name: sKey.name || `Key ${p.apiKeys.length + 1}`,
                    key: sKey.key,
                    enabled: Boolean(sKey.enabled),
                    envVarName: sKey.envVarName,
                    status: sKey.status || (sKey.enabled ? "active" : "disabled"),
                  });
                }
              }
            }
          }
        }
      }
      return true;
    } catch (err) {
      console.warn("Could not load AI settings from disk:", err);
      return false;
    }
  }

  // --- Central Execution Engine ---

  /**
   * Central AI Request Execution with strict ON/OFF enforcement,
   * capability matching, free-only cost guardrails, and automated fallback.
   */
  public async execute(request: AIRequest): Promise<AIResponse> {
    const overallStartTime = Date.now();
    const fallbackChain: FallbackStep[] = [];
    const requiredCapabilities = request.capabilities || ["text", "math"];

    // 1. Determine candidate providers according to mode and ON/OFF switch
    let candidateProviders: ProviderConfig[] = [];

    if (this.config.mode === "manual") {
      const activePId = this.config.activeProviderId || "gemini";
      const manualProvider = this.providers.get(activePId);

      // CRITICAL: Check if manual provider is enabled
      if (manualProvider && manualProvider.enabled) {
        candidateProviders.push(manualProvider);
      } else {
        throw new Error(
          `Selected provider '${manualProvider?.name || activePId}' is currently turned OFF. Please turn it ON in AI Settings or switch to Automatic mode.`
        );
      }

      // If fallback is explicitly enabled even in manual mode, append other ENABLED providers
      if (this.config.enableFallback) {
        const others = Array.from(this.providers.values())
          .filter((p) => p.enabled && p.id !== activePId)
          .sort((a, b) => a.priority - b.priority);
        candidateProviders.push(...others);
      }
    } else {
      // Automatic Mode: Candidate providers are ALL providers that are explicitly turned ON, sorted by priority
      candidateProviders = Array.from(this.providers.values())
        .filter((p) => p.enabled)
        .sort((a, b) => a.priority - b.priority);
    }

    if (candidateProviders.length === 0) {
      throw new Error(
        "All enabled AI providers are currently unavailable. Please turn ON at least one provider and active API key in AI Settings."
      );
    }

    let hadFreeEligibleProvider = false;

    // 2. Iterate through candidate providers in priority sequence
    for (const provider of candidateProviders) {
      // Provider MUST be enabled (strictly checked)
      if (!provider.enabled) continue;

      const adapter = this.adapters.get(provider.id);
      if (!adapter) continue;

      // Filter available API keys:
      // KEY MUST BE EXPLICITLY ENABLED (key.enabled === true) AND NOT KNOWN INVALID
      const activeKeys = (provider.apiKeys || []).filter(
        (k) => k.enabled && !this.invalidKeys.has(k.key)
      );

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
      if (this.config.mode === "manual" && provider.id === this.config.activeProviderId && this.config.activeModel) {
        modelToUse = this.config.activeModel;
      }

      let modelInfo = provider.availableModels.find((m) => m.id === modelToUse);

      // Check Cost Guardrail: Free-Only Mode
      const isFreeOnly = this.config.freeOnlyMode || this.config.billingMode === "free_only" || provider.billingMode === "free_only";
      if (isFreeOnly) {
        if (modelInfo && !modelInfo.isFree) {
          // Attempt model fallback to a free model for this provider if enabled
          if (this.config.enableModelFallback) {
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

      // Capability matching check (e.g. math for LaTeX equations)
      const missingCapability = requiredCapabilities.find(
        (cap) => !adapter.supportsCapability(cap, modelToUse)
      );

      if (missingCapability) {
        if (this.config.enableModelFallback) {
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

      // Reorder keys starting from round-robin cursor for active keys
      // (If manual mode specifies activeKeyId and it is in activeKeys, prioritize that key)
      let orderedKeys: ApiKeyItem[] = [...activeKeys];
      if (
        this.config.mode === "manual" &&
        this.config.activeProviderId === provider.id &&
        this.config.activeKeyId
      ) {
        const specific = activeKeys.find((k) => k.id === this.config.activeKeyId);
        if (specific) {
          orderedKeys = [specific, ...activeKeys.filter((k) => k.id !== specific.id)];
        }
      } else {
        const cursor = this.keyCursors.get(provider.id) || 0;
        orderedKeys = [
          ...activeKeys.slice(cursor % activeKeys.length),
          ...activeKeys.slice(0, cursor % activeKeys.length),
        ];
      }

      // 3. Try each enabled API key for this provider
      for (let keyIdx = 0; keyIdx < orderedKeys.length; keyIdx++) {
        const keyItem = orderedKeys[keyIdx];
        const apiKey = keyItem.key;
        const masked = maskApiKey(apiKey);

        let attempt = 0;
        const maxRetries = Math.max(1, provider.maxRetries || 2);
        let keyFailed = false;

        while (attempt < maxRetries) {
          attempt++;
          const callStart = Date.now();

          try {
            this.updateStats(provider.id, (s) => {
              s.requestCount++;
            });

            const result = await adapter.generate(
              { ...request, model: modelToUse },
              apiKey,
              modelToUse,
              {
                timeoutMs: provider.timeoutMs || this.config.defaultTimeoutMs,
                customEndpoint: provider.customEndpoint,
                temperature: request.temperature,
                maxTokens: request.maxTokens,
              }
            );

            const latency = Date.now() - callStart;

            // SUCCESS!
            keyItem.status = "active";
            keyItem.lastTestedAt = Date.now();
            keyItem.lastTestLatencyMs = latency;
            keyItem.lastError = undefined;

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

            this.updateStats(provider.id, (s) => {
              s.successCount++;
              s.lastSuccessAt = Date.now();
              s.estimatedInputTokens += result.inputTokens || 0;
              s.estimatedOutputTokens += result.outputTokens || 0;
              s.averageLatencyMs =
                s.averageLatencyMs === 0
                  ? latency
                  : Math.round(s.averageLatencyMs * 0.8 + latency * 0.2);
            });

            // Advance cursor for round-robin balancing
            this.keyCursors.set(
              provider.id,
              (keyIdx + 1) % activeKeys.length
            );

            this.recordLogEntry({
              id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              timestamp: Date.now(),
              requestSummary: request.prompt.slice(0, 80).replace(/\n/g, " "),
              finalProvider: provider.name,
              finalModel: modelToUse,
              hopsCount: fallbackChain.length,
              totalLatencyMs: Date.now() - overallStartTime,
              success: true,
              chain: fallbackChain,
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

            this.updateStats(provider.id, (s) => {
              s.failureCount++;
              s.lastErrorAt = Date.now();
              s.lastErrorMessage = norm.message;
              if (norm.kind === "rate_limit") {
                s.rateLimitCount++;
              }
            });

            keyItem.lastError = norm.message;

            // 401 Invalid Key: mark invalid and immediately stop retrying this key
            if (norm.kind === "invalid_key") {
              this.invalidKeys.add(apiKey);
              keyItem.status = "invalid";

              fallbackChain.push({
                providerId: provider.id,
                providerName: provider.name,
                keyMasked: masked,
                keyName: keyItem.name,
                model: modelToUse,
                status: "invalid_key",
                errorMessage: norm.message,
                latencyMs: latency,
                timestamp: Date.now(),
              });
              keyFailed = true;
              break; // Skip to next key
            }

            // 429 Rate limit: mark status and rotate to next key
            if (norm.kind === "rate_limit") {
              keyItem.status = "rate_limited";
              fallbackChain.push({
                providerId: provider.id,
                providerName: provider.name,
                keyMasked: masked,
                keyName: keyItem.name,
                model: modelToUse,
                status: "rate_limited",
                errorMessage: norm.message,
                latencyMs: latency,
                timestamp: Date.now(),
              });
              keyFailed = true;
              break; // Try next key
            }

            // Server error / timeout
            fallbackChain.push({
              providerId: provider.id,
              providerName: provider.name,
              keyMasked: masked,
              keyName: keyItem.name,
              model: modelToUse,
              status: (norm.kind as any) || "server_error",
              errorMessage: norm.message,
              latencyMs: latency,
              timestamp: Date.now(),
            });

            if (!norm.retryable || attempt >= maxRetries) {
              keyFailed = true;
              break;
            }
          }
        } // while attempt
      } // for keyIdx

      // In manual mode without fallback, stop after the chosen provider
      if (this.config.mode === "manual" && !this.config.enableFallback) {
        break;
      }
    } // for candidateProviders

    // All active configurations failed
    const isFreeOnlyActive = this.config.freeOnlyMode || this.config.billingMode === "free_only";
    const errorMessage = (isFreeOnlyActive && !hadFreeEligibleProvider)
      ? "All configured AI providers failed. All enabled free AI providers are currently unavailable."
      : "All configured AI providers failed. All enabled AI providers are currently unavailable.";

    this.recordLogEntry({
      id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      requestSummary: request.prompt.slice(0, 80).replace(/\n/g, " "),
      finalProvider: "None (All Failed)",
      finalModel: "None",
      hopsCount: fallbackChain.length,
      totalLatencyMs: Date.now() - overallStartTime,
      success: false,
      chain: fallbackChain,
    });

    const error = new Error(errorMessage);
    (error as any).fallbackChain = fallbackChain;
    throw error;
  }

  private updateStats(providerId: string, updater: (s: ProviderStats) => void) {
    let s = this.stats.get(providerId);
    if (!s) {
      s = {
        providerId,
        providerName: this.providers.get(providerId)?.name || providerId,
        requestCount: 0,
        successCount: 0,
        failureCount: 0,
        rateLimitCount: 0,
        estimatedInputTokens: 0,
        estimatedOutputTokens: 0,
        averageLatencyMs: 0,
      };
      this.stats.set(providerId, s);
    }
    updater(s);
  }

  private recordLogEntry(entry: FallbackLogEntry) {
    this.recentLogs.unshift(entry);
    if (this.recentLogs.length > this.maxLogEntries) {
      this.recentLogs.pop();
    }
  }

  // --- API & UI Configuration Methods ---

  public getManagerConfig(): ManagerConfig {
    return { ...this.config };
  }

  public updateManagerConfig(updates: Partial<ManagerConfig>) {
    this.config = { ...this.config, ...updates };
    this.saveSettings();
  }

  public getClientProviders(): ClientProviderConfig[] {
    const list = Array.from(this.providers.values()).sort(
      (a, b) => a.priority - b.priority
    );

    return list.map((p) => {
      const stats = this.stats.get(p.id);
      const clientKeys: ClientApiKeyItem[] = (p.apiKeys || []).map((k) => ({
        id: k.id,
        name: k.name,
        maskedKey: maskApiKey(k.key),
        enabled: k.enabled,
        envVarName: k.envVarName,
        status: !p.enabled
          ? "disabled"
          : !k.enabled
          ? "disabled"
          : this.invalidKeys.has(k.key)
          ? "invalid"
          : k.status || "active",
        lastTestedAt: k.lastTestedAt,
        lastTestLatencyMs: k.lastTestLatencyMs,
        lastError: k.lastError,
      }));

      const activeKeyCount = clientKeys.filter((k) => k.enabled).length;

      let status: ClientProviderConfig["status"] = "offline";
      if (!p.enabled) {
        status = "offline";
      } else if (p.apiKeys.length === 0 || activeKeyCount === 0) {
        status = "offline";
      } else if (activeKeyCount === 0) {
        status = "invalid_key";
      } else if (
        stats &&
        stats.rateLimitCount > 0 &&
        stats.lastErrorAt &&
        Date.now() - stats.lastErrorAt < 60000
      ) {
        status = "rate_limited";
      } else if (stats && stats.failureCount > stats.successCount && stats.failureCount > 2) {
        status = "degraded";
      } else {
        status = "active";
      }

      return {
        id: p.id,
        name: p.name,
        enabled: p.enabled,
        priority: p.priority,
        apiKeys: clientKeys,
        keyCount: p.apiKeys.length,
        activeKeyCount,
        selectedModel: p.selectedModel,
        selectedKeyId: p.selectedKeyId,
        availableModels: p.availableModels,
        maxRetries: p.maxRetries,
        timeoutMs: p.timeoutMs,
        customEndpoint: p.customEndpoint,
        accountId: p.accountId,
        billingMode: p.billingMode,
        freeTier: p.freeTier,
        notes: p.notes,
        status,
        lastError: stats?.lastErrorMessage,
      };
    });
  }

  public updateProvider(providerId: string, updates: Partial<ProviderConfig>) {
    const p = this.providers.get(providerId);
    if (!p) throw new Error(`Provider '${providerId}' not found.`);

    if (updates.enabled !== undefined) p.enabled = updates.enabled;
    if (updates.priority !== undefined) p.priority = updates.priority;
    if (updates.selectedModel !== undefined) p.selectedModel = updates.selectedModel;
    if (updates.selectedKeyId !== undefined) p.selectedKeyId = updates.selectedKeyId;
    if (updates.maxRetries !== undefined) p.maxRetries = updates.maxRetries;
    if (updates.timeoutMs !== undefined) p.timeoutMs = updates.timeoutMs;
    if (updates.customEndpoint !== undefined) p.customEndpoint = updates.customEndpoint;
    if (updates.accountId !== undefined) p.accountId = updates.accountId;
    if (updates.billingMode !== undefined) p.billingMode = updates.billingMode;
    if (updates.notes !== undefined) p.notes = updates.notes;
    if (updates.availableModels !== undefined) p.availableModels = updates.availableModels;

    this.saveSettings();
  }

  /**
   * Adds a new API key.
   * By default, a newly added key is enabled = true so it is immediately active,
   * while allowing callers to pass initialEnabled = false if desired.
   */
  public addApiKey(
    providerId: string,
    rawKey: string,
    keyName?: string,
    initialEnabled = true
  ): { keyId: string; masked: string; enabled: boolean } {
    if (!rawKey || !rawKey.trim()) {
      throw new Error("API key cannot be empty.");
    }
    const p = this.providers.get(providerId);
    if (!p) throw new Error(`Provider '${providerId}' not found.`);

    const clean = rawKey.trim();
    if (!p.apiKeys) p.apiKeys = [];

    const existing = p.apiKeys.find((k) => k.key === clean);
    if (existing) {
      if (initialEnabled !== undefined) {
        existing.enabled = initialEnabled;
        existing.status = initialEnabled ? "active" : "disabled";
      }
      return {
        keyId: existing.id,
        masked: maskApiKey(clean),
        enabled: existing.enabled,
      };
    }

    const keyId = `${providerId}-key-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const name = keyName?.trim() || `Key ${p.apiKeys.length + 1}`;

    const newKeyItem: ApiKeyItem = {
      id: keyId,
      name,
      key: clean,
      enabled: initialEnabled,
      status: initialEnabled ? "active" : "disabled",
    };

    p.apiKeys.push(newKeyItem);
    if (initialEnabled) {
      p.enabled = true;
    }
    this.invalidKeys.delete(clean);
    this.saveSettings();

    return {
      keyId,
      masked: maskApiKey(clean),
      enabled: newKeyItem.enabled,
    };
  }

  /**
   * Toggle individual key ON / OFF
   */
  public toggleApiKey(providerId: string, keyId: string, enabled: boolean) {
    const p = this.providers.get(providerId);
    if (!p) throw new Error(`Provider '${providerId}' not found.`);
    const keyItem = p.apiKeys.find((k) => k.id === keyId);
    if (!keyItem) throw new Error(`Key '${keyId}' not found for provider '${providerId}'.`);

    keyItem.enabled = enabled;
    if (enabled && this.invalidKeys.has(keyItem.key)) {
      this.invalidKeys.delete(keyItem.key);
    }
    keyItem.status = enabled ? "active" : "disabled";
    this.saveSettings();
  }

  /**
   * Remove an individual API key
   */
  public removeApiKey(providerId: string, keyId: string) {
    const p = this.providers.get(providerId);
    if (!p || !p.apiKeys) throw new Error(`Provider '${providerId}' not found.`);
    const idx = p.apiKeys.findIndex((k) => k.id === keyId);
    if (idx === -1) throw new Error(`Key '${keyId}' not found.`);

    const removed = p.apiKeys.splice(idx, 1)[0];
    this.invalidKeys.delete(removed.key);
    if (p.selectedKeyId === keyId) {
      p.selectedKeyId = p.apiKeys[0]?.id;
    }
    this.saveSettings();
  }

  public reorderProviders(orderedIds: string[]) {
    orderedIds.forEach((id, index) => {
      const p = this.providers.get(id);
      if (p) {
        p.priority = index + 1;
      }
    });
    this.saveSettings();
  }

  /**
   * Test a provider key / model combination
   */
  public async testProvider(
    providerId: string,
    keyId?: string,
    model?: string
  ): Promise<TestResult> {
    const p = this.providers.get(providerId);
    if (!p) throw new Error(`Provider '${providerId}' not found.`);
    const adapter = this.adapters.get(providerId);
    if (!adapter) throw new Error(`Adapter for '${providerId}' not found.`);

    let targetKeyItem: ApiKeyItem | undefined;
    if (keyId) {
      targetKeyItem = p.apiKeys.find((k) => k.id === keyId);
    } else if (p.selectedKeyId) {
      targetKeyItem = p.apiKeys.find((k) => k.id === p.selectedKeyId);
    } else if (p.apiKeys && p.apiKeys.length > 0) {
      targetKeyItem = p.apiKeys.find((k) => k.enabled) || p.apiKeys[0];
    }

    if (!targetKeyItem || !targetKeyItem.key) {
      return {
        success: false,
        providerId,
        providerName: p.name,
        model: model || p.selectedModel,
        keyId,
        latencyMs: 0,
        errorMessage: "No API key configured to test with.",
        errorKind: "invalid_key",
      };
    }

    const testRes = await adapter.testConnection(
      targetKeyItem.key,
      model || p.selectedModel,
      p.customEndpoint,
      p.timeoutMs || 15000
    );

    testRes.keyId = targetKeyItem.id;
    testRes.keyName = targetKeyItem.name;

    if (testRes.success) {
      this.invalidKeys.delete(targetKeyItem.key);
      targetKeyItem.status = "active";
      targetKeyItem.lastTestedAt = Date.now();
      targetKeyItem.lastTestLatencyMs = testRes.latencyMs;
      targetKeyItem.lastError = undefined;
    } else {
      targetKeyItem.lastTestedAt = Date.now();
      targetKeyItem.lastError = testRes.errorMessage;
      if (testRes.errorKind === "invalid_key") {
        this.invalidKeys.add(targetKeyItem.key);
        targetKeyItem.status = "invalid";
      } else if (testRes.errorKind === "rate_limit") {
        targetKeyItem.status = "rate_limited";
      }
    }

    return testRes;
  }

  public async testAllProviders(): Promise<Record<string, TestResult>> {
    const results: Record<string, TestResult> = {};
    const enabledProviders = Array.from(this.providers.values()).filter(
      (p) => p.enabled && p.apiKeys && p.apiKeys.some((k) => k.enabled)
    );

    await Promise.all(
      enabledProviders.map(async (p) => {
        results[p.id] = await this.testProvider(p.id);
      })
    );

    return results;
  }

  public getStats(): ProviderStats[] {
    return Array.from(this.stats.values());
  }

  public getRecentLogs(): FallbackLogEntry[] {
    return this.recentLogs;
  }

  /**
   * Restore safe defaults
   */
  public resetToDefaults() {
    this.config = { ...DEFAULT_MANAGER_CONFIG };
    this.initializeProviders();
    this.loadKeysFromEnvironment();
    this.invalidKeys.clear();
    try {
      if (fs.existsSync(this.settingsFilePath)) {
        fs.unlinkSync(this.settingsFilePath);
      }
    } catch {
      // ignore
    }
  }
}

// Global Singleton instance for server runtime
export const aiRequestManager = new AIRequestManager();
