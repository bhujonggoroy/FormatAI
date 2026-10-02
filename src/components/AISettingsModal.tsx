import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ClientProviderConfig,
  ManagerConfig,
  ProviderStats,
  FallbackLogEntry,
  TestResult,
  ModelInfo,
  UserApiKeyItem,
} from "../types/ai";
import {
  getUserSettings,
  saveUserSettings,
  getUserProviders,
  saveUserProviders,
  healAndNormalizeProviders,
  toClientProviders,
  getUserStats,
  saveUserStats,
  getUserLogs,
  clearUserLogs,
  recordProviderMetric,
  recordAuditLogEntry,
  DEFAULT_PROVIDER_STATS,
  resetAllUserData,
  maskApiKey,
  setCachedProviderModels,
  invalidateProviderModelCache,
} from "../utils/userLocalStorage";
import { isModelSelectable, canonicalProviderId, getCatalogModels } from "../shared/centralModelCatalog";
import { getActiveModels } from "../config/modelRegistry";
import { getCachedModelTestReport } from "../services/UniversalModelTester";
import {
  X,
  Sparkles,
  ShieldCheck,
  Key,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Activity,
  ScrollText,
  HelpCircle,
  AlertTriangle,
  Server,
  SlidersHorizontal,
  Save,
  RotateCcw,
  ExternalLink,
  Eye,
  EyeOff,
  ChevronDown,
  Inbox,
  Check,
} from "lucide-react";
import { getProviderHelp, ProviderHelpConfig } from "../data/providerHelp";
import { GetFreeApiKeyModal } from "./GetFreeApiKeyModal";
import { AIBrandLogo } from "./AIBrandLogo";
import { StatusSignalGuide } from "./StatusSignalGuide";
import { classifyAuditLogEntry } from "../utils/aiStatusClassifier";
import { UniversalModelTesterPanel } from "./UniversalModelTesterPanel";

type TabId = "providers" | "settings" | "usage" | "logs";

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChanged?: () => void;
  initialTab?: "control" | "fallback" | "stats" | "logs" | "providers" | "settings" | "usage";
}

const TAB_INDEX_MAP: Record<TabId, number> = {
  providers: 0,
  settings: 1,
  usage: 2,
  logs: 3,
};

const TABS: Array<{ id: TabId; label: string; icon: React.FC<{ className?: string }> }> = [
  { id: "providers", label: "Providers", icon: Server },
  { id: "settings", label: "Settings", icon: SlidersHorizontal },
  { id: "usage", label: "Usage", icon: Activity },
  { id: "logs", label: "Logs", icon: ScrollText },
];

