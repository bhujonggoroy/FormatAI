import React, { useState } from "react";
import { useModelTester } from "../hooks/useModelTester";
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  XCircle,
  Zap,
  Clock,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  X,
  Play,
  RotateCcw,
} from "lucide-react";

interface UniversalModelTesterPanelProps {
  providerId: string;
  providerName: string;
  apiKey: string;
  customEndpoint?: string;
  accountId?: string;
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
  accentColor?: string;
}

export const UniversalModelTesterPanel: React.FC<UniversalModelTesterPanelProps> = ({
  providerId,
  providerName,
  apiKey,
  customEndpoint,
  accountId,
  selectedModelId,
  onSelectModel,
  accentColor = "blue",
}) => {
  const {
    isTesting,
    progress,
    report,
    readyModels,
    notReadyModels,
    errorMap,
    scan,
    cancelScan,
    clearReport,
    progressPercent,
    testedCount,
    totalCount,
    readyCount,
    notReadyCount,
    currentModelId,
  } = useModelTester({
    providerId,
    apiKey,
    customEndpoint,
    accountId,
  });

  const [showNotReady, setShowNotReady] = useState(false);

  const handleStartTest = () => {
    scan();
  };

  const handleCancel = () => {
    cancelScan();
  };

  const handleClear = () => {
    clearReport();
  };

  return (
    <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-2.5">
      {/* Action Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
            Model Deployment Readiness
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {report && !isTesting && (
            <button
              type="button"
              onClick={handleClear}
              className="text-[10px] text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded cursor-pointer"
              title="Clear tested model cache"
            >
              <RotateCcw className="w-2.5 h-2.5 inline mr-1" />
              Reset
            </button>
          )}

          {isTesting ? (
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer shadow-2xs"
            >
              <X className="w-3 h-3" />
              <span>Cancel Test</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartTest}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs cursor-pointer transition-all active:scale-98"
              title={`Discover and test all models for ${providerName} only`}
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Test All Models</span>
            </button>
          )}
        </div>
      </div>

      {/* Live Testing Loader & Progress Bar */}
      {isTesting && progress && (
        <div className="p-3 rounded-lg bg-indigo-50/70 border border-indigo-200 space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-indigo-900 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
              <span>
                {progress.stage === "validating_key"
                  ? `Validating ${providerName} API Key...`
                  : progress.stage === "discovering_models"
                  ? `Discovering ${providerName} Models...`
                  : `Testing ${providerName} Models (${progress.testedCount} / ${progress.totalModels})...`}
              </span>
            </span>
            <span className="font-mono text-xs font-bold text-indigo-700">
              {progress.progressPercent}%
            </span>
          </div>

          {/* Graphical Progress Bar */}
          <div className="w-full bg-indigo-200/60 rounded-full h-2 overflow-hidden">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.max(5, progress.progressPercent)}%` }}
            />
          </div>

          {/* Live Progress Metrics */}
          <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium pt-0.5">
            <div className="flex items-center gap-3">
              <span>
                Tested: <strong className="text-slate-900 font-bold">{progress.testedCount}</strong>
              </span>
              <span className="text-emerald-700">
                Ready: <strong className="font-bold">{progress.readyCount}</strong>
              </span>
              <span className="text-amber-700">
                Not Ready: <strong className="font-bold">{progress.notReadyCount}</strong>
              </span>
            </div>

            {progress.currentModelName && (
              <span className="text-slate-500 font-mono text-[10px] truncate max-w-[150px]" title={progress.currentModelName}>
                {progress.currentModelName}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Error state if API key validation failed */}
      {!isTesting && report?.status === "error" && (
        <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-rose-900">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>Key / Discovery Error</span>
          </div>
          <p className="text-[11px] leading-relaxed text-rose-700">
            {report.errorMessage || "Failed to validate credentials or discover models."}
          </p>
        </div>
      )}

      {/* Prominent READY TO DEPLOY Models Section */}
      {report && report.readyModels.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide">
                Ready to Deploy ({report.readyModels.length})
              </span>
            </div>
            <span className="text-[10px] text-slate-500">
              Click to select for active formatting
            </span>
          </div>

          <div className="grid grid-cols-1 gap-1.5 max-h-[180px] overflow-y-auto pr-0.5">
            {report.readyModels.map((m) => {
              const isCurrent = m.id === selectedModelId;
              return (
                <div
                  key={m.id}
                  onClick={() => onSelectModel(m.id)}
                  className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 cursor-pointer transition-all ${
                    isCurrent
                      ? "bg-emerald-50/90 border-emerald-300 ring-1 ring-emerald-400 shadow-2xs"
                      : "bg-white hover:bg-slate-50 border-slate-200 text-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isCurrent ? "text-emerald-600" : "text-slate-400"
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 truncate" title={m.name}>
                          {m.name}
                        </span>
                        {isCurrent && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-600 text-white">
                            Selected
                          </span>
                        )}
                        <span className="px-1 py-0.2 rounded text-[9px] font-semibold bg-emerald-100 text-emerald-800">
                          {m.isFree ? "Free tier" : "Paid"}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[9px] text-slate-400 truncate max-w-[120px]">
                          {m.id}
                        </span>
                        {m.latencyMs && (
                          <span className="flex items-center gap-0.5 text-slate-500">
                            <Clock className="w-2.5 h-2.5" />
                            {m.latencyMs}ms
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectModel(m.id);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 cursor-pointer ${
                      isCurrent
                        ? "bg-emerald-700 text-white"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
                    }`}
                  >
                    {isCurrent ? "Active" : "Deploy"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* NOT READY Section (Collapsible with clear error explanations) */}
      {report && report.notReadyModels.length > 0 && (
        <div className="pt-1 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowNotReady(!showNotReady)}
            className="flex items-center justify-between w-full text-[11px] font-semibold text-slate-600 hover:text-slate-800 py-1 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <XCircle className="w-3 h-3 text-slate-400" />
              <span>Not Ready / Incompatible ({report.notReadyModels.length})</span>
            </span>
            {showNotReady ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>

          {showNotReady && (
            <div className="space-y-1.5 pt-1.5 max-h-[140px] overflow-y-auto pr-0.5">
              {report.notReadyModels.map((m) => (
                <div
                  key={m.id}
                  className="p-1.5 rounded-md bg-slate-50 border border-slate-200 text-[11px] flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <span className="font-medium text-slate-700 block truncate" title={m.name}>
                      {m.name}
                    </span>
                    <span className="text-[10px] text-rose-600 font-medium block">
                      {m.reason}
                    </span>
                  </div>
                  <span className="font-mono text-[9px] text-slate-400 shrink-0">
                    {m.id}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
