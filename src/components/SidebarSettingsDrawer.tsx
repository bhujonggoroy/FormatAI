import React from "react";
import {
  X,
  Sparkles,
  Layers,
  Scale,
  Settings2,
  FileText,
  Type,
  Palette,
  SquareRadical,
  GraduationCap,
  Clipboard,
  Eraser,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Zap,
  Download,
} from "lucide-react";
import { FormatAILogo } from "./FormatAILogo";

interface SidebarSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  // Multi-Provider AI
  readyProvidersCount: number;
  aiProvidersSummary: string[];
  aiMode: string;
  isFreeOnly: boolean;
  onOpenAISettingsModal: () => void;
  // Academic Skills
  activeSkillsCount: number;
  onOpenSkillsModal: () => void;
  onOpenLicenseModal: () => void;
  // Document Options
  fontFamily: string;
  onFontFamilyChange: (font: string) => void;
  accentColor: string;
  onAccentColorChange: (color: string) => void;
  equationFormat: "native" | "latex" | "unicode";
  onEquationFormatChange: (fmt: "native" | "latex" | "unicode") => void;
  formatMode: "auto" | "study_guide" | "exam_bank";
  onFormatModeChange: (mode: "auto" | "study_guide" | "exam_bank") => void;
  // Quick Document Actions
  onPasteClipboard: () => void;
  onClearText: () => void;
  charCount: number;
  wordCount: number;
  // PWA Installation
  isInstalled?: boolean;
  hasNativePrompt?: boolean;
  onInstallApp?: () => void;
}

