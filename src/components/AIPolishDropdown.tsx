import React, { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  Loader2,
  Check,
  AlertTriangle,
  Key,
  ExternalLink,
  Settings2,
  ChevronDown,
  Info,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  X,
} from "lucide-react";
import {
  getUserSettings,
  saveUserSettings,
  getUserProviders,
  saveUserProviders,
  getUserStats,
} from "../utils/userLocalStorage";
import { UserProviderConfig, ManagerConfig, ProviderStats } from "../types/ai";
import { AIBrandLogo, getAIProviderTheme } from "./AIBrandLogo";
import { getProviderHelp, ProviderHelpConfig } from "../data/providerHelp";
import { isModelSelectable } from "../shared/centralModelCatalog";
import { getActiveModels } from "../config/modelRegistry";
import { getCachedModelTestReport } from "../services/UniversalModelTester";

export type AISignalType =
  | "available"     // 🟢 Available & Ready (green)
  | "quota_low"     // 🟡 Quota Almost Finished / Warning (yellow)
  | "rate_limited"  // 🔴 Free Tier Ended / Rate Limit (red)
  | "connection_err"// ⚠️ Connection Failed / Key Invalid (warning)
  | "no_key";       // 🔑 Needs Free Key / Not Configured (gray/neutral)

interface AIPolishDropdownProps {
  isAiPolishing: boolean;
  onTriggerAiPolish: () => void;
  onTriggerFormatAI?: () => void;
  isNoAI?: boolean;
  onProviderChange?: (providerId: string) => void;
  onClose: () => void;
  onOpenAISettings?: () => void;
  onOpenFreeKeyModal?: (helpConfig: ProviderHelpConfig) => void;
}

