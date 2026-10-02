import React, { useState, useRef, useEffect } from "react";
import {
  Type,
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
  CheckCircle2,
  Wrench,
  X,
  MoreHorizontal,
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
  onOpenAISettings?: (tab?: "control" | "fallback" | "stats" | "logs" | "providers" | "settings" | "usage") => void;
  // Flagged Blocks Repair
  failedBlockCount?: number;
  onRepairFlagged?: () => void;
  isRepairing?: boolean;
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
  failedBlockCount = 0,
  onRepairFlagged,
  isRepairing = false,
}) => {
  const [openCard, setOpenCard] = useState<string | null>(null);
  const [mathTab, setMathTab] = useState<"stats" | "calc" | "algebra">("stats");
  const [mobileToolsTab, setMobileToolsTab] = useState<"presets" | "skills" | "samples" | "typography" | "theme" | "math">("presets");
  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(false);
  const [containerWidth, setContainerWidth] = useState<number>(1200);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentTheme = getAcademicTheme(accentColor);

  // Monitor mobile screen width (<640px)
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileScreen(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Monitor container width using ResizeObserver for responsive overflow
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

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
      { symbol: "\\partial", label: "∂ Partial" },
      { symbol: "\\nabla", label: "∇ Del / Gradient" },
      { symbol: "\\alpha", label: "α Alpha" },
    ],
    algebra: [
      { symbol: "\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}", label: "Matrix 2x2" },
      { symbol: "\\leq", label: "≤ Less than or equal" },
      { symbol: "\\geq", label: "≥ Greater than or equal" },
      { symbol: "\\approx", label: "≈ Approximately" },
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

  // Priority order for overflow from the right: Samples, Skills, Study Guide, Math, Theme, Font
  const primaryButtonsEstimatedWidth = failedBlockCount > 0 ? 370 : 290;
  const avail = containerWidth - primaryButtonsEstimatedWidth;

  const isSamplesInOverflow = avail < 470;
  const isSkillsInOverflow = avail < 380;
  const isStudyGuideInOverflow = avail < 300;
  const isMathInOverflow = avail < 220;
  const isThemeInOverflow = avail < 150;

  const hasAnyOverflow = isSamplesInOverflow || isSkillsInOverflow || isStudyGuideInOverflow || isMathInOverflow || isThemeInOverflow;
  const isCompactLabels = avail < 680;

  // Reusable bottom sheet wrapper for mobile
  const renderBottomSheet = (title: string, children: React.ReactNode) => (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex items-end justify-center p-0 animate-modal-backdrop motion-reduce:transition-none cursor-pointer"
      onClick={() => setOpenCard(null)}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="w-full max-h-[85vh] bg-white rounded-t-2xl border-t border-slate-200 p-4 shadow-xl overflow-y-auto animate-modal-content motion-reduce:transition-none cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pb-2.5" aria-hidden="true">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={() => setOpenCard(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Close sheet"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className="sticky top-[40px] z-20 w-full bg-white/95 backdrop-blur-xs border-b border-slate-200 select-none overflow-visible"
    >
      {/* ===================== MOBILE LAYOUT (<640px) ===================== */}
      {/* Shows [☰ Tools ▾] on left and [✨ AI Polish] [⬇ Export] on right, 44px tall touch targets, single line */}
      {isMobileScreen ? (
        <div className="h-12 px-2 flex items-center justify-between w-full gap-2">
          {/* Left: Tools button */}
          <button
            id="pill-toolbar-mobile-tools"
            type="button"
            onClick={() => toggleCard("tools")}
            aria-expanded={openCard === "tools"}
            aria-haspopup="true"
            className="h-11 min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            title="Presets, Skills & Samples"
          >
            <SlidersHorizontal className="w-4 h-4 text-slate-600" />
            <span>Tools</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 motion-reduce:transition-none ${
                openCard === "tools" ? "rotate-180 text-slate-700" : ""
              }`}
            />
          </button>

          {/* Right: AI Polish and Export (both 44px tall touch targets) */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            {/* AI Polish */}
            <div className="inline-flex rounded-xl overflow-hidden shadow-xs h-11 min-h-[44px]">
              <button
                type="button"
                id="btn-ai-polish-main-mobile"
                onClick={() => {
                  if (isAiPolishing) return;
                  if (isNoAI && onTriggerFormatAI) {
                    onTriggerFormatAI();
                  } else {
                    onTriggerAiPolish();
                  }
                }}
                disabled={isAiPolishing}
                className="h-11 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                title="Run AI Polish"
              >
                {isAiPolishing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>{isAiPolishing ? "Running..." : "AI Polish"}</span>
              </button>
              <button
                type="button"
                id="btn-ai-polish-dropdown-mobile"
                onClick={() => toggleCard("ai-polish")}
                disabled={isAiPolishing}
                aria-label="Engine selector options"
                aria-expanded={openCard === "ai-polish"}
                className="h-11 px-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 border-l border-blue-500 text-white flex items-center justify-center cursor-pointer disabled:opacity-50 transition-colors"
              >
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-150 motion-reduce:transition-none ${
                    openCard === "ai-polish" ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>

            {/* Export */}
            <div className="inline-flex rounded-xl overflow-hidden shadow-xs h-11 min-h-[44px]">
              <button
                type="button"
                id="btn-export-docs-mobile"
                onClick={() => {
                  if (onExportFormat) onExportFormat("docx");
                  else onDownloadDocx();
                }}
                disabled={!canDownload || isAiPolishing}
                className="h-11 px-3 bg-slate-900 hover:bg-black text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Export Document"
              >
                <Download className="w-3.5 h-3.5 text-blue-300" />
                <span>Export</span>
              </button>
              <button
                type="button"
                id="btn-export-dropdown-mobile"
                onClick={() => toggleCard("export")}
                disabled={!canDownload || isAiPolishing}
                aria-label="Export format options"
                aria-expanded={openCard === "export"}
                className="h-11 px-2 bg-slate-900 hover:bg-black border-l border-slate-700 text-blue-200 flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-150 motion-reduce:transition-none ${
                    openCard === "export" ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ===================== DESKTOP LAYOUT (>= 640px) ===================== */
        /* Exact 44px total row height, compact 32px secondary controls, larger 40px right-aligned primary actions */
        <div className="h-[44px] px-3 flex items-center justify-between gap-1.5 w-full">
          {/* Secondary Controls Left Group (Ghost buttons, height 32px, 13px text, no borders until hover) */}
          <div className="flex items-center gap-1 min-w-0">
            {/* 1. FONT */}
            <div className="relative shrink-0">
              <button
                id="pill-toolbar-font"
                type="button"
                onClick={() => toggleCard("font")}
                aria-expanded={openCard === "font"}
                aria-haspopup="true"
                className={`h-8 px-2 rounded-lg text-[13px] font-medium transition-colors duration-150 flex items-center gap-1.5 cursor-pointer border border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  openCard === "font"
                    ? "bg-slate-100 border-slate-200 text-slate-900 font-semibold"
                    : "text-slate-700 hover:text-slate-900 hover:bg-slate-100 hover:border-slate-200"
                }`}
                title="Change Document Font"
              >
                <Type className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="truncate max-w-[110px]">{fontFamily}</span>
                <ChevronDown
                  className={`w-3 h-3 text-slate-400 transition-transform duration-150 motion-reduce:transition-none ${
                    openCard === "font" ? "rotate-180 text-slate-700" : ""
                  }`}
                />
              </button>

              {/* Font Popover */}
              {openCard === "font" && (
                <div className="absolute left-0 top-full mt-1.5 w-64 bg-white rounded-xl shadow-lg border border-slate-200 p-2 z-50 animate-popover-in motion-reduce:transition-none">
                  <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 border-b border-slate-100 mb-1 flex items-center justify-between">
                    <span>Typography</span>
                    <span className="text-blue-700 font-medium">{fontFamily}</span>
                  </div>
                  <div className="space-y-0.5">
                    {fontOptions.map((f) => (
                      <button
                        key={f.name}
                        type="button"
                        onClick={() => {
                          onFontFamilyChange(f.name);
                          setOpenCard(null);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors duration-150 text-left cursor-pointer ${
                          fontFamily === f.name
                            ? "bg-blue-50 text-blue-900 font-semibold"
                            : "hover:bg-slate-50 text-slate-800"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-xs" style={{ fontFamily: f.name }}>
                            {f.name}
                          </div>
                          <div className="text-[10px] text-slate-600 truncate">{f.type}</div>
                        </div>
                        {fontFamily === f.name && <Check className="w-3.5 h-3.5 text-blue-700 shrink-0 ml-1.5" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 2. THEME (Unless overflowed) */}
            {!isThemeInOverflow && (
              <div className="relative shrink-0">
                <button
                  id="pill-toolbar-theme"
                  type="button"
                  onClick={() => toggleCard("theme")}
                  aria-expanded={openCard === "theme"}
                  aria-haspopup="true"
                  className={`h-8 px-2 rounded-lg text-[13px] font-medium transition-colors duration-150 flex items-center gap-1.5 cursor-pointer border border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    openCard === "theme"
                      ? "bg-slate-100 border-slate-200 text-slate-900 font-semibold"
                      : "text-slate-700 hover:text-slate-900 hover:bg-slate-100 hover:border-slate-200"
                  }`}
                  title="Change University Color Theme"
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0 shadow-2xs border border-black/10"
                    style={{ backgroundColor: currentTheme.hex }}
                  />
                  {!isCompactLabels && (
                    <span className="truncate max-w-[95px]">{currentTheme.label}</span>
                  )}
                  <ChevronDown
                    className={`w-3 h-3 text-slate-400 transition-transform duration-150 motion-reduce:transition-none ${
                      openCard === "theme" ? "rotate-180 text-slate-700" : ""
                    }`}
                  />
                </button>

                {/* Theme Popover */}
                {openCard === "theme" && (
                  <div className="absolute left-0 top-full mt-1.5 w-68 bg-white rounded-xl shadow-lg border border-slate-200 p-2 z-50 animate-popover-in motion-reduce:transition-none">
                    <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 border-b border-slate-100 mb-1 flex items-center justify-between">
                      <span>University Themes</span>
                      <span className="text-xs font-medium text-slate-800">{currentTheme.label}</span>
                    </div>
                    <div className="space-y-0.5 max-h-64 overflow-y-auto pr-0.5">
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
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors duration-150 text-left cursor-pointer ${
                              isSelected ? "bg-slate-100 font-semibold text-slate-900" : "hover:bg-slate-50 text-slate-800"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs border border-black/10"
                                style={{ backgroundColor: t.hex }}
                              />
                              <div className="text-left min-w-0">
                                <span className="font-medium text-slate-900 block truncate">{t.label}</span>
                                <span className="text-[10px] text-slate-600 block truncate">{t.desc}</span>
                              </div>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-slate-900 shrink-0 ml-1.5" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. MATH (Unless overflowed) */}
            {!isMathInOverflow && (
              <div className="relative shrink-0">
                <button
                  id="pill-toolbar-math"
                  type="button"
                  onClick={() => toggleCard("math")}
                  aria-expanded={openCard === "math"}
                  aria-haspopup="true"
                  className={`h-8 px-2 rounded-lg text-[13px] font-medium transition-colors duration-150 flex items-center gap-1.5 cursor-pointer border border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    openCard === "math"
                      ? "bg-slate-100 border-slate-200 text-slate-900 font-semibold"
                      : "text-slate-700 hover:text-slate-900 hover:bg-slate-100 hover:border-slate-200"
                  }`}
                  title="Mathematical Equations & Quick Symbols"
                >
                  <SquareRadical className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="truncate max-w-[90px]">
                    {isCompactLabels ? (equationFormat === "native" ? "OMML" : "LaTeX") : (equationFormat === "native" ? "Word OMML" : "LaTeX Math")}
                  </span>
                  <ChevronDown
                    className={`w-3 h-3 text-slate-400 transition-transform duration-150 motion-reduce:transition-none ${
                      openCard === "math" ? "rotate-180 text-slate-700" : ""
                    }`}
                  />
                </button>

                {/* Math Popover */}
                {openCard === "math" && (
                  <div className="absolute left-0 top-full mt-1.5 w-76 bg-white rounded-xl shadow-lg border border-slate-200 p-3 z-50 animate-popover-in motion-reduce:transition-none">
                    <div className="mb-2.5">
                      <div className="text-[11px] font-semibold text-slate-600 mb-1">
                        Word Math Output Format
                      </div>
                      <div className="grid grid-cols-2 gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                        <button
                          type="button"
                          onClick={() => onEquationFormatChange("native")}
                          className={`text-xs py-1 px-2 rounded-md font-medium transition-all duration-150 cursor-pointer ${
                            equationFormat === "native"
                              ? "bg-white text-indigo-900 font-semibold shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          Word (OMML)
                        </button>
                        <button
                          type="button"
                          onClick={() => onEquationFormatChange("latex")}
                          className={`text-xs py-1 px-2 rounded-md font-medium transition-all duration-150 cursor-pointer ${
                            equationFormat === "latex"
                              ? "bg-white text-indigo-900 font-semibold shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          LaTeX ($...$)
                        </button>
                      </div>
                    </div>

                    <div className="mb-2">
                      <div className="text-[11px] font-semibold text-slate-600 mb-1">
                        Quick Symbols
                      </div>
                      <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 gap-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setMathTab("stats")}
                          className={`flex-1 py-0.5 rounded transition-all ${
                            mathTab === "stats" ? "bg-white text-slate-900 font-semibold shadow-xs" : "text-slate-600"
                          }`}
                        >
                          Stats
                        </button>
                        <button
                          type="button"
                          onClick={() => setMathTab("calc")}
                          className={`flex-1 py-0.5 rounded transition-all ${
                            mathTab === "calc" ? "bg-white text-slate-900 font-semibold shadow-xs" : "text-slate-600"
                          }`}
                        >
                          Calculus
                        </button>
                        <button
                          type="button"
                          onClick={() => setMathTab("algebra")}
                          className={`flex-1 py-0.5 rounded transition-all ${
                            mathTab === "algebra" ? "bg-white text-slate-900 font-semibold shadow-xs" : "text-slate-600"
                          }`}
                        >
                          Algebra
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-1">
                      {mathCategories[mathTab].map((item) => (
                        <button
                          key={item.symbol}
                          type="button"
                          onClick={() => {
                            if (onInsertSymbol) onInsertSymbol(` ${item.symbol} `);
                          }}
                          className="p-1.5 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-900 border border-slate-200 rounded-lg text-xs font-mono text-center transition-colors cursor-pointer"
                          title={item.label}
                        >
                          {item.symbol}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Thin Divider 1 */}
            {(!isStudyGuideInOverflow || !isSkillsInOverflow || !isSamplesInOverflow) && (
              <div className="w-px h-4 bg-slate-200 shrink-0 mx-0.5" aria-hidden="true" />
            )}

            {/* 4. STUDY GUIDE (Unless overflowed) */}
            {!isStudyGuideInOverflow && (
              <div className="relative shrink-0">
                <button
                  id="pill-toolbar-study-guide"
                  type="button"
                  onClick={() => toggleCard("study-guide")}
                  aria-expanded={openCard === "study-guide"}
                  aria-haspopup="true"
                  className={`h-8 px-2 rounded-lg text-[13px] font-medium transition-colors duration-150 flex items-center gap-1.5 cursor-pointer border border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    openCard === "study-guide"
                      ? "bg-slate-100 border-slate-200 text-slate-900 font-semibold"
                      : "text-slate-700 hover:text-slate-900 hover:bg-slate-100 hover:border-slate-200"
                  }`}
                  title="Select Academic Document Preset"
                >
                  <GraduationCap className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  {!isCompactLabels && (
                    <span className="truncate max-w-[90px]">{currentFormatLabel}</span>
                  )}
                  <ChevronDown
                    className={`w-3 h-3 text-slate-400 transition-transform duration-150 motion-reduce:transition-none ${
                      openCard === "study-guide" ? "rotate-180 text-slate-700" : ""
                    }`}
                  />
                </button>

                {openCard === "study-guide" && (
                  <div className="absolute left-0 top-full mt-1.5 w-72 bg-white rounded-xl shadow-lg border border-slate-200 p-2 z-50 animate-popover-in motion-reduce:transition-none">
                    <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 border-b border-slate-100 mb-1">
                      Document Structure Preset
                    </div>
                    <div className="space-y-1">
                      {[
                        {
                          id: "study_guide",
                          title: "🎓 Study Guide & Formulas",
                          desc: "Numbered sections, highlighted formulas, definition tables",
                        },
                        {
                          id: "exam_bank",
                          title: "📝 Exam Question Bank",
                          desc: "Numbered problems, exam sections, step-by-step items",
                        },
                        {
                          id: "auto",
                          title: "⚡ Auto-Detect Structure",
                          desc: "Intelligently formats headers and math based on content",
                        },
                      ].map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => {
                            onFormatModeChange(mode.id as any);
                            setOpenCard(null);
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition-colors duration-150 text-left cursor-pointer ${
                            formatMode === mode.id
                              ? "bg-amber-50 text-amber-950 font-semibold border border-amber-200"
                              : "hover:bg-slate-50 text-slate-800"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="font-medium text-slate-900">{mode.title}</div>
                            <div className="text-[10px] text-slate-600 line-clamp-1">{mode.desc}</div>
                          </div>
                          {formatMode === mode.id && <Check className="w-3.5 h-3.5 text-amber-700 shrink-0 ml-1.5" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 5. ACADEMIC SKILLS (Unless overflowed) */}
            {!isSkillsInOverflow && (
              <div className="relative shrink-0">
                <button
                  id="pill-toolbar-skills"
                  type="button"
                  onClick={() => toggleCard("skills")}
                  aria-expanded={openCard === "skills"}
                  aria-haspopup="true"
                  className={`h-8 px-2 rounded-lg text-[13px] font-medium transition-colors duration-150 flex items-center gap-1.5 cursor-pointer border border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    openCard === "skills"
                      ? "bg-slate-100 border-slate-200 text-slate-900 font-semibold"
                      : "text-slate-700 hover:text-slate-900 hover:bg-slate-100 hover:border-slate-200"
                  }`}
                  title="Academic Skills Rules"
                >
                  <Layers className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span>{isCompactLabels ? `${activeSkillsCount}` : `${activeSkillsCount} Skills`}</span>
                  <ChevronDown
                    className={`w-3 h-3 text-slate-400 transition-transform duration-150 motion-reduce:transition-none ${
                      openCard === "skills" ? "rotate-180 text-slate-700" : ""
                    }`}
                  />
                </button>

                {openCard === "skills" && (
                  <div className="absolute left-0 top-full mt-1.5 w-76 bg-white rounded-xl shadow-lg border border-slate-200 p-2.5 z-50 animate-popover-in motion-reduce:transition-none">
                    <div className="text-[11px] font-semibold text-slate-600 mb-1.5">
                      Academic Skills Pipeline
                    </div>
                    <div className="space-y-1 mb-2.5 max-h-52 overflow-y-auto pr-0.5">
                      {skillRegistry.getAllSkills().map((skill) => (
                        <div
                          key={skill.id}
                          className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="font-medium text-slate-900 truncate">{skill.name}</div>
                            <div className="text-[10px] text-slate-600 truncate">{skill.description}</div>
                          </div>
                          <input
                            type="checkbox"
                            checked={skill.enabled}
                            onChange={() => {
                              skillRegistry.toggleSkill(skill.id);
                              if (onSkillsChanged) onSkillsChanged();
                            }}
                            className="w-3.5 h-3.5 accent-purple-600 rounded cursor-pointer shrink-0"
                            aria-label={`Toggle skill ${skill.name}`}
                          />
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenCard(null);
                        onOpenSkillsManager();
                      }}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs py-1.5 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-[0.98]"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Open Skills Hub</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 6. SAMPLES (Unless overflowed) */}
            {!isSamplesInOverflow && (
              <div className="relative shrink-0">
                <button
                  id="pill-toolbar-samples"
                  type="button"
                  onClick={() => toggleCard("samples")}
                  aria-expanded={openCard === "samples"}
                  aria-haspopup="true"
                  className={`h-8 px-2 rounded-lg text-[13px] font-medium transition-colors duration-150 flex items-center gap-1.5 cursor-pointer border border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    openCard === "samples"
                      ? "bg-slate-100 border-slate-200 text-slate-900 font-semibold"
                      : "text-slate-700 hover:text-slate-900 hover:bg-slate-100 hover:border-slate-200"
                  }`}
                  title="Load STEM Sample Notes"
                >
                  <FileText className="w-3.5 h-3.5 text-cyan-700 shrink-0" />
                  {!isCompactLabels && <span>Samples</span>}
                  <ChevronDown
                    className={`w-3 h-3 text-slate-400 transition-transform duration-150 motion-reduce:transition-none ${
                      openCard === "samples" ? "rotate-180 text-slate-700" : ""
                    }`}
                  />
                </button>

                {openCard === "samples" && (
                  <div className="absolute left-0 top-full mt-1.5 w-72 bg-white rounded-xl shadow-lg border border-slate-200 p-2 z-50 animate-popover-in motion-reduce:transition-none">
                    <div className="px-2 py-1 text-[11px] font-semibold text-slate-600 border-b border-slate-100 mb-1">
                      STEM Sample Templates
                    </div>
                    <div className="space-y-0.5 max-h-56 overflow-y-auto pr-0.5">
                      {SAMPLE_NOTES.map((sample) => (
                        <button
                          key={sample.id}
                          type="button"
                          onClick={() => {
                            onSelectSample(sample);
                            setOpenCard(null);
                          }}
                          className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-slate-50 rounded-lg transition-colors duration-150 flex flex-col cursor-pointer"
                        >
                          <span className="font-semibold text-slate-900 truncate">{sample.title}</span>
                          <span className="text-[10px] text-slate-600">{sample.category}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* "MORE ⋯" OVERFLOW BUTTON (Rendered whenever controls have moved into overflow) */}
            {hasAnyOverflow && (
              <div className="relative shrink-0">
                <button
                  id="pill-toolbar-more-overflow"
                  type="button"
                  onClick={() => toggleCard("more-overflow")}
                  aria-expanded={openCard === "more-overflow"}
                  aria-haspopup="true"
                  className={`h-8 px-2 rounded-lg text-[13px] font-medium transition-colors duration-150 flex items-center gap-1 cursor-pointer border border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    openCard === "more-overflow"
                      ? "bg-slate-100 border-slate-200 text-slate-900 font-semibold"
                      : "text-slate-700 hover:text-slate-900 hover:bg-slate-100 hover:border-slate-200"
                  }`}
                  title="More Controls"
                >
                  <MoreHorizontal className="w-4 h-4 text-slate-600" />
                  <span className="text-xs">More</span>
                  <ChevronDown
                    className={`w-3 h-3 text-slate-400 transition-transform duration-150 motion-reduce:transition-none ${
                      openCard === "more-overflow" ? "rotate-180 text-slate-700" : ""
                    }`}
                  />
                </button>

                {/* Overflow Popover Menu */}
                {openCard === "more-overflow" && (
                  <div className="absolute left-0 top-full mt-1.5 w-64 bg-white rounded-xl shadow-lg border border-slate-200 p-2 z-50 animate-popover-in motion-reduce:transition-none space-y-1">
                    <div className="px-2 py-1 text-[11px] font-semibold text-slate-500 border-b border-slate-100 mb-1">
                      Additional Controls
                    </div>

                    {/* Overflow: Theme if overflowed */}
                    {isThemeInOverflow && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpenCard("theme");
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 text-xs text-slate-800 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full border border-black/10"
                            style={{ backgroundColor: currentTheme.hex }}
                          />
                          <span>Theme ({currentTheme.label})</span>
                        </div>
                        <ChevronDown className="w-3 h-3 text-slate-400 -rotate-90" />
                      </button>
                    )}

                    {/* Overflow: Math if overflowed */}
                    {isMathInOverflow && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpenCard("math");
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 text-xs text-slate-800 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <SquareRadical className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Math ({equationFormat === "native" ? "OMML" : "LaTeX"})</span>
                        </div>
                        <ChevronDown className="w-3 h-3 text-slate-400 -rotate-90" />
                      </button>
                    )}

                    {/* Overflow: Study Guide if overflowed */}
                    {isStudyGuideInOverflow && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpenCard("study-guide");
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 text-xs text-slate-800 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <GraduationCap className="w-3.5 h-3.5 text-amber-700" />
                          <span>Structure ({currentFormatLabel})</span>
                        </div>
                        <ChevronDown className="w-3 h-3 text-slate-400 -rotate-90" />
                      </button>
                    )}

                    {/* Overflow: Skills if overflowed */}
                    {isSkillsInOverflow && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpenCard("skills");
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 text-xs text-slate-800 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Layers className="w-3.5 h-3.5 text-purple-600" />
                          <span>Skills ({activeSkillsCount} Active)</span>
                        </div>
                        <ChevronDown className="w-3 h-3 text-slate-400 -rotate-90" />
                      </button>
                    )}

                    {/* Overflow: Samples if overflowed */}
                    {isSamplesInOverflow && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpenCard("samples");
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 text-xs text-slate-800 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-cyan-700" />
                          <span>STEM Samples</span>
                        </div>
                        <ChevronDown className="w-3 h-3 text-slate-400 -rotate-90" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ===================== PRIMARY ACTIONS (VISUALLY LARGER, RIGHT-ALIGNED) ===================== */}
          {/* Height 40px, 14px semibold, min-width ~120px. AI Polish = accent-blue filled, Export = dark filled */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            {/* Quick Flagged repair button if errors exist */}
            {failedBlockCount > 0 && onRepairFlagged && (
              <button
                type="button"
                id="btn-toolbar-fix-flagged"
                onClick={onRepairFlagged}
                disabled={isRepairing}
                className="h-10 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                title={`Fix only the ${failedBlockCount} flagged blocks`}
              >
                {isRepairing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600 motion-reduce:animate-none shrink-0" />
                ) : (
                  <Wrench className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                )}
                <span>Fix ({failedBlockCount})</span>
              </button>
            )}

            {/* 1. [✨ AI Polish ▾] - Accent-blue filled button, height 40px, 14px semibold, min-width ~120px */}
            <div className="relative shrink-0 flex items-center">
              <div className="inline-flex rounded-xl overflow-hidden shadow-xs h-10 min-w-[120px]">
                {/* Main Action part */}
                <button
                  type="button"
                  id="btn-ai-polish-main"
                  onClick={() => {
                    if (isAiPolishing) return;
                    if (isNoAI && onTriggerFormatAI) {
                      onTriggerFormatAI();
                    } else {
                      onTriggerAiPolish();
                    }
                  }}
                  disabled={isAiPolishing}
                  className="flex-1 px-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  title={isNoAI ? "Run AI Polish (Offline)" : "Run AI Polish"}
                >
                  {isAiPolishing ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white motion-reduce:animate-none shrink-0" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-white shrink-0" />
                  )}
                  <span className="whitespace-nowrap">
                    {isAiPolishing ? "Running..." : "AI Polish"}
                  </span>
                </button>

                {/* Split Chevron ▾ */}
                <button
                  type="button"
                  id="btn-ai-polish-dropdown-toggle"
                  onClick={() => toggleCard("ai-polish")}
                  disabled={isAiPolishing}
                  aria-label="Engine selector options"
                  aria-expanded={openCard === "ai-polish"}
                  className="px-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 border-l border-blue-500 text-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  title="Select Engine & AI Models"
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-150 motion-reduce:transition-none ${
                      openCard === "ai-polish" ? "rotate-180" : ""
                    }`}
                  />
                </button>
              </div>

              {/* AI Polish Popover */}
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

            {/* 2. [⬇ Export .docx ▾] - Dark filled button, height 40px, 14px semibold, min-width ~120px */}
            <div className="relative shrink-0">
              <div className="inline-flex rounded-xl overflow-hidden shadow-xs h-10 min-w-[120px]">
                {/* Main Action part */}
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
                  className="flex-1 px-3.5 bg-slate-900 hover:bg-black active:bg-slate-950 text-white text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                  title="Download Word (.docx)"
                >
                  <Download className="w-4 h-4 text-blue-300 shrink-0" />
                  <span className="whitespace-nowrap">Export .docx</span>
                </button>

                {/* Split Chevron ▾ */}
                <button
                  id="btn-export-dropdown-toggle"
                  type="button"
                  onClick={() => toggleCard("export")}
                  disabled={!canDownload || isAiPolishing}
                  aria-label="Export format options"
                  aria-expanded={openCard === "export"}
                  className="px-2 bg-slate-900 hover:bg-black active:bg-slate-950 border-l border-slate-700 text-blue-200 hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                  title="Choose export format (PDF, LaTeX, Markdown, Text)"
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-150 motion-reduce:transition-none ${
                      openCard === "export" ? "rotate-180 text-white" : ""
                    }`}
                  />
                </button>
              </div>

              {/* Export Popover */}
              {openCard === "export" && (
                <div
                  id="menu-export-formats"
                  className="absolute right-0 top-full mt-1.5 w-68 bg-white rounded-xl shadow-lg border border-slate-200 p-2 z-50 animate-popover-in motion-reduce:transition-none select-none"
                >
                  <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 border-b border-slate-100 flex items-center justify-between mb-1">
                    <span>Export Formats</span>
                    <span className="text-[10px] text-slate-600 font-mono">Select type</span>
                  </div>

                  <div className="space-y-0.5">
                    {/* Word (.docx) */}
                    <button
                      type="button"
                      id="opt-export-docx"
                      onClick={() => {
                        setOpenCard(null);
                        if (onExportFormat) onExportFormat("docx");
                        else onDownloadDocx();
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-800 hover:bg-sky-50 flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded bg-sky-100 text-sky-800 font-bold text-[10px] flex items-center justify-center shrink-0">
                          DOCX
                        </span>
                        <div>
                          <div className="font-semibold text-slate-900">Word (.docx)</div>
                          <div className="text-[10px] text-slate-600">Native Word OMML Equations</div>
                        </div>
                      </div>
                      <span className="text-[10px] text-sky-800 bg-sky-50 px-1 rounded font-medium">Standard</span>
                    </button>

                    {/* PDF (.pdf) */}
                    <button
                      type="button"
                      id="opt-export-pdf"
                      onClick={() => {
                        setOpenCard(null);
                        if (onExportFormat) onExportFormat("pdf");
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-800 hover:bg-rose-50 flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded bg-rose-100 text-rose-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                          PDF
                        </span>
                        <div>
                          <div className="font-semibold text-slate-900">PDF (.pdf)</div>
                          <div className="text-[10px] text-slate-600">Download Typeset Document</div>
                        </div>
                      </div>
                    </button>

                    {/* LaTeX (.tex) */}
                    <button
                      type="button"
                      id="opt-export-tex"
                      onClick={() => {
                        setOpenCard(null);
                        if (onExportFormat) onExportFormat("tex");
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-800 hover:bg-indigo-50 flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                          TEX
                        </span>
                        <div>
                          <div className="font-semibold text-slate-900">LaTeX (.tex)</div>
                          <div className="text-[10px] text-slate-600">Compilable Academic Source</div>
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
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-800 hover:bg-blue-50 flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                          MD
                        </span>
                        <div>
                          <div className="font-semibold text-slate-900">Markdown (.md)</div>
                          <div className="text-[10px] text-slate-600">Clean Academic Markdown</div>
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
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-800 hover:bg-slate-50 flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                          TXT
                        </span>
                        <div>
                          <div className="font-semibold text-slate-900">Plain Text (.txt)</div>
                          <div className="text-[10px] text-slate-600">Clean Raw Notes</div>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================== MOBILE TOOLS BOTTOM SHEET ===================== */}
      {/* Contains all secondary controls (Presets, Skills, Samples, Typography, Theme, Math) */}
      {openCard === "tools" && isMobileScreen &&
        renderBottomSheet(
          "Document Tools & Settings",
          <div className="space-y-4">
            {/* Scrollable Tab Switcher */}
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1 text-xs font-medium overflow-x-auto no-scrollbar">
              {[
                { id: "presets", label: "Presets" },
                { id: "skills", label: `Skills (${activeSkillsCount})` },
                { id: "samples", label: "Samples" },
                { id: "typography", label: "Typography" },
                { id: "theme", label: "Theme" },
                { id: "math", label: "Math" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMobileToolsTab(tab.id as any)}
                  className={`min-h-[40px] px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                    mobileToolsTab === tab.id ? "bg-white text-slate-900 font-semibold shadow-xs" : "text-slate-600"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab 1: Presets */}
            {mobileToolsTab === "presets" && (
              <div className="space-y-1.5">
                {[
                  {
                    id: "study_guide",
                    title: "🎓 Study Guide & Formulas",
                    desc: "Numbered sections, formulas, definition callouts",
                  },
                  {
                    id: "exam_bank",
                    title: "📝 Exam Question Bank",
                    desc: "Numbered problems, exam sections, step-by-step items",
                  },
                  {
                    id: "auto",
                    title: "⚡ Auto-Detect Structure",
                    desc: "Intelligently formats headers and math based on content",
                  },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => {
                      onFormatModeChange(mode.id as any);
                      setOpenCard(null);
                    }}
                    className={`w-full min-h-[44px] flex items-center justify-between p-3 rounded-xl text-xs transition-colors text-left cursor-pointer border ${
                      formatMode === mode.id
                        ? "bg-amber-50 text-amber-950 font-semibold border-amber-300"
                        : "hover:bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-slate-900 text-xs">{mode.title}</div>
                      <div className="text-xs text-slate-600 mt-0.5">{mode.desc}</div>
                    </div>
                    {formatMode === mode.id && <Check className="w-4 h-4 text-amber-700 shrink-0 ml-2" />}
                  </button>
                ))}
              </div>
            )}

            {/* Tab 2: Skills */}
            {mobileToolsTab === "skills" && (
              <div className="space-y-2">
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {skillRegistry.getAllSkills().map((skill) => (
                    <div
                      key={skill.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-medium text-slate-900 text-xs">{skill.name}</div>
                        <div className="text-xs text-slate-600 line-clamp-1">{skill.description}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={skill.enabled}
                        onChange={() => {
                          skillRegistry.toggleSkill(skill.id);
                          if (onSkillsChanged) onSkillsChanged();
                        }}
                        className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                        aria-label={`Toggle skill ${skill.name}`}
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOpenCard(null);
                    onOpenSkillsManager();
                  }}
                  className="w-full min-h-[44px] bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.98]"
                >
                  <Layers className="w-4 h-4" />
                  <span>Open Full Skills Manager</span>
                </button>
              </div>
            )}

            {/* Tab 3: Samples */}
            {mobileToolsTab === "samples" && (
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {SAMPLE_NOTES.map((sample) => (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => {
                      onSelectSample(sample);
                      setOpenCard(null);
                    }}
                    className="w-full min-h-[44px] text-left p-2.5 text-xs hover:bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-center cursor-pointer"
                  >
                    <span className="font-semibold text-slate-900 text-xs">{sample.title}</span>
                    <span className="text-xs text-slate-600">{sample.category}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Tab 4: Typography */}
            {mobileToolsTab === "typography" && (
              <div className="space-y-1.5">
                {fontOptions.map((f) => (
                  <button
                    key={f.name}
                    type="button"
                    onClick={() => {
                      onFontFamilyChange(f.name);
                      setOpenCard(null);
                    }}
                    className={`w-full min-h-[44px] flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-colors text-left cursor-pointer border ${
                      fontFamily === f.name
                        ? "bg-blue-50 text-blue-900 font-semibold border-blue-200"
                        : "hover:bg-slate-50 text-slate-800 border-slate-200"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium" style={{ fontFamily: f.name }}>
                        {f.name}
                      </div>
                      <div className="text-xs text-slate-600">{f.type}</div>
                    </div>
                    {fontFamily === f.name && <Check className="w-4 h-4 text-blue-700 shrink-0 ml-2" />}
                  </button>
                ))}
              </div>
            )}

            {/* Tab 5: Theme */}
            {mobileToolsTab === "theme" && (
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
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
                      className={`w-full min-h-[44px] flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer border ${
                        isSelected ? "bg-slate-100 font-semibold border-slate-300" : "hover:bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-4 h-4 rounded-full shrink-0 shadow-2xs border border-black/10"
                          style={{ backgroundColor: t.hex }}
                        />
                        <div className="text-left min-w-0">
                          <span className="font-semibold text-slate-900 block text-xs">{t.label}</span>
                          <span className="text-xs text-slate-600 block">{t.desc}</span>
                        </div>
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-slate-900 shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Tab 6: Math */}
            {mobileToolsTab === "math" && (
              <div className="space-y-3">
                <div>
                  <div className="text-xs font-medium text-slate-700 mb-1.5">Output Equation Format</div>
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => onEquationFormatChange("native")}
                      className={`min-h-[44px] text-xs py-2 px-3 rounded-lg font-medium transition-all ${
                        equationFormat === "native" ? "bg-white text-slate-900 font-semibold shadow-xs" : "text-slate-600"
                      }`}
                    >
                      Word Math (OMML)
                    </button>
                    <button
                      type="button"
                      onClick={() => onEquationFormatChange("latex")}
                      className={`min-h-[44px] text-xs py-2 px-3 rounded-lg font-medium transition-all ${
                        equationFormat === "latex" ? "bg-white text-slate-900 font-semibold shadow-xs" : "text-slate-600"
                      }`}
                    >
                      LaTeX ($...$)
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-slate-700 mb-1.5">Insert Symbol into Notes</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {mathCategories[mathTab].map((item) => (
                      <button
                        key={item.symbol}
                        type="button"
                        onClick={() => {
                          if (onInsertSymbol) onInsertSymbol(` ${item.symbol} `);
                          setOpenCard(null);
                        }}
                        className="min-h-[44px] p-2 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-xl text-xs font-mono text-center"
                        title={item.label}
                      >
                        {item.symbol}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
    </div>
  );
};
