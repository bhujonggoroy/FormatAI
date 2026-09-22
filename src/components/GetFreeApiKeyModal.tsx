import React, { useEffect, useRef } from "react";
import { ExternalLink, X, Shield, Sparkles } from "lucide-react";
import { ProviderHelpConfig } from "../data/providerHelp";

interface GetFreeApiKeyModalProps {
  providerHelp: ProviderHelpConfig | null;
  isOpen: boolean;
  onClose: () => void;
}

export const GetFreeApiKeyModal: React.FC<GetFreeApiKeyModalProps> = ({
  providerHelp,
  isOpen,
  onClose,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const ctaButtonRef = useRef<HTMLButtonElement>(null);

  // Keyboard accessibility: Escape to close, focus trapping
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    // Auto-focus the primary CTA
    const timer = setTimeout(() => {
      ctaButtonRef.current?.focus();
    }, 50);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timer);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !providerHelp) return null;

  const handleOpenProviderUrl = () => {
    window.open(providerHelp.apiKeyUrl, "_blank", "noopener,noreferrer");
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="free-key-modal-title"
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs antialiased animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col scale-100 transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 id="free-key-modal-title" className="text-sm font-bold text-slate-900 leading-snug">
                Get {providerHelp.name} API Key
              </h3>
              <p className="text-[11px] font-medium text-emerald-700">
                {providerHelp.freeLabel}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-3.5 text-xs text-slate-600 leading-relaxed">
          <p className="text-slate-800 font-medium">
            Create your own API key from{" "}
            <span className="font-semibold text-slate-900">{providerHelp.name}</span> and add it to FormatAI.
          </p>

          <p className="text-slate-600">
            Free-tier availability and usage limits are controlled by{" "}
            <span className="font-medium text-slate-800">{providerHelp.providerOrg}</span>.
          </p>

          <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200/80 flex items-start gap-2.5 text-[11px] text-amber-900">
            <Shield className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Local Privacy Guarantee:</span>
              <p className="mt-0.5 text-amber-800/90 leading-normal">
                FormatAI does not collect, intercept, or sync keys. Once generated, simply copy and paste your key into FormatAI's key field.
              </p>
            </div>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 cursor-pointer"
          >
            Cancel
          </button>

          <button
            ref={ctaButtonRef}
            type="button"
            onClick={handleOpenProviderUrl}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 cursor-pointer"
          >
            <span>Get Free API Key</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
