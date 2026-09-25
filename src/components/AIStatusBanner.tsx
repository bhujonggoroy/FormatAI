import React, { useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RotateCw,
  Sliders,
  ChevronDown,
  X,
  ShieldAlert,
  Info,
} from "lucide-react";
import { AIStatusNotification } from "../types/ai";

interface AIStatusBannerProps {
  notification: AIStatusNotification | null;
  onDismiss: () => void;
  onOpenSettings?: () => void;
  onRetry?: () => void;
  onOpenAuditLogs?: () => void;
}

export const AIStatusBanner: React.FC<AIStatusBannerProps> = ({
  notification,
  onDismiss,
  onOpenSettings,
  onRetry,
  onOpenAuditLogs,
}) => {
  const [isTechDetailsOpen, setIsTechDetailsOpen] = useState(false);

  if (!notification) return null;

  const {
    type,
    badgeLabel,
    badgeColor,
    badgeIcon,
    title,
    secondaryText,
    actionType,
    actionLabel,
    secondaryActionLabel,
    technicalDetails,
  } = notification;

  // Visual Theme Setup matching FormatAI design language
  const themeStyles = {
    emerald: {
      container: "bg-emerald-50/90 border-emerald-300 text-emerald-950",
      badge: "bg-emerald-100 text-emerald-900 border-emerald-300",
      iconBg: "bg-emerald-600 text-white",
      mainIcon: <CheckCircle2 className="w-4 h-4" />,
      primaryBtn: "bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs",
    },
    amber: {
      container: "bg-amber-50/90 border-amber-300 text-amber-950",
      badge: "bg-amber-100 text-amber-900 border-amber-300",
      iconBg: "bg-amber-500 text-white",
      mainIcon: <AlertTriangle className="w-4 h-4" />,
      primaryBtn: "bg-amber-600 hover:bg-amber-700 text-white shadow-2xs",
    },
    rose: {
      container: "bg-rose-50/95 border-rose-300 text-rose-950",
      badge: "bg-rose-100 text-rose-900 border-rose-300",
      iconBg: "bg-rose-600 text-white",
      mainIcon: <AlertCircle className="w-4 h-4" />,
      primaryBtn: "bg-rose-600 hover:bg-rose-700 text-white shadow-2xs",
    },
    slate: {
      container: "bg-slate-100/95 border-slate-300 text-slate-900",
      badge: "bg-slate-200 text-slate-800 border-slate-300",
      iconBg: "bg-slate-600 text-white",
      mainIcon: <Info className="w-4 h-4" />,
      primaryBtn: "bg-slate-700 hover:bg-slate-800 text-white shadow-2xs",
    },
    blue: {
      container: "bg-blue-50/90 border-blue-300 text-blue-950",
      badge: "bg-blue-100 text-blue-900 border-blue-300",
      iconBg: "bg-blue-600 text-white",
      mainIcon: <Sparkles className="w-4 h-4" />,
      primaryBtn: "bg-blue-600 hover:bg-blue-700 text-white shadow-2xs",
    },
  }[badgeColor];

  const handleActionClick = () => {
    if (actionType === "settings" || actionType === "another_provider") {
      onOpenSettings?.();
    } else if (actionType === "audit") {
      onOpenAuditLogs ? onOpenAuditLogs() : onOpenSettings?.();
    } else if (actionType === "retry") {
      onRetry?.();
    }
  };

  return (
    <div
      id="ai-status-notification"
      role="status"
      aria-live="polite"
      className={`w-full rounded-2xl border-2 p-3 sm:p-4 shadow-sm transition-all animate-fadeIn select-text ${themeStyles.container}`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left icon + status header */}
        <div className="flex items-start gap-2.5 sm:gap-3 flex-1 min-w-0">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs mt-0.5 ${themeStyles.iconBg}`}>
            {themeStyles.mainIcon}
          </div>

          <div className="flex-1 min-w-0">
            {/* Top row: Signal Badge & Action Labels */}
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-black uppercase tracking-wider border shadow-2xs ${themeStyles.badge}`}>
                <span className="text-[11px] leading-none" aria-hidden="true">
                  {badgeIcon}
                </span>
                <span>{badgeLabel}</span>
              </span>

              {notification.latencyMs !== undefined && notification.latencyMs > 0 && (
                <span className="text-[10px] font-mono text-slate-500 bg-white/80 px-1.5 py-0.5 rounded border border-slate-200">
                  {notification.latencyMs}ms
                </span>
              )}
            </div>

            {/* Primary Large Readable Title */}
            <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
              {title}
            </h4>

            {/* Human-Readable Secondary Explanation */}
            <p className="text-xs text-slate-700 mt-1 font-medium leading-normal">
              {secondaryText}
            </p>

            {/* Primary & Secondary Action Buttons if present */}
            {(actionLabel || secondaryActionLabel) && (
              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                {actionLabel && (
                  <button
                    type="button"
                    onClick={handleActionClick}
                    className={`inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1.5 rounded-xl cursor-pointer transition-all active:scale-95 ${themeStyles.primaryBtn}`}
                  >
                    {actionType === "settings" || actionType === "another_provider" ? (
                      <Sliders className="w-3.5 h-3.5" />
                    ) : actionType === "retry" ? (
                      <RotateCw className="w-3.5 h-3.5" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>{actionLabel}</span>
                  </button>
                )}

                {secondaryActionLabel && onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 shadow-2xs cursor-pointer transition-all active:scale-95"
                  >
                    <RotateCw className="w-3 h-3 text-slate-500" />
                    <span>{secondaryActionLabel}</span>
                  </button>
                )}
              </div>
            )}

            {/* Collapsible Technical Details Section */}
            {technicalDetails && (
              <div className="mt-2.5 pt-2 border-t border-black/10">
                <button
                  type="button"
                  onClick={() => setIsTechDetailsOpen(!isTechDetailsOpen)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isTechDetailsOpen ? "rotate-180" : ""
                    }`}
                  />
                  <span>Technical Details</span>
                </button>

                {isTechDetailsOpen && (
                  <div className="mt-2 p-2.5 rounded-xl bg-white/95 border border-slate-200 text-[11px] font-mono text-slate-700 space-y-1 shadow-2xs animate-in fade-in duration-150">
                    {technicalDetails.provider && (
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-500 font-sans">Provider:</span>
                        <span className="font-bold text-slate-900">{technicalDetails.provider}</span>
                      </div>
                    )}
                    {technicalDetails.model && (
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-500 font-sans">Model:</span>
                        <span className="text-slate-800">{technicalDetails.model}</span>
                      </div>
                    )}
                    {technicalDetails.requestStatus && (
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-500 font-sans">Status Code / State:</span>
                        <span className="font-semibold text-slate-800">{technicalDetails.requestStatus}</span>
                      </div>
                    )}
                    {technicalDetails.fallbackAttempt && (
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-500 font-sans">Fallback Trace:</span>
                        <span className="text-amber-800 font-semibold">{technicalDetails.fallbackAttempt}</span>
                      </div>
                    )}
                    {technicalDetails.executionTime && (
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-500 font-sans">Execution Time:</span>
                        <span>{technicalDetails.executionTime}</span>
                      </div>
                    )}
                    {technicalDetails.technicalErrorMessage && (
                      <div className="mt-1 pt-1 border-t border-slate-100 text-rose-700 text-[10px] break-all">
                        <span className="font-sans font-bold text-slate-500">Error: </span>
                        {technicalDetails.technicalErrorMessage}
                      </div>
                    )}

                    {/* Step-by-Step Fallback Chain */}
                    {technicalDetails.rawChain && technicalDetails.rawChain.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-200">
                        <div className="font-sans font-bold text-slate-800 text-[11px] mb-1.5 flex items-center justify-between">
                          <span>Execution Steps ({technicalDetails.rawChain.length}):</span>
                          <span className="text-[10px] text-slate-400 font-normal">Full Fallback Trace</span>
                        </div>
                        <div className="space-y-1.5 font-sans">
                          {technicalDetails.rawChain.map((step, idx) => (
                            <div
                              key={idx}
                              className={`p-2 rounded-lg border text-[11px] ${
                                step.status === "success"
                                  ? "bg-emerald-50/70 border-emerald-200"
                                  : "bg-slate-50 border-slate-200"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-slate-800">
                                  {idx + 1}. {step.providerName}
                                </span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                    step.status === "success"
                                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                      : step.status === "rate_limited"
                                      ? "bg-rose-100 text-rose-800 border border-rose-300"
                                      : step.status === "invalid_key" || step.status === "permission_denied"
                                      ? "bg-amber-100 text-amber-900 border border-amber-300"
                                      : step.status === "timeout"
                                      ? "bg-amber-100 text-amber-800 border border-amber-300"
                                      : "bg-slate-200 text-slate-700 border border-slate-300"
                                  }`}
                                >
                                  {step.status}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-mono text-slate-500 mt-0.5">
                                <span>Model: <span className="text-slate-700">{step.model}</span></span>
                                {step.keyMasked && step.keyMasked !== "none" && (
                                  <span>• Key: <span className="text-slate-700">{step.keyMasked}</span></span>
                                )}
                                {step.latencyMs !== undefined && step.latencyMs > 0 && (
                                  <span>• Latency: {step.latencyMs}ms</span>
                                )}
                              </div>
                              {step.errorMessage && (
                                <div className="mt-1 text-[10px] text-rose-700 font-sans break-words bg-rose-50/80 p-1.5 rounded border border-rose-100">
                                  <span className="font-bold text-rose-800">Reason: </span>
                                  {step.errorMessage}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={onDismiss}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-black/5 transition-colors cursor-pointer shrink-0"
          title="Dismiss notification"
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
