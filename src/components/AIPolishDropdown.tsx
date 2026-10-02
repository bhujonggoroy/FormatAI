import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  Settings2,
  X,
} from "lucide-react";
import {
  getUserSettings,
  saveUserSettings,
  getUserProviders,
  saveUserProviders,
} from "../utils/userLocalStorage";
import { UserProviderConfig, ManagerConfig } from "../types/ai";
import { AIBrandLogo } from "./AIBrandLogo";
import { getActiveModels } from "../config/modelRegistry";
import { canonicalProviderId, getCatalogModels } from "../shared/centralModelCatalog";
import { getCachedModelTestReport } from "../services/UniversalModelTester";
import { ProviderHelpConfig } from "../data/providerHelp";

interface AIPolishDropdownProps {
  isAiPolishing: boolean;
  onTriggerAiPolish: () => void;
  onTriggerFormatAI?: () => void;
  isNoAI?: boolean;
  onProviderChange?: (providerId: string) => void;
  onClose: () => void;
  onOpenAISettings?: (tab?: "control" | "fallback" | "stats" | "logs" | "providers" | "settings" | "usage") => void;
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
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [providers, setProviders] = useState<UserProviderConfig[]>([]);
  const [managerConfig, setManagerConfig] = useState<ManagerConfig | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("gemini");
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [activeEngineMode, setActiveEngineMode] = useState<"offline" | "ai">("ai");

  // Collision detection placement
  const [placement, setPlacement] = useState<{
    vertical: "bottom" | "top";
    horizontal: "right" | "left";
  }>({
    vertical: "bottom",
    horizontal: "right",
  });

