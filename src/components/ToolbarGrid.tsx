import React, { useState, useRef, useEffect } from "react";
import {
  Zap,
  Palette,
  SquareRadical,
  Sparkles,
  GraduationCap,
  Layers,
  FileText,
  ChevronDown,
  Check,
  Loader2,
  ExternalLink,
  FileDown,
  SlidersHorizontal,
  Download,
  FileCode,
  CheckCircle2,
} from "lucide-react";
import { SAMPLE_NOTES, SampleNote } from "../data/samples";
import { skillRegistry } from "../skills";
import { ACADEMIC_THEMES, getAcademicTheme } from "../utils/theme";
import { AIPolishDropdown } from "./AIPolishDropdown";

interface ToolbarGridProps {
  // Font
  fontFamily: string;
  onFontFamilyChange: (font: string) => void;
  // Theme
  accentColor: string;
  onAccentColorChange: (color: string) => void;
  // Math
  equationFormat: "native" | "latex" | "unicode";
  onEquationFormatChange: (fmt: "native" | "latex" | "unicode") => void;
  onInsertSymbol?: (symbol: string) => void;
  // AI Polish & Export Word
  isAiPolishing: boolean;
  onTriggerAiPolish: () => void;
  onTriggerFormatAI?: () => void;
  isNoAI?: boolean;
  onProviderChange?: (providerId: string) => void;
  aiProviderName?: string;
  onDownloadDocx: () => void;
  onExportFormat?: (format: "docx" | "pdf" | "tex" | "md" | "txt") => void;
  canDownload: boolean;
  // Format Mode (Study Guide & Formulas)
  formatMode: "auto" | "study_guide" | "exam_bank";
  onFormatModeChange: (mode: "auto" | "study_guide" | "exam_bank") => void;
  // Academic Skills
  activeSkillsCount: number;
  onOpenSkillsManager: () => void;
  onSkillsChanged?: () => void;
  // Samples
  onSelectSample: (sample: SampleNote) => void;
  // AI Settings Modal trigger
  onOpenAISettings?: () => void;
}

