import React, { useState, useEffect } from "react";
import {
  ClientProviderConfig,
  ClientApiKeyItem,
  ManagerConfig,
  ProviderStats,
  FallbackLogEntry,
  TestResult,
  ModelInfo,
} from "../types/ai";
import {
  X,
  Sparkles,
  ShieldCheck,
  Zap,
  Key,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowUp,
  ArrowDown,
  Activity,
  ScrollText,
  HelpCircle,
  Check,
  AlertTriangle,
  Server,
  Layers,
  Settings2,
  SlidersHorizontal,
  Save,
  RotateCcw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChanged?: () => void;
}

export const AISettingsModal: React.FC<AISettingsModalProps> = ({
  isOpen,
  onClose,
  onConfigChanged,
}) => {
  const [activeTab, setActiveTab] = useState<"control" | "fallback" | "stats" | "logs">("control");
  const [config, setConfig] = useState<ManagerConfig | null>(null);
  const [providers, setProviders] = useState<ClientProviderConfig[]>([]);
  const [stats, setStats] = useState<ProviderStats[]>([]);
  const [logs, setLogs] = useState<FallbackLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Key testing state
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  // Adding key state per provider
  const [newKeyInputs, setNewKeyInputs] = useState<Record<string, { key: string; name: string }>>({});
  const [showAddKeyFor, setShowAddKeyFor] = useState<string | null>(null);

  // Notifications
  const [statusBanner, setStatusBanner] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchAIConfig();
    }
  }, [isOpen]);

  const showStatus = (text: string, type: "success" | "error" | "info" = "success") => {
    setStatusBanner({ text, type });
    setTimeout(() => {
      setStatusBanner(null);
    }, 5000);
  };

  const fetchAIConfig = async () => {
    setIsLoading(true);
    try {
      const [cfgRes, statsRes, logsRes] = await Promise.all([
        fetch("/api/ai/config"),
        fetch("/api/ai/stats"),
        fetch("/api/ai/logs"),
      ]);

      if (cfgRes.ok) {
        const data = await cfgRes.json();
        setConfig(data.config);
        setProviders(data.providers);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats || []);
      }
      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data.logs || []);
      }
    } catch (err: any) {
      showStatus("Failed to load AI configuration: " + err.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Update Global Strategy or Active Configuration
  const handleUpdateConfig = async (updates: Partial<ManagerConfig>) => {
    try {
      const res = await fetch("/api/ai/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update AI settings");
      const data = await res.json();
      setConfig(data.config);
      if (data.providers) setProviders(data.providers);
      onConfigChanged?.();
    } catch (err: any) {
      showStatus(err.message, "error");
    }
  };

  // Update a Provider (toggle provider ON/OFF, change selected model, priority, custom endpoint, accountId)
  const handleUpdateProvider = async (providerId: string, updates: Partial<ClientProviderConfig>) => {
    try {
      const res = await fetch(`/api/ai/providers/${providerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update provider");
      const data = await res.json();
      setProviders(data.providers);
      if (data.config) setConfig(data.config);
      onConfigChanged?.();
    } catch (err: any) {
      showStatus(err.message, "error");
    }
  };

  // Toggle individual API key ON / OFF
  const handleToggleKey = async (providerId: string, keyId: string, currentEnabled: boolean) => {
    try {
      const res = await fetch(`/api/ai/providers/${providerId}/keys/${keyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !currentEnabled }),
      });
      if (!res.ok) throw new Error("Failed to toggle API key");
      const data = await res.json();
      setProviders(data.providers);
      showStatus(`Key ${!currentEnabled ? "Enabled (ON)" : "Disabled (OFF)"}`);
      onConfigChanged?.();
    } catch (err: any) {
      showStatus(err.message, "error");
    }
  };

  // Add an API key (defaults to enabled = false / OFF)
  const handleAddKey = async (providerId: string) => {
    const input = newKeyInputs[providerId];
    if (!input || !input.key.trim()) return;

    try {
      const res = await fetch(`/api/ai/providers/${providerId}/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: input.key.trim(), name: input.name?.trim() }),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to add API key");
      }
      const data = await res.json();
      setProviders(data.providers);
      setNewKeyInputs((prev) => ({ ...prev, [providerId]: { key: "", name: "" } }));
      setShowAddKeyFor(null);
      showStatus(`API key added for ${providerId} (Status: OFF). Turn it ON when ready to use.`);
      onConfigChanged?.();
    } catch (err: any) {
      showStatus(err.message, "error");
    }
  };

  // Remove an API key
  const handleRemoveKey = async (providerId: string, keyId: string) => {
    if (!confirm("Are you sure you want to remove this API key?")) return;
    try {
      const res = await fetch(`/api/ai/providers/${providerId}/keys/${keyId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove key");
      const data = await res.json();
      setProviders(data.providers);
      showStatus("API key deleted.");
      onConfigChanged?.();
    } catch (err: any) {
      showStatus(err.message, "error");
    }
  };

  // Test individual API key + selected model
  const handleTestKey = async (providerId: string, keyId: string, model?: string) => {
    const testId = `${providerId}-${keyId}`;
    setTestingKeyId(testId);
    try {
      const res = await fetch(`/api/ai/providers/${providerId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId, model }),
      });
      const result: TestResult = await res.json();
      setTestResults((prev) => ({ ...prev, [testId]: result }));

      if (result.success) {
        showStatus(
          `✓ Connection successful: ${result.providerName} (${result.model}) • Response: ${result.latencyMs}ms`
        );
      } else {
        showStatus(
          `✕ Connection failed for ${result.providerName}: ${result.errorMessage || "Unknown error"}`,
          "error"
        );
      }

      // Refresh to update key status
      const cfgRes = await fetch("/api/ai/config");
      if (cfgRes.ok) {
        const data = await cfgRes.json();
        setProviders(data.providers);
      }
    } catch (err: any) {
      showStatus(err.message, "error");
    } finally {
      setTestingKeyId(null);
    }
  };

  // Test all active providers
  const handleTestAll = async () => {
    setTestingKeyId("all");
    try {
      const res = await fetch("/api/ai/test-all", { method: "POST" });
      const data = await res.json();
      showStatus("Tested all active enabled providers. View details below.");
      fetchAIConfig();
    } catch (err: any) {
      showStatus(err.message, "error");
    } finally {
      setTestingKeyId(null);
    }
  };

  // Move priority up or down
  const handleMovePriority = async (providerId: string, direction: "up" | "down") => {
    const sorted = [...providers].sort((a, b) => a.priority - b.priority);
    const index = sorted.findIndex((p) => p.id === providerId);
    if (index === -1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    // Swap
    const temp = sorted[index];
    sorted[index] = sorted[targetIndex];
    sorted[targetIndex] = temp;

    const newOrder = sorted.map((p) => p.id);
    try {
      const res = await fetch("/api/ai/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: newOrder }),
      });
      if (!res.ok) throw new Error("Failed to reorder");
      const data = await res.json();
      setProviders(data.providers);
      onConfigChanged?.();
    } catch (err: any) {
      showStatus(err.message, "error");
    }
  };

  // Save Settings explicitly
  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/ai/save", { method: "POST" });
      const data = await res.json();
      showStatus("AI Settings saved successfully! Preferences will persist across sessions.");
      onConfigChanged?.();
    } catch (err: any) {
      showStatus(err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to Defaults
  const handleResetSettings = async () => {
    if (
      !confirm(
        "Reset AI Settings to safe defaults? (Gemini remains primary; other providers and newly added keys will be turned OFF; Free-Only mode = ON)."
      )
    ) {
      return;
    }
    try {
      const res = await fetch("/api/ai/reset", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setProviders(data.providers);
        showStatus("AI Settings reset to safe defaults.");
        onConfigChanged?.();
      }
    } catch (err: any) {
      showStatus(err.message, "error");
    }
  };

  if (!isOpen) return null;

  // Compute active provider and available models/keys for Active AI section
  const currentActiveProvider = providers.find(
    (p) => p.id === (config?.activeProviderId || "gemini")
  ) || providers[0];

  const currentAvailableModels = currentActiveProvider?.availableModels || [];
  const currentProviderKeys = currentActiveProvider?.apiKeys || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs antialiased">
      <div className="bg-white w-full max-w-5xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Multi-Provider AI Control Panel
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                  8 Providers
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Explicit ON/OFF activation, key rotation, priority fallback, and zero-leak secrets management.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? "Saving..." : "Save AI Settings"}</span>
            </button>
            <button
              onClick={handleResetSettings}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors cursor-pointer"
              title="Reset AI Settings to safe defaults"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Notification Banner */}
        {statusBanner && (
          <div
            className={`px-6 py-2.5 text-xs font-medium flex items-center justify-between border-b ${
              statusBanner.type === "error"
                ? "bg-rose-50 text-rose-800 border-rose-200"
                : statusBanner.type === "info"
                ? "bg-sky-50 text-sky-800 border-sky-200"
                : "bg-emerald-50 text-emerald-800 border-emerald-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {statusBanner.type === "error" ? (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              )}
              <span>{statusBanner.text}</span>
            </div>
            <button
              onClick={() => setStatusBanner(null)}
              className="text-slate-400 hover:text-slate-700 text-xs cursor-pointer ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tabs Navigation */}
        <div className="flex border-b border-slate-200 px-6 bg-white gap-2 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab("control")}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === "control"
                ? "border-blue-600 text-blue-600 font-bold"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Settings2 className="w-4 h-4" />
            <span>AI Control Panel & Keys</span>
          </button>
          <button
            onClick={() => setActiveTab("fallback")}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === "fallback"
                ? "border-blue-600 text-blue-600 font-bold"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Fallback Strategy & Safety</span>
          </button>
          <button
            onClick={() => setActiveTab("stats")}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === "stats"
                ? "border-blue-600 text-blue-600 font-bold"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Usage & Health Telemetry</span>
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === "logs"
                ? "border-blue-600 text-blue-600 font-bold"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <ScrollText className="w-4 h-4" />
            <span>Fallback Audit Logs</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-sm font-medium text-slate-600">Loading AI Configurations...</p>
            </div>
          ) : activeTab === "control" ? (
            <>
              {/* SECTION 1: GLOBAL AI MODE & SAFETY TOGGLES */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" />
                      Global AI Mode & Cost Guardrails
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Configure how requests are scheduled across providers and enforce zero accidental spend.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleTestAll}
                      disabled={testingKeyId === "all"}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors cursor-pointer border border-slate-200"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${testingKeyId === "all" ? "animate-spin text-blue-600" : ""}`} />
                      <span>Test All Active</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Mode Selector */}
                  <div className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/70 flex flex-col justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-900 block mb-1">Execution Mode</span>
                      <p className="text-[11px] text-slate-500 mb-3">
                        Automatic prioritizes the fallback chain; Manual locks requests to your chosen active configuration.
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                        <input
                          type="radio"
                          name="global_mode"
                          checked={config?.mode === "automatic"}
                          onChange={() => handleUpdateConfig({ mode: "automatic" })}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span>Automatic</span>
                      </label>
                      <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                        <input
                          type="radio"
                          name="global_mode"
                          checked={config?.mode === "manual"}
                          onChange={() => handleUpdateConfig({ mode: "manual" })}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span>Manual</span>
                      </label>
                    </div>
                  </div>

                  {/* Fallback Checkbox */}
                  <div className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/70 flex flex-col justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-900 block mb-1">Automatic Fallback</span>
                      <p className="text-[11px] text-slate-500 mb-3">
                        Automatically step down to secondary providers on rate-limits (429), timeouts, or server outages.
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(config?.enableFallback)}
                        onChange={(e) => handleUpdateConfig({ enableFallback: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                      <span>Enable Automatic Fallback</span>
                    </label>
                  </div>

                  {/* Free-Only / Billing Mode */}
                  <div className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/70 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-900">Billing Mode</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                          Zero Spend Guard
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mb-3">
                        Restricts requests strictly to free models & free tiers. Never switches to paid endpoints.
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-800 cursor-pointer">
                        <input
                          type="radio"
                          name="billing_mode"
                          checked={config?.freeOnlyMode || config?.billingMode === "free_only"}
                          onChange={() => handleUpdateConfig({ freeOnlyMode: true, billingMode: "free_only" })}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>Free Only</span>
                      </label>
                      <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-800 cursor-pointer">
                        <input
                          type="radio"
                          name="billing_mode"
                          checked={!config?.freeOnlyMode && config?.billingMode === "free_and_paid"}
                          onChange={() => handleUpdateConfig({ freeOnlyMode: false, billingMode: "free_and_paid" })}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>Free + Paid</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: ACTIVE AI CONFIGURATION */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                      ACTIVE AI CONFIGURATION
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      The primary configuration used for standard requests. In Manual mode, only this configuration is used.
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
                      currentActiveProvider?.enabled
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-rose-50 text-rose-800 border-rose-200"
                    }`}
                  >
                    Provider Status: {currentActiveProvider?.enabled ? "✓ Active (ON)" : "○ Disabled (OFF)"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Provider Dropdown */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Active Provider:
                    </label>
                    <select
                      value={config?.activeProviderId || "gemini"}
                      onChange={(e) => {
                        const newPId = e.target.value;
                        const targetP = providers.find((p) => p.id === newPId);
                        handleUpdateConfig({
                          activeProviderId: newPId,
                          activeModel: targetP?.selectedModel || "",
                          activeKeyId: targetP?.apiKeys?.[0]?.id,
                        });
                      }}
                      className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {providers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.enabled ? "(ON)" : "(OFF)"}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Model Dropdown */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Selected Model:
                    </label>
                    <select
                      value={config?.activeModel || currentActiveProvider?.selectedModel || ""}
                      onChange={(e) => {
                        handleUpdateConfig({ activeModel: e.target.value });
                        handleUpdateProvider(currentActiveProvider.id, { selectedModel: e.target.value });
                      }}
                      className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {currentAvailableModels.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} {m.isFree ? "(Free)" : "(Paid)"}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* API Key Dropdown */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Active API Key:
                    </label>
                    <select
                      value={config?.activeKeyId || currentProviderKeys[0]?.id || ""}
                      onChange={(e) => handleUpdateConfig({ activeKeyId: e.target.value })}
                      disabled={currentProviderKeys.length === 0}
                      className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                    >
                      {currentProviderKeys.length === 0 ? (
                        <option value="">No Keys Configured</option>
                      ) : (
                        currentProviderKeys.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.name} ({k.maskedKey}) {k.enabled ? "[ON]" : "[OFF]"}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {/* Mode Display & Toggle */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Current Mode:
                    </label>
                    <div className="flex items-center justify-between h-[42px] px-3 rounded-lg border border-slate-300 bg-slate-50">
                      <span className="text-xs font-bold text-slate-800 capitalize">
                        {config?.mode} Mode
                      </span>
                      <button
                        onClick={() =>
                          handleUpdateConfig({
                            mode: config?.mode === "automatic" ? "manual" : "automatic",
                          })
                        }
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer underline"
                      >
                        Switch to {config?.mode === "automatic" ? "Manual" : "Auto"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: PROVIDERS LIST (ON/OFF, Individual Keys, Model Dropdown, Priority) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Server className="w-4 h-4 text-blue-600" />
                      CONFIGURED PROVIDERS
                    </h3>
                    <p className="text-xs text-slate-500">
                      A provider and its keys are strictly skipped unless explicitly turned ON.
                    </p>
                  </div>
                  <div className="text-xs text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                    <span className="font-bold text-slate-900">
                      {providers.filter((p) => p.enabled).length} of {providers.length}
                    </span>{" "}
                    Providers Active
                  </div>
                </div>

                <div className="space-y-4">
                  {providers.map((p, idx) => {
                    const isExpanded = true; // Always clear and open as requested
                    const activeKeysCount = p.apiKeys.filter((k) => k.enabled).length;

                    return (
                      <div
                        key={p.id}
                        className={`bg-white rounded-xl border transition-all duration-200 overflow-hidden shadow-2xs ${
                          p.enabled ? "border-blue-200/90 ring-1 ring-blue-100" : "border-slate-200 opacity-90"
                        }`}
                      >
                        {/* Provider Header Bar */}
                        <div className="p-4 bg-slate-50/70 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            {/* Priority Badge with Up/Down buttons */}
                            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-slate-200 text-xs font-bold text-slate-700 shadow-2xs">
                              <span>#{p.priority}</span>
                              <div className="flex flex-col ml-1">
                                <button
                                  onClick={() => handleMovePriority(p.id, "up")}
                                  disabled={idx === 0}
                                  className="text-slate-400 hover:text-blue-600 disabled:opacity-20 cursor-pointer leading-none"
                                  title="Increase Priority"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleMovePriority(p.id, "down")}
                                  disabled={idx === providers.length - 1}
                                  className="text-slate-400 hover:text-blue-600 disabled:opacity-20 cursor-pointer leading-none"
                                  title="Decrease Priority"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold text-slate-900">{p.name}</h4>
                                {/* Provider Status Badge */}
                                <span
                                  className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${
                                    !p.enabled
                                      ? "bg-slate-100 text-slate-600 border-slate-200"
                                      : p.status === "active"
                                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                      : p.status === "rate_limited"
                                      ? "bg-amber-50 text-amber-800 border-amber-200"
                                      : "bg-rose-50 text-rose-800 border-rose-200"
                                  }`}
                                >
                                  {!p.enabled
                                    ? "○ Disabled (OFF)"
                                    : p.status === "active"
                                    ? "✓ Active"
                                    : p.status === "rate_limited"
                                    ? "⚠ Rate Limited"
                                    : "✕ Invalid Key / Offline"}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {p.apiKeys.length} configured key{p.apiKeys.length === 1 ? "" : "s"} • {activeKeysCount} active (ON)
                              </p>
                            </div>
                          </div>

                          {/* Provider ON / OFF Switch */}
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <span className="text-xs font-bold text-slate-700">Provider Switch:</span>
                              <div
                                onClick={() => handleUpdateProvider(p.id, { enabled: !p.enabled })}
                                className={`w-14 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                                  p.enabled ? "bg-blue-600" : "bg-slate-300"
                                }`}
                              >
                                <div
                                  className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform flex items-center justify-center text-[9px] font-bold ${
                                    p.enabled ? "translate-x-7 text-blue-600" : "translate-x-0 text-slate-400"
                                  }`}
                                >
                                  {p.enabled ? "ON" : "OFF"}
                                </div>
                              </div>
                            </label>
                          </div>
                        </div>

                        {/* Provider Details & Keys */}
                        <div className="p-4 space-y-4">
                          {/* Model selection & Endpoint row */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50/60 p-3 rounded-lg border border-slate-200/70">
                            {/* Model selection */}
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                Selected Model:
                              </label>
                              <select
                                value={p.selectedModel}
                                onChange={(e) => handleUpdateProvider(p.id, { selectedModel: e.target.value })}
                                className="w-full text-xs bg-white border border-slate-300 rounded-md p-2 text-slate-800 focus:ring-1 focus:ring-blue-500"
                              >
                                {p.availableModels.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name} {m.isFree ? "[Free]" : "[Paid]"}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Cloudflare Account ID or Custom Endpoint */}
                            {p.id === "cloudflare" && (
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                  Cloudflare Account ID:
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g. 7f3b8..."
                                  value={p.accountId || ""}
                                  onChange={(e) => handleUpdateProvider(p.id, { accountId: e.target.value })}
                                  className="w-full text-xs bg-white border border-slate-300 rounded-md p-2 text-slate-800"
                                />
                              </div>
                            )}

                            {p.id === "custom" && (
                              <div className="col-span-2">
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                  Custom Endpoint URL:
                                </label>
                                <input
                                  type="text"
                                  placeholder="http://localhost:11434/v1/chat/completions"
                                  value={p.customEndpoint || ""}
                                  onChange={(e) => handleUpdateProvider(p.id, { customEndpoint: e.target.value })}
                                  className="w-full text-xs bg-white border border-slate-300 rounded-md p-2 text-slate-800"
                                />
                              </div>
                            )}

                            {/* Free Tier Info */}
                            {p.freeTier && (
                              <div className="text-[11px] text-slate-500 flex flex-col justify-center">
                                <span className="font-semibold text-slate-700">Free Tier Allowance:</span>
                                <span>{p.freeTier.notes || "Generous free limits without credit card."}</span>
                              </div>
                            )}
                          </div>

                          {/* Individual API Keys Management */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <Key className="w-3.5 h-3.5 text-blue-600" />
                                API Keys ({p.apiKeys.length}):
                              </span>
                              <button
                                onClick={() => setShowAddKeyFor(showAddKeyFor === p.id ? null : p.id)}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>{showAddKeyFor === p.id ? "Cancel" : "Add Key"}</span>
                              </button>
                            </div>

                            {/* Add key input form */}
                            {showAddKeyFor === p.id && (
                              <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-200 space-y-2">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  <input
                                    type="text"
                                    placeholder="Key Label (e.g. Personal Key 2)"
                                    value={newKeyInputs[p.id]?.name || ""}
                                    onChange={(e) =>
                                      setNewKeyInputs((prev) => ({
                                        ...prev,
                                        [p.id]: { ...(prev[p.id] || { key: "", name: "" }), name: e.target.value },
                                      }))
                                    }
                                    className="text-xs bg-white border border-slate-300 rounded-md p-2 text-slate-800"
                                  />
                                  <input
                                    type="password"
                                    placeholder="Enter raw API key secret..."
                                    value={newKeyInputs[p.id]?.key || ""}
                                    onChange={(e) =>
                                      setNewKeyInputs((prev) => ({
                                        ...prev,
                                        [p.id]: { ...(prev[p.id] || { key: "", name: "" }), key: e.target.value },
                                      }))
                                    }
                                    className="sm:col-span-2 text-xs bg-white border border-slate-300 rounded-md p-2 text-slate-800 font-mono"
                                  />
                                </div>
                                <div className="flex justify-between items-center text-[11px] text-slate-500">
                                  <span>Added keys default to <strong>OFF</strong> for safety.</span>
                                  <button
                                    onClick={() => handleAddKey(p.id)}
                                    className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer shadow-2xs"
                                  >
                                    Save Key to Provider
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Key Rows */}
                            {p.apiKeys.length === 0 ? (
                              <div className="p-3 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-center text-xs text-slate-500">
                                No API keys configured for {p.name}. Click "Add Key" above to add one.
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                {p.apiKeys.map((k) => {
                                  const testKey = `${p.id}-${k.id}`;
                                  const lastTest = testResults[testKey];
                                  const isTestingThis = testingKeyId === testKey;

                                  return (
                                    <div
                                      key={k.id}
                                      className={`p-2.5 rounded-lg border flex flex-wrap items-center justify-between gap-3 text-xs ${
                                        k.enabled
                                          ? "bg-white border-slate-200/90 shadow-2xs"
                                          : "bg-slate-50/80 border-slate-200 text-slate-500"
                                      }`}
                                    >
                                      {/* Key info */}
                                      <div className="flex items-center gap-3">
                                        <span className="font-bold text-slate-900 min-w-[70px]">
                                          {k.name}
                                        </span>
                                        <code className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[11px] text-slate-700">
                                          {k.maskedKey}
                                        </code>
                                        {/* Status badge */}
                                        <span
                                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                            !k.enabled
                                              ? "bg-slate-100 text-slate-500 border-slate-200"
                                              : k.status === "active"
                                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                              : k.status === "rate_limited"
                                              ? "bg-amber-50 text-amber-800 border-amber-200"
                                              : "bg-rose-50 text-rose-700 border-rose-200"
                                          }`}
                                        >
                                          {!k.enabled ? "OFF" : k.status === "active" ? "Active" : k.status || "Ready"}
                                        </span>
                                        {/* Latency if available */}
                                        {k.lastTestLatencyMs && (
                                          <span className="text-[10px] text-slate-400">
                                            {k.lastTestLatencyMs}ms
                                          </span>
                                        )}
                                      </div>

                                      {/* Controls: ON/OFF toggle, Test, Delete */}
                                      <div className="flex items-center gap-2">
                                        {/* Individual Key ON / OFF toggle */}
                                        <button
                                          onClick={() => handleToggleKey(p.id, k.id, k.enabled)}
                                          className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer border ${
                                            k.enabled
                                              ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300"
                                              : "bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-300"
                                          }`}
                                        >
                                          {k.enabled ? "[ ON ]" : "[ OFF ]"}
                                        </button>

                                        {/* Test Button */}
                                        <button
                                          onClick={() => handleTestKey(p.id, k.id, p.selectedModel)}
                                          disabled={isTestingThis}
                                          className="px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                                        >
                                          <RefreshCw className={`w-3 h-3 ${isTestingThis ? "animate-spin text-blue-600" : ""}`} />
                                          <span>{isTestingThis ? "Testing..." : "Test"}</span>
                                        </button>

                                        {/* Delete Button */}
                                        <button
                                          onClick={() => handleRemoveKey(p.id, k.id)}
                                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                          title="Remove this key"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : activeTab === "fallback" ? (
            /* TAB 2: FALLBACK RULES & STRATEGY */
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Fallback Engine & Routing Rules
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  How the Central AI Request Manager automatically routes requests and protects against disruptions.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Automatic Fallback Triggers
                  </h4>
                  <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                    <li><strong>HTTP 429 & Rate Limit:</strong> Rotates to next active key, then falls back to next enabled provider.</li>
                    <li><strong>Provider Outages (500/502/503):</strong> Instantly fails over to the next priority provider.</li>
                    <li><strong>Request Timeouts:</strong> Configured timeout (default 45s) interrupts hung queries and transfers execution.</li>
                    <li><strong>Context Limits:</strong> If a note exceeds window, falls back to a larger context model automatically.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Non-Retryable Errors (Fast Failover)
                  </h4>
                  <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                    <li><strong>HTTP 401 Invalid Key:</strong> Permanently marks the individual key as invalid and immediately skips further retries.</li>
                    <li><strong>HTTP 403 Forbidden:</strong> Immediately steps to secondary provider without wasteful repeated attempts.</li>
                    <li><strong>Disabled Providers/Keys:</strong> OFF providers and OFF keys are never called.</li>
                  </ul>
                </div>
              </div>

              {/* Advanced Strategy Options */}
              <div className="border-t border-slate-200 pt-5 space-y-4">
                <h4 className="text-xs font-bold text-slate-900">Advanced Fallback Controls</h4>
                <div className="space-y-3">
                  <label className="flex items-center gap-2.5 text-xs text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(config?.enableModelFallback)}
                      onChange={(e) => handleUpdateConfig({ enableModelFallback: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <div>
                      <span className="font-semibold block">Intra-Provider Model Fallback</span>
                      <span className="text-slate-500 text-[11px]">
                        Try larger or alternative models within the same provider before hopping to another provider.
                      </span>
                    </div>
                  </label>

                  <div className="flex items-center gap-3 pt-2">
                    <label className="text-xs font-bold text-slate-700">Default Request Timeout:</label>
                    <select
                      value={config?.defaultTimeoutMs || 45000}
                      onChange={(e) => handleUpdateConfig({ defaultTimeoutMs: Number(e.target.value) })}
                      className="text-xs bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-800"
                    >
                      <option value={20000}>20 Seconds (Fast Fail)</option>
                      <option value={35000}>35 Seconds (Balanced)</option>
                      <option value={45000}>45 Seconds (Standard for Long Notes)</option>
                      <option value={60000}>60 Seconds (Maximum Patience)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === "stats" ? (
            /* TAB 3: USAGE & TELEMETRY */
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-600" />
                    Provider Telemetry & Health Metrics
                  </h3>
                  <p className="text-xs text-slate-500">Live operational metrics recorded by the Central AI Request Manager.</p>
                </div>
                <button
                  onClick={fetchAIConfig}
                  className="px-2.5 py-1 text-xs font-semibold rounded-md border border-slate-300 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Refresh</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">Provider</th>
                      <th className="p-3">Requests</th>
                      <th className="p-3">Success Rate</th>
                      <th className="p-3">429 Caught</th>
                      <th className="p-3">Avg Latency</th>
                      <th className="p-3">Est. Tokens</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {stats.map((s) => {
                      const successRate = s.requestCount > 0 ? Math.round((s.successCount / s.requestCount) * 100) : 100;
                      return (
                        <tr key={s.providerId} className="hover:bg-slate-50/50">
                          <td className="p-3 font-bold text-slate-900">{s.providerName}</td>
                          <td className="p-3">{s.requestCount}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded font-semibold ${successRate >= 90 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
                              {successRate}%
                            </span>
                          </td>
                          <td className="p-3">{s.rateLimitCount}</td>
                          <td className="p-3 font-mono">{s.averageLatencyMs || 0} ms</td>
                          <td className="p-3 text-slate-500">{((s.estimatedInputTokens + s.estimatedOutputTokens) / 1000).toFixed(1)}k</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* TAB 4: AUDIT LOGS */
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <ScrollText className="w-4 h-4 text-blue-600" />
                    AI Execution & Failover Audit Logs
                  </h3>
                  <p className="text-xs text-slate-500">
                    Detailed step-by-step trace of key rotations and provider hops for recent note conversion requests.
                  </p>
                </div>
                <button
                  onClick={fetchAIConfig}
                  className="px-2.5 py-1 text-xs font-semibold rounded-md border border-slate-300 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Refresh</span>
                </button>
              </div>

              {logs.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-400 border border-dashed border-slate-300 rounded-xl">
                  No fallback logs recorded yet. Convert a note to generate fallback traces.
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div key={log.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">
                          {log.finalProvider} ({log.finalModel})
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.success ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                            {log.success ? "SUCCESS" : "FAILED"}
                          </span>
                          <span className="text-slate-400 font-mono text-[11px]">{log.totalLatencyMs}ms</span>
                        </div>
                      </div>

                      {/* Hop Trace */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {log.chain.map((step, idx) => (
                          <React.Fragment key={idx}>
                            <div className={`px-2 py-1 rounded text-[11px] border font-medium ${
                              step.status === "success"
                                ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                                : step.status === "rate_limited"
                                ? "bg-amber-50 text-amber-900 border-amber-200"
                                : "bg-rose-50 text-rose-900 border-rose-200"
                            }`}>
                              <span>{step.providerName}</span>
                              <span className="opacity-70 ml-1">({step.keyName || step.keyMasked})</span>
                              <span className="ml-1 font-bold uppercase text-[9px]">[{step.status}]</span>
                            </div>
                            {idx < log.chain.length - 1 && <span className="text-slate-400 font-bold">→</span>}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 flex items-center justify-between bg-slate-50 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Server-side isolated: Raw API keys are never returned to client source.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors cursor-pointer shadow-2xs"
          >
            Close Control Panel
          </button>
        </div>
      </div>
    </div>
  );
};
