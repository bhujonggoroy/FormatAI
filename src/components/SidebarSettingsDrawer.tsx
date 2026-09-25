import React, { useState } from "react";
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
  Check,
  Cpu,
  Sliders,
  Server,
  Workflow,
  BookOpen,
  ArrowDown,
  ListChecks,
  FileCheck2,
  HelpCircle,
  RefreshCw,
} from "lucide-react";
import { FormatAILogo } from "./FormatAILogo";
import { ACADEMIC_THEMES, getAcademicTheme } from "../utils/theme";
import { skillRegistry } from "../skills";
import {
  ACADEMIC_SYSTEM_WORKFLOW,
  FORMATTING_ORDER_COMMANDS,
  RECOMMENDED_ACADEMIC_SYSTEM_PROMPT,
} from "../shared/academicWorkflow";


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
  // Custom Prompt & Academic Workflow
  customPrompt?: string;
  onCustomPromptChange?: (prompt: string) => void;
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
  customPrompt = "",
  onCustomPromptChange,
  isInstalled = false,
  hasNativePrompt = false,
  onInstallApp,
}) => {
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  if (!isOpen) return null;

  const currentTheme = getAcademicTheme(accentColor);
  const skills = skillRegistry.getAllSkills();

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Dark semi-transparent backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel sliding in from left */}
      <div className="relative z-50 w-full max-w-sm sm:max-w-md bg-[#F8FAFC] h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-left duration-250 border-r-2 border-slate-300">
        {/* Top dynamic theme accent bar */}
        <div
          className="h-1.5 w-full transition-colors duration-300"
          style={{ backgroundColor: currentTheme.hex }}
        />

        {/* Drawer Header */}
        <div className="px-5 py-3.5 border-b-2 border-slate-200 flex items-center justify-between bg-white shadow-2xs">
          <div className="flex items-center gap-2.5">
            <FormatAILogo size="sm" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900 leading-tight">Settings & Tools</h2>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-extrabold"
                  style={{
                    backgroundColor: currentTheme.badgeBg,
                    color: currentTheme.badgeText,
                  }}
                >
                  {currentTheme.label}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">FormatAI Academic Engine</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
            title="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-slate-800 text-xs">
          {/* ================= PWA INSTALLATION BAR ================= */}
          {!isInstalled && onInstallApp && (
            <div className="bg-white border-2 border-blue-200 rounded-2xl p-3.5 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm leading-tight">Install FormatAI</h3>
                    <p className="text-[11px] text-slate-500">Fast offline-ready desktop & mobile PWA</p>
                  </div>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                  {hasNativePrompt ? "1-Click" : "PWA Ready"}
                </span>
              </div>
              <button
                id="btn-sidebar-install-app-top"
                type="button"
                onClick={onInstallApp}
                className="w-full flex items-center justify-between p-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-extrabold rounded-xl text-xs transition-colors shadow-2xs cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  <span>Install Web App</span>
                </span>
                <ChevronRight className="w-4 h-4 text-blue-200" />
              </button>
            </div>
          )}

          {/* ================= FULL THEME COLOR SELECTOR BAR ================= */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-3.5 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white shadow-2xs shrink-0"
                  style={{ backgroundColor: currentTheme.hex }}
                >
                  <Palette className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm leading-tight">Full Theme Color</h3>
                  <p className="text-[11px] text-slate-500">App accents, headers & document styling</p>
                </div>
              </div>
              <span
                className="text-[10px] font-extrabold px-2 py-0.5 rounded-md border"
                style={{
                  backgroundColor: currentTheme.badgeBg,
                  color: currentTheme.badgeText,
                  borderColor: currentTheme.border,
                }}
              >
                {currentTheme.label}
              </span>
            </div>

            {/* Sub-button bar: 8 Theme Color Swatches */}
            <div className="grid grid-cols-4 gap-2 pt-1">
              {ACADEMIC_THEMES.map((t) => {
                const isSelected = accentColor.toLowerCase() === t.hex.toLowerCase();
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onAccentColorChange(t.hex)}
                    className={`p-2 rounded-xl border-2 flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      isSelected
                        ? "border-slate-800 bg-slate-100/90 shadow-2xs ring-2 ring-slate-300"
                        : "border-slate-200 hover:border-slate-400 bg-white hover:bg-slate-50"
                    }`}
                    title={`${t.label}: ${t.desc}`}
                  >
                    <span
                      className="w-5 h-5 rounded-full border border-white shadow-2xs flex items-center justify-center"
                      style={{ backgroundColor: t.hex }}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                    </span>
                    <span className="text-[10px] font-bold text-slate-800 truncate w-full text-center">
                      {t.label.split(" ")[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ================= SECTION 1: AI ENGINE & PROVIDERS BARS ================= */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 space-y-3 shadow-2xs">
            {/* Top Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">AI Engine & Providers</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Multi-model failover & normalization</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-800 border border-blue-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {readyProvidersCount} Ready
              </span>
            </div>

            {/* Providers Status Sub-Button Bar */}
            <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-600 font-bold">Execution Engine:</span>
                <span className="font-extrabold text-blue-900 bg-blue-100/70 px-2 py-0.5 rounded border border-blue-200">
                  Google Gemini (Free Tier)
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-600 font-bold">Failover Protocol:</span>
                <span className="font-bold text-slate-800 capitalize bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  {aiMode || "Auto-Failover"}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-600 font-bold">Cost Protection:</span>
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  {isFreeOnly ? "100% Free Guaranteed" : "Standard"}
                </span>
              </div>

              {/* Providers Sub-bar chips */}
              <div className="pt-2 border-t border-slate-200">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Connected Providers Bar:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { name: "Gemini", status: "Active (Free)", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
                    { name: "Claude", status: "Ready", color: "bg-slate-100 text-slate-700 border-slate-300" },
                    { name: "OpenAI", status: "Ready", color: "bg-slate-100 text-slate-700 border-slate-300" },
                    { name: "DeepSeek", status: "Ready", color: "bg-slate-100 text-slate-700 border-slate-300" },
                    { name: "Groq", status: "Fast", color: "bg-slate-100 text-slate-700 border-slate-300" },
                    { name: "OpenRouter", status: "Ready", color: "bg-slate-100 text-slate-700 border-slate-300" },
                    { name: "Mistral", status: "Ready", color: "bg-slate-100 text-slate-700 border-slate-300" },
                    { name: "Ollama", status: "Local", color: "bg-slate-100 text-slate-700 border-slate-300" },
                  ].map((p) => (
                    <span
                      key={p.name}
                      className={`text-[10px] px-2 py-0.5 rounded-md font-bold border flex items-center gap-1 ${p.color}`}
                    >
                      {p.name === "Gemini" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />}
                      <span>{p.name}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* AI Action Sub-Button Bar */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAISettingsModal();
              }}
              className="w-full flex items-center justify-between bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-2.5 px-3.5 rounded-xl text-xs transition-colors shadow-2xs cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-blue-200" />
                <span>Configure AI Keys & Fallback Engine</span>
              </span>
              <ChevronRight className="w-4 h-4 text-blue-200" />
            </button>
          </div>

          {/* ================= SECTION 2: ACADEMIC SKILLS BAR ================= */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Workflow className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Academic Skills</h3>
                  <p className="text-[11px] text-slate-500 font-medium">4-Tier formatting & 15 Rules Pipeline</p>
                </div>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-900 border border-purple-200">
                {activeSkillsCount} Active
              </span>
            </div>

            {/* 4-Tier Interactive Academic Pipeline Sub-Bar */}
            <div className="bg-purple-50/60 rounded-xl p-2.5 border border-purple-200 space-y-1.5">
              <div className="text-[10px] font-bold text-purple-900 uppercase tracking-wider mb-1">
                4-Tier Pipeline Architecture:
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <div className="bg-white p-2 rounded-lg border border-purple-200/80 shadow-2xs">
                  <div className="font-extrabold text-purple-950 flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold flex items-center justify-center">1</span>
                    Text Sanitizer
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Cleans ASCII pipes & noise</div>
                </div>
                <div className="bg-white p-2 rounded-lg border border-purple-200/80 shadow-2xs">
                  <div className="font-extrabold text-purple-950 flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold flex items-center justify-center">2</span>
                    Math Normalizer
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">\hat&#123;p&#125;, \bar&#123;X&#125;, S^2, \operatorname</div>
                </div>
                <div className="bg-white p-2 rounded-lg border border-purple-200/80 shadow-2xs">
                  <div className="font-extrabold text-purple-950 flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold flex items-center justify-center">3</span>
                    15 System Rules
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">AGENTS & GEMINI compliance</div>
                </div>
                <div className="bg-white p-2 rounded-lg border border-purple-200/80 shadow-2xs">
                  <div className="font-extrabold text-purple-950 flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold flex items-center justify-center">4</span>
                    Word OMML
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Native DOCX math equations</div>
                </div>
              </div>
            </div>

            {/* Academic Skills Launch Sub-Button */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSkillsModal();
              }}
              className="w-full flex items-center justify-between bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold py-2.5 px-3.5 rounded-xl text-xs transition-colors shadow-2xs cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-200" />
                <span>Skills Hub & 15 Academic Standards</span>
              </span>
              <ChevronRight className="w-4 h-4 text-purple-200" />
            </button>
          </div>

          {/* ================= SECTION 3: DOCUMENT FORMATTING SUB BUTTON BARS ================= */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 space-y-3 shadow-2xs">
            <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-slate-500" />
              <span>Document Formatting Bars</span>
            </h4>

            {/* Font selection sub-bar */}
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-700">Typography Standard</span>
              <div className="grid grid-cols-3 gap-1.5">
                {["Times New Roman", "Georgia", "Calibri", "Arial", "Aptos"].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => onFontFamilyChange(f)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center border cursor-pointer truncate ${
                      fontFamily === f
                        ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                    style={{ fontFamily: f }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Equation format sub-button bar */}
            <div className="space-y-1 pt-1">
              <span className="text-[11px] font-bold text-slate-700">Math Conversion Bar</span>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => onEquationFormatChange("native")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    equationFormat === "native"
                      ? "bg-white text-indigo-900 shadow-2xs border border-slate-300"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Word Math (OMML)
                </button>
                <button
                  type="button"
                  onClick={() => onEquationFormatChange("latex")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    equationFormat === "latex"
                      ? "bg-white text-indigo-900 shadow-2xs border border-slate-300"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  LaTeX ($...$)
                </button>
              </div>
            </div>

            {/* Structure preset sub-button bar */}
            <div className="space-y-1 pt-1">
              <span className="text-[11px] font-bold text-slate-700">Structure Preset</span>
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                {[
                  { id: "study_guide", label: "Study Guide" },
                  { id: "exam_bank", label: "Exam Bank" },
                  { id: "auto", label: "Auto-Detect" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onFormatModeChange(m.id as any)}
                    className={`py-1.5 px-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer truncate ${
                      formatMode === m.id
                        ? "bg-white text-amber-900 shadow-2xs border border-slate-300"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ================= SECTION: SYSTEM WORK FLOW & FORMATTING RULES ================= */}
          <div className="bg-white border-2 border-indigo-200 rounded-2xl p-3.5 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Workflow className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                    Academic System Workflow
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium">10-Step Publication Pipeline</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWorkflow((prev) => !prev)}
                className="px-2.5 py-1 text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
              >
                {showWorkflow ? "Compact View" : "View 10 Steps"}
              </button>
            </div>

            {/* Visual Workflow Steps */}
            {showWorkflow ? (
              <div className="space-y-2 pt-1">
                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200 space-y-1">
                  {ACADEMIC_SYSTEM_WORKFLOW.map((step, idx) => (
                    <div key={step} className="flex flex-col items-center">
                      <div className="w-full flex items-center gap-2 px-2.5 py-1.5 bg-white rounded-lg border border-slate-200 text-[11px] font-bold text-slate-800 shadow-2xs">
                        <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-800 flex items-center justify-center text-[10px] font-extrabold shrink-0">
                          {idx + 1}
                        </span>
                        <span className="truncate">{step}</span>
                      </div>
                      {idx < ACADEMIC_SYSTEM_WORKFLOW.length - 1 && (
                        <ArrowDown className="w-3.5 h-3.5 text-indigo-400 my-0.5" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Formatting Order Commands */}
                <div className="bg-amber-50/70 rounded-xl p-2.5 border border-amber-200 space-y-1 text-[11px]">
                  <span className="font-extrabold text-amber-950 uppercase tracking-wide flex items-center gap-1">
                    <ListChecks className="w-3.5 h-3.5 text-amber-700" />
                    <span>Formatting Order</span>
                  </span>
                  <ul className="space-y-1 pl-1 text-slate-700 text-[10.5px]">
                    {FORMATTING_ORDER_COMMANDS.map((cmd) => (
                      <li key={cmd} className="flex items-start gap-1.5">
                        <span className="text-amber-600 font-bold">•</span>
                        <span>{cmd}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-1 text-[10px] font-semibold text-slate-600 pt-0.5">
                <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">Input</span>
                <span>→</span>
                <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">Preservation</span>
                <span>→</span>
                <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">Year & Exam</span>
                <span>→</span>
                <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">LaTeX & Matrix</span>
                <span>→</span>
                <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">Quality Check</span>
                <span>→</span>
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Output</span>
              </div>
            )}
          </div>

          {/* ================= SECTION: ACADEMIC SYSTEM PROMPT & CUSTOM INSTRUCTIONS ================= */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-3.5 space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <FileCheck2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Academic System Prompt</span>
              </h4>
              <button
                type="button"
                onClick={() => {
                  if (onCustomPromptChange) {
                    onCustomPromptChange(RECOMMENDED_ACADEMIC_SYSTEM_PROMPT);
                    setCopiedPrompt(true);
                    setTimeout(() => setCopiedPrompt(false), 2000);
                  }
                }}
                className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-extrabold transition-colors cursor-pointer"
                title="Load the official Academic Document Formatting Assistant prompt"
              >
                <Sparkles className="w-3 h-3 text-blue-600" />
                <span>{copiedPrompt ? "Loaded!" : "Load Recommended Prompt"}</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-500 leading-snug">
              Instruct the AI typesetter with specific exam rules, matrix formats (<code className="text-[10px] font-mono bg-slate-100 px-1 py-0.5 rounded">\begin&#123;bmatrix&#125;</code>), and side notes.
            </p>

            <textarea
              value={customPrompt}
              onChange={(e) => onCustomPromptChange && onCustomPromptChange(e.target.value)}
              placeholder="Enter custom formatting instructions, or click 'Load Recommended Prompt' above..."
              rows={4}
              className="w-full text-[11px] font-mono p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y"
            />

            {customPrompt && (
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Custom instructions active</span>
                </span>
                <button
                  type="button"
                  onClick={() => onCustomPromptChange && onCustomPromptChange("")}
                  className="text-[10px] text-slate-500 hover:text-rose-600 font-bold transition-colors cursor-pointer"
                >
                  Clear Instructions
                </button>
              </div>
            )}
          </div>


          {/* ================= SECTION 4: EDITOR QUICK TOOLS ================= */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 space-y-2.5 shadow-2xs">
            <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-slate-500" />
              <span>Editor Tools Sub-Bar</span>
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onPasteClipboard();
                  onClose();
                }}
                className="min-h-[40px] flex items-center justify-center gap-2 p-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors cursor-pointer shadow-2xs"
              >
                <Clipboard className="w-4 h-4 text-white" />
                <span>Paste Notes</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onClearText();
                  onClose();
                }}
                className="min-h-[40px] flex items-center justify-center gap-2 p-2 bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-800 font-bold rounded-xl transition-colors cursor-pointer shadow-2xs"
              >
                <Eraser className="w-4 h-4 text-rose-600" />
                <span>Clear Notes</span>
              </button>
            </div>
            <div className="text-[11px] text-slate-500 text-center font-medium pt-1">
              Live Buffer: <span className="font-bold text-slate-800">{charCount.toLocaleString()}</span> chars •{" "}
              <span className="font-bold text-slate-800">{wordCount.toLocaleString()}</span> words
            </div>
          </div>

          {/* FormatAI Mission & Core Motto */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50/70 border-2 border-amber-200 rounded-2xl p-3.5 space-y-1.5 text-slate-800 shadow-2xs">
            <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-amber-950 uppercase tracking-wide">
              <BookOpen className="w-3.5 h-3.5 text-amber-700" />
              <span>FormatAI Mission</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-700 font-medium">
              ChatGPT, Gemini, Claude, NotebookLM বা যেকোনো উৎস থেকে পাওয়া AI-generated কিংবা লেকচার নোটকে স্বয়ংক্রিয়ভাবে গাণিতিক, বৈজ্ঞানিক ও টেক্সট ফরম্যাটিংসহ একটি প্রকাশনা-উপযোগী, কাস্টমাইজযোগ্য DOCX ফাইলে রূপান্তর করা—শিক্ষার্থী ও গবেষকদের জন্য সম্পূর্ণ উন্মুক্ত ও বিনামূল্যে।
            </p>
          </div>

          {/* Open Source & MIT License */}
          <div className="border-t-2 border-slate-200 pt-3 space-y-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenLicenseModal();
              }}
              className="w-full flex items-center justify-between p-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl text-emerald-950 font-bold transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-emerald-700" />
                <span>FormatAI License & Upstream Repos</span>
              </span>
              <ChevronRight className="w-4 h-4 text-emerald-700" />
            </button>
            <p className="text-[11px] text-slate-500 text-center font-medium">
              FormatAI Academic Core is free for students worldwide.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