export const ToolbarGrid: React.FC<ToolbarGridProps> = ({
  fontFamily,
  onFontFamilyChange,
  accentColor,
  onAccentColorChange,
  equationFormat,
  onEquationFormatChange,
  onInsertSymbol,
  isAiPolishing,
  onTriggerAiPolish,
  onTriggerFormatAI,
  isNoAI = false,
  onProviderChange,
  aiProviderName,
  onDownloadDocx,
  onExportFormat,
  canDownload,
  formatMode,
  onFormatModeChange,
  activeSkillsCount,
  onOpenSkillsManager,
  onSkillsChanged,
  onSelectSample,
  onOpenAISettings,
}) => {
  const [openCard, setOpenCard] = useState<string | null>(null);
  const [isMobileExpanded, setIsMobileExpanded] = useState<boolean>(false);
  const [mathTab, setMathTab] = useState<"stats" | "calc" | "algebra">("stats");
  const containerRef = useRef<HTMLDivElement>(null);

  const currentTheme = getAcademicTheme(accentColor);

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpenCard(null);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenCard(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const toggleCard = (cardId: string) => {
    setOpenCard((prev) => (prev === cardId ? null : cardId));
  };

  const fontOptions = [
    { name: "Times New Roman", type: "Academic Standard (APA, IEEE, Chicago)", sample: "Aa Bb Gg" },
    { name: "Georgia", type: "Classic Warm Serif (Reading clarity)", sample: "Aa Bb Gg" },
    { name: "Calibri", type: "Microsoft Office Contemporary Sans", sample: "Aa Bb Gg" },
    { name: "Arial", type: "Technical Document Standard Sans", sample: "Aa Bb Gg" },
    { name: "Aptos", type: "New Academic Default Sans", sample: "Aa Bb Gg" },
  ];

  const mathCategories = {
    stats: [
      { symbol: "\\hat{p}", label: "p̂ Sample proportion" },
      { symbol: "\\bar{X}", label: "X̄ Sample mean" },
      { symbol: "S^2", label: "S² Sample variance" },
      { symbol: "\\sigma^2", label: "σ² Population variance" },
      { symbol: "\\mu", label: "μ Population mean" },
      { symbol: "\\pi", label: "π Population proportion" },
      { symbol: "\\operatorname{Var}(X)", label: "Var(X) Variance" },
      { symbol: "\\operatorname{Cov}(X,Y)", label: "Cov(X,Y) Covariance" },
    ],
    calc: [
      { symbol: "\\frac{a}{b}", label: "Fraction" },
      { symbol: "\\sqrt{x}", label: "Square root" },
      { symbol: "\\sum_{i=1}^{n}", label: "∑ Summation" },
      { symbol: "\\int_{a}^{b}", label: "∫ Integral" },
      { symbol: "\\lim_{x \\to \\infty}", label: "lim Limit" },
      { symbol: "\\partial", label: "∂ Partial derivative" },
      { symbol: "\\nabla", label: "∇ Del / Gradient" },
      { symbol: "\\prod_{i=1}^{n}", label: "∏ Product" },
    ],
    algebra: [
      { symbol: "\\approx", label: "≈ Approximately" },
      { symbol: "\\sim", label: "~ Distributed as" },
      { symbol: "\\le", label: "≤ Less or equal" },
      { symbol: "\\ge", label: "≥ Greater or equal" },
      { symbol: "\\neq", label: "≠ Not equal" },
      { symbol: "\\infty", label: "∞ Infinity" },
      { symbol: "\\pm", label: "± Plus-minus" },
      { symbol: "\\mathbb{R}", label: "ℝ Real numbers" },
    ],
  };

  const currentFormatLabel =
    formatMode === "study_guide"
      ? "Study Guide"
      : formatMode === "exam_bank"
      ? "Exam Bank"
      : "Auto Detect";

  return (
    <div ref={containerRef} className="w-full">
      {/* Outer Card with dynamic theme border accent */}
      <div
        className="bg-white rounded-2xl border-2 shadow-sm p-3 sm:p-4.5 transition-all"
        style={{ borderColor: currentTheme.border }}
      >
        {/* Mobile-Friendly Quick Header (Visible on small screens) */}
        <div className="sm:hidden mb-2.5 pb-2.5 border-b-2 border-slate-200 flex items-center justify-between gap-2">
          {/* Quick FormatAI or AI Polish on Mobile */}
          <button
            type="button"
            onClick={isNoAI ? (onTriggerFormatAI || onTriggerAiPolish) : onTriggerAiPolish}
            disabled={isAiPolishing}
            className="flex-1 min-h-[48px] min-w-[48px] px-3 py-2.5 rounded-xl text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            style={{ backgroundColor: currentTheme.btnPrimary }}
            title={isNoAI ? "Run FormatAI (No AI)" : "Run AI Polish"}
          >
            {isAiPolishing ? (
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
            )}
            <span>
              {isAiPolishing ? "Normalizing..." : isNoAI ? "FormatAI" : "AI Polish"}
            </span>
          </button>

          {/* Quick Export on Mobile */}
          <button
            type="button"
            onClick={() => {
              if (onExportFormat) onExportFormat("docx");
              else onDownloadDocx();
            }}
            disabled={!canDownload || isAiPolishing}
            className="flex-1 min-h-[48px] min-w-[48px] px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-black active:scale-95 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            title="Export to Word"
          >
            <Download className="w-4 h-4 text-blue-300 shrink-0" />
            <span>Export DOCX</span>
          </button>

          {/* Toggle All 8 Controls on Mobile */}
          <button
            type="button"
            onClick={() => setIsMobileExpanded(!isMobileExpanded)}
            className={`min-h-[48px] min-w-[48px] px-2.5 py-2.5 rounded-xl border-2 flex items-center justify-center gap-1 text-xs font-bold transition-all cursor-pointer ${
              isMobileExpanded
                ? "bg-slate-100 border-slate-400 text-slate-900 shadow-2xs"
                : "bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100"
            }`}
            title="Toggle All Formatting Controls"
            aria-expanded={isMobileExpanded}
          >
            <SlidersHorizontal className="w-4 h-4 shrink-0" />
            <span className="sr-only">Tools</span>
          </button>
        </div>

        {/* Backdrop for mobile / tablet tap-outside */}
        {openCard && (
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onClick={() => setOpenCard(null)}
            aria-hidden="true"
          />
        )}

        {/* The 8 Distinct Action Cards: Responsive Grid (4x2 on md+, 2x4 on mobile/tablet portrait) */}
        <div
          className={`${
            isMobileExpanded ? "grid" : "hidden sm:grid"
          } grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3`}
        >
          {/* ===================== CARD 1: FONT ===================== */}
          <div className={`relative ${openCard === "font" ? "z-50" : "z-10"}`}>
            <button
              id="card-toolbar-font"
              type="button"
              onClick={() => toggleCard("font")}
              aria-expanded={openCard === "font"}
              className={`w-full min-h-[76px] sm:min-h-[82px] bg-white hover:bg-slate-50 border-2 ${
                openCard === "font"
                  ? "border-emerald-600 ring-2 ring-emerald-100 shadow-xs"
                  : "border-slate-300 hover:border-emerald-500 hover:shadow-xs"
              } rounded-2xl p-2.5 sm:p-3 transition-all text-left flex flex-col justify-between cursor-pointer group`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center shrink-0 shadow-2xs">
                    <Zap className="w-4 h-4 text-emerald-700 fill-emerald-600" />
                  </div>
                  <div>
                    <span className="font-extrabold text-slate-900 text-xs sm:text-sm block leading-tight">
                      Font
                    </span>
                    <span className="text-[10px] font-bold text-emerald-800 truncate block max-w-[90px] sm:max-w-[120px]">
                      {fontFamily}
                    </span>
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-500 group-hover:text-emerald-700 transition-transform ${
                    openCard === "font" ? "rotate-180 text-emerald-700 font-bold" : ""
                  }`}
                />
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 mt-1 font-medium line-clamp-1">
                Standard academic typography
              </p>
            </button>

            {/* Font Sub-buttons Dropdown */}
            {openCard === "font" && (
              <div className="absolute left-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border-2 border-slate-300 p-2.5 z-40 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 border-b-2 border-slate-100 mb-1.5 flex items-center justify-between">
                  <span>Document Typography</span>
                  <span className="text-emerald-700 font-extrabold">{fontFamily}</span>
                </div>
                <div className="space-y-1">
                  {fontOptions.map((f) => (
                    <button
                      key={f.name}
                      type="button"
                      onClick={() => {
                        onFontFamilyChange(f.name);
                        setOpenCard(null);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors text-left cursor-pointer border-2 ${
                        fontFamily === f.name
                          ? "bg-emerald-50 text-emerald-950 font-extrabold border-emerald-400 shadow-2xs"
                          : "hover:bg-slate-100 text-slate-800 border-transparent"
                      }`}
                    >
                      <div>
                        <div className="font-bold text-slate-900 text-sm" style={{ fontFamily: f.name }}>
                          {f.name}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">{f.type}</div>
                      </div>
                      {fontFamily === f.name && <Check className="w-4 h-4 text-emerald-700 stroke-[3] shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ===================== CARD 2: THEME (FULL THEME COLOR CHANGE) ===================== */}
          <div className={`relative ${openCard === "theme" ? "z-50" : "z-10"}`}>
            <button
              id="card-toolbar-theme"
              type="button"
              onClick={() => toggleCard("theme")}
              aria-expanded={openCard === "theme"}
              className={`w-full min-h-[76px] sm:min-h-[82px] bg-white hover:bg-slate-50 border-2 ${
                openCard === "theme"
                  ? "border-slate-800 ring-2 ring-slate-300 shadow-xs"
                  : "border-slate-300 hover:border-slate-700 hover:shadow-xs"
              } rounded-2xl p-2.5 sm:p-3 transition-all text-left flex flex-col justify-between cursor-pointer group`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl text-white flex items-center justify-center shrink-0 shadow-2xs"
                    style={{ backgroundColor: currentTheme.hex }}
                  >
                    <Palette className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-extrabold text-slate-900 text-xs sm:text-sm block leading-tight">
                      Theme
                    </span>
                    <div className="flex items-center gap-1">
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-slate-400 shrink-0"
                        style={{ backgroundColor: currentTheme.hex }}
                      />
                      <span className="text-[10px] font-bold text-slate-800 truncate max-w-[80px]">
                        {currentTheme.label}
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-500 group-hover:text-slate-800 transition-transform ${
                    openCard === "theme" ? "rotate-180 text-slate-800 font-bold" : ""
                  }`}
                />
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 mt-1 font-medium line-clamp-1">
                8 Academic university themes
              </p>
            </button>

            {/* Theme Sub-buttons Dropdown */}
            {openCard === "theme" && (
              <div className="absolute right-0 md:left-0 md:right-auto top-full mt-2 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border-2 border-slate-300 p-2.5 z-40 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 border-b-2 border-slate-100 mb-1.5 flex items-center justify-between">
                  <span>University Color Schemes</span>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: currentTheme.badgeBg,
                      color: currentTheme.badgeText,
                    }}
                  >
                    {currentTheme.label}
                  </span>
                </div>
                <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                  {ACADEMIC_THEMES.map((t) => {
                    const isSelected = accentColor.toLowerCase() === t.hex.toLowerCase();
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          onAccentColorChange(t.hex);
                          setOpenCard(null);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer border-2 ${
                          isSelected
                            ? "bg-slate-100 font-extrabold border-slate-800 shadow-2xs"
                            : "hover:bg-slate-50 border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-5 h-5 rounded-full border border-white shadow-2xs shrink-0 flex items-center justify-center ring-1 ring-slate-300"
                            style={{ backgroundColor: t.hex }}
                          >
                            {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                          </span>
                          <div className="text-left">
                            <span className="text-slate-900 font-bold block">{t.label}</span>
                            <span className="text-[10px] text-slate-500 block leading-tight">{t.desc}</span>
                          </div>
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-slate-900 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ===================== CARD 3: MATH (SUB BUTTON BARS & SYMBOLS) ===================== */}
          <div className={`relative ${openCard === "math" ? "z-50" : "z-10"}`}>
            <button
              id="card-toolbar-math"
              type="button"
              onClick={() => toggleCard("math")}
              aria-expanded={openCard === "math"}
              className={`w-full min-h-[76px] sm:min-h-[82px] bg-white hover:bg-slate-50 border-2 ${
                openCard === "math"
                  ? "border-indigo-600 ring-2 ring-indigo-100 shadow-xs"
                  : "border-slate-300 hover:border-indigo-500 hover:shadow-xs"
              } rounded-2xl p-2.5 sm:p-3 transition-all text-left flex flex-col justify-between cursor-pointer group`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-indigo-100 border border-indigo-300 flex items-center justify-center shrink-0 shadow-2xs">
                    <SquareRadical className="w-4 h-4 text-indigo-700" />
                  </div>
                  <div>
                    <span className="font-extrabold text-slate-900 text-xs sm:text-sm block leading-tight">
                      Math
                    </span>
                    <span className="text-[10px] font-bold text-indigo-800 block truncate">
                      {equationFormat === "native" ? "Word (OMML)" : "LaTeX ($...$)"}
                    </span>
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-500 group-hover:text-indigo-700 transition-transform ${
                    openCard === "math" ? "rotate-180 text-indigo-700 font-bold" : ""
                  }`}
                />
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 mt-1 font-medium line-clamp-1">
                Native OMML equations & symbols
              </p>
            </button>

            {/* Math Sub-button bars Dropdown */}
            {openCard === "math" && (
              <div className="absolute left-0 md:right-0 md:left-auto top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border-2 border-slate-300 p-3 z-40 animate-in fade-in zoom-in-95">
                {/* Math Format Toggle Sub-Bar */}
                <div className="mb-3">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                    Word Math Output Format
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-300">
                    <button
                      type="button"
                      onClick={() => onEquationFormatChange("native")}
                      className={`text-xs py-1.5 px-2 rounded-lg font-extrabold transition-all cursor-pointer ${
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
                      className={`text-xs py-1.5 px-2 rounded-lg font-extrabold transition-all cursor-pointer ${
                        equationFormat === "latex"
                          ? "bg-white text-indigo-900 shadow-2xs border border-slate-300"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      LaTeX ($...$)
                    </button>
                  </div>
                </div>

                {/* Sub-button Category Tabs for Math Symbols */}
                <div className="mb-2">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                    Quick Symbols Sub-Bar
                  </div>
                  <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 gap-1 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setMathTab("stats")}
                      className={`flex-1 py-1 rounded-md transition-all ${
                        mathTab === "stats"
                          ? "bg-white text-indigo-950 shadow-2xs font-extrabold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Statistics
                    </button>
                    <button
                      type="button"
                      onClick={() => setMathTab("calc")}
                      className={`flex-1 py-1 rounded-md transition-all ${
                        mathTab === "calc"
                          ? "bg-white text-indigo-950 shadow-2xs font-extrabold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Calculus
                    </button>
                    <button
                      type="button"
                      onClick={() => setMathTab("algebra")}
                      className={`flex-1 py-1 rounded-md transition-all ${
                        mathTab === "algebra"
                          ? "bg-white text-indigo-950 shadow-2xs font-extrabold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Algebra
                    </button>
                  </div>
                </div>

                {/* Quick Math Symbols Sub-Buttons Grid */}
                <div className="grid grid-cols-4 gap-1.5">
                  {mathCategories[mathTab].map((item) => (
                    <button
                      key={item.symbol}
                      type="button"
                      onClick={() => {
                        if (onInsertSymbol) {
                          onInsertSymbol(` ${item.symbol} `);
                        }
                      }}
                      className="p-2 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-900 hover:border-indigo-400 border border-slate-300 rounded-xl text-xs font-mono text-center font-bold text-slate-900 transition-colors cursor-pointer shadow-2xs"
                      title={item.label}
                    >
                      {item.symbol}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-2 text-center font-medium">
                  Click any symbol to insert directly into raw notes.
                </p>
              </div>
            )}
          </div>

          {/* ===================== CARD 4: SPLIT BUTTON AI POLISH / FORMATAI ===================== */}
          <div className={`relative h-full ${openCard === "ai-polish" ? "z-50" : "z-10"}`}>
            <div
              className={`w-full min-h-[76px] sm:min-h-[82px] bg-white border-2 ${
                isAiPolishing
                  ? "bg-blue-50/80 border-blue-500 ring-2 ring-blue-200 shadow-xs"
                  : openCard === "ai-polish"
                  ? "border-blue-600 ring-2 ring-blue-100 shadow-xs"
                  : "border-slate-300 hover:border-blue-500 hover:shadow-xs"
              } rounded-2xl transition-all flex items-stretch`}
            >
              {/* Main Left Button: Click to immediately run FormatAI / AI Polish */}
              <button
                id="btn-ai-polish-main"
                type="button"
                onClick={() => {
                  if (isAiPolishing) return;
                  if (isNoAI && onTriggerFormatAI) {
                    onTriggerFormatAI();
                  } else {
                    onTriggerAiPolish();
                  }
                }}
                disabled={isAiPolishing}
                className="flex-1 p-2.5 sm:p-3 transition-all text-left flex flex-col justify-between cursor-pointer group hover:bg-slate-50/80 rounded-l-2xl disabled:cursor-not-allowed min-w-0"
                title={
                  isAiPolishing
                    ? "Normalizing notes..."
                    : isNoAI
                    ? "Click to Run FormatAI immediately (Offline / No AI)"
                    : `Click to Run AI Polish immediately (${aiProviderName || "Active AI"})`
                }
              >
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs transition-colors ${
                      isAiPolishing
                        ? "bg-blue-600 text-white"
                        : "bg-blue-100 border border-blue-200 text-blue-700 group-hover:bg-blue-200/80"
                    }`}
                  >
                    {isAiPolishing ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-blue-700 group-hover:text-blue-900" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="font-extrabold text-slate-900 text-xs sm:text-sm block leading-tight truncate">
                      {isNoAI ? "FormatAI" : "AI Polish"}
                    </span>
                    <span className="text-[10px] font-bold text-blue-700 block truncate">
                      {isAiPolishing
                        ? "Normalizing..."
                        : isNoAI
                        ? "Instant Academic Formatter"
                        : aiProviderName
                        ? `${aiProviderName.replace("Google ", "")} Engine`
                        : "Click to Run Polish"}
                    </span>
                  </div>
                </div>

                <p className="text-[10px] sm:text-[11px] text-slate-500 mt-1 font-medium truncate">
                  {isAiPolishing
                    ? "Normalizing equations..."
                    : isNoAI
                    ? "Deterministic offline rules • Click to Run"
                    : "Click to Run Polish • or ▼ for options"}
                </p>
              </button>

              {/* Vertical divider between left action and right chevron dropdown */}
              <div className="w-px bg-slate-200 my-2 shrink-0" />

              {/* Right side: ▼ opens dropdown menu */}
              <button
                id="btn-ai-polish-dropdown-toggle"
                type="button"
                onClick={() => toggleCard("ai-polish")}
                disabled={isAiPolishing}
                aria-label="Open AI Polish options menu"
                aria-expanded={openCard === "ai-polish"}
                className={`px-2.5 sm:px-3 flex flex-col items-center justify-center gap-1 hover:bg-slate-100/90 rounded-r-2xl transition-all cursor-pointer group disabled:cursor-not-allowed ${
                  openCard === "ai-polish" ? "bg-blue-50 text-blue-800" : "text-slate-500 hover:text-blue-700"
                }`}
                title="Select Engine, Providers, Models & Options"
              >
                {isNoAI ? (
                  <span className="text-[9px] font-black bg-slate-100 text-slate-700 px-1 py-0.2 rounded border border-slate-200 uppercase tracking-tight">
                    NO AI
                  </span>
                ) : (
                  <span className="text-[9px] font-black bg-blue-100 text-blue-800 px-1 py-0.2 rounded border border-blue-200 uppercase tracking-tight">
                    AI
                  </span>
                )}
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 group-hover:text-blue-700 transition-transform duration-200 ${
                    openCard === "ai-polish" ? "rotate-180 text-blue-700 font-bold" : ""
                  }`}
                />
              </button>
            </div>

            {/* AI Polish Sub-bar Dropdown with AI Selection, Health Signals & Run Button */}
            {openCard === "ai-polish" && (
              <AIPolishDropdown
                isAiPolishing={isAiPolishing}
                onTriggerAiPolish={onTriggerAiPolish}
                onTriggerFormatAI={onTriggerFormatAI}
                isNoAI={isNoAI}
                onProviderChange={onProviderChange}
                onClose={() => setOpenCard(null)}
                onOpenAISettings={onOpenAISettings}
              />
            )}
          </div>

          {/* ===================== CARD 5: STUDY GUIDE & FORMULAS ===================== */}
          <div className={`relative ${openCard === "study-guide" ? "z-50" : "z-10"}`}>
            <button
              id="card-toolbar-study-guide"
              type="button"
              onClick={() => toggleCard("study-guide")}
              aria-expanded={openCard === "study-guide"}
              className={`w-full min-h-[76px] sm:min-h-[82px] bg-white hover:bg-slate-50 border-2 ${
                openCard === "study-guide"
                  ? "border-amber-600 ring-2 ring-amber-100 shadow-xs"
                  : "border-slate-300 hover:border-amber-500 hover:shadow-xs"
              } rounded-2xl p-2.5 sm:p-3 transition-all text-left flex flex-col justify-between cursor-pointer group`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0 shadow-2xs">
                    <GraduationCap className="w-4 h-4 text-amber-800" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-extrabold text-slate-900 text-xs sm:text-sm block leading-tight truncate">
                      Study Guide
                    </span>
                    <span className="text-[10px] font-bold text-amber-800 block truncate">
                      {currentFormatLabel}
                    </span>
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-500 group-hover:text-amber-700 shrink-0 transition-transform ${
                    openCard === "study-guide" ? "rotate-180 text-amber-700 font-bold" : ""
                  }`}
                />
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 mt-1 font-medium line-clamp-1">
                Key concepts, formulas & problems
              </p>
            </button>

            {/* Study Guide Sub-button bars */}
            {openCard === "study-guide" && (
              <div className="absolute left-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border-2 border-slate-300 p-2.5 z-40 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 border-b-2 border-slate-100 mb-1.5">
                  Document Structure Preset
                </div>
                <div className="space-y-1.5">
                  {[
                    {
                      id: "study_guide",
                      title: "🎓 Study Guide & Formulas",
                      desc: "Numbered sections, highlighted formulas, definition callouts",
                    },
                    {
                      id: "exam_bank",
                      title: "📝 Exam Question Bank",
                      desc: "Numbered problems, multiple-choice items, step-by-step solutions",
                    },
                    {
                      id: "auto",
                      title: "⚡ Auto-Detect Structure",
                      desc: "Intelligently formats headers and math based on raw content",
                    },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => {
                        onFormatModeChange(mode.id as any);
                        setOpenCard(null);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors text-left cursor-pointer border-2 ${
                        formatMode === mode.id
                          ? "bg-amber-50 text-amber-950 font-extrabold border-amber-400 shadow-2xs"
                          : "hover:bg-slate-50 text-slate-800 border-transparent"
                      }`}
                    >
                      <div>
                        <div className="font-bold text-slate-900">{mode.title}</div>
                        <div className="text-[10px] text-slate-500 font-medium leading-normal">{mode.desc}</div>
                      </div>
                      {formatMode === mode.id && <Check className="w-4 h-4 text-amber-700 stroke-[3] shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ===================== CARD 6: ACADEMIC SKILLS ===================== */}
          <div className={`relative ${openCard === "skills" ? "z-50" : "z-10"}`}>
            <button
              id="card-toolbar-academic-skills"
              type="button"
              onClick={() => toggleCard("skills")}
              aria-expanded={openCard === "skills"}
              className={`w-full min-h-[76px] sm:min-h-[82px] bg-white hover:bg-slate-50 border-2 ${
                openCard === "skills"
                  ? "border-purple-600 ring-2 ring-purple-100 shadow-xs"
                  : "border-slate-300 hover:border-purple-500 hover:shadow-xs"
              } rounded-2xl p-2.5 sm:p-3 transition-all text-left flex flex-col justify-between cursor-pointer group`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-purple-100 border border-purple-300 flex items-center justify-center shrink-0 shadow-2xs">
                    <Layers className="w-4 h-4 text-purple-700" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-extrabold text-slate-900 text-xs sm:text-sm block leading-tight truncate">
                      Academic Skills
                    </span>
                    <span className="text-[10px] font-bold text-purple-800 bg-purple-100 px-1.5 py-0.2 rounded border border-purple-200 inline-block">
                      {activeSkillsCount} Active
                    </span>
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-500 group-hover:text-purple-700 shrink-0 transition-transform ${
                    openCard === "skills" ? "rotate-180 text-purple-700 font-bold" : ""
                  }`}
                />
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 mt-1 font-medium line-clamp-1">
                15 Academic writing & research rules
              </p>
            </button>

            {/* Academic Skills Sub-button list */}
            {openCard === "skills" && (
              <div className="absolute right-0 md:left-0 md:right-auto top-full mt-2 w-84 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border-2 border-slate-300 p-3 z-40 animate-in fade-in zoom-in-95">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                  Academic Skills Pipeline
                </div>
                <div className="space-y-1.5 mb-3 max-h-56 overflow-y-auto pr-1">
                  {skillRegistry.getAllSkills().map((skill) => {
                    const isEnabled = skill.enabled;
                    return (
                      <div
                        key={skill.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 hover:border-purple-300 transition-colors"
                      >
                        <div className="flex-1 pr-2">
                          <div className="font-bold text-slate-900 text-xs">{skill.name}</div>
                          <div className="text-[10px] text-slate-500 line-clamp-1 font-medium">{skill.description}</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={() => {
                            skillRegistry.toggleSkill(skill.id);
                            if (onSkillsChanged) onSkillsChanged();
                          }}
                          className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                        />
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOpenCard(null);
                    onOpenSkillsManager();
                  }}
                  className="w-full bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-2xs cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Open Full Skills Hub & 15 Rules</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* ===================== CARD 7: SAMPLES ===================== */}
          <div className={`relative ${openCard === "samples" ? "z-50" : "z-10"}`}>
            <button
              id="card-toolbar-samples"
              type="button"
              onClick={() => toggleCard("samples")}
              aria-expanded={openCard === "samples"}
              className={`w-full min-h-[76px] sm:min-h-[82px] bg-white hover:bg-slate-50 border-2 ${
                openCard === "samples"
                  ? "border-cyan-600 ring-2 ring-cyan-100 shadow-xs"
                  : "border-slate-300 hover:border-cyan-500 hover:shadow-xs"
              } rounded-2xl p-2.5 sm:p-3 transition-all text-left flex flex-col justify-between cursor-pointer group`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-cyan-100 border border-cyan-300 flex items-center justify-center shrink-0 shadow-2xs">
                    <FileText className="w-4 h-4 text-cyan-800" />
                  </div>
                  <div>
                    <span className="font-extrabold text-slate-900 text-xs sm:text-sm block leading-tight">
                      Samples
                    </span>
                    <span className="text-[10px] font-bold text-cyan-800 block">
                      Ready Examples
                    </span>
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-500 group-hover:text-cyan-700 transition-transform ${
                    openCard === "samples" ? "rotate-180 text-cyan-700 font-bold" : ""
                  }`}
                />
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 mt-1 font-medium line-clamp-1">
                Pre-built STEM lecture templates
              </p>
            </button>

            {/* Samples Sub-buttons */}
            {openCard === "samples" && (
              <div className="absolute left-0 md:right-0 md:left-auto top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border-2 border-slate-300 p-2.5 z-40 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 border-b-2 border-slate-100 mb-1.5">
                  Ready-to-Test STEM Notes
                </div>
                <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                  {SAMPLE_NOTES.map((sample) => (
                    <button
                      key={sample.id}
                      type="button"
                      onClick={() => {
                        onSelectSample(sample);
                        setOpenCard(null);
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-cyan-50 rounded-xl transition-colors flex flex-col cursor-pointer border border-transparent hover:border-cyan-300"
                    >
                      <span className="font-extrabold text-slate-900 truncate">{sample.title}</span>
                      <span className="text-[10px] text-slate-500 font-medium">{sample.category}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ===================== CARD 8: SPLIT BUTTON EXPORT DOCS (PRIMARY CALL TO ACTION) ===================== */}
          <div className={`relative h-full ${openCard === "export" ? "z-50" : "z-10"}`}>
            <div
              className={`w-full min-h-[76px] sm:min-h-[82px] bg-slate-900 border-2 border-slate-900 hover:border-black rounded-2xl shadow-md transition-all flex items-stretch ${
                !canDownload || isAiPolishing ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {/* Main left button: Export Docs (DOCX) */}
              <button
                id="btn-export-docs-main"
                type="button"
                onClick={() => {
                  if (onExportFormat) {
                    onExportFormat("docx");
                  } else {
                    onDownloadDocx();
                  }
                }}
                disabled={!canDownload || isAiPolishing}
                className="flex-1 p-2.5 sm:p-3 transition-all text-left flex flex-col justify-between cursor-pointer group hover:bg-slate-800 rounded-l-2xl disabled:cursor-not-allowed min-w-0"
                title="Export Docs (Download DOCX)"
              >
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <div
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs text-white"
                    style={{ backgroundColor: currentTheme.btnPrimary }}
                  >
                    <FileDown className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-extrabold text-white text-xs sm:text-sm block leading-tight truncate">
                      Export Docs
                    </span>
                    <span className="text-[10px] font-bold text-blue-300 block truncate">
                      Word (.docx)
                    </span>
                  </div>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-300 mt-1 font-medium truncate">
                  Save publication-ready document
                </p>
              </button>

              {/* Divider between left and right */}
              <div className="w-px bg-white/20 my-2 shrink-0" />

              {/* Right side: ▼ opens dropdown */}
              <button
                id="btn-export-dropdown-toggle"
                type="button"
                onClick={() => toggleCard("export")}
                disabled={!canDownload || isAiPolishing}
                aria-label="Open export options menu"
                aria-expanded={openCard === "export"}
                className={`px-3 sm:px-3.5 flex items-center justify-center hover:bg-slate-800 rounded-r-2xl transition-all cursor-pointer text-blue-200 group disabled:cursor-not-allowed ${
                  openCard === "export" ? "bg-slate-800 text-white" : ""
                }`}
                title="Select Export Format (PDF, LaTeX, Markdown, Text)"
              >
                <ChevronDown
                  className={`w-5 h-5 text-blue-300 group-hover:text-white transition-transform duration-200 ${
                    openCard === "export" ? "rotate-180 text-white" : ""
                  }`}
                />
              </button>
            </div>

            {/* Export Dropdown Menu with High Contrast Sub-buttons */}
            {openCard === "export" && (
              <div
                id="menu-export-formats"
                className="absolute right-0 top-full mt-2 w-76 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border-2 border-slate-300 p-2.5 z-50 animate-in fade-in zoom-in-95 select-none"
              >
                <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 border-b-2 border-slate-100 flex items-center justify-between">
                  <span>Export Formats</span>
                  <span className="text-[9px] font-bold text-slate-400">Select file type</span>
                </div>

                <div className="py-1 space-y-1">
                  {/* Word (.docx) */}
                  <button
                    type="button"
                    id="opt-export-docx"
                    onClick={() => {
                      setOpenCard(null);
                      if (onExportFormat) {
                        onExportFormat("docx");
                      } else {
                        onDownloadDocx();
                      }
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-800 hover:bg-sky-50 flex items-center justify-between group transition-colors cursor-pointer border-2 border-transparent hover:border-sky-300"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-sky-100 border border-sky-300 flex items-center justify-center text-sky-800 font-extrabold text-[10px] shrink-0">
                        DOCX
                      </span>
                      <div className="flex flex-col">
                        <span className="font-extrabold text-slate-900 group-hover:text-sky-950">Word (.docx)</span>
                        <span className="text-[10px] text-slate-500 font-medium">Native Word OMML Equations</span>
                      </div>
                    </div>
                    <span className="text-[9px] font-extrabold text-sky-800 bg-sky-100 px-1.5 py-0.5 rounded border border-sky-300">
                      Standard
                    </span>
                  </button>

                  {/* PDF (.pdf) */}
                  <button
                    type="button"
                    id="opt-export-pdf"
                    onClick={() => {
                      setOpenCard(null);
                      if (onExportFormat) onExportFormat("pdf");
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-800 hover:bg-rose-50 flex items-center justify-between group transition-colors cursor-pointer border-2 border-transparent hover:border-rose-300"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-700 font-extrabold text-[10px] shrink-0">
                        PDF
                      </span>
                      <div className="flex flex-col">
                        <span className="font-extrabold text-slate-900 group-hover:text-rose-950">PDF (.pdf)</span>
                        <span className="text-[10px] text-slate-500 font-medium">Download Typeset Document</span>
                      </div>
                    </div>
                    <span className="text-[9px] font-extrabold text-rose-800 bg-rose-100 px-1.5 py-0.5 rounded border border-rose-300">
                      File
                    </span>
                  </button>

                  {/* PDF (Preview Match) */}
                  <button
                    type="button"
                    id="opt-print-preview-pdf"
                    onClick={() => {
                      setOpenCard(null);
                      if (onExportFormat) onExportFormat("pdf");
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-800 hover:bg-rose-50 flex items-center justify-between group transition-colors cursor-pointer border-2 border-transparent hover:border-rose-300"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-700 font-extrabold text-[10px] shrink-0">
                        PDF
                      </span>
                      <div className="flex flex-col">
                        <span className="font-extrabold text-slate-900 group-hover:text-rose-950">Download PDF (Preview Match)</span>
                        <span className="text-[10px] text-slate-500 font-medium">Exact KaTeX Vector Math • A4</span>
                      </div>
                    </div>
                    <span className="text-[9px] font-extrabold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300">
                      Exact
                    </span>
                  </button>

                  {/* LaTeX (.tex) */}
                  <button
                    type="button"
                    id="opt-export-tex"
                    onClick={() => {
                      setOpenCard(null);
                      if (onExportFormat) onExportFormat("tex");
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-800 hover:bg-indigo-50 flex items-center justify-between group transition-colors cursor-pointer border-2 border-transparent hover:border-indigo-300"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-indigo-100 border border-indigo-300 flex items-center justify-center text-indigo-700 font-extrabold text-[10px] shrink-0">
                        TeX
                      </span>
                      <div className="flex flex-col">
                        <span className="font-extrabold text-slate-900 group-hover:text-indigo-950">LaTeX (.tex)</span>
                        <span className="text-[10px] text-slate-500 font-medium">Compilable Academic Source</span>
                      </div>
                    </div>
                  </button>

                  {/* Markdown (.md) */}
                  <button
                    type="button"
                    id="opt-export-md"
                    onClick={() => {
                      setOpenCard(null);
                      if (onExportFormat) onExportFormat("md");
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-800 hover:bg-blue-50 flex items-center justify-between group transition-colors cursor-pointer border-2 border-transparent hover:border-blue-300"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-blue-100 border border-blue-300 flex items-center justify-center text-blue-700 font-extrabold text-[10px] shrink-0">
                        MD
                      </span>
                      <div className="flex flex-col">
                        <span className="font-extrabold text-slate-900 group-hover:text-blue-950">Markdown (.md)</span>
                        <span className="text-[10px] text-slate-500 font-medium">Clean Academic Markdown</span>
                      </div>
                    </div>
                  </button>

                  {/* Plain Text (.txt) */}
                  <button
                    type="button"
                    id="opt-export-txt"
                    onClick={() => {
                      setOpenCard(null);
                      if (onExportFormat) onExportFormat("txt");
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-800 hover:bg-slate-100 flex items-center justify-between group transition-colors cursor-pointer border-2 border-transparent hover:border-slate-300"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-700 font-extrabold text-[10px] shrink-0">
                        TXT
                      </span>
                      <div className="flex flex-col">
                        <span className="font-extrabold text-slate-900 group-hover:text-slate-950">Plain Text (.txt)</span>
                        <span className="text-[10px] text-slate-500 font-medium">Clean Raw Notes</span>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