  // Calculate collision detection on mount & window resize
  useEffect(() => {
    const el = popoverRef.current;
    if (!el) return;

    const updatePlacement = () => {
      const parent = el.parentElement;
      if (!parent) return;

      const parentRect = parent.getBoundingClientRect();
      const popoverHeight = 360;
      const popoverWidth = 320;

      // Vertical flip detection
      const spaceBelow = window.innerHeight - parentRect.bottom;
      const spaceAbove = parentRect.top;
      const vertical = spaceBelow < popoverHeight && spaceAbove > spaceBelow ? "top" : "bottom";

      // Horizontal shift detection
      const spaceRight = window.innerWidth - parentRect.left;
      const horizontal = spaceRight < popoverWidth ? "right" : "left";

      setPlacement({ vertical, horizontal });
    };

    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, []);

  // Close on outside click and Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const el = popoverRef.current;
      if (el && !el.contains(e.target as Node) && !el.parentElement?.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [onClose]);

  // Load user settings and providers
  useEffect(() => {
    try {
      const cfg = getUserSettings();
      const provs = getUserProviders();
      setManagerConfig(cfg);
      setProviders(provs);

      const isOfflineInit = cfg.activeProviderId === "formatai" || cfg.activeProviderId === "local" || isNoAI;
      setActiveEngineMode(isOfflineInit ? "offline" : "ai");

      const activeId = isOfflineInit
        ? "formatai"
        : cfg.activeProviderId || "gemini";
      setSelectedProviderId(activeId);

      const currentP = provs.find((p) => p.id === activeId);
      if (currentP) {
        setSelectedModelId(cfg.activeModel || currentP.selectedModel || "");
      }
    } catch (err) {
      console.warn("Failed to load AI state in dropdown:", err);
    }
  }, [isNoAI]);

  // Handle switching between FormatAI (Offline) and AI Models
  const handleSwitchEngineMode = (mode: "offline" | "ai") => {
    setActiveEngineMode(mode);
    if (mode === "offline") {
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
    } else {
      const nonLocal = providers.find((p) => p.id !== "formatai" && p.id !== "local") || providers[0];
      const targetId = selectedProviderId !== "formatai" && selectedProviderId !== "local"
        ? selectedProviderId
        : nonLocal?.id || "gemini";
      const targetP = providers.find((p) => p.id === targetId);
      if (targetP) {
        handleSelectProvider(targetP);
      }
    }
  };

  // Handle selecting an AI provider
  const handleSelectProvider = (p: UserProviderConfig) => {
    setSelectedProviderId(p.id);
    const newModel = p.selectedModel || p.availableModels?.[0]?.id || "";
    setSelectedModelId(newModel);

    const updatedCfg: ManagerConfig = {
      ...(managerConfig || getUserSettings()),
      activeProviderId: p.id,
      activeModel: newModel,
      mode: "manual",
    };
    setManagerConfig(updatedCfg);
    saveUserSettings(updatedCfg);

    const updatedProvs = providers.map((item) =>
      item.id === p.id ? { ...item, selectedModel: newModel } : item
    );
    setProviders(updatedProvs);
    saveUserProviders(updatedProvs);
    onProviderChange?.(p.id);
  };

  // Handle model change
  const handleSelectModel = (modelId: string) => {
    setSelectedModelId(modelId);

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

  // Execute polish
  const handleRunPolish = () => {
    if (activeEngineMode === "offline" || selectedProviderId === "formatai" || selectedProviderId === "local") {
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

  // Currently selected AI provider
  const selectedProvider = useMemo(() => {
    if (activeEngineMode === "offline") return null;
    return providers.find((p) => p.id === selectedProviderId) || null;
  }, [providers, selectedProviderId, activeEngineMode]);

  // Check if selected provider has an active key
  const selectedHasKey = useMemo(() => {
    if (activeEngineMode === "offline") return true;
    if (!selectedProvider) return false;
    if (selectedProvider.id === "gemini") return true; // Gemini has built-in free tier
    const activeKeys = (selectedProvider.apiKeys || []).filter(
      (k) => k.enabled && k.key && k.key.trim().length > 0
    );
    return activeKeys.length > 0;
  }, [selectedProvider, activeEngineMode]);

  // Model list for selected provider
  const modelOptions = useMemo(() => {
    if (!selectedProvider) return [];
    const canonical = canonicalProviderId(selectedProvider.id);
    const activeModels = getActiveModels(selectedProvider.id);
    const catalogModels = getCatalogModels(selectedProvider.id);
    const testReport = getCachedModelTestReport(selectedProvider.id);
    const readyList = (testReport?.readyModels || []).filter(
      (m) => canonicalProviderId(m.provider) === canonical
    );

    const seen = new Set<string>();
    const list: Array<{ id: string; name: string; isReady: boolean; isFree: boolean }> = [];

    for (const m of readyList) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        list.push({ id: m.id, name: m.name || m.id, isReady: true, isFree: m.isFree });
      }
    }

    const basePool =
      activeModels.length > 0
        ? activeModels
        : (selectedProvider.availableModels || []).length > 0
        ? selectedProvider.availableModels.filter((m) => !m.deprecated && !m.retired)
        : catalogModels;

    for (const m of basePool) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        list.push({
          id: m.id,
          name: m.name || m.id,
          isReady: false,
          isFree: Boolean(m.free || (m as any).isFree),
        });
      }
    }
    return list;
  }, [selectedProvider]);

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Formatting Engine Selector"
      className={`absolute z-50 w-[320px] max-h-[70vh] flex flex-col bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden text-xs animate-popover-in motion-reduce:transition-none motion-reduce:transform-none ${
        placement.vertical === "top" ? "bottom-full mb-2" : "top-full mt-2"
      } ${
        placement.horizontal === "right" ? "right-0" : "left-0"
      }`}
    >
      {/* 1. Header with Close Button */}
      <div className="shrink-0 p-3 pb-2 flex items-center justify-between border-b border-slate-100">
        <span className="font-semibold text-slate-900 text-xs">Formatting Engine</span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors cursor-pointer"
          aria-label="Close engine selector"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. Scrollable Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {/* 2.1 Segmented Control: "FormatAI (Offline)" | "AI Models" */}
        <div className="p-0.5 bg-slate-100 rounded-lg flex items-center" role="group" aria-label="Engine Mode">
          <button
            type="button"
            onClick={() => handleSwitchEngineMode("offline")}
            aria-pressed={activeEngineMode === "offline"}
            className={`flex-1 py-1.5 px-2 rounded-md font-medium text-xs transition-all cursor-pointer text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              activeEngineMode === "offline"
                ? "bg-white text-slate-900 shadow-xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            FormatAI (Offline)
          </button>
          <button
            type="button"
            onClick={() => handleSwitchEngineMode("ai")}
            aria-pressed={activeEngineMode === "ai"}
            className={`flex-1 py-1.5 px-2 rounded-md font-medium text-xs transition-all cursor-pointer text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              activeEngineMode === "ai"
                ? "bg-white text-slate-900 shadow-xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            AI Models
          </button>
        </div>

        {/* 2.2 Offline Mode Details */}
        {activeEngineMode === "offline" ? (
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1 text-slate-600">
            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Deterministic LaTeX Normalizer</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-xs">
              Fast, zero-latency formatting using built-in academic typesetting rules. Works completely offline with zero API keys required.
            </p>
          </div>
        ) : (
          /* 2.3 AI Models Section: Provider List + Model Select */
          <div className="space-y-3">
            {/* Provider List: Compact Rows with Radio-style Selection */}
            <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-0.5" role="radiogroup" aria-label="Select AI Provider">
              {providers
                .filter((p) => p.id !== "formatai" && p.id !== "local")
                .map((p) => {
                  const isSelected = selectedProviderId === p.id;
                  const activeKeys = (p.apiKeys || []).filter(
                    (k) => k.enabled && k.key && k.key.trim().length > 0
                  );
                  const isGemini = p.id === "gemini";
                  const hasKey = isGemini || activeKeys.length > 0;

                  return (
                    <div
                      key={p.id}
                      role="radio"
                      aria-checked={isSelected}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleSelectProvider(p);
                        }
                      }}
                      onClick={() => handleSelectProvider(p)}
                      className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 active:scale-[0.98] motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        isSelected
                          ? "border-blue-600 bg-blue-50/40 text-slate-900 shadow-xs"
                          : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {/* Radio selection circle */}
                        <div
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "border-blue-600 bg-blue-600"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>

                        <div className="p-0.5 rounded bg-white border border-slate-200 shrink-0">
                          <AIBrandLogo providerId={p.id} size="sm" />
                        </div>

                        <span className="font-medium truncate">{p.name}</span>
                      </div>

                      {/* Status Dot */}
                      <div className="shrink-0 flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            hasKey
                              ? p.enabled
                                ? "bg-emerald-500"
                                : "bg-slate-400"
                              : "bg-slate-300"
                          }`}
                          title={
                            hasKey
                              ? p.enabled
                                ? "Active & Ready"
                                : "Ready (Disabled)"
                              : "Needs API Key"
                          }
                        />
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Model Select (only shows for selected provider) */}
            {selectedProvider && (
              <div className="space-y-1">
                <label htmlFor="select-provider-model" className="block text-slate-700 font-medium text-xs">
                  Model ({selectedProvider.name})
                </label>
                <select
                  id="select-provider-model"
                  value={selectedModelId || selectedProvider.selectedModel}
                  onChange={(e) => handleSelectModel(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {modelOptions.length === 0 ? (
                    <option value="" disabled>No models configured</option>
                  ) : (
                    modelOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.isReady ? `✓ ${m.name}` : m.name} {m.isFree ? "(Free)" : ""}
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Footer: Inline Hint + ONE Run Button + Manage Link */}
      <div className="shrink-0 p-3 pt-2 border-t border-slate-100 bg-white space-y-2">
        {/* Inline Hint if provider has no key */}
        {!selectedHasKey && selectedProvider && (
          <div className="flex items-center justify-between text-xs text-slate-700 bg-amber-50/90 border border-amber-200 rounded-lg px-2.5 py-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="truncate">No key for {selectedProvider.name}.</span>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onOpenAISettings) onOpenAISettings("providers");
              }}
              className="font-medium text-blue-700 hover:text-blue-900 underline shrink-0 cursor-pointer ml-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded"
            >
              Add key →
            </button>
          </div>
        )}

        {/* ONE Primary Full-width Run Button */}
        <button
          type="button"
          onClick={handleRunPolish}
          disabled={isAiPolishing || !selectedHasKey}
          className="w-full py-2 px-3 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 motion-reduce:transform-none"
        >
          {isAiPolishing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white motion-reduce:animate-none" />
              <span>Polishing Notes...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Run Polish</span>
            </>
          )}
        </button>

        {/* Small text link to open the Control Panel modal on Providers tab */}
        <div className="flex items-center justify-center pt-0.5">
          <button
            type="button"
            onClick={() => {
              onClose();
              if (onOpenAISettings) onOpenAISettings("providers");
            }}
            className="text-xs text-slate-600 hover:text-blue-700 transition-colors flex items-center gap-1 cursor-pointer font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded p-0.5"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Manage API keys</span>
          </button>
        </div>
      </div>
    </div>
  );
};
