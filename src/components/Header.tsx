import React from "react";
import { FileText, Sparkles, Terminal, ExternalLink } from "lucide-react";

interface HeaderProps {
  onOpenDeployModal: () => void;
  onOpenAISettingsModal: () => void;
  readyProvidersCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenDeployModal,
  onOpenAISettingsModal,
  readyProvidersCount = 1,
}) => {
  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-900 text-white flex items-center justify-center shadow-xs">
            <FileText className="w-5 h-5 text-blue-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                NotebookLM to DOCX Converter
              </h1>
              <button
                onClick={onOpenAISettingsModal}
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 transition-colors"
                title="Configure Multi-Provider AI Fallback & Models"
              >
                <Sparkles className="w-3 h-3 text-blue-600" />
                <span>Multi-Provider AI (Auto-Fallback)</span>
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Clean up raw study notes, normalize LaTeX math to Unicode, and export publication-ready Word documents.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={onOpenAISettingsModal}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-950 bg-blue-50/80 hover:bg-blue-100/80 px-3 py-1.5 rounded-lg border border-blue-200 shadow-2xs transition-colors"
            title="Configure AI Providers, Auto-Fallback & API Keys"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-700" />
            <span>AI Settings & Providers</span>
          </button>

          <button
            onClick={onOpenDeployModal}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg border border-slate-300 transition-colors"
            title="View Python backend code, Vercel & Render configs"
          >
            <Terminal className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">Python & Serverless</span>
            <span className="sm:hidden">Deploy</span>
          </button>
        </div>
      </div>
    </header>
  );
};
