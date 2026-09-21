import React from "react";
import { Sparkles, Settings2, FileDown, Loader2, Layers, Scale } from "lucide-react";
import { FormatAILogo } from "./FormatAILogo";

interface HeaderProps {
  docTitle: string;
  onDocTitleChange: (title: string) => void;
  onOpenAISettingsModal: () => void;
  onOpenSkillsModal?: () => void;
  onOpenLicenseModal?: () => void;
  activeSkillsCount?: number;
  readyProvidersCount?: number;
  isConverting: boolean;
  onDownloadDocx: () => void;
  canDownload: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  docTitle,
  onDocTitleChange,
  onOpenAISettingsModal,
  onOpenSkillsModal,
  onOpenLicenseModal,
  activeSkillsCount = 4,
  readyProvidersCount = 1,
  isConverting,
  onDownloadDocx,
  canDownload,
}) => {
  return (
    <header className="border-b border-slate-200/90 bg-white/95 backdrop-blur-sm sticky top-0 z-30 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        {/* Left: Brand + Document Title */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className="flex items-center gap-2 shrink-0"
            title="FormatAI — Paste. Format. Get Documents. (Official Academic Typesetter)"
          >
            <FormatAILogo variant="header" size="md" showTagline={true} />
          </div>

          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="hidden sm:inline-block text-slate-300">/</span>
            <input
              id="header-doc-title"
              type="text"
              value={docTitle}
              onChange={(e) => onDocTitleChange(e.target.value)}
              placeholder="Untitled Document"
              className="text-sm font-semibold text-slate-800 bg-transparent hover:bg-slate-100/70 focus:bg-white focus:ring-1 focus:ring-amber-600/30 focus:border-slate-300 border border-transparent rounded-lg px-2.5 py-1 transition-all truncate w-full max-w-xs sm:max-w-sm"
              title="Click to rename document"
            />
          </div>
        </div>

        {/* Right: AI status & Primary Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* License & 4 Repos Trigger */}
          {onOpenLicenseModal && (
            <button
              id="btn-header-license"
              type="button"
              onClick={onOpenLicenseModal}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800 hover:text-emerald-950 bg-emerald-50/90 hover:bg-emerald-100/90 px-2.5 py-1.5 rounded-lg border border-emerald-200/90 transition-colors cursor-pointer"
              title="View MIT License, 4 GitHub Repos & Student Mission"
            >
              <Scale className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden md:inline">License & 4 Repos</span>
              <span className="md:hidden">MIT</span>
            </button>
          )}

          {/* AI Settings Trigger */}
          <button
            id="btn-ai-settings"
            onClick={onOpenAISettingsModal}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100/80 hover:bg-slate-200/80 px-2.5 py-1.5 rounded-lg border border-slate-200 transition-colors"
            title="Configure AI Models, Fallback Order & API Keys"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden md:inline">AI Settings</span>
            <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800">
              {readyProvidersCount}
            </span>
          </button>

          {/* Primary Download Word Button */}
          <button
            id="btn-header-download"
            onClick={onDownloadDocx}
            disabled={!canDownload || isConverting}
            className="inline-flex items-center justify-center gap-1.5 text-xs sm:text-sm font-semibold text-white px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-all shadow-xs disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            style={{ backgroundColor: "#1A365D" }}
            title="Download publication-ready Microsoft Word (.docx) document"
          >
            {isConverting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-blue-200" />
                <span className="hidden sm:inline">Generating Word...</span>
                <span className="sm:hidden">Saving...</span>
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4 text-blue-200" />
                <span>Export Word (.docx)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