export const SidebarSettingsDrawer: React.FC<SidebarSettingsDrawerProps> = ({
  isOpen,
  onClose,
  readyProvidersCount,
  aiProvidersSummary,
  aiMode,
  isFreeOnly,
  onOpenAISettingsModal,
  activeSkillsCount,
  onOpenSkillsModal,
  onOpenLicenseModal,
  fontFamily,
  onFontFamilyChange,
  accentColor,
  onAccentColorChange,
  equationFormat,
  onEquationFormatChange,
  formatMode,
  onFormatModeChange,
  onPasteClipboard,
  onClearText,
  charCount,
  wordCount,
  isInstalled = false,
  hasNativePrompt = false,
  onInstallApp,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Dark semi-transparent backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel sliding in from left */}
      <div className="relative z-50 w-full max-w-sm sm:max-w-md bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-left duration-250">
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <FormatAILogo size="sm" />
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">Settings & Tools</h2>
              <p className="text-[11px] text-slate-500">FormatAI Configuration Center</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            title="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-slate-700 text-xs">
          {/* INSTALL APP - Prominently placed right at top of 3-lines bar drawer */}
          {!isInstalled && onInstallApp && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50/80 border border-blue-200/90 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm leading-tight">Install App</h3>
                    <p className="text-[11px] text-slate-500">Standalone desktop & mobile app</p>
                  </div>
                </div>
                {hasNativePrompt ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Ready
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100/70 text-blue-800">
                    PWA
                  </span>
                )}
              </div>
              <button
                id="btn-sidebar-install-app-top"
                type="button"
                onClick={() => {
                  onInstallApp?.();
                }}
                className="w-full flex items-center justify-between p-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs transition-colors shadow-xs cursor-pointer"
                title="Install FormatAI application"
              >
                <span className="flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  <span>Install FormatAI</span>
                </span>
                <ChevronRight className="w-4 h-4 text-blue-200" />
              </button>
            </div>
          )}

          {/* SECTION 1: Multi-Provider AI Settings */}
          <div className="bg-gradient-to-br from-blue-50/60 to-indigo-50/40 border border-blue-100 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">AI Engine & Providers</h3>
                  <p className="text-[11px] text-slate-500">Multi-provider failover & models</p>
                </div>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                {readyProvidersCount} Ready
              </span>
            </div>

            <div className="text-[11px] text-slate-600 space-y-1 bg-white/80 rounded-lg p-2.5 border border-blue-100/80">
              <div className="flex justify-between">
                <span className="text-slate-500">Active Mode:</span>
                <span className="font-semibold text-slate-800 capitalize">{aiMode || "Auto-Failover"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cost Protection:</span>
                <span className={`font-semibold ${isFreeOnly ? "text-emerald-600" : "text-slate-700"}`}>
                  {isFreeOnly ? "Free-Only Active" : "Standard"}
                </span>
              </div>
              {aiProvidersSummary && aiProvidersSummary.length > 0 && (
                <div className="pt-1 border-t border-slate-100 flex flex-wrap gap-1 mt-1">
                  {aiProvidersSummary.map((p) => (
                    <span key={p} className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-medium">
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAISettingsModal();
              }}
              className="w-full flex items-center justify-between bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 rounded-lg text-xs transition-colors shadow-xs cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5" />
                Configure AI Keys & Fallback
              </span>
              <ChevronRight className="w-4 h-4 text-blue-200" />
            </button>
          </div>

          {/* SECTION 2: Academic Skills & Standards */}
          <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-xs">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Academic Skills</h3>
                  <p className="text-[11px] text-slate-500">4-Tier formatting pipeline</p>
                </div>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800">
                {activeSkillsCount} Active
              </span>
            </div>

            <p className="text-[11px] text-slate-600 leading-relaxed">
              Standardizes math symbols, cleans raw ASCII pipes, and converts LaTeX equations into true Word Math formulas.
            </p>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSkillsModal();
              }}
              className="w-full flex items-center justify-between bg-white hover:bg-purple-50 text-purple-950 border border-purple-200 font-semibold py-2 px-3 rounded-lg text-xs transition-colors shadow-2xs cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-600" />
                Skills Hub & 15 Standards
              </span>
              <ChevronRight className="w-4 h-4 text-purple-400" />
            </button>
          </div>

          {/* SECTION 3: Document Defaults & Typography */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-slate-400">
              Document Formatting
            </h4>

            {/* Font selection */}
            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-slate-500" />
                <span className="font-semibold text-slate-700">Font Family</span>
              </div>
              <select
                value={fontFamily}
                onChange={(e) => onFontFamilyChange(e.target.value)}
                className="bg-white border border-slate-200 text-slate-800 text-xs font-medium rounded-md px-2 py-1 focus:outline-none"
              >
                <option value="Times New Roman">Times New Roman</option>
                <option value="Georgia">Georgia</option>
                <option value="Calibri">Calibri</option>
                <option value="Arial">Arial</option>
                <option value="Aptos">Aptos</option>
              </select>
            </div>

            {/* Equation format */}
            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2">
                <SquareRadical className="w-4 h-4 text-slate-500" />
                <span className="font-semibold text-slate-700">Math Output</span>
              </div>
              <select
                value={equationFormat}
                onChange={(e) => onEquationFormatChange(e.target.value as any)}
                className="bg-white border border-slate-200 text-slate-800 text-xs font-medium rounded-md px-2 py-1 focus:outline-none"
              >
                <option value="native">Word Math (OMML)</option>
                <option value="latex">LaTeX ($...$)</option>
              </select>
            </div>

            {/* Format preset */}
            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-slate-500" />
                <span className="font-semibold text-slate-700">Structure Preset</span>
              </div>
              <select
                value={formatMode}
                onChange={(e) => onFormatModeChange(e.target.value as any)}
                className="bg-white border border-slate-200 text-slate-800 text-xs font-medium rounded-md px-2 py-1 focus:outline-none"
              >
                <option value="study_guide">Study Guide & Formulas</option>
                <option value="exam_bank">Exam Question Bank</option>
                <option value="auto">Auto-Detect</option>
              </select>
            </div>
          </div>

          {/* SECTION 4: Quick Actions */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-slate-400">
              Editor Tools
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onPasteClipboard();
                  onClose();
                }}
                className="flex items-center justify-center gap-1.5 p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-medium transition-colors cursor-pointer"
              >
                <Clipboard className="w-3.5 h-3.5 text-slate-500" />
                <span>Paste Notes</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onClearText();
                  onClose();
                }}
                className="flex items-center justify-center gap-1.5 p-2 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg text-slate-700 hover:text-rose-700 font-medium transition-colors cursor-pointer"
              >
                <Eraser className="w-3.5 h-3.5 text-slate-500" />
                <span>Clear Notes</span>
              </button>
            </div>
            <div className="text-[11px] text-slate-400 text-center pt-1">
              Current Document: {charCount.toLocaleString()} chars • {wordCount.toLocaleString()} words
            </div>
          </div>

          {/* FormatAI Mission & Core Motto */}
          <div className="bg-gradient-to-br from-amber-50/80 to-orange-50/50 border border-amber-200/90 rounded-xl p-3.5 space-y-2 text-slate-800">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-950 uppercase tracking-wide">
              <span>FormatAI Mission</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-700">
              ChatGPT, Gemini, Claude, NotebookLM বা যেকোনো source থেকে পাওয়া AI-generated বা copy-pasted content-কে স্বয়ংক্রিয়ভাবে mathematical, scientific, textual এবং academic formatting সহ একটি clean, professional, editable DOCX document-এ রূপান্তর করা—শিক্ষার্থীদের জন্য সম্পূর্ণ বিনামূল্যে।
            </p>
          </div>

          {/* SECTION 5: Open Source & MIT License */}
          <div className="border-t border-slate-200 pt-4 space-y-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenLicenseModal();
              }}
              className="w-full flex items-center justify-between p-2.5 bg-emerald-50/80 hover:bg-emerald-100/80 border border-emerald-200 rounded-lg text-emerald-950 font-semibold transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-emerald-600" />
                <span>MIT License & 4 Upstream Repos</span>
              </span>
              <ChevronRight className="w-4 h-4 text-emerald-600" />
            </button>
            <p className="text-[11px] text-slate-500 text-center">
              FormatAI is free for students worldwide. All academic code is open source.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