export const AISettingsModal: React.FC<AISettingsModalProps> = ({
  isOpen,
  onClose,
  onConfigChanged,
  initialTab,
}) => {
  // Remember last opened tab with localStorage and fallback to initialTab or "providers"
  const [activeTab, setActiveTabState] = useState<TabId>(() => {
    if (initialTab) {
      if (initialTab === "control") return "providers";
      if (initialTab === "fallback") return "settings";
      if (initialTab === "stats") return "usage";
      if (["providers", "settings", "usage", "logs"].includes(initialTab)) {
        return initialTab as TabId;
      }
    }
    try {
      const saved = localStorage.getItem("formatai:last_ai_tab");
      if (saved && ["providers", "settings", "usage", "logs"].includes(saved)) {
        return saved as TabId;
      }
    } catch {}
    return "providers";
  });

  const setActiveTab = (tab: TabId) => {
    setActiveTabState(tab);
    try {
      localStorage.setItem("formatai:last_ai_tab", tab);
    } catch {}
  };

  const modalRef = useRef<HTMLDivElement>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen && initialTab) {
      if (initialTab === "control") setActiveTab("providers");
      else if (initialTab === "fallback") setActiveTab("settings");
      else if (initialTab === "stats") setActiveTab("usage");
      else if (["providers", "settings", "usage", "logs"].includes(initialTab)) {
        setActiveTab(initialTab as TabId);
      }
    }
  }, [isOpen, initialTab]);

  // Close on Escape & trap focus
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const [config, setConfig] = useState<ManagerConfig | null>(null);
  const [providers, setProviders] = useState<ClientProviderConfig[]>([]);
  const [stats, setStats] = useState<ProviderStats[]>([]);
  const [logs, setLogs] = useState<FallbackLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Expanded Provider accordion (only one open at a time)
  const [expandedProviderId, setExpandedProviderId] = useState<string | null>(null);

  // Quick Add Drawer / Modal at the top of Providers list
  const [showQuickAddDrawer, setShowQuickAddDrawer] = useState<boolean>(false);

  // Free API Key modal state
  const [freeKeyModalProvider, setFreeKeyModalProvider] = useState<ProviderHelpConfig | null>(null);

  // Key testing state
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null);
  const [refreshingProviderId, setRefreshingProviderId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  // Adding key state per provider
  const [newKeyInputs, setNewKeyInputs] = useState<Record<string, { key: string; name: string }>>({});
  const [showAddKeyFor, setShowAddKeyFor] = useState<string | null>(null);
  const [revealedKeyIds, setRevealedKeyIds] = useState<Record<string, boolean>>({});

  // Dedicated Quick Add AI API Key state
  const [quickAddProviderId, setQuickAddProviderId] = useState<string>("gemini");
  const [quickAddKeyLabel, setQuickAddKeyLabel] = useState<string>("");
  const [quickAddKeySecret, setQuickAddKeySecret] = useState<string>("");
  const [quickAddCustomEndpoint, setQuickAddCustomEndpoint] = useState<string>("");
  const [quickAddAccountId, setQuickAddAccountId] = useState<string>("");
  const [showQuickAddSecret, setShowQuickAddSecret] = useState<boolean>(false);
  const [isSubmittingQuickKey, setIsSubmittingQuickKey] = useState<boolean>(false);

  // Collapsible Status Signal Guide (collapsed by default)
  const [showStatusGuide, setShowStatusGuide] = useState<boolean>(false);

  // Sleek floating toast notification (non-blocking)
  const [toast, setToast] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchAIConfig();
    }
  }, [isOpen]);

  const showToast = (text: string, type: "success" | "error" | "info" = "success") => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ text, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  const fetchAIConfig = async () => {
    setIsLoading(true);
    try {
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

      const userSettings = getUserSettings();
      let userProvs = getUserProviders(templates);
      if (!userProvs || userProvs.length === 0) {
        userProvs = healAndNormalizeProviders([], templates);
        saveUserProviders(userProvs);
      }
      const userStats = getUserStats();
      const userLogs = getUserLogs();

      setConfig(userSettings);
      setProviders(toClientProviders(userProvs));
      setStats(userStats);
      setLogs(userLogs);
    } catch (err: any) {
      showToast("Failed to load AI configuration: " + err.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateConfig = async (updates: Partial<ManagerConfig>) => {
    try {
      const current = getUserSettings();
      const updated = { ...current, ...updates };
      saveUserSettings(updated);
      setConfig(updated);
      onConfigChanged?.();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

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
      showToast(err.message, "error");
    }
  };

  const handleToggleKey = async (providerId: string, keyId: string, currentEnabled: boolean) => {
    try {
      const userProvs = getUserProviders();
      const prov = userProvs.find((p) => p.id === providerId);
      const keyObj = prov?.apiKeys?.find((k) => k.id === keyId);
      if (keyObj) {
        keyObj.enabled = !currentEnabled;
        saveUserProviders(userProvs);
        setProviders(toClientProviders(userProvs));
        showToast(`Key ${!currentEnabled ? "enabled (ON)" : "disabled (OFF)"}`);
        onConfigChanged?.();
      }
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

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
      showToast(`Key added for ${prov.name} (OFF). Turn ON to use.`);
      onConfigChanged?.();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleQuickAddAPIKey = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const rawSecret = quickAddKeySecret.trim();
    if (!rawSecret && quickAddProviderId !== "custom") {
      showToast(`Please enter an API key for ${quickAddProviderId.toUpperCase()}`, "error");
      return;
    }

    setIsSubmittingQuickKey(true);
    try {
      const userProvs = getUserProviders();
      let prov = userProvs.find((p) => p.id === quickAddProviderId);
      if (!prov) {
        const healed = healAndNormalizeProviders(userProvs);
        prov = healed.find((p) => p.id === quickAddProviderId);
      }

      if (!prov) {
        throw new Error("Provider not found: " + quickAddProviderId);
      }

      const newKeyId = `key-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const keyName =
        quickAddKeyLabel.trim() ||
        `${prov.name} Key ${(prov.apiKeys || []).length + 1}`;

      const newKeyItem: UserApiKeyItem = {
        id: newKeyId,
        name: keyName,
        key: rawSecret,
        maskedKey: maskApiKey(rawSecret),
        enabled: true,
        status: "active",
      };

      if (!prov.apiKeys) prov.apiKeys = [];
      prov.apiKeys.push(newKeyItem);
      prov.enabled = true;
      prov.selectedKeyId = newKeyId;

      if (quickAddProviderId === "custom" && quickAddCustomEndpoint.trim()) {
        prov.customEndpoint = quickAddCustomEndpoint.trim();
      }
      if (quickAddProviderId === "cloudflare" && quickAddAccountId.trim()) {
        prov.accountId = quickAddAccountId.trim();
      }

      saveUserProviders(userProvs);
      setProviders(toClientProviders(userProvs));
      setQuickAddKeySecret("");
      setQuickAddKeyLabel("");
      setShowQuickAddDrawer(false);
      showToast(`✓ ${prov.name} API key connected & active!`, "success");
      onConfigChanged?.();

      handleTestKey(prov.id, newKeyId, prov.selectedModel);
    } catch (err: any) {
      showToast("Failed to add API key: " + err.message, "error");
    } finally {
      setIsSubmittingQuickKey(false);
    }
  };

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
        showToast("API key removed.");
        onConfigChanged?.();
      }
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleRefreshModels = async (providerId: string) => {
    setRefreshingProviderId(providerId);
    try {
      const userProvs = getUserProviders();
      const prov = userProvs.find((p) => p.id === providerId);
      const keyObj = prov?.apiKeys?.find((k) => k.enabled && k.key) || prov?.apiKeys?.[0];

      const res = await fetch("/api/ai/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId,
          apiKey: keyObj?.key,
          customEndpoint: prov?.customEndpoint,
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.models) && data.models.length > 0) {
        setCachedProviderModels(providerId, data.models);
        if (prov) {
          prov.availableModels = data.models;
          if (!data.models.some((m: ModelInfo) => m.id === prov.selectedModel)) {
            prov.selectedModel = data.models[0].id;
          }
          saveUserProviders(userProvs);
          setProviders(toClientProviders(userProvs));
        }
        showToast(`✓ Refreshed ${data.models.length} models for ${prov?.name || providerId}`);
      } else {
        showToast(data.error || `Could not refresh models for ${prov?.name || providerId}`, "error");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to refresh models", "error");
    } finally {
      setRefreshingProviderId(null);
    }
  };

  const handleTestKey = async (providerId: string, keyId: string, model?: string) => {
    const testId = `${providerId}-${keyId}`;
    setTestingKeyId(testId);
    try {
      const userProvs = getUserProviders();
      const prov = userProvs.find((p) => p.id === providerId);
      const keyObj = prov?.apiKeys?.find((k) => k.id === keyId);
      const rawKey = keyObj?.key;
      const targetModel = model || prov?.selectedModel;

      const res = await fetch(`/api/ai/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId,
          keyId,
          apiKey: rawKey,
          modelId: targetModel,
          model: targetModel,
          customEndpoint: prov?.customEndpoint,
          accountId: prov?.accountId,
        }),
      });
      const result: TestResult = await res.json();
      setTestResults((prev) => ({ ...prev, [testId]: result }));

      if (keyObj) {
        keyObj.lastTestedAt = Date.now();
        keyObj.lastTestLatencyMs = result.latencyMs;
        keyObj.lastTestedModel = result.model || targetModel;
        keyObj.lastErrorCode = result.errorCode;
        if (result.success) {
          keyObj.status = "active";
          keyObj.lastError = undefined;
        } else if (result.errorCode === "MODEL_UNAVAILABLE" || result.errorKind === "model_unavailable") {
          keyObj.status = "model_unavailable";
          keyObj.lastError = result.userFacingMessage || result.errorMessage;
          invalidateProviderModelCache(providerId);
        } else if (result.errorCode === "RATE_LIMIT" || result.errorKind === "rate_limit") {
          keyObj.status = "rate_limited";
          keyObj.lastError = result.userFacingMessage || result.errorMessage;
        } else {
          keyObj.status = "invalid";
          keyObj.lastError = result.userFacingMessage || result.errorMessage;
        }
        saveUserProviders(userProvs);
        setProviders(toClientProviders(userProvs));
      }

      recordProviderMetric(
        providerId,
        result.providerName || providerId,
        result.success,
        result.latencyMs || 0,
        result.errorKind === "rate_limit",
        45,
        45,
        result.errorMessage
      );
      recordAuditLogEntry({
        requestSummary: `Key Probe Test: ${result.providerName || providerId} (${result.model || "diagnostic"})`,
        finalProvider: result.providerName || providerId,
        finalModel: result.model || "diagnostic-probe",
        hopsCount: 0,
        totalLatencyMs: result.latencyMs || 0,
        success: result.success,
        chain: [
          {
            providerId: (providerId || "unknown").toLowerCase(),
            providerName: result.providerName || providerId,
            keyMasked: keyObj?.maskedKey || "Configured Key",
            model: result.model || "diagnostic-probe",
            status: result.success ? "success" : result.errorKind === "rate_limit" ? "rate_limited" : "server_error",
            errorMessage: result.errorMessage,
            latencyMs: result.latencyMs || 0,
            timestamp: Date.now(),
          },
        ],
      });
      setStats(getUserStats());
      setLogs(getUserLogs());

      if (result.success) {
        showToast(`✓ Connected to ${result.providerName} (${result.latencyMs}ms)`);
      } else {
        const title = result.errorTitle || (result.errorCode ? `[${result.errorCode}]` : "Connection failed");
        showToast(`${title}: ${result.userFacingMessage || result.errorMessage || "Unknown error"}`, "error");
      }
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setTestingKeyId(null);
    }
  };

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

          recordProviderMetric(
            r.providerId,
            r.providerName || r.providerId,
            r.success,
            r.latencyMs || 0,
            r.errorKind === "rate_limit",
            40,
            40,
            r.errorMessage
          );
          recordAuditLogEntry({
            requestSummary: `Batch Key Probe: ${r.providerName || r.providerId} (${r.model || "diagnostic"})`,
            finalProvider: r.providerName || r.providerId,
            finalModel: r.model || "diagnostic-probe",
            hopsCount: 0,
            totalLatencyMs: r.latencyMs || 0,
            success: r.success,
            chain: [
              {
                providerId: (r.providerId || "unknown").toLowerCase(),
                providerName: r.providerName || r.providerId,
                keyMasked: "Active Key",
                model: r.model || "diagnostic-probe",
                status: r.success ? "success" : r.errorKind === "rate_limit" ? "rate_limited" : "server_error",
                errorMessage: r.errorMessage,
                latencyMs: r.latencyMs || 0,
                timestamp: Date.now(),
              },
            ],
          });
        }
        saveUserProviders(userProvs);
        setProviders(toClientProviders(userProvs));
        setStats(getUserStats());
        setLogs(getUserLogs());
      }
      showToast("Tested all active enabled providers.");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setTestingKeyId(null);
    }
  };

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

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 200));
      showToast("Settings saved", "success");
      onConfigChanged?.();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

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
      showToast("AI Settings reset to safe defaults.");
      onConfigChanged?.();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleResetTelemetry = () => {
    saveUserStats(DEFAULT_PROVIDER_STATS);
    setStats(structuredClone(DEFAULT_PROVIDER_STATS));
    showToast("Telemetry metrics reset to baseline.");
  };

  const handleClearAuditLogs = () => {
    clearUserLogs();
    setLogs([]);
    showToast("Audit logs cleared.");
  };

  const handleSimulateFailoverProbe = () => {
    recordAuditLogEntry({
      requestSummary: "Multi-Hop Failover Diagnostic Simulation",
      finalProvider: "Groq",
      finalModel: "openai/gpt-oss-120b",
      hopsCount: 2,
      totalLatencyMs: 284,
      success: true,
      isSimulation: true,
      chain: [
        {
          providerId: "gemini",
          providerName: "Google Gemini",
          keyMasked: "AIza************cOA8",
          keyName: "Primary Gemini Free Tier",
          model: "gemini-3.8-flash",
          status: "rate_limited",
          errorMessage: "Simulated 429 Quota Exceeded (Resource Exhausted)",
          latencyMs: 95,
          timestamp: Date.now() - 284,
        },
        {
          providerId: "gemini",
          providerName: "Google Gemini",
          keyMasked: "AIza************91B2",
          keyName: "Backup Key 2",
          model: "gemini-3.7-flash",
          status: "server_error",
          errorMessage: "Simulated 503 Model High Load",
          latencyMs: 82,
          timestamp: Date.now() - 189,
        },
        {
          providerId: "groq",
          providerName: "Groq LPU",
          keyMasked: "gsk_************19Xp",
          keyName: "Ultra-Fast Failover",
          model: "openai/gpt-oss-120b",
          status: "success",
          latencyMs: 107,
          timestamp: Date.now(),
        },
      ],
    });

    recordProviderMetric("gemini", "Google Gemini", false, 95, true, 45, 0, "429 Rate Limit");
    recordProviderMetric("groq", "Groq LPU", true, 107, false, 45, 80);

    setStats(getUserStats());
    setLogs(getUserLogs());
    showToast("Failover simulation completed.");
  };

  // Keyboard navigation across tabs
  const handleTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const nextIndex = (index + 1) % TABS.length;
      setActiveTab(TABS[nextIndex].id);
      const nextBtn = document.getElementById(`tab-${TABS[nextIndex].id}`);
      nextBtn?.focus();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prevIndex = (index - 1 + TABS.length) % TABS.length;
      setActiveTab(TABS[prevIndex].id);
      const prevBtn = document.getElementById(`tab-${TABS[prevIndex].id}`);
      prevBtn?.focus();
    }
  };

  if (!isOpen) return null;

  const currentActiveProvider =
    providers.find((p) => p.id === (config?.activeProviderId || "gemini")) || providers[0];
  const activeModelName = config?.activeModel || currentActiveProvider?.selectedModel || "Standard";
  const activeModeText = config?.mode === "automatic" ? "Automatic mode" : "Manual mode";

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-150 motion-reduce:transition-none animate-modal-backdrop"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-settings-title"
        className="bg-white w-full sm:max-w-[880px] h-[95vh] sm:h-[80vh] sm:max-h-[80vh] rounded-t-2xl sm:rounded-xl shadow-xl flex flex-col overflow-hidden border-t sm:border border-slate-200 animate-modal-content motion-reduce:transition-none motion-reduce:transform-none"
      >
        {/* Mobile Drag Indicator Handle */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0 bg-white" aria-hidden="true">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>

        {/* Modal Header (Fixed / Sticky) */}
        <div className="shrink-0 px-4 sm:px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-3 bg-white">
          <div className="min-w-0">
            <h2 id="ai-settings-title" className="text-sm sm:text-base font-semibold text-slate-900 truncate">
              Multi-Provider AI Control Panel
            </h2>
            <p className="text-xs text-slate-600 mt-0.5 truncate">
              Manage AI models, credentials, automatic failover rules, and operational telemetry.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented Tab Bar (WCAG AA tablist with keyboard arrow navigation) */}
        <div className="shrink-0 border-b border-slate-200 bg-white px-2 sm:px-5 relative">
          <nav
            role="tablist"
            aria-label="AI Settings Tabs"
            className="grid grid-cols-4 w-full"
          >
            {TABS.map((tab, idx) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={isActive}
                  aria-controls={`tabpanel-${tab.id}`}
                  tabIndex={isActive ? 0 : -1}
                  onKeyDown={(e) => handleTabKeyDown(e, idx)}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-3 flex items-center justify-center gap-1.5 sm:gap-2 text-xs font-medium transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                    isActive ? "text-blue-700 font-semibold" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </nav>
          {/* Smooth sliding indicator bar (200ms ease-out) */}
          <div
            className="absolute bottom-0 left-0 h-0.5 bg-blue-600 transition-transform duration-200 ease-out motion-reduce:transition-none"
            style={{
              width: "25%",
              transform: `translateX(${TAB_INDEX_MAP[activeTab] * 100}%)`,
            }}
          />
        </div>

        {/* Modal Body (Scrolls internally) */}
        <div
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          tabIndex={0}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3.5 sm:p-5 space-y-4 bg-slate-50/50 focus-visible:outline-none"
        >
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600 motion-reduce:animate-none" />
              <p className="text-xs text-slate-700 font-medium">Loading AI configurations...</p>
            </div>
          ) : activeTab === "providers" ? (
            /* TAB 1: PROVIDERS */
            <div className="space-y-4 transition-opacity duration-150 ease-out motion-reduce:transition-none">
              {/* Single compact summary bar at the top */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 sm:px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs shadow-xs">
                <div className="flex items-center gap-2 text-slate-700 min-w-0 flex-wrap">
                  <span className="text-slate-500 font-medium">Currently using:</span>
                  <div className="flex items-center gap-1.5 font-semibold text-slate-900 truncate">
                    <AIBrandLogo providerId={currentActiveProvider?.id || "gemini"} size="sm" />
                    <span className="truncate">{currentActiveProvider?.name || "Google Gemini"}</span>
                    <span className="text-slate-500 font-normal">({activeModelName})</span>
                  </div>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-600 font-medium">{activeModeText}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-xs">
                    {providers.filter((p) => p.enabled).length} of {providers.length} active
                  </span>
                </div>
              </div>

              {/* Quick Add AI API Drawer / Expandable Form */}
              {showQuickAddDrawer && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3 transition-all duration-150 ease-out motion-reduce:transition-none">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-slate-600" />
                      <h3 className="text-sm font-semibold text-slate-900">Add AI API Key</h3>
                    </div>
                    {(() => {
                      const help = getProviderHelp(quickAddProviderId);
                      if (!help?.apiKeyUrl) return null;
                      return (
                        <button
                          type="button"
                          onClick={() => setFreeKeyModalProvider(help)}
                          className="text-xs font-medium text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded"
                        >
                          <span>Get free key</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      );
                    })()}
                  </div>

                  <form onSubmit={handleQuickAddAPIKey} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label htmlFor="quick-add-provider" className="block text-xs font-medium text-slate-700 mb-1">Provider</label>
                        <select
                          id="quick-add-provider"
                          value={quickAddProviderId}
                          onChange={(e) => setQuickAddProviderId(e.target.value)}
                          className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
                        >
                          {providers.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label htmlFor="quick-add-label" className="block text-xs font-medium text-slate-700 mb-1">Key Label (Optional)</label>
                        <input
                          id="quick-add-label"
                          type="text"
                          placeholder="e.g. Primary Key"
                          value={quickAddKeyLabel}
                          onChange={(e) => setQuickAddKeyLabel(e.target.value)}
                          className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
                        />
                      </div>

                      <div>
                        <label htmlFor="quick-add-secret" className="block text-xs font-medium text-slate-700 mb-1">Secret Key</label>
                        <div className="relative">
                          <input
                            id="quick-add-secret"
                            type={showQuickAddSecret ? "text" : "password"}
                            placeholder="Enter raw API key..."
                            value={quickAddKeySecret}
                            onChange={(e) => setQuickAddKeySecret(e.target.value)}
                            className="w-full text-xs font-mono bg-white border border-slate-200 rounded-lg p-2 pr-8 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => setShowQuickAddSecret(!showQuickAddSecret)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 p-1 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded"
                            aria-label={showQuickAddSecret ? "Hide secret key" : "Show secret key"}
                          >
                            {showQuickAddSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {quickAddProviderId === "custom" && (
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                        <label htmlFor="quick-add-endpoint" className="block text-xs font-medium text-slate-700">Custom Endpoint URL</label>
                        <input
                          id="quick-add-endpoint"
                          type="text"
                          placeholder="http://localhost:11434/v1/chat/completions"
                          value={quickAddCustomEndpoint}
                          onChange={(e) => setQuickAddCustomEndpoint(e.target.value)}
                          className="w-full text-xs font-mono bg-white border border-slate-200 rounded-lg p-1.5 text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        />
                      </div>
                    )}

                    {quickAddProviderId === "cloudflare" && (
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                        <label htmlFor="quick-add-account" className="block text-xs font-medium text-slate-700">Cloudflare Account ID</label>
                        <input
                          id="quick-add-account"
                          type="text"
                          placeholder="e.g. 7f3b890a..."
                          value={quickAddAccountId}
                          onChange={(e) => setQuickAddAccountId(e.target.value)}
                          className="w-full text-xs font-mono bg-white border border-slate-200 rounded-lg p-1.5 text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowQuickAddDrawer(false)}
                        className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmittingQuickKey}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 motion-reduce:transform-none"
                      >
                        {isSubmittingQuickKey ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" />
                            <span>Connecting...</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Connect & Save</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Provider List Header & "Add AI API" button */}
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">AI Providers</h3>
                  <p className="text-xs text-slate-600">Configure credentials, models, and priority fallback.</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestAll}
                    disabled={testingKeyId === "all"}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-all cursor-pointer shadow-xs active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 motion-reduce:transform-none"
                    title="Test connection for all enabled providers"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testingKeyId === "all" ? "animate-spin text-blue-600 motion-reduce:animate-none" : "text-slate-400"}`} />
                    <span className="hidden sm:inline">{testingKeyId === "all" ? "Testing..." : "Test Active"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowQuickAddDrawer((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all cursor-pointer shadow-xs active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 motion-reduce:transform-none"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add AI API</span>
                  </button>
                </div>
              </div>

              {/* Clean Vertical Provider List */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
                {providers.length === 0 ? (
                  <div className="p-8 text-center bg-white space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-500">
                      <Inbox className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900">No AI Providers Found</h4>
                    <p className="text-xs text-slate-600 max-w-sm mx-auto">
                      Restore default providers or connect a custom AI API endpoint to get started.
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        resetAllUserData();
                        await fetchAIConfig();
                      }}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer shadow-xs inline-flex items-center gap-1.5 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore Default Providers</span>
                    </button>
                  </div>
                ) : (
                  providers.map((p, idx) => {
                    const isExpanded = expandedProviderId === p.id;
                    const activeKeysCount = p.apiKeys.filter((k) => k.enabled).length;
                    const hasKeys = p.apiKeys.length > 0;
                    const helpConfig = getProviderHelp(p.id);

                    // Status indicator
                    const statusKind = !p.enabled
                      ? "disabled"
                      : p.status === "active" && activeKeysCount > 0
                      ? "active"
                      : hasKeys
                      ? "ready"
                      : "needs_key";

                    return (
                      <div key={p.id} className="transition-colors">
                        {/* Main Provider Row */}
                        <div className="p-3 sm:p-3.5 flex items-center justify-between gap-2.5 sm:gap-3 hover:bg-slate-50/60 transition-colors">
                          {/* Provider Logo + Name */}
                          <div className="flex items-center gap-2.5 min-w-0 w-36 sm:w-56 shrink-0">
                            <div className="p-1 rounded bg-slate-50 border border-slate-200 shrink-0">
                              <AIBrandLogo providerId={p.id} size="sm" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs sm:text-sm font-semibold text-slate-900 truncate" title={p.name}>
                                  {p.name}
                                </span>
                                <span className="text-xs text-slate-500 font-mono">#{p.priority}</span>
                              </div>
                              <div className="text-xs text-slate-500 truncate">
                                {hasKeys ? `${p.apiKeys.length} key (${activeKeysCount} ON)` : "No keys"}
                              </div>
                            </div>
                          </div>

                          {/* Selected Model */}
                          <div className="hidden sm:block min-w-0 flex-1 truncate text-xs text-slate-600 font-mono">
                            {p.selectedModel || "—"}
                          </div>

                          {/* Status Dot */}
                          <div className="shrink-0">
                            {statusKind === "active" ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-2xs" />
                                <span className="hidden xs:inline">Active</span>
                              </span>
                            ) : statusKind === "ready" ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                                <span className="w-2 h-2 rounded-full bg-slate-400" />
                                <span className="hidden xs:inline">Ready</span>
                              </span>
                            ) : statusKind === "needs_key" ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800">
                                <span className="w-2 h-2 rounded-full bg-amber-400" />
                                <span className="hidden xs:inline">Needs key</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                                <span className="w-2 h-2 rounded-full bg-slate-300" />
                                <span className="hidden xs:inline">Disabled</span>
                              </span>
                            )}
                          </div>

                          {/* Enable Switch Toggle */}
                          <div className="shrink-0 flex items-center">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={p.enabled}
                              onClick={() => handleUpdateProvider(p.id, { enabled: !p.enabled })}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                                p.enabled ? "bg-blue-600" : "bg-slate-300"
                              }`}
                              title={`Toggle ${p.name} ON/OFF`}
                              aria-label={`Toggle ${p.name} ON or OFF`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform duration-150 ease-in-out ${
                                  p.enabled ? "translate-x-4" : "translate-x-0"
                                }`}
                              />
                            </button>
                          </div>

                          {/* Configure Accordion Button */}
                          <div className="shrink-0">
                            <button
                              type="button"
                              onClick={() => setExpandedProviderId(isExpanded ? null : p.id)}
                              className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all cursor-pointer flex items-center gap-1 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                                isExpanded
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                              }`}
                              aria-expanded={isExpanded}
                              aria-label={`Configure ${p.name}`}
                            >
                              <span>Configure</span>
                              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 motion-reduce:transition-none ${isExpanded ? "rotate-180" : ""}`} />
                            </button>
                          </div>
                        </div>

                        {/* Expandable Configuration Drawer/Panel (Full Width) */}
                        {isExpanded && (
                          <div className="p-3.5 sm:p-4 bg-slate-50/90 border-t border-slate-100 space-y-3.5 transition-all duration-150 ease-out motion-reduce:transition-none">
                            {/* Priority reordering & Get Free Key */}
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-600 font-medium">Priority Order:</span>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleMovePriority(p.id, "up")}
                                    disabled={idx === 0}
                                    className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                                    title="Increase Priority"
                                    aria-label="Increase priority"
                                  >
                                    <ArrowUp className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="font-semibold text-slate-800">#{p.priority}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleMovePriority(p.id, "down")}
                                    disabled={idx === providers.length - 1}
                                    className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                                    title="Decrease Priority"
                                    aria-label="Decrease priority"
                                  >
                                    <ArrowDown className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {helpConfig?.apiKeyUrl && (
                                <button
                                  type="button"
                                  onClick={() => setFreeKeyModalProvider(helpConfig)}
                                  className="text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded"
                                >
                                  <span>Get free API key for {p.name}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              )}
                            </div>

                            {/* Model Selection */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <label htmlFor={`select-model-${p.id}`} className="text-xs font-medium text-slate-700">Selected Model</label>
                                <button
                                  type="button"
                                  onClick={() => handleRefreshModels(p.id)}
                                  disabled={refreshingProviderId === p.id}
                                  className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded"
                                >
                                  <RefreshCw className={`w-3 h-3 ${refreshingProviderId === p.id ? "animate-spin text-blue-600 motion-reduce:animate-none" : ""}`} />
                                  <span>{refreshingProviderId === p.id ? "Refreshing..." : "Refresh Catalog"}</span>
                                </button>
                              </div>
                              <select
                                id={`select-model-${p.id}`}
                                value={p.selectedModel}
                                onChange={(e) => handleUpdateProvider(p.id, { selectedModel: e.target.value })}
                                className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                              >
                                {(() => {
                                  const canonical = canonicalProviderId(p.id);
                                  const testReport = getCachedModelTestReport(p.id);
                                  const readyList = (testReport?.readyModels || []).filter(
                                    (m) => canonicalProviderId(m.provider) === canonical
                                  );
                                  const registryModels = getActiveModels(p.id);
                                  const catalogModels = getCatalogModels(p.id);
                                  const availableFallback = (p.availableModels || []).filter(
                                    (m) => !m.deprecated && !m.retired && m.status !== "retired"
                                  );

                                  const seen = new Set<string>();
                                  const modelsToRender: Array<{ id: string; name: string; isReady: boolean; isFree: boolean }> = [];

                                  for (const m of readyList) {
                                    if (!seen.has(m.id)) {
                                      seen.add(m.id);
                                      modelsToRender.push({
                                        id: m.id,
                                        name: m.name || m.id,
                                        isReady: true,
                                        isFree: m.isFree,
                                      });
                                    }
                                  }

                                  const basePool =
                                    registryModels.length > 0
                                      ? registryModels
                                      : availableFallback.length > 0
                                      ? availableFallback
                                      : catalogModels;

                                  for (const m of basePool) {
                                    if (!seen.has(m.id)) {
                                      seen.add(m.id);
                                      modelsToRender.push({
                                        id: m.id,
                                        name: m.name || m.id,
                                        isReady: false,
                                        isFree: Boolean(m.free || (m as any).isFree),
                                      });
                                    }
                                  }

                                  if (modelsToRender.length === 0) {
                                    return <option value="" disabled>No models configured</option>;
                                  }

                                  return modelsToRender.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.isReady ? `✓ ${m.name}` : m.name} {m.isFree ? "(Free)" : "(Paid)"}
                                    </option>
                                  ));
                                })()}
                              </select>
                            </div>

                            {/* Custom Endpoint / Account ID */}
                            {p.id === "custom" && (
                              <div className="space-y-1">
                                <label htmlFor="cfg-custom-endpoint" className="text-xs font-medium text-slate-700 block">Custom Endpoint URL</label>
                                <input
                                  id="cfg-custom-endpoint"
                                  type="text"
                                  placeholder="http://localhost:11434/v1/..."
                                  value={p.customEndpoint || ""}
                                  onChange={(e) => handleUpdateProvider(p.id, { customEndpoint: e.target.value })}
                                  className="w-full text-xs font-mono bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                />
                              </div>
                            )}

                            {p.id === "cloudflare" && (
                              <div className="space-y-1">
                                <label htmlFor="cfg-cf-account" className="text-xs font-medium text-slate-700 block">Cloudflare Account ID</label>
                                <input
                                  id="cfg-cf-account"
                                  type="text"
                                  placeholder="e.g. 7f3b8..."
                                  value={p.accountId || ""}
                                  onChange={(e) => handleUpdateProvider(p.id, { accountId: e.target.value })}
                                  className="w-full text-xs font-mono bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                />
                              </div>
                            )}

                            {/* API Keys List */}
                            <div className="space-y-2 pt-2 border-t border-slate-200">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-800">
                                  API Keys ({p.apiKeys.length})
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setShowAddKeyFor(showAddKeyFor === p.id ? null : p.id)}
                                  className="text-xs font-medium text-blue-700 hover:text-blue-900 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded px-1"
                                >
                                  {showAddKeyFor === p.id ? "Cancel" : "+ Add Key"}
                                </button>
                              </div>

                              {showAddKeyFor === p.id && (
                                <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                                  <label htmlFor={`new-key-name-${p.id}`} className="sr-only">Key Label</label>
                                  <input
                                    id={`new-key-name-${p.id}`}
                                    type="text"
                                    placeholder="Key Label (e.g. Primary)"
                                    value={newKeyInputs[p.id]?.name || ""}
                                    onChange={(e) =>
                                      setNewKeyInputs((prev) => ({
                                        ...prev,
                                        [p.id]: { ...(prev[p.id] || { key: "", name: "" }), name: e.target.value },
                                      }))
                                    }
                                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-md p-1.5 text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                  />
                                  <label htmlFor={`new-key-secret-${p.id}`} className="sr-only">Secret Key</label>
                                  <input
                                    id={`new-key-secret-${p.id}`}
                                    type="password"
                                    placeholder="Enter secret API key..."
                                    value={newKeyInputs[p.id]?.key || ""}
                                    onChange={(e) =>
                                      setNewKeyInputs((prev) => ({
                                        ...prev,
                                        [p.id]: { ...(prev[p.id] || { key: "", name: "" }), key: e.target.value },
                                      }))
                                    }
                                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-md p-1.5 text-slate-800 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                  />
                                  <div className="flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => handleAddKey(p.id)}
                                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold cursor-pointer shadow-xs active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                    >
                                      Save Key
                                    </button>
                                  </div>
                                </div>
                              )}

                              <div className="space-y-1.5">
                                {p.apiKeys.length === 0 ? (
                                  <div className="p-4 bg-white rounded-lg border border-dashed border-slate-200 text-center text-xs text-slate-600 flex flex-col items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                      <Key className="w-4 h-4 text-slate-400" />
                                    </div>
                                    <span className="font-medium text-slate-800">No API keys yet — Add your first provider key</span>
                                    <button
                                      type="button"
                                      onClick={() => setShowAddKeyFor(p.id)}
                                      className="px-2.5 py-1 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md cursor-pointer transition-colors"
                                    >
                                      + Add API Key
                                    </button>
                                  </div>
                                ) : (
                                  p.apiKeys.map((k) => {
                                    const testKey = `${p.id}-${k.id}`;
                                    const isTestingThis = testingKeyId === testKey;
                                    const isRevealed = Boolean(revealedKeyIds[k.id]);
                                    const rawSecret = isRevealed
                                      ? getUserProviders().find((u) => u.id === p.id)?.apiKeys?.find((uk) => uk.id === k.id)?.key || ""
                                      : "";

                                    return (
                                      <div
                                        key={k.id}
                                        className="p-2.5 rounded-lg border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className="font-medium text-slate-900 truncate" title={k.name}>
                                            {k.name}
                                          </span>
                                          <code className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-xs text-slate-600 truncate">
                                            {isRevealed && rawSecret ? rawSecret : k.maskedKey}
                                          </code>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setRevealedKeyIds((prev) => ({ ...prev, [k.id]: !prev[k.id] }))
                                            }
                                            className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded"
                                            title={isRevealed ? "Hide key" : "Show key"}
                                            aria-label={isRevealed ? "Hide API key" : "Show API key"}
                                          >
                                            {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                          </button>
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0 justify-end">
                                          {isTestingThis ? (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
                                              <RefreshCw className="w-3 h-3 animate-spin mr-1 text-blue-600 motion-reduce:animate-none" />
                                              Probing...
                                            </span>
                                          ) : (
                                            <span
                                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${
                                                !k.enabled
                                                  ? "bg-slate-100 text-slate-600 border-slate-200"
                                                  : k.status === "active"
                                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                                  : k.status === "rate_limited"
                                                  ? "bg-amber-50 text-amber-800 border-amber-200"
                                                  : "bg-rose-50 text-rose-800 border-rose-200"
                                              }`}
                                            >
                                              {!k.enabled ? "OFF" : k.status === "active" ? "Active" : k.status || "Ready"}
                                            </span>
                                          )}

                                          <button
                                            type="button"
                                            onClick={() => handleToggleKey(p.id, k.id, k.enabled)}
                                            className={`px-2 py-0.5 rounded text-xs font-medium transition-all cursor-pointer border active:scale-[0.98] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 ${
                                              k.enabled
                                                ? "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200"
                                                : "bg-white hover:bg-slate-50 text-slate-600 border-slate-200"
                                            }`}
                                            aria-label={`Toggle key ${k.name} ${k.enabled ? "OFF" : "ON"}`}
                                          >
                                            {k.enabled ? "ON" : "OFF"}
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => handleTestKey(p.id, k.id, p.selectedModel)}
                                            disabled={isTestingThis}
                                            className="px-2 py-0.5 rounded text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 cursor-pointer disabled:opacity-50 inline-flex items-center gap-1 shadow-xs active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                                            aria-label={`Test connection for key ${k.name}`}
                                          >
                                            <RefreshCw className={`w-3 h-3 ${isTestingThis ? "animate-spin text-blue-600 motion-reduce:animate-none" : "text-slate-400"}`} />
                                            <span>{isTestingThis ? "Testing..." : "Test"}</span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => handleRemoveKey(p.id, k.id)}
                                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500"
                                            title="Remove key"
                                            aria-label={`Remove key ${k.name}`}
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>

                            {/* Universal Model Tester */}
                            <div className="pt-2 border-t border-slate-200">
                              <UniversalModelTesterPanel
                                providerId={p.id}
                                providerName={p.name}
                                apiKey={(() => {
                                  const userProvs = getUserProviders();
                                  const up = userProvs.find((u) => u.id === p.id);
                                  return (
                                    up?.apiKeys?.find((k) => k.enabled && k.key)?.key ||
                                    up?.apiKeys?.[0]?.key ||
                                    ""
                                  );
                                })()}
                                customEndpoint={p.customEndpoint}
                                accountId={p.accountId}
                                selectedModelId={p.selectedModel}
                                onSelectModel={(newModelId) => {
                                  handleUpdateProvider(p.id, { selectedModel: newModelId });
                                  if (config?.activeProviderId === p.id) {
                                    handleUpdateConfig({ activeModel: newModelId });
                                  }
                                  showToast(`Selected ${newModelId} for ${p.name}`);
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : activeTab === "settings" ? (
            /* TAB 2: SETTINGS (3 Simple rows in one card + reliability options) */
            <div className="space-y-4 transition-opacity duration-150 ease-out motion-reduce:transition-none">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">AI Execution & Routing Settings</h3>
                <p className="text-xs text-slate-600">
                  Configure global scheduling, automatic failover rules, and billing cost guardrails.
                </p>
              </div>

              {/* Single unified card with 3 simple setting rows */}
              <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 shadow-xs">
                {/* Row 1: Execution Mode */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">Execution Mode</div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Automatic prioritizes your fallback chain; Manual locks requests to your chosen active provider.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-800 cursor-pointer">
                      <input
                        type="radio"
                        name="settings_mode"
                        checked={config?.mode === "automatic"}
                        onChange={() => handleUpdateConfig({ mode: "automatic" })}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>Automatic</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-800 cursor-pointer">
                      <input
                        type="radio"
                        name="settings_mode"
                        checked={config?.mode === "manual"}
                        onChange={() => handleUpdateConfig({ mode: "manual" })}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>Manual</span>
                    </label>
                  </div>
                </div>

                {/* Row 2: Automatic Fallback */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">Automatic Fallback</div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Automatically step down to secondary providers on rate-limits (429), timeouts, or server outages.
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={Boolean(config?.enableFallback)}
                      onClick={() => handleUpdateConfig({ enableFallback: !config?.enableFallback })}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                        config?.enableFallback ? "bg-blue-600" : "bg-slate-300"
                      }`}
                      aria-label="Toggle Automatic Fallback"
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform duration-150 ease-in-out ${
                          config?.enableFallback ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Row 3: Billing Mode */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">Billing Mode</span>
                      <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        Zero Spend Guard
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Restricts requests strictly to free models & free tiers. Never switches to paid endpoints.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-800 cursor-pointer">
                      <input
                        type="radio"
                        name="settings_billing"
                        checked={config?.freeOnlyMode || config?.billingMode === "free_only"}
                        onChange={() => handleUpdateConfig({ freeOnlyMode: true, billingMode: "free_only" })}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>Free Only</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-800 cursor-pointer">
                      <input
                        type="radio"
                        name="settings_billing"
                        checked={!config?.freeOnlyMode && config?.billingMode === "free_and_paid"}
                        onChange={() => handleUpdateConfig({ freeOnlyMode: false, billingMode: "free_and_paid" })}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>Free + Paid</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Advanced Fallback Rules card */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
                <h4 className="text-xs font-semibold text-slate-900">Failover Rules & Reliability</h4>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(config?.enableModelFallback)}
                      onChange={(e) => handleUpdateConfig({ enableModelFallback: e.target.checked })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <div>
                      <span className="font-medium block">Intra-Provider Model Fallback</span>
                      <span className="text-slate-600 text-xs">
                        Try alternative models within the same provider before hopping to another provider.
                      </span>
                    </div>
                  </label>

                  <div className="flex items-center gap-3 pt-1 border-t border-slate-100">
                    <label htmlFor="settings-req-timeout" className="text-xs font-medium text-slate-700">Request Timeout:</label>
                    <select
                      id="settings-req-timeout"
                      value={config?.defaultTimeoutMs || 45000}
                      onChange={(e) => handleUpdateConfig({ defaultTimeoutMs: Number(e.target.value) })}
                      className="text-xs bg-white border border-slate-200 rounded-lg p-1.5 text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <option value={20000}>20 Seconds (Fast Fail)</option>
                      <option value={35000}>35 Seconds (Balanced)</option>
                      <option value={45000}>45 Seconds (Standard)</option>
                      <option value={60000}>60 Seconds (Maximum Patience)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === "usage" ? (
            /* TAB 3: USAGE & TELEMETRY */
            <div className="space-y-4 transition-opacity duration-150 ease-out motion-reduce:transition-none">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Provider Telemetry & Health</h3>
                  <p className="text-xs text-slate-600">Live operational performance, latency benchmarks, and rate limit telemetry.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      fetchAIConfig();
                      showToast("Telemetry data refreshed.");
                    }}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer text-slate-700 shadow-xs active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                    <span>Refresh</span>
                  </button>
                  <button
                    onClick={handleTestAll}
                    disabled={testingKeyId !== null}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{testingKeyId !== null ? "Probing..." : "Probe All"}</span>
                  </button>
                  <button
                    onClick={handleResetTelemetry}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* KPI Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-xs font-medium text-slate-600">Total Requests</div>
                  <div className="text-lg font-semibold text-slate-900 mt-1">
                    {stats.reduce((acc, s) => acc + (s.requestCount || 0), 0)}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-xs font-medium text-slate-600">Avg Success Rate</div>
                  <div className="text-lg font-semibold text-emerald-700 mt-1">
                    {(() => {
                      const totalReq = stats.reduce((acc, s) => acc + (s.requestCount || 0), 0);
                      const totalSuccess = stats.reduce((acc, s) => acc + (s.successCount || 0), 0);
                      return totalReq > 0 ? Math.round((totalSuccess / totalReq) * 100) : 100;
                    })()}%
                  </div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-xs font-medium text-slate-600">Rate Limits (429)</div>
                  <div className="text-lg font-semibold text-amber-700 mt-1">
                    {stats.reduce((acc, s) => acc + (s.rateLimitCount || 0), 0)}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-xs font-medium text-slate-600">Average Latency</div>
                  <div className="text-lg font-semibold text-blue-700 mt-1">
                    {(() => {
                      const activeWithLat = stats.filter((s) => (s.requestCount || 0) > 0 && (s.averageLatencyMs || 0) > 0);
                      if (activeWithLat.length === 0) return "14 ms";
                      const avg = Math.round(
                        activeWithLat.reduce((acc, s) => acc + (s.averageLatencyMs || 0), 0) / activeWithLat.length
                      );
                      return `${avg} ms`;
                    })()}
                  </div>
                </div>
              </div>

              {/* Clean Table with Sticky Header */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs max-h-[360px]">
                <table className="w-full text-left text-[13px]">
                  <thead className="sticky top-0 bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 z-10">
                    <tr>
                      <th className="p-3">Provider</th>
                      <th className="p-3">Requests</th>
                      <th className="p-3">Success Rate</th>
                      <th className="p-3">429 Caught</th>
                      <th className="p-3">Avg Latency</th>
                      <th className="p-3">Tokens</th>
                      <th className="p-3 text-right">Quick Probe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                    {stats.map((s) => {
                      const reqCount = s.requestCount || 0;
                      const successCount = s.successCount || 0;
                      const successRate = reqCount > 0 ? Math.round((successCount / reqCount) * 100) : 100;
                      const totalTokens = (s.estimatedInputTokens || 0) + (s.estimatedOutputTokens || 0);
                      const isProbingThis = testingKeyId === s.providerId;

                      return (
                        <tr key={s.providerId} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-3 font-medium text-slate-900">
                            <div className="flex items-center gap-2">
                              <AIBrandLogo providerId={s.providerId.toLowerCase()} size="sm" />
                              <div className="min-w-0">
                                <div className="truncate">{s.providerName}</div>
                                {s.lastErrorMessage && (
                                  <div className="text-xs text-rose-600 font-normal truncate max-w-xs">
                                    {s.lastErrorMessage}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-3">{reqCount}</td>
                          <td className="p-3">
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${
                                reqCount === 0
                                  ? "bg-slate-100 text-slate-700 border-slate-200"
                                  : successRate >= 90
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : "bg-amber-50 text-amber-800 border-amber-200"
                              }`}
                            >
                              {reqCount === 0 ? "Ready" : `${successRate}%`}
                            </span>
                          </td>
                          <td className="p-3">{s.rateLimitCount || 0}</td>
                          <td className="p-3 font-mono text-slate-700">
                            {s.averageLatencyMs ? `${s.averageLatencyMs} ms` : "—"}
                          </td>
                          <td className="p-3 text-slate-600">
                            {totalTokens > 0 ? `${(totalTokens / 1000).toFixed(1)}k` : "0"}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                const prov = providers.find((p) => p.id === s.providerId);
                                const activeKey = prov?.apiKeys?.find((k) => k.enabled);
                                handleTestKey(s.providerId, activeKey?.id || "default", prov?.selectedModel);
                              }}
                              disabled={testingKeyId !== null}
                              className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 hover:bg-slate-50 text-slate-700 transition-all cursor-pointer inline-flex items-center gap-1 shadow-xs active:scale-[0.98] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                              aria-label={`Probe provider ${s.providerName}`}
                            >
                              {isProbingThis ? (
                                <RefreshCw className="w-3 h-3 animate-spin text-blue-600 motion-reduce:animate-none" />
                              ) : (
                                <Sparkles className="w-3 h-3 text-slate-500" />
                              )}
                              <span>Probe</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* TAB 4: AUDIT LOGS */
            <div className="space-y-4 transition-opacity duration-150 ease-out motion-reduce:transition-none">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Failover & Routing Audit Logs</h3>
                  <p className="text-xs text-slate-600">
                    Step-by-step trace of model routing, 429 recoveries, and multi-hop provider fallbacks.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      fetchAIConfig();
                      showToast("Audit logs refreshed.");
                    }}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer text-slate-700 shadow-xs active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                    <span>Refresh</span>
                  </button>
                  <button
                    onClick={handleSimulateFailoverProbe}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Simulate Probe</span>
                  </button>
                  <button
                    onClick={handleClearAuditLogs}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300"
                  >
                    Clear Logs
                  </button>
                </div>
              </div>

              {/* Collapsible Status Signal Guide (Collapsed by default) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                <button
                  type="button"
                  onClick={() => setShowStatusGuide(!showStatusGuide)}
                  className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-medium text-slate-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  aria-expanded={showStatusGuide}
                >
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-slate-500" />
                    <span>How to read audit logs and status signals</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-150 motion-reduce:transition-none ${showStatusGuide ? "rotate-180" : ""}`} />
                </button>
                {showStatusGuide && (
                  <div className="p-4 border-t border-slate-200 bg-white transition-opacity duration-150 ease-out motion-reduce:transition-none">
                    <StatusSignalGuide />
                  </div>
                )}
              </div>

              {logs.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-500 border border-dashed border-slate-200 bg-white rounded-xl space-y-2">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-500">
                    <ScrollText className="w-6 h-6" />
                  </div>
                  <p className="font-semibold text-slate-900">No fallback audit logs recorded yet.</p>
                  <p className="text-slate-600 text-xs max-w-sm mx-auto">
                    Format academic notes or click "Simulate Probe" above to observe the failover pipeline in action.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                  {logs.map((log) => {
                    const finalProviderId = (log.finalProvider || "formatai").toLowerCase();
                    const chain = log.chain || [];
                    const timeStr = log.timestamp
                      ? new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                      : "Just now";
                    const summary = classifyAuditLogEntry(log);

                    return (
                      <div
                        key={log.id}
                        className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors text-[13px] space-y-2.5 shadow-xs"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm shrink-0 leading-none">{summary.badgeIcon}</span>
                            <div className="min-w-0">
                              <span className="font-semibold text-slate-900">{summary.headline}</span>
                              <span className="text-slate-600 ml-2 text-xs">{summary.detailLine}</span>
                            </div>
                          </div>
                          <span className="text-xs font-mono text-slate-500 shrink-0">{timeStr}</span>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <AIBrandLogo providerId={finalProviderId} size="sm" />
                            <span className="text-slate-700 truncate">
                              Resolved via <span className="font-semibold text-slate-900">{log.finalProvider}</span> ({log.finalModel})
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {log.hopsCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                                {log.hopsCount} Hop{log.hopsCount > 1 ? "s" : ""}
                              </span>
                            )}
                            <span
                              className={`px-1.5 py-0.5 rounded text-xs font-medium border ${
                                log.success
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : "bg-rose-50 text-rose-800 border-rose-200"
                              }`}
                            >
                              {log.success ? "Success" : "Failed"}
                            </span>
                            <span className="text-slate-600 font-mono text-xs">
                              {log.totalLatencyMs || 0}ms
                            </span>
                          </div>
                        </div>

                        {chain.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            {chain.map((step, idx) => {
                              const stepProviderId = (step.providerId || "formatai").toLowerCase();
                              const isStepSuccess = step.status === "success";

                              return (
                                <React.Fragment key={idx}>
                                  <div
                                    className={`px-2 py-1 rounded-md border text-xs font-medium flex items-center gap-1.5 ${
                                      isStepSuccess
                                        ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                                        : "bg-amber-50 text-amber-900 border-amber-200"
                                    }`}
                                  >
                                    <AIBrandLogo providerId={stepProviderId} size="sm" />
                                    <span>{step.providerName || step.providerId}</span>
                                    <span className="text-slate-500">({step.latencyMs || 0}ms)</span>
                                  </div>
                                  {idx < chain.length - 1 && (
                                    <span className="text-slate-400 text-xs font-bold">→</span>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer (Fixed / Sticky) */}
        <div className="shrink-0 px-4 sm:px-5 py-3 border-t border-slate-200 flex items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-2 text-xs text-slate-600 min-w-0">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="truncate">Browser-isolated keys · Zero server retention · 10 providers</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleResetSettings}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 active:scale-[0.98] motion-reduce:transform-none"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all cursor-pointer shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:scale-[0.98] motion-reduce:transform-none"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save AI Settings</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Sleek Floating Non-Blocking Toast Notification */}
        {toast && (
          <div
            className={`fixed sm:absolute bottom-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-xs font-medium shadow-lg border flex items-center gap-2 transition-all duration-150 ease-out motion-reduce:transition-none ${
              toast.type === "error"
                ? "bg-rose-900 text-rose-100 border-rose-800"
                : toast.type === "info"
                ? "bg-slate-900 text-slate-100 border-slate-800"
                : "bg-slate-900 text-emerald-300 border-slate-800"
            }`}
          >
            {toast.type === "error" ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : toast.type === "info" ? (
              <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
            ) : (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{toast.text}</span>
          </div>
        )}
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
