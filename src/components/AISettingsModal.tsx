import React, { useState, useEffect, useRef } from "react";
import {
  ClientProviderConfig,
  ClientApiKeyItem,
  ManagerConfig,
  ProviderStats,
  FallbackLogEntry,
  TestResult,
  ModelInfo,
  UserApiKeyItem,
  UserProviderConfig,
} from "../types/ai";
import {
  getUserSettings,
  saveUserSettings,
  getUserProviders,
  saveUserProviders,
  toClientProviders,
  getUserStats,
  getUserLogs,
  resetAllUserData,
  maskApiKey,
} from "../utils/userLocalStorage";
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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { getProviderHelp, ProviderHelpConfig } from "../data/providerHelp";
import { GetFreeApiKeyModal } from "./GetFreeApiKeyModal";

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

  // Tab Slide Bar & Scroll Controls
  const tabBarRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkTabBarScroll = () => {
    const el = tabBarRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 6);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 6);
  };

  const handleSlideTabBar = (direction: "left" | "right") => {
    const el = tabBarRef.current;
    if (!el) return;
    const distance = direction === "left" ? -200 : 200;
    el.scrollBy({ left: distance, behavior: "smooth" });
    setTimeout(checkTabBarScroll, 350);
  };

  const handleSelectTab = (tab: "control" | "fallback" | "stats" | "logs") => {
    setActiveTab(tab);
    setTimeout(() => {
      const btn = document.getElementById(`ai-tab-btn-${tab}`);
      if (btn && tabBarRef.current) {
        btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
      checkTabBarScroll();
    }, 60);
  };

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(checkTabBarScroll, 100);
    const el = tabBarRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkTabBarScroll, { passive: true });
    window.addEventListener("resize", checkTabBarScroll);
    return () => {
      clearTimeout(timer);
      el.removeEventListener("scroll", checkTabBarScroll);
      window.removeEventListener("resize", checkTabBarScroll);
    };
  }, [isOpen]);
  const [config, setConfig] = useState<ManagerConfig | null>(null);
  const [providers, setProviders] = useState<ClientProviderConfig[]>([]);
  const [stats, setStats] = useState<ProviderStats[]>([]);
  const [logs, setLogs] = useState<FallbackLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Free API Key modal state
  const [freeKeyModalProvider, setFreeKeyModalProvider] = useState<ProviderHelpConfig | null>(null);

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
      // 1. Fetch static templates from server
      let templates: ClientProviderConfig[] = [];
      try {
        const cfgRes = await fetch("/api/ai/config");
        if (cfgRes.ok) {
          const data = await cfgRes.json();
          templates = data.providers || [];
        }
      } catch (err) {
        console.warn("Could not fetch server AI templates:", err);
      }

      // 2. Reconcile with current browser's isolated local storage
      const userSettings = getUserSettings();
      const userProvs = getUserProviders(templates);
      const userStats = getUserStats();
      const userLogs = getUserLogs();

      setConfig(userSettings);
      setProviders(toClientProviders(userProvs));
      setStats(userStats);
      setLogs(userLogs);
    } catch (err: any) {
      showStatus("Failed to load AI configuration: " + err.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Update Global Strategy or Active Configuration (strictly local to current browser)
  const handleUpdateConfig = async (updates: Partial<ManagerConfig>) => {
    try {
      const current = getUserSettings();
      const updated = { ...current, ...updates };
      saveUserSettings(updated);
      setConfig(updated);
      onConfigChanged?.();
    } catch (err: any) {
      showStatus(err.message, "error");
    }
  };

  // Update a Provider (toggle provider ON/OFF, change selected model, priority, custom endpoint, accountId)
  const handleUpdateProvider = async (providerId: string, updates: Partial<ClientProviderConfig>) => {
    try {
      const userProvs = getUserProviders();
      const prov = userProvs.find((p) => p.id === providerId);
      if (prov) {
        Object.assign(prov, updates);
        saveUserProviders(userProvs);
        setProviders(toClientProviders(userProvs));
        onConfigChanged?.();
      }
    } catch (err: any) {
      showStatus(err.message, "error");
    }
  };

  // Toggle individual API key ON / OFF
  const handleToggleKey = async (providerId: string, keyId: string, currentEnabled: boolean) => {
    try {
      const userProvs = getUserProviders();
      const prov = userProvs.find((p) => p.id === providerId);
      const keyObj = prov?.apiKeys?.find((k) => k.id === keyId);
      if (keyObj) {
        keyObj.enabled = !currentEnabled;
        saveUserProviders(userProvs);
        setProviders(toClientProviders(userProvs));
        showStatus(`Key ${!currentEnabled ? "Enabled (ON)" : "Disabled (OFF)"}`);
        onConfigChanged?.();
      }
    } catch (err: any) {
      showStatus(err.message, "error");
    }
  };

  // Add an API key (defaults to enabled = false / OFF)
  const handleAddKey = async (providerId: string) => {
    const input = newKeyInputs[providerId];
    if (!input || !input.key.trim()) return;

    try {
      const userProvs = getUserProviders();
      const prov = userProvs.find((p) => p.id === providerId);
      if (!prov) throw new Error("Provider not found");

      const newKeyItem: UserApiKeyItem = {
        id: `key-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: input.name?.trim() || `API Key ${(prov.apiKeys || []).length + 1}`,
        key: input.key.trim(),
        maskedKey: maskApiKey(input.key.trim()),
        enabled: false,
        status: "active",
      };

      if (!prov.apiKeys) prov.apiKeys = [];
      prov.apiKeys.push(newKeyItem);
      if (!prov.selectedKeyId) {
        prov.selectedKeyId = newKeyItem.id;
      }

      saveUserProviders(userProvs);
      setProviders(toClientProviders(userProvs));
      setNewKeyInputs((prev) => ({ ...prev, [providerId]: { key: "", name: "" } }));
      setShowAddKeyFor(null);
      showStatus(`API key added for ${prov.name} (Status: OFF). Turn it ON when ready to use.`);
      onConfigChanged?.();
    } catch (err: any) {
      showStatus(err.message, "error");
    }
  };

  // Remove an API key
  const handleRemoveKey = async (providerId: string, keyId: string) => {
    if (!confirm("Are you sure you want to remove this API key?")) return;
    try {
      const userProvs = getUserProviders();
      const prov = userProvs.find((p) => p.id === providerId);
      if (prov && prov.apiKeys) {
        prov.apiKeys = prov.apiKeys.filter((k) => k.id !== keyId);
        if (prov.selectedKeyId === keyId) {
          prov.selectedKeyId = prov.apiKeys[0]?.id;
        }
        saveUserProviders(userProvs);
        setProviders(toClientProviders(userProvs));
        showStatus("API key deleted.");
        onConfigChanged?.();
      }
    } catch (err: any) {
      showStatus(err.message, "error");
    }
  };

  // Test individual API key + selected model
  const handleTestKey = async (providerId: string, keyId: string, model?: string) => {
    const testId = `${providerId}-${keyId}`;
    setTestingKeyId(testId);
    try {
      const userProvs = getUserProviders();
      const prov = userProvs.find((p) => p.id === providerId);
      const keyObj = prov?.apiKeys?.find((k) => k.id === keyId);
      const rawKey = keyObj?.key;

      const res = await fetch(`/api/ai/providers/${providerId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: rawKey,
          model: model || prov?.selectedModel,
          customEndpoint: prov?.customEndpoint,
          accountId: prov?.accountId,
        }),
      });
      const result: TestResult = await res.json();
      setTestResults((prev) => ({ ...prev, [testId]: result }));

      if (keyObj) {
        keyObj.lastTestedAt = Date.now();
        keyObj.lastTestLatencyMs = result.latencyMs;
        if (result.success) {
          keyObj.status = "active";
          keyObj.lastError = undefined;
        } else {
          keyObj.status = result.errorKind === "rate_limit" ? "rate_limited" : "invalid";
          keyObj.lastError = result.errorMessage;
        }
        saveUserProviders(userProvs);
        setProviders(toClientProviders(userProvs));
      }

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
      const userProvs = getUserProviders();
      const res = await fetch("/api/ai/test-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providers: userProvs }),
      });
      const data = await res.json();
      if (data.results && Array.isArray(data.results)) {
        for (const r of data.results) {
          const prov = userProvs.find((p) => p.id === r.providerId);
          const activeKey = prov?.apiKeys?.find((k) => k.enabled);
          if (activeKey) {
            activeKey.lastTestedAt = Date.now();
            activeKey.lastTestLatencyMs = r.latencyMs;
            if (r.success) {
              activeKey.status = "active";
              activeKey.lastError = undefined;
            } else {
              activeKey.status = r.errorKind === "rate_limit" ? "rate_limited" : "invalid";
              activeKey.lastError = r.errorMessage;
            }
          }
        }
        saveUserProviders(userProvs);
        setProviders(toClientProviders(userProvs));
      }
      showStatus("Tested all active enabled providers. View details below.");
    } catch (err: any) {
      showStatus(err.message, "error");
    } finally {
      setTestingKeyId(null);
    }
  };

  // Move priority up or down
  const handleMovePriority = async (providerId: string, direction: "up" | "down") => {
    const userProvs = getUserProviders();
    const sorted = [...userProvs].sort((a, b) => a.priority - b.priority);
    const index = sorted.findIndex((p) => p.id === providerId);
    if (index === -1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    const temp = sorted[index];
    sorted[index] = sorted[targetIndex];
    sorted[targetIndex] = temp;

    sorted.forEach((p, idx) => {
      p.priority = idx + 1;
    });

    saveUserProviders(sorted);
    setProviders(toClientProviders(sorted));
    onConfigChanged?.();
  };

  // Save Settings explicitly
  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      showStatus("AI Settings saved successfully! Stored locally in your browser.");
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
      resetAllUserData();
      await fetchAIConfig();
      showStatus("AI Settings reset to safe defaults.");
      onConfigChanged?.();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs antialiased">
      <div className="bg-white w-full sm:max-w-7xl h-full sm:h-[88vh] sm:max-h-[92vh] sm:rounded-2xl rounded-none shadow-2xl flex flex-col overflow-hidden border-0 sm:border sm:border-slate-200">
        {/* Modal Header */}
        <div className="shrink-0 px-3 sm:px-6 py-2.5 sm:py-4 border-b border-slate-200 flex items-center justify-between gap-2 bg-slate-50/90">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-lg font-extrabold text-slate-900 flex items-center gap-1.5 sm:gap-2 truncate">
                <span className="hidden sm:inline">Multi-Provider AI Control Panel</span>
                <span className="sm:hidden">AI Control Panel</span>
                <span className="text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 shrink-0">
                  8 Providers
                </span>
              </h2>
              <p className="hidden sm:block text-xs text-slate-500 mt-0.5 truncate">
                Explicit ON/OFF activation, key rotation, priority fallback, and zero-leak secrets management.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isSaving ? "Saving..." : "Save AI Settings"}</span>
              <span className="sm:hidden">{isSaving ? "Saving..." : "Save"}</span>
            </button>
            <button
              onClick={handleResetSettings}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors cursor-pointer"
              title="Reset AI Settings to safe defaults"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Notification Banner */}
        {statusBanner && (
          <div
            className={`shrink-0 px-3 sm:px-6 py-2 sm:py-2.5 text-xs font-medium flex items-center justify-between border-b ${
              statusBanner.type === "error"
                ? "bg-rose-50 text-rose-800 border-rose-200"
                : statusBanner.type === "info"
                ? "bg-sky-50 text-sky-800 border-sky-200"
                : "bg-emerald-50 text-emerald-800 border-emerald-200"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {statusBanner.type === "error" ? (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              )}
              <span className="truncate">{statusBanner.text}</span>
            </div>
            <button
              onClick={() => setStatusBanner(null)}
              className="text-slate-400 hover:text-slate-700 text-xs cursor-pointer ml-2 p-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tabs Navigation with Visible Slide Bar & Controls */}
        <div className="shrink-0 bg-slate-100 border-b-2 border-slate-300 px-2 sm:px-4 py-2 space-y-1.5">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Left Slide Button */}
            <button
              id="slide-ai-tabs-left-btn"
              type="button"
              onClick={() => handleSlideTabBar("left")}
              disabled={!canScrollLeft}
              className={`p-2 rounded-xl border-2 transition-all cursor-pointer shrink-0 flex items-center justify-center ${
                canScrollLeft
                  ? "bg-white text-blue-700 border-blue-400 hover:bg-blue-50 shadow-2xs hover:scale-105 active:scale-95"
                  : "bg-slate-200 text-slate-400 border-slate-300 opacity-40 cursor-not-allowed"
              }`}
              title="Slide Left (বামে স্লাইড করুন)"
              aria-label="Slide Left"
            >
              <ChevronLeft className="w-4 h-4 stroke-[3]" />
            </button>

            {/* Scrollable Container with EXPLICIT Visible Slide Bar (Scrollbar) */}
            <div
              ref={tabBarRef}
              className="flex-1 bg-white p-1 rounded-xl border-2 border-slate-300 flex items-center gap-1.5 overflow-x-auto shadow-inner pb-2.5 [scrollbar-width:auto] [scrollbar-color:#2563eb_#e2e8f0] [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-track]:bg-slate-200 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-blue-600 hover:[&::-webkit-scrollbar-thumb]:bg-blue-700 [&::-webkit-scrollbar-thumb]:rounded-full"
            >
              <button
                id="ai-tab-btn-control"
                onClick={() => handleSelectTab("control")}
                className={`py-1.5 sm:py-2 px-3 sm:px-4 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 text-xs font-semibold ${
                  activeTab === "control"
                    ? "bg-blue-900 text-white shadow-xs font-extrabold border border-blue-950"
                    : "text-slate-700 hover:text-slate-950 hover:bg-slate-100"
                }`}
              >
                <Settings2 className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">AI Control Panel & Keys</span>
                <span className="sm:hidden">Keys & Models</span>
              </button>
              <button
                id="ai-tab-btn-fallback"
                onClick={() => handleSelectTab("fallback")}
                className={`py-1.5 sm:py-2 px-3 sm:px-4 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 text-xs font-semibold ${
                  activeTab === "fallback"
                    ? "bg-indigo-900 text-white shadow-xs font-extrabold border border-indigo-950"
                    : "text-slate-700 hover:text-slate-950 hover:bg-slate-100"
                }`}
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Fallback Strategy & Safety</span>
                <span className="sm:hidden">Fallback</span>
              </button>
              <button
                id="ai-tab-btn-stats"
                onClick={() => handleSelectTab("stats")}
                className={`py-1.5 sm:py-2 px-3 sm:px-4 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 text-xs font-semibold ${
                  activeTab === "stats"
                    ? "bg-emerald-900 text-white shadow-xs font-extrabold border border-emerald-950"
                    : "text-slate-700 hover:text-slate-950 hover:bg-slate-100"
                }`}
              >
                <Activity className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Usage & Health Telemetry</span>
                <span className="sm:hidden">Telemetry</span>
              </button>
              <button
                id="ai-tab-btn-logs"
                onClick={() => handleSelectTab("logs")}
                className={`py-1.5 sm:py-2 px-3 sm:px-4 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 text-xs font-semibold ${
                  activeTab === "logs"
                    ? "bg-purple-900 text-white shadow-xs font-extrabold border border-purple-950"
                    : "text-slate-700 hover:text-slate-950 hover:bg-slate-100"
                }`}
              >
                <ScrollText className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Fallback Audit Logs</span>
                <span className="sm:hidden">Audit Logs</span>
              </button>
            </div>

            {/* Right Slide Button */}
            <button
              id="slide-ai-tabs-right-btn"
              type="button"
              onClick={() => handleSlideTabBar("right")}
              disabled={!canScrollRight}
              className={`p-2 rounded-xl border-2 transition-all cursor-pointer shrink-0 flex items-center justify-center ${
                canScrollRight
                  ? "bg-blue-600 text-white border-blue-700 hover:bg-blue-700 shadow-2xs hover:scale-105 active:scale-95 animate-pulse"
                  : "bg-slate-200 text-slate-400 border-slate-300 opacity-40 cursor-not-allowed"
              }`}
              title="Slide Right to see all options (বাকি অপশন দেখতে ডানে স্লাইড করুন)"
              aria-label="Slide Right"
            >
              <ChevronRight className="w-4 h-4 stroke-[3]" />
            </button>
          </div>

          {/* Slide Bar Helper Guidance */}
          <div className="flex items-center justify-between px-1 text-[11px] font-bold text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
              <span>Slide Bar (স্লাইড বার) ◀ ▶ : মোট ৪টি অপশন রয়েছে</span>
            </div>
            {canScrollRight && (
              <button
                type="button"
                onClick={() => handleSlideTabBar("right")}
                className="text-blue-700 hover:text-blue-900 font-extrabold flex items-center gap-1 cursor-pointer bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-md border border-blue-200 transition-colors"
              >
                <span>বাকি অপশন দেখতে স্লাইড করুন</span>
                <ChevronRight className="w-3.5 h-3.5 stroke-[3]" />
              </button>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6 bg-slate-50/50">
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

              {/* SECTION 2: COMPACT ACTIVE AI CONFIGURATION */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
                <div className="border-b border-slate-100 pb-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-blue-600 shrink-0" />
                    <h3 className="text-xs font-bold tracking-wider text-slate-900 uppercase">
                      Active AI Configuration
                    </h3>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                        currentActiveProvider?.enabled
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-rose-50 text-rose-800 border-rose-200"
                      }`}
                    >
                      {currentActiveProvider?.enabled ? "✓ Active (ON)" : "○ Disabled (OFF)"}
                    </span>
                  </div>

                  {/* Active Provider Chips (wraps on small screens) */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-medium text-slate-500 mr-0.5">Active Providers:</span>
                    {providers.filter((p) => p.enabled).length === 0 ? (
                      <span className="text-[11px] text-amber-700 italic">None active</span>
                    ) : (
                      providers
                        .filter((p) => p.enabled)
                        .map((p) => (
                          <span
                            key={p.id}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-colors ${
                              p.id === (config?.activeProviderId || "gemini")
                                ? "bg-blue-50 text-blue-700 border-blue-300 ring-1 ring-blue-300"
                                : "bg-slate-100 text-slate-700 border-slate-200"
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {p.name.replace("Google ", "").replace(" Workers AI", "")} ON
                          </span>
                        ))
                    )}
                  </div>
                </div>

                {/* 4 Compact Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {/* Provider Dropdown */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
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
                      className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Selected Model:
                    </label>
                    <select
                      value={config?.activeModel || currentActiveProvider?.selectedModel || ""}
                      onChange={(e) => {
                        handleUpdateConfig({ activeModel: e.target.value });
                        handleUpdateProvider(currentActiveProvider.id, { selectedModel: e.target.value });
                      }}
                      className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Active API Key:
                    </label>
                    <select
                      value={config?.activeKeyId || currentProviderKeys[0]?.id || ""}
                      onChange={(e) => handleUpdateConfig({ activeKeyId: e.target.value })}
                      disabled={currentProviderKeys.length === 0}
                      className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
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
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Current Mode:
                    </label>
                    <div className="flex items-center justify-between h-[34px] px-2.5 rounded-lg border border-slate-300 bg-slate-50 text-xs">
                      <span className="font-bold text-slate-800 capitalize">
                        {config?.mode} Mode
                      </span>
                      <button
                        type="button"
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

              {/* SECTION 3: CONFIGURABLE PROVIDER GRID */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Server className="w-4 h-4 text-blue-600" />
                      Configured AI Providers
                    </h3>
                    <p className="text-xs text-slate-500">
                      Explicit ON/OFF switch per provider. Providers are strictly bypassed when turned OFF.
                    </p>
                  </div>
                  <div className="text-xs text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                    <span className="font-bold text-slate-900">
                      {providers.filter((p) => p.enabled).length} of {providers.length}
                    </span>{" "}
                    Providers Active
                  </div>
                </div>

                {/* 4/2/1 Responsive Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {providers.map((p, idx) => {
                    const helpConfig = getProviderHelp(p.id);
                    const activeKeysCount = p.apiKeys.filter((k) => k.enabled).length;

                    return (
                      <div
                        key={p.id}
                        className={`bg-white rounded-xl border flex flex-col justify-between transition-all duration-200 shadow-2xs overflow-hidden ${
                          p.enabled
                            ? "border-blue-200/90 ring-1 ring-blue-100/80"
                            : "border-slate-200 opacity-90"
                        }`}
                      >
                        {/* Provider Header Card */}
                        <div className="p-3.5 bg-slate-50/80 border-b border-slate-200/80 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {/* Priority Badge */}
                              <div className="flex items-center gap-0.5 bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[11px] font-bold text-slate-700 shrink-0 shadow-2xs">
                                <span>#{p.priority}</span>
                                <div className="flex flex-col ml-0.5">
                                  <button
                                    type="button"
                                    onClick={() => handleMovePriority(p.id, "up")}
                                    disabled={idx === 0}
                                    className="text-slate-400 hover:text-blue-600 disabled:opacity-20 cursor-pointer leading-none"
                                    title="Increase Priority"
                                  >
                                    <ArrowUp className="w-2.5 h-2.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMovePriority(p.id, "down")}
                                    disabled={idx === providers.length - 1}
                                    className="text-slate-400 hover:text-blue-600 disabled:opacity-20 cursor-pointer leading-none"
                                    title="Decrease Priority"
                                  >
                                    <ArrowDown className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              </div>
                              <h4 className="text-xs font-bold text-slate-900 truncate" title={p.name}>
                                {p.name}
                              </h4>
                            </div>

                            {/* ON/OFF Switch */}
                            <div
                              onClick={() => handleUpdateProvider(p.id, { enabled: !p.enabled })}
                              className={`w-11 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-colors shrink-0 ${
                                p.enabled ? "bg-blue-600" : "bg-slate-300"
                              }`}
                              title={`Toggle ${p.name} ON/OFF`}
                            >
                              <div
                                className={`bg-white w-5 h-5 rounded-full shadow-xs transform transition-transform flex items-center justify-center text-[8px] font-bold ${
                                  p.enabled ? "translate-x-5 text-blue-600" : "translate-x-0 text-slate-400"
                                }`}
                              >
                                {p.enabled ? "ON" : "OFF"}
                              </div>
                            </div>
                          </div>

                          {/* Status & Free Tier / Get Key Link */}
                          <div className="flex items-center justify-between gap-1 text-[10px]">
                            <span
                              className={`px-1.5 py-0.5 rounded-full font-semibold border truncate ${
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
                                ? "○ Disabled"
                                : p.status === "active"
                                ? "✓ Active"
                                : p.status === "rate_limited"
                                ? "⚠ Rate Limit"
                                : "✕ Invalid Key"}
                            </span>
                            <span className="text-slate-400">
                              {p.apiKeys.length} key{p.apiKeys.length === 1 ? "" : "s"} ({activeKeysCount} ON)
                            </span>
                          </div>

                          {/* Free Key / Manual Config Info Line */}
                          {p.id === "custom" ? (
                            <div className="text-[10px] text-slate-500 bg-white/80 px-2 py-1 rounded border border-slate-200 italic">
                              Custom endpoint — configure manually
                            </div>
                          ) : helpConfig ? (
                            <div className="flex items-center justify-between gap-1 text-[11px] bg-white/90 px-2 py-1 rounded border border-slate-200">
                              <span className="text-[10px] text-emerald-700 font-semibold truncate" title={helpConfig.freeLabel}>
                                {helpConfig.freeLabel}
                              </span>
                              <button
                                type="button"
                                onClick={() => setFreeKeyModalProvider(helpConfig)}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline shrink-0 cursor-pointer"
                              >
                                <span>Get Free API Key</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ) : null}
                        </div>

                        {/* Provider Card Body */}
                        <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
                          <div className="space-y-2.5">
                            {/* Model Selector */}
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                Selected Model:
                              </label>
                              <select
                                value={p.selectedModel}
                                onChange={(e) => handleUpdateProvider(p.id, { selectedModel: e.target.value })}
                                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-md p-1.5 text-slate-800 focus:ring-1 focus:ring-blue-500"
                              >
                                {p.availableModels.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name} {m.isFree ? "[Free]" : "[Paid]"}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Cloudflare Account ID */}
                            {p.id === "cloudflare" && (
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                  Account ID:
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g. 7f3b8..."
                                  value={p.accountId || ""}
                                  onChange={(e) => handleUpdateProvider(p.id, { accountId: e.target.value })}
                                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-md p-1.5 text-slate-800"
                                />
                              </div>
                            )}

                            {/* Custom AI Endpoint */}
                            {p.id === "custom" && (
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                  Custom Endpoint URL:
                                </label>
                                <input
                                  type="text"
                                  placeholder="http://localhost:11434/v1/..."
                                  value={p.customEndpoint || ""}
                                  onChange={(e) => handleUpdateProvider(p.id, { customEndpoint: e.target.value })}
                                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-md p-1.5 text-slate-800 font-mono text-[11px]"
                                />
                              </div>
                            )}
                          </div>

                          {/* API Keys Header and List */}
                          <div className="space-y-2 pt-2 border-t border-slate-100">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                                <Key className="w-3 h-3 text-blue-600" />
                                API Keys ({p.apiKeys.length})
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowAddKeyFor(showAddKeyFor === p.id ? null : p.id)}
                                className="inline-flex items-center gap-0.5 text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                                <span>{showAddKeyFor === p.id ? "Cancel" : "Add Key"}</span>
                              </button>
                            </div>

                            {/* Add key input form */}
                            {showAddKeyFor === p.id && (
                              <div className="p-2.5 bg-blue-50/70 rounded-lg border border-blue-200 space-y-2">
                                <input
                                  type="text"
                                  placeholder="Key Label (e.g. Primary)"
                                  value={newKeyInputs[p.id]?.name || ""}
                                  onChange={(e) =>
                                    setNewKeyInputs((prev) => ({
                                      ...prev,
                                      [p.id]: { ...(prev[p.id] || { key: "", name: "" }), name: e.target.value },
                                    }))
                                  }
                                  className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 text-slate-800"
                                />
                                <input
                                  type="password"
                                  placeholder="Enter raw secret key..."
                                  value={newKeyInputs[p.id]?.key || ""}
                                  onChange={(e) =>
                                    setNewKeyInputs((prev) => ({
                                      ...prev,
                                      [p.id]: { ...(prev[p.id] || { key: "", name: "" }), key: e.target.value },
                                    }))
                                  }
                                  className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 text-slate-800 font-mono"
                                />
                                <div className="flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => handleAddKey(p.id)}
                                    className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer shadow-2xs"
                                  >
                                    Save Key
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Internal Scrollable API Key List (max-height & overflow-y: auto) */}
                            <div className="max-h-[160px] overflow-y-auto pr-0.5 space-y-1.5">
                              {p.apiKeys.length === 0 ? (
                                <div className="p-2.5 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-center text-[11px] text-slate-500">
                                  No API keys configured.
                                </div>
                              ) : (
                                p.apiKeys.map((k) => {
                                  const testKey = `${p.id}-${k.id}`;
                                  const isTestingThis = testingKeyId === testKey;

                                  return (
                                    <div
                                      key={k.id}
                                      className={`p-2 rounded-lg border flex flex-col gap-1 text-xs transition-colors ${
                                        k.enabled
                                          ? "bg-white border-slate-200 shadow-2xs"
                                          : "bg-slate-50/80 border-slate-200 text-slate-500"
                                      }`}
                                    >
                                      {/* Key info row */}
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="font-bold text-slate-900 truncate max-w-[90px]" title={k.name}>
                                          {k.name}
                                        </span>
                                        <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px] text-slate-700 truncate">
                                          {k.maskedKey}
                                        </code>
                                      </div>

                                      {/* Controls row */}
                                      <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100">
                                        {/* Status & Latency */}
                                        <div className="flex items-center gap-1">
                                          <span
                                            className={`px-1 py-0.2 text-[9px] font-bold rounded border ${
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
                                          {k.lastTestLatencyMs && (
                                            <span className="text-[9px] text-slate-400">
                                              {k.lastTestLatencyMs}ms
                                            </span>
                                          )}
                                        </div>

                                        {/* Actions: ON/OFF, Test, Delete */}
                                        <div className="flex items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() => handleToggleKey(p.id, k.id, k.enabled)}
                                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer border ${
                                              k.enabled
                                                ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300"
                                                : "bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-300"
                                            }`}
                                            title="Toggle key ON/OFF"
                                          >
                                            {k.enabled ? "ON" : "OFF"}
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => handleTestKey(p.id, k.id, p.selectedModel)}
                                            disabled={isTestingThis}
                                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 cursor-pointer disabled:opacity-50 inline-flex items-center gap-0.5"
                                            title="Test key connection"
                                          >
                                            <RefreshCw className={`w-2.5 h-2.5 ${isTestingThis ? "animate-spin text-blue-600" : ""}`} />
                                            <span>{isTestingThis ? "..." : "Test"}</span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => handleRemoveKey(p.id, k.id)}
                                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                            title="Remove key"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
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
        <div className="shrink-0 px-3 sm:px-6 py-2.5 sm:py-3.5 border-t border-slate-200 flex items-center justify-between gap-2 bg-slate-50 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] sm:text-xs min-w-0">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="truncate sm:whitespace-normal">Server-side isolated: Raw API keys protected.</span>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl font-extrabold text-slate-800 bg-white border-2 border-slate-300 hover:bg-slate-100 transition-colors cursor-pointer shadow-2xs text-xs whitespace-nowrap"
          >
            Close
          </button>
        </div>
      </div>

      {/* Get Free API Key Modal */}
      <GetFreeApiKeyModal
        isOpen={!!freeKeyModalProvider}
        providerHelp={freeKeyModalProvider}
        onClose={() => setFreeKeyModalProvider(null)}
      />
    </div>
  );
};