export const AIPolishDropdown: React.FC<AIPolishDropdownProps> = ({
  isAiPolishing,
  onTriggerAiPolish,
  onTriggerFormatAI,
  isNoAI = false,
  onProviderChange,
  onClose,
  onOpenAISettings,
  onOpenFreeKeyModal,
}) => {
  const [providers, setProviders] = useState<UserProviderConfig[]>([]);
  const [managerConfig, setManagerConfig] = useState<ManagerConfig | null>(null);
  const [stats, setStats] = useState<ProviderStats[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("gemini");
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [showModelPicker, setShowModelPicker] = useState<boolean>(false);

  // Load user settings, providers, and stats
  const refreshState = () => {
    try {
      const cfg = getUserSettings();
      const provs = getUserProviders();
      const st = getUserStats();
      setManagerConfig(cfg);
      setProviders(provs);
      setStats(st);

      const activeId = cfg.activeProviderId || (isNoAI ? "formatai" : "gemini");
      setSelectedProviderId(activeId);

      const currentP = provs.find((p) => p.id === activeId);
      if (currentP) {
        setSelectedModelId(cfg.activeModel || currentP.selectedModel || "");
      }
    } catch (err) {
      console.warn("Failed to load AI state in dropdown:", err);
    }
  };

  useEffect(() => {
    refreshState();
  }, []);

  // Compute status signal for a given provider
  const getProviderSignal = (p: UserProviderConfig): {
    signal: AISignalType;
    label: string;
    description: string;
    badgeBg: string;
    dotColor: string;
    icon: React.ReactNode;
  } => {
    const pStats = stats.find((s) => s.providerId === p.id);
    const activeKeys = (p.apiKeys || []).filter((k) => k.enabled && k.key.trim().length > 0);
    const hasActiveKey = activeKeys.length > 0;
    const isGemini = p.id === "gemini";

    // 1. Check if Rate Limited / Free Tier Ended (Red signal 🔴)
    const isRateLimited =
      p.status === "rate_limited" ||
      Boolean(pStats && pStats.rateLimitCount > 0) ||
      (p.apiKeys || []).some((k) => k.status === "rate_limited");

    if (isRateLimited) {
      return {
        signal: "rate_limited",
        label: "Free Tier Ended",
        description: "Rate limit / quota exceeded (429). Auto-fallback will route to backup.",
        badgeBg: "bg-rose-50 text-rose-800 border-rose-300",
        dotColor: "bg-rose-500 ring-2 ring-rose-200",
        icon: <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-xs animate-pulse" />,
      };
    }

    // 2. Check Connection Error / Invalid Key (Warning sign ⚠️)
    const hasConnectionError =
      p.status === "invalid_key" ||
      p.status === "offline" ||
      (p.lastError && p.lastError.toLowerCase().includes("fail")) ||
      (p.apiKeys || []).some((k) => k.status === "invalid");

    if (hasConnectionError) {
      return {
        signal: "connection_err",
        label: "Connection Failed",
        description: "Cannot reach provider or invalid API key. Please check key in settings.",
        badgeBg: "bg-orange-50 text-orange-900 border-orange-300",
        dotColor: "bg-orange-500 ring-2 ring-orange-200",
        icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />,
      };
    }

    // 3. Check if Quota Almost Finished / Warning (Yellow signal 🟡)
    const isQuotaLow =
      p.status === "degraded" ||
      (pStats && pStats.requestCount > 50 && pStats.failureCount > 3) ||
      (pStats && pStats.requestCount > 0 && pStats.successCount / pStats.requestCount < 0.75);

    if (isQuotaLow) {
      return {
        signal: "quota_low",
        label: "Quota Low / Warning",
        description: "Approaching free quota limit or experiencing higher latency.",
        badgeBg: "bg-amber-50 text-amber-900 border-amber-300",
        dotColor: "bg-amber-400 ring-2 ring-amber-200",
        icon: <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-xs" />,
      };
    }

    // 4. Check if Available & Ready (Green signal 🟢)
    // Gemini has built-in server-side free fallback even without a user key
    if (isGemini) {
      return {
        signal: "available",
        label: hasActiveKey ? "Available (Custom Key)" : "Available (Free Tier)",
        description: "Ready to polish academic notes & mathematical equations instantly.",
        badgeBg: "bg-emerald-50 text-emerald-800 border-emerald-300",
        dotColor: "bg-emerald-500 ring-2 ring-emerald-200",
        icon: <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" />,
      };
    }

    // Other providers with configured keys
    if (hasActiveKey) {
      return {
        signal: "available",
        label: "Available & Ready",
        description: `${activeKeys.length} active key(s) ready for requests.`,
        badgeBg: "bg-emerald-50 text-emerald-800 border-emerald-300",
        dotColor: "bg-emerald-500 ring-2 ring-emerald-200",
        icon: <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" />,
      };
    }

    // 5. No key added yet (Key icon 🔑)
    return {
      signal: "no_key",
      label: "Needs Free Key",
      description: "Free API access available. Click to configure or add a free key.",
      badgeBg: "bg-slate-100 text-slate-700 border-slate-200",
      dotColor: "bg-slate-300",
      icon: <Key className="w-3 h-3 text-slate-500 shrink-0" />,
    };
  };

  // Currently selected provider (null if FormatAI / local / deselected)
  const selectedProvider = useMemo(() => {
    if (selectedProviderId === "formatai" || selectedProviderId === "local") {
      return null;
    }
    return providers.find((p) => p.id === selectedProviderId) || null;
  }, [providers, selectedProviderId]);

  const selectedSignal = selectedProvider ? getProviderSignal(selectedProvider) : null;
  const selectedTheme = selectedProvider ? getAIProviderTheme(selectedProvider.id) : null;

  // Handle selecting an AI provider
  const handleSelectProvider = (p: UserProviderConfig) => {
    setSelectedProviderId(p.id);
    const newModel = p.selectedModel || p.availableModels?.[0]?.id || "";
    setSelectedModelId(newModel);

    // Save to user settings immediately
    const updatedCfg: ManagerConfig = {
      ...(managerConfig || getUserSettings()),
      activeProviderId: p.id,
      activeModel: newModel,
      mode: "manual",
    };
    setManagerConfig(updatedCfg);
    saveUserSettings(updatedCfg);

    // Also update provider selection
    const updatedProvs = providers.map((item) =>
      item.id === p.id ? { ...item, selectedModel: newModel } : item
    );
    setProviders(updatedProvs);
    saveUserProviders(updatedProvs);
    onProviderChange?.(p.id);
  };

  // Handle deselecting an AI provider (reverting to FormatAI / No AI)
  const handleDeselectProvider = (_p?: UserProviderConfig) => {
    setSelectedProviderId("formatai");
    setSelectedModelId("standard-academic");

    const updatedCfg: ManagerConfig = {
      ...(managerConfig || getUserSettings()),
      activeProviderId: "formatai",
      activeModel: "standard-academic",
      mode: "manual",
    };
    setManagerConfig(updatedCfg);
    saveUserSettings(updatedCfg);
    onProviderChange?.("formatai");
  };

  // Handle selecting a model for the chosen AI
  const handleSelectModel = (modelId: string) => {
    setSelectedModelId(modelId);
    setShowModelPicker(false);

    if (managerConfig) {
      const updatedCfg: ManagerConfig = {
        ...managerConfig,
        activeModel: modelId,
      };
      setManagerConfig(updatedCfg);
      saveUserSettings(updatedCfg);
    }

    if (selectedProvider) {
      const updatedProvs = providers.map((item) =>
        item.id === selectedProvider.id ? { ...item, selectedModel: modelId } : item
      );
      setProviders(updatedProvs);
      saveUserProviders(updatedProvs);
    }
  };

  // Execute polish or FormatAI
  const handleRunPolish = () => {
    if (selectedProviderId === "formatai" || selectedProviderId === "local") {
      const updatedCfg: ManagerConfig = {
        ...(managerConfig || getUserSettings()),
        activeProviderId: "formatai",
        activeModel: "standard-academic",
        mode: "manual",
      };
      saveUserSettings(updatedCfg);
      onClose();
      if (onTriggerFormatAI) {
        onTriggerFormatAI();
      } else {
        onTriggerAiPolish();
      }
      return;
    }

    // Ensure the selected provider is saved
    if (selectedProvider) {
      const updatedCfg: ManagerConfig = {
        ...(managerConfig || getUserSettings()),
        activeProviderId: selectedProvider.id,
        activeModel: selectedModelId || selectedProvider.selectedModel,
        mode: "manual",
      };
      saveUserSettings(updatedCfg);
    }

    onClose();
    onTriggerAiPolish();
  };

  const isFormatAiActive = selectedProviderId === "formatai" || selectedProviderId === "local" || isNoAI;

  return (
    <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-md max-h-[calc(100vh-140px)] overflow-y-auto bg-white rounded-2xl shadow-2xl border-2 border-slate-300 p-3.5 sm:p-4 z-50 animate-in fade-in zoom-in-95 space-y-3.5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200/90 pb-2.5">
        <div className="min-w-0 pr-2">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
            {isNoAI ? "Academic Normalizer" : "Multi-Provider Engine & FormatAI"}
          </div>
          <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5 flex-wrap">
            <span>{isNoAI ? "FormatAI Engine" : "Select Engine"}</span>
            {isFormatAiActive ? (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                Active: FormatAI (No AI)
              </span>
            ) : selectedProvider ? (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                Active: {selectedProvider.name.replace("Google ", "")}
              </span>
            ) : null}
          </h3>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onOpenAISettings && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAISettings();
              }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-300 cursor-pointer"
              title="Open AI Control Panel"
            >
              <Settings2 className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden min-[380px]:inline">Settings</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer border border-transparent hover:border-slate-200"
            title="Close menu"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Top Quick-Run Bar for Instant 1-Click Execution (No Scrolling Needed on PC or Mobile) */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50/70 p-2.5 rounded-xl border border-blue-200 shadow-2xs space-y-1.5">
        <div className="flex items-center justify-between text-[10px]">
          <span className="font-extrabold uppercase tracking-wider text-blue-900 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>{isFormatAiActive ? "FormatAI Engine" : `${selectedProvider ? selectedProvider.name.replace("Google ", "") : "AI"} Engine`}</span>
          </span>
          <span className="font-bold text-slate-500 truncate max-w-[150px]">
            {isFormatAiActive ? "Deterministic / Offline" : selectedModelId || "Default Model"}
          </span>
        </div>
        <button
          type="button"
          onClick={handleRunPolish}
          disabled={isAiPolishing}
          className="w-full text-white text-xs font-black py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all shadow-2xs cursor-pointer active:scale-98 disabled:opacity-50 bg-blue-600 hover:bg-blue-700"
        >
          {isAiPolishing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              <span>Normalizing Academic Notes...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>
                {isFormatAiActive
                  ? "Run FormatAI Now (No AI)"
                  : `Run Polish Now with ${selectedProvider ? selectedProvider.name.replace("Google ", "") : "AI"}`}
              </span>
            </>
          )}
        </button>
      </div>

      {/* When running with No AI, display informative banner */}
      {isNoAI && (
        <div className="p-2.5 rounded-xl bg-blue-50/90 border border-blue-200 text-blue-950 text-xs flex items-start gap-2 shadow-2xs">
          <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="min-w-0 text-[11px] leading-snug">
            <span className="font-extrabold block">No AI Mode Active</span>
            <p className="text-[10px] text-blue-800 font-medium">
              FormatAI cleans and normalizes your notes & equations instantly using local deterministic academic rules without needing API keys.
            </p>
          </div>
        </div>
      )}

      {/* FormatAI Featured Option (Zero AI Required / Deterministic) */}
      <div>
        <div className="text-[10px] font-bold text-slate-600 mb-1 flex items-center justify-between">
          <span>Standard Formatter (Offline / No AI):</span>
          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
            Free Forever
          </span>
        </div>
        <div
          onClick={() => {
            setSelectedProviderId("formatai");
            setSelectedModelId("standard-academic");
            const updatedCfg: ManagerConfig = {
              ...(managerConfig || getUserSettings()),
              activeProviderId: "formatai",
              activeModel: "standard-academic",
              mode: "manual",
            };
            setManagerConfig(updatedCfg);
            saveUserSettings(updatedCfg);
            onProviderChange?.("formatai");
          }}
          className={`p-2.5 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between gap-2 text-left ${
            isFormatAiActive
              ? "border-blue-600 ring-2 ring-blue-300/50 bg-blue-50/90 shadow-2xs"
              : "border-slate-200 hover:border-blue-400 bg-white hover:bg-slate-50/60"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1 rounded-lg bg-blue-600 text-white shadow-2xs shrink-0">
              <Sparkles className="w-4 h-4 text-amber-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-slate-900">FormatAI</span>
                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 border border-blue-200">
                  No AI • Instant
                </span>
                {isFormatAiActive && (
                  <span className="p-0.5 rounded-full bg-blue-600 text-white shrink-0">
                    <Check className="w-2.5 h-2.5" />
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-600 font-medium truncate">
                Deterministic Academic LaTeX & Notes Typesetter
              </p>
            </div>
          </div>
          <div className="shrink-0">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border bg-emerald-50 text-emerald-800 border-emerald-200">
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
              <span>Ready</span>
            </span>
          </div>
        </div>
      </div>

      {/* AI Provider Selection List */}
      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 border-t border-slate-200/80 pt-2">
        <div className="text-[10px] font-bold text-slate-600 mb-1 flex items-center justify-between">
          <span>Multi-Provider AI Engines:</span>
          <span className="text-[9px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-semibold border border-blue-200">
            Double-click to deselect
          </span>
        </div>

        {providers.map((p) => {
          const isSelected = selectedProviderId === p.id;
          const theme = getAIProviderTheme(p.id);
          const sig = getProviderSignal(p);
          const help = getProviderHelp(p.id);

          return (
            <div
              key={p.id}
              onClick={() => {
                if (isSelected) {
                  handleDeselectProvider(p);
                } else {
                  handleSelectProvider(p);
                }
              }}
              onDoubleClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDeselectProvider(p);
              }}
              title={
                isSelected
                  ? "Double-click (or click) to deselect and switch to FormatAI (No AI)"
                  : "Click to select, double-click to deselect"
              }
              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 text-left ${
                isSelected
                  ? `${theme.cardBorder} ${theme.activeRing} bg-slate-50/90 shadow-2xs`
                  : "border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/60"
              }`}
            >
              {/* Left AI Identity */}
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1 rounded-lg bg-white shadow-2xs border border-slate-200 shrink-0">
                  <AIBrandLogo providerId={p.id} size="sm" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`text-xs font-bold truncate ${
                        isSelected ? "text-slate-950" : "text-slate-800"
                      }`}
                    >
                      {p.name}
                    </span>
                    {isSelected && (
                      <>
                        <span className="p-0.5 rounded-full bg-blue-600 text-white shrink-0" title="Selected">
                          <Check className="w-2.5 h-2.5" />
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeselectProvider(p);
                          }}
                          className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-200 hover:bg-rose-100 text-slate-700 hover:text-rose-700 border border-slate-300 transition-colors cursor-pointer"
                          title="Click to deselect"
                        >
                          ✕ Deselect
                        </button>
                      </>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate font-mono">
                    {p.selectedModel || p.availableModels?.[0]?.name || "Default"}
                  </div>
                </div>
              </div>

              {/* Right Status & Warning Indicator */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${sig.badgeBg}`}
                  title={sig.description}
                >
                  {sig.icon}
                  <span>{sig.label}</span>
                </span>

                {/* If needs a key and modal opener provided */}
                {sig.signal === "no_key" && help && onOpenFreeKeyModal && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose();
                      onOpenFreeKeyModal(help);
                    }}
                    className="p-1 rounded bg-slate-100 hover:bg-blue-50 text-blue-600 hover:text-blue-800 border border-slate-200 text-[10px] font-bold cursor-pointer"
                    title="Get Free API Key"
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Model Picker for the Selected AI */}
      {selectedProvider && selectedProvider.availableModels.length > 0 && (
        <div className="pt-1">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-bold text-slate-700">
              Selected Model ({selectedProvider.name}):
            </label>
            <button
              type="button"
              onClick={() => setShowModelPicker(!showModelPicker)}
              className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 cursor-pointer"
            >
              <span>{showModelPicker ? "Hide Models" : "Change Model"}</span>
              <ChevronDown
                className={`w-3 h-3 transition-transform ${showModelPicker ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          {showModelPicker ? (
            <div className="space-y-1 max-h-36 overflow-y-auto bg-slate-50 p-1.5 rounded-xl border border-slate-200">
              {(() => {
                const activeModels = getActiveModels(selectedProvider.id);
                const selectableModels = activeModels.length > 0
                  ? activeModels
                  : selectedProvider.availableModels.filter(isModelSelectable);
                if (selectableModels.length === 0) {
                  return (
                    <div className="p-2 text-center text-[11px] text-slate-500 font-medium italic">
                      No currently available free model for this provider
                    </div>
                  );
                }
                const testReport = getCachedModelTestReport(selectedProvider.id);
                return selectableModels.map((m) => {
                  const isReady = testReport?.readyModels?.some((r) => r.id === m.id);
                  return (
                    <div
                      key={m.id}
                      onClick={() => handleSelectModel(m.id)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                        (selectedModelId || selectedProvider.selectedModel) === m.id
                          ? "bg-blue-600 text-white shadow-2xs"
                          : "bg-white hover:bg-slate-100 text-slate-800 border border-slate-200"
                      }`}
                    >
                      <div className="truncate flex items-center gap-1">
                        <span>{m.name}</span>
                        {isReady && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-600 text-white font-bold">
                            ✓ Ready
                          </span>
                        )}
                        {m.free && !isReady && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold" title={m.freeTier || "Free tier — subject to provider limits"}>
                            Free tier
                          </span>
                        )}
                      </div>
                      {(selectedModelId || selectedProvider.selectedModel) === m.id && (
                        <Check className="w-3.5 h-3.5 text-white shrink-0 ml-1" />
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            <div className="px-2.5 py-1.5 rounded-lg bg-slate-100/80 border border-slate-200 text-xs font-bold text-slate-800 flex items-center justify-between">
              <span className="truncate">
                {selectedProvider.availableModels.find(
                  (m) => m.id === (selectedModelId || selectedProvider.selectedModel)
                )?.name || selectedModelId || "Default Model"}
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200 font-mono">
                Active
              </span>
            </div>
          )}
        </div>
      )}

      {/* Real-time Status Alert / Warning Message */}
      {selectedSignal && (
        <div
          className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
            selectedSignal.signal === "available"
              ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
              : selectedSignal.signal === "rate_limited"
              ? "bg-rose-50 border-rose-300 text-rose-950 font-medium"
              : selectedSignal.signal === "quota_low"
              ? "bg-amber-50 border-amber-300 text-amber-950 font-medium"
              : selectedSignal.signal === "connection_err"
              ? "bg-orange-50 border-orange-300 text-orange-950 font-medium"
              : "bg-slate-100 border-slate-300 text-slate-800"
          }`}
        >
          <div className="mt-0.5 shrink-0">{selectedSignal.icon}</div>
          <div className="min-w-0 text-[11px] leading-snug">
            <div className="font-extrabold">{selectedSignal.label}</div>
            <p className="text-[10px] opacity-90">{selectedSignal.description}</p>
          </div>
        </div>
      )}

      {/* Action Buttons: FormatAI vs AI Polish */}
      <div className="space-y-2 pt-1">
        {isFormatAiActive ? (
          <button
            type="button"
            onClick={handleRunPolish}
            disabled={isAiPolishing}
            className="w-full text-white text-xs font-extrabold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer active:scale-98 disabled:opacity-50 bg-blue-600 hover:bg-blue-700"
          >
            {isAiPolishing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Normalizing with FormatAI...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Run FormatAI Now (No AI Needed)</span>
              </>
            )}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleRunPolish}
              disabled={isAiPolishing}
              className={`w-full text-white text-xs font-extrabold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer active:scale-98 disabled:opacity-50 ${
                selectedTheme?.switchActiveBg || "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isAiPolishing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Polishing Academic Notes...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>
                    Run AI Polish Now ({selectedProvider ? selectedProvider.name.replace("Google ", "") : "AI"})
                  </span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                if (onTriggerFormatAI) onTriggerFormatAI();
                else onTriggerAiPolish();
              }}
              disabled={isAiPolishing}
              className="w-full text-slate-700 hover:text-slate-950 text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all border border-slate-300 hover:bg-slate-100/80 cursor-pointer active:scale-98 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Or Run Instant FormatAI (No AI)</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
