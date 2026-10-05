import React, { useState, useRef, useEffect } from "react";
import {
  Type,
  SquareRadical,
  Sparkles,
  GraduationCap,
  ChevronDown,
  Check,
  Loader2,
  SlidersHorizontal,
  Download,
  CheckCircle2,
  Wrench,
  X,
  FileCode,
  Printer,
  BarChart2,
} from "lucide-react";
import { SampleNote } from "../data/samples";
import { ACADEMIC_THEMES, getAcademicTheme } from "../utils/theme";
import { AIPolishDropdown } from "./AIPolishDropdown";

export interface ToolbarGridProps {
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
  // Optional Word & Char counts for toolbar display
  charCount?: number;
  wordCount?: number;
}

export const ToolbarGrid: React.FC<ToolbarGridProps> = React.memo(({
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
  charCount = 0,
  wordCount = 0,
}) => {
  const [openCard, setOpenCard] = useState<string | null>(null);
  const [mathTab, setMathTab] = useState<"stats" | "calc" | "algebra">("stats");
  const [mobileToolsTab, setMobileToolsTab] = useState<
    "typography" | "theme" | "math" | "metrics"
  >("typography");
  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ left: number } | null>(null);

  const currentTheme = getAcademicTheme(accentColor);

  const closeDropdown = () => {
    setOpenCard(null);
    if (lastTriggerRef.current) {
      lastTriggerRef.current.focus();
    }
  };

  const toggleCard = (cardId: string) => {
    setOpenCard((prev) => {
      if (prev === cardId) {
        return null;
      }
      lastTriggerRef.current = document.activeElement as HTMLElement;
      return cardId;
    });
  };

  // Keyboard navigation for Export dropdown menus
  const handleExportMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const menuEl = e.currentTarget;
    const items = Array.from(menuEl.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]'));
    if (items.length === 0) return;

    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      items[nextIndex]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
      items[prevIndex]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeDropdown();
    }
  };

  // Calculate anchored, non-clipping popover position for secondary tools track buttons
  useEffect(() => {
    if (!openCard || ["tools", "ai-polish", "export"].includes(openCard)) {
      setPopoverPos(null);
      return;
    }

    const buttonIdMap: Record<string, string> = {
      font: "pill-toolbar-font",
      theme: "pill-toolbar-theme",
      math: "pill-toolbar-math",
    };

    const btnId = buttonIdMap[openCard];
    if (!btnId) return;

    const updatePos = () => {
      const btnEl = document.getElementById(btnId);
      const containerEl = containerRef.current;
      if (!btnEl || !containerEl) return;

      const btnRect = btnEl.getBoundingClientRect();
      const containerRect = containerEl.getBoundingClientRect();
      const popoverWidth = openCard === "math" ? 304 : openCard === "theme" ? 272 : 256;

      let left = btnRect.left - containerRect.left;
      const maxLeft = containerRect.width - popoverWidth - 12;
      if (left > maxLeft) left = maxLeft;
      if (left < 8) left = 8;
      setPopoverPos({ left });
    };

    updatePos();
    window.addEventListener("resize", updatePos);
    const trackEl = document.getElementById("toolbar-secondary-track");
    trackEl?.addEventListener("scroll", updatePos, { passive: true });
    return () => {
      window.removeEventListener("resize", updatePos);
      trackEl?.removeEventListener("scroll", updatePos);
    };
  }, [openCard]);

  // Responsive breakpoint tracking (< 640px = Mobile mode with tools sheet)
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileScreen(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Close dropdowns on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpenCard(null);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeDropdown();
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

  const fontOptions = [
    { name: "Times New Roman", type: "Academic Standard (APA, IEEE, Chicago)" },
    { name: "Georgia", type: "Classic Warm Serif (Reading clarity)" },
    { name: "Calibri", type: "Microsoft Office Contemporary Sans" },
    { name: "Arial", type: "Technical Document Standard Sans" },
    { name: "Aptos", type: "New Academic Default Sans" },
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

  const renderFontPopover = () => (
    <div className="w-64 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-xl border border-slate-300 p-2 select-none">
      <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 border-b border-slate-100 mb-1 flex items-center justify-between">
        <span>Typography</span>
        <span className="font-semibold" style={{ color: currentTheme.hex }}>
          {fontFamily}
        </span>
      </div>
      <div className="space-y-0.5">
        {fontOptions.map((f) => (
          <button
            key={f.name}
            type="button"
            onClick={() => {
              onFontFamilyChange(f.name);
              closeDropdown();
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors duration-150 text-left cursor-pointer ${
              fontFamily === f.name
                ? "bg-rose-50 text-[#881337] font-bold border border-rose-200"
                : "hover:bg-slate-50 text-slate-800"
            }`}
          >
            <div className="min-w-0">
              <div className="truncate text-xs" style={{ fontFamily: f.name }}>
                {f.name}
              </div>
              <div className="text-[10px] text-slate-500 truncate">{f.type}</div>
            </div>
            {fontFamily === f.name && (
              <Check className="w-3.5 h-3.5 text-[#881337] shrink-0 ml-1.5" />
            )}
          </button>
        ))}
      </div>
    </div>
  );

  const renderThemePopover = () => (
    <div className="w-68 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-xl border border-slate-300 p-2 select-none">
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
                closeDropdown();
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors duration-150 text-left cursor-pointer ${
                isSelected
                  ? "bg-slate-100 font-bold text-slate-950 border border-slate-300"
                  : "hover:bg-slate-50 text-slate-800"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs border border-black/10"
                  style={{ backgroundColor: t.hex }}
                />
                <div className="text-left min-w-0">
                  <span className="font-semibold text-slate-900 block truncate">
                    {t.label}
                  </span>
                  <span className="text-[10px] text-slate-500 block truncate">
                    {t.desc}
                  </span>
                </div>
              </div>
              {isSelected && <Check className="w-3.5 h-3.5 text-slate-900 shrink-0 ml-1.5" />}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderMathPopover = () => (
    <div className="w-76 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-xl border border-slate-300 p-3 select-none">
      <div className="mb-2.5">
        <div className="text-[11px] font-semibold text-slate-700 mb-1">
          Word Math Output Format
        </div>
        <div className="grid grid-cols-2 gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => onEquationFormatChange("native")}
            className={`text-xs py-1.5 px-2 rounded-md font-medium transition-all duration-150 cursor-pointer ${
              equationFormat === "native"
                ? "bg-white text-indigo-950 font-bold shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Word (OMML)
          </button>
          <button
            type="button"
            onClick={() => onEquationFormatChange("latex")}
            className={`text-xs py-1.5 px-2 rounded-md font-medium transition-all duration-150 cursor-pointer ${
              equationFormat === "latex"
                ? "bg-white text-indigo-950 font-bold shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            LaTeX ($...$)
          </button>
        </div>
      </div>

      <div className="mb-2">
        <div className="text-[11px] font-semibold text-slate-700 mb-1">
          Quick Symbols
        </div>
        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 gap-1 text-[11px]">
          <button
            type="button"
            onClick={() => setMathTab("stats")}
            className={`flex-1 py-1 rounded transition-all cursor-pointer ${
              mathTab === "stats"
                ? "bg-white text-slate-900 font-bold shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Stats
          </button>
          <button
            type="button"
            onClick={() => setMathTab("calc")}
            className={`flex-1 py-1 rounded transition-all cursor-pointer ${
              mathTab === "calc"
                ? "bg-white text-slate-900 font-bold shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Calculus
          </button>
          <button
            type="button"
            onClick={() => setMathTab("algebra")}
            className={`flex-1 py-1 rounded transition-all cursor-pointer ${
              mathTab === "algebra"
                ? "bg-white text-slate-900 font-bold shadow-xs"
                : "text-slate-600 hover:text-slate-900"
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
            className="p-1.5 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-950 border border-slate-200 rounded-lg text-xs font-mono text-center transition-colors cursor-pointer"
            title={item.label}
          >
            {item.symbol}
          </button>
        ))}
      </div>
    </div>
  );

  // Reusable bottom sheet wrapper for mobile tools
  const renderBottomSheet = (title: string, children: React.ReactNode) => (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-end justify-center p-0 animate-modal-backdrop motion-reduce:transition-none cursor-pointer"
      onClick={closeDropdown}
      aria-modal="true"
      role="dialog"
      aria-labelledby="mobile-tools-sheet-title"
    >
      <div
        className="w-full max-h-[85dvh] bg-white rounded-t-3xl border-t border-slate-300 p-4 shadow-2xl overflow-y-auto animate-modal-content motion-reduce:transition-none cursor-default"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex justify-center pb-2.5" aria-hidden="true">
          <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
        </div>
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-slate-700" />
            <h3 id="mobile-tools-sheet-title" className="text-sm font-bold text-slate-900">{title}</h3>
          </div>
          <button
            type="button"
            onClick={closeDropdown}
            className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#881337]"
            aria-label="Close sheet"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className="sticky top-[44px] sm:top-[40px] z-20 w-full bg-white border-b border-slate-300 select-none overflow-visible shadow-2xs"
    >
      {/* ===================== MOBILE LAYOUT (<640px) ===================== */}
      {isMobileScreen ? (
        <div className="h-12 px-1.5 sm:px-2 flex items-center justify-between w-full gap-1 sm:gap-1.5 flex-nowrap min-w-0">
          {/* Left: Tools categorised menu launcher */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              id="pill-toolbar-mobile-tools"
              type="button"
              onClick={() => toggleCard("tools")}
              aria-expanded={openCard === "tools"}
              aria-haspopup="dialog"
              className={`h-10 min-h-[40px] px-2 sm:px-3 rounded-xl border transition-all text-xs font-bold flex items-center gap-1 sm:gap-1.5 cursor-pointer shadow-2xs shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#881337] active:scale-[0.98] ${
                openCard === "tools"
                  ? "bg-slate-100 border-slate-400 text-slate-950"
                  : "bg-white border-slate-300 text-slate-800 hover:bg-slate-50"
              }`}
              title="Open Formatting Tools, Skills, Math & Themes"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-700 shrink-0" />
              <span>Tools</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-150 motion-reduce:transition-none ${
                  openCard === "tools" ? "rotate-180 text-slate-900" : ""
                }`}
              />
            </button>

            {/* Quick Word Count badge on mobile (>= 380px) */}
            {wordCount > 0 && (
              <span className="hidden min-[380px]:inline-flex items-center text-[11px] font-mono text-slate-600 bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg truncate max-w-[85px]">
                {wordCount}w
              </span>
            )}
          </div>

          {/* Right: AI Polish and Export (both with min 40px hit-targets and split chevrons) */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-auto">
            {/* Quick Flagged repair button if errors exist */}
            {failedBlockCount > 0 && onRepairFlagged && (
              <button
                type="button"
                id="btn-toolbar-fix-flagged-mobile"
                onClick={onRepairFlagged}
                disabled={isRepairing}
                className="h-10 px-1.5 sm:px-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                title={`Fix only the ${failedBlockCount} flagged blocks`}
              >
                {isRepairing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600 motion-reduce:animate-none shrink-0" />
                ) : (
                  <Wrench className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                )}
                <span>({failedBlockCount})</span>
              </button>
            )}

            {/* AI Polish */}
            <div className="relative shrink-0 flex items-center">
              <div className="inline-flex rounded-xl overflow-hidden shadow-xs h-10 shrink-0">
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
                  style={{ backgroundColor: currentTheme.btnPrimary }}
                  className="h-10 px-2 sm:px-3 text-white text-xs font-bold flex items-center gap-1 sm:gap-1.5 cursor-pointer disabled:opacity-50 transition-all hover:brightness-95 active:brightness-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#881337]"
                  title={isNoAI ? "Run AI Polish (Offline)" : "Run AI Polish"}
                >
                  {isAiPolishing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none shrink-0" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="whitespace-nowrap">
                    {isAiPolishing ? "..." : (
                      <>
                        <span className="hidden min-[360px]:inline">AI </span>
                        <span>Polish</span>
                      </>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  id="btn-ai-polish-dropdown-mobile"
                  onClick={() => toggleCard("ai-polish")}
                  disabled={isAiPolishing}
                  aria-label="AI Engine options"
                  aria-expanded={openCard === "ai-polish"}
                  aria-haspopup="dialog"
                  style={{ backgroundColor: currentTheme.btnPrimary }}
                  className="h-10 px-1 sm:px-1.5 border-l border-white/25 text-white flex items-center justify-center cursor-pointer disabled:opacity-50 transition-all hover:brightness-95 active:brightness-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#881337]"
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-150 motion-reduce:transition-none ${
                      openCard === "ai-polish" ? "rotate-180" : ""
                    }`}
                  />
                </button>
              </div>

              {/* AI Polish Popover on Mobile */}
              {openCard === "ai-polish" && (
                <AIPolishDropdown
                  isAiPolishing={isAiPolishing}
                  onTriggerAiPolish={onTriggerAiPolish}
                  onTriggerFormatAI={onTriggerFormatAI}
                  isNoAI={isNoAI}
                  onProviderChange={onProviderChange}
                  onClose={closeDropdown}
                  onOpenAISettings={onOpenAISettings}
                />
              )}
            </div>

            {/* Export */}
            <div className="relative shrink-0 flex items-center">
              <div className="inline-flex rounded-xl overflow-hidden shadow-xs h-10 shrink-0">
                <button
                  type="button"
                  id="btn-export-docs-mobile"
                  onClick={() => {
                    if (onExportFormat) onExportFormat("docx");
                    else onDownloadDocx();
                  }}
                  disabled={!canDownload || isAiPolishing}
                  className="h-10 px-2 sm:px-3 bg-slate-900 hover:bg-black active:bg-slate-950 text-white text-xs font-bold flex items-center gap-1 sm:gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Export Word Document (.docx)"
                >
                  <Download className="w-3.5 h-3.5 text-white shrink-0" />
                  <span className="whitespace-nowrap">Export</span>
                </button>
                <button
                  type="button"
                  id="btn-export-dropdown-mobile"
                  onClick={() => toggleCard("export")}
                  disabled={!canDownload || isAiPolishing}
                  aria-label="Export format options"
                  aria-expanded={openCard === "export"}
                  aria-haspopup="menu"
                  aria-controls="menu-export-formats-mobile"
                  className="h-10 px-1 sm:px-1.5 bg-slate-900 hover:bg-black active:bg-slate-950 border-l border-slate-700 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-150 motion-reduce:transition-none ${
                      openCard === "export" ? "rotate-180 text-white" : ""
                    }`}
                  />
                </button>
              </div>

              {/* Export Popover on Mobile */}
              {openCard === "export" && (
                <div
                  id="menu-export-formats-mobile"
                  role="menu"
                  aria-label="Export format options"
                  tabIndex={-1}
                  onKeyDown={handleExportMenuKeyDown}
                  className="absolute right-0 top-full mt-1.5 w-64 max-w-[calc(100vw-1rem)] bg-white rounded-xl shadow-2xl border border-slate-300 p-2 z-50 animate-popover-in motion-reduce:transition-none select-none"
                >
                  <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 border-b border-slate-100 flex items-center justify-between mb-1">
                    <span>Export Formats</span>
                    <span className="text-[10px] text-slate-600 font-mono">Select type</span>
                  </div>
                  <div className="space-y-0.5">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        closeDropdown();
                        if (onExportFormat) onExportFormat("docx");
                        else onDownloadDocx();
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-900 hover:bg-slate-100 focus:bg-slate-100 focus-visible:outline-none flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <span>Word (.docx)</span>
                      <span className="text-[10px] text-slate-500 font-normal">OMML Math</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        closeDropdown();
                        if (onExportFormat) onExportFormat("pdf");
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-900 hover:bg-slate-100 focus:bg-slate-100 focus-visible:outline-none flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <span>Print to PDF (.pdf)</span>
                      <span className="text-[10px] text-slate-500 font-normal">Clean Paper</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        closeDropdown();
                        if (onExportFormat) onExportFormat("tex");
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-900 hover:bg-slate-100 focus:bg-slate-100 focus-visible:outline-none flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <span>LaTeX Source (.tex)</span>
                      <span className="text-[10px] text-slate-500 font-normal">Publication</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        closeDropdown();
                        if (onExportFormat) onExportFormat("md");
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-900 hover:bg-slate-100 focus:bg-slate-100 focus-visible:outline-none flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <span>Markdown (.md)</span>
                      <span className="text-[10px] text-slate-500 font-normal">Clean Markdown</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        closeDropdown();
                        if (onExportFormat) onExportFormat("txt");
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-900 hover:bg-slate-100 focus:bg-slate-100 focus-visible:outline-none flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <span>Plain Text (.txt)</span>
                      <span className="text-[10px] text-slate-500 font-normal">Raw Text</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ===================== DESKTOP & TABLET LAYOUT (>= 640px) ===================== */
        /* Exact 44px total row height, horizontally scrollable secondary tools track, pinned right actions */
        <div className="h-[44px] px-3 flex items-center justify-between gap-2 w-full overflow-visible">
          {/* 
            Secondary Controls Track:
            - Desktop: Spacious horizontal row.
            - Tablet: Smooth touch-scrollable horizontal track (.no-scrollbar) preventing clipped controls.
          */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-x-auto no-scrollbar scroll-smooth py-0.5">
            {/* 1. FONT SELECTOR */}
            <div className="relative shrink-0">
              <button
                id="pill-toolbar-font"
                type="button"
                onClick={() => toggleCard("font")}
                aria-expanded={openCard === "font"}
                aria-haspopup="true"
                aria-label={`Select document font, currently ${fontFamily}`}
                className={`h-8 px-2.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 cursor-pointer border shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#881337] active:scale-[0.98] ${
                  openCard === "font"
                    ? "bg-slate-100 border-slate-400 text-slate-950 font-bold shadow-xs"
                    : "bg-white border-slate-300 text-slate-800 hover:text-slate-950 hover:bg-slate-50 hover:border-slate-400"
                }`}
                title="Change Document Font"
              >
                <Type className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                <span className="truncate max-w-[105px]">{fontFamily}</span>
                <ChevronDown
                  className={`w-3 h-3 text-slate-400 transition-transform duration-150 motion-reduce:transition-none ${
                    openCard === "font" ? "rotate-180 text-slate-800" : ""
                  }`}
                />
              </button>
            </div>

            {/* 2. THEME SELECTOR */}
            <div className="relative shrink-0">
              <button
                id="pill-toolbar-theme"
                type="button"
                onClick={() => toggleCard("theme")}
                aria-expanded={openCard === "theme"}
                aria-haspopup="true"
                aria-label={`Select university theme, currently ${currentTheme.label}`}
                className={`h-8 px-2.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 cursor-pointer border shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#881337] active:scale-[0.98] ${
                  openCard === "theme"
                    ? "bg-slate-100 border-slate-400 text-slate-950 font-bold shadow-xs"
                    : "bg-white border-slate-300 text-slate-800 hover:text-slate-950 hover:bg-slate-50 hover:border-slate-400"
                }`}
                title="Change University Color Theme"
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0 shadow-2xs border border-black/10"
                  style={{ backgroundColor: currentTheme.hex }}
                />
                <span className="truncate max-w-[95px]">{currentTheme.label}</span>
                <ChevronDown
                  className={`w-3 h-3 text-slate-400 transition-transform duration-150 motion-reduce:transition-none ${
                    openCard === "theme" ? "rotate-180 text-slate-800" : ""
                  }`}
                />
              </button>
            </div>

            {/* 3. MATHEMATICAL NOTATION & SYMBOLS */}
            <div className="relative shrink-0">
              <button
                id="pill-toolbar-math"
                type="button"
                onClick={() => toggleCard("math")}
                aria-expanded={openCard === "math"}
                aria-haspopup="true"
                aria-label={`Mathematical notation settings, currently ${equationFormat === "native" ? "Word OMML" : "LaTeX Math"}`}
                className={`h-8 px-2.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 cursor-pointer border shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#881337] active:scale-[0.98] ${
                  openCard === "math"
                    ? "bg-slate-100 border-slate-400 text-slate-950 font-bold shadow-xs"
                    : "bg-white border-slate-300 text-slate-800 hover:text-slate-950 hover:bg-slate-50 hover:border-slate-400"
                }`}
                title="Mathematical Equations & Quick Symbols"
              >
                <SquareRadical className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                <span className="truncate max-w-[85px]">
                  {equationFormat === "native" ? "OMML Math" : "LaTeX Math"}
                </span>
                <ChevronDown
                  className={`w-3 h-3 text-slate-400 transition-transform duration-150 motion-reduce:transition-none ${
                    openCard === "math" ? "rotate-180 text-slate-800" : ""
                  }`}
                />
              </button>
            </div>

            {/* 4. LIVE WORD COUNT / METRICS BADGE */}
            {wordCount > 0 && (
              <div
                className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100/90 border border-slate-200 px-2.5 py-1 rounded-lg shrink-0 cursor-default"
                title={`${charCount.toLocaleString()} total characters • ${wordCount.toLocaleString()} words in active document`}
              >
                <BarChart2 className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-medium font-mono text-[11px]">
                  {wordCount.toLocaleString()} words
                  {charCount > 0 && (
                    <span className="hidden md:inline text-slate-400"> • {charCount.toLocaleString()} chars</span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Anchored Popover for Secondary Track Buttons (rendered outside overflow-x-auto track to prevent clipping) */}
          {!isMobileScreen && popoverPos && openCard && [
            "font",
            "theme",
            "math",
          ].includes(openCard) && (
            <div
              className="absolute top-full mt-1.5 z-50 animate-popover-in motion-reduce:transition-none"
              style={{ left: popoverPos.left }}
            >
              {openCard === "font" && renderFontPopover()}
              {openCard === "theme" && renderThemePopover()}
              {openCard === "math" && renderMathPopover()}
            </div>
          )}

          {/* ===================== PRIMARY ACTIONS (PINNED RIGHT) ===================== */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto pl-2 bg-white">
            {/* Quick Flagged repair button if errors exist */}
            {failedBlockCount > 0 && onRepairFlagged && (
              <button
                type="button"
                id="btn-toolbar-fix-flagged"
                onClick={onRepairFlagged}
                disabled={isRepairing}
                className="h-10 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-800 border border-rose-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
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

            {/* 1. [✨ AI Polish ▾] - Accent-filled button */}
            <div className="relative shrink-0 flex items-center">
              <div className="inline-flex rounded-xl overflow-hidden shadow-xs h-10 min-w-[120px]">
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
                  style={{ backgroundColor: currentTheme.btnPrimary }}
                  className="flex-1 px-3.5 text-white text-sm font-semibold flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer disabled:opacity-50 hover:brightness-95 active:brightness-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#881337]"
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
                  style={{ backgroundColor: currentTheme.btnPrimary }}
                  className="px-2 border-l border-white/25 text-white flex items-center justify-center transition-all duration-150 cursor-pointer disabled:opacity-50 hover:brightness-95 active:brightness-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#881337]"
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
                <div className="absolute right-0 top-full mt-1.5 z-50">
                  <AIPolishDropdown
                    isAiPolishing={isAiPolishing}
                    onTriggerAiPolish={onTriggerAiPolish}
                    onTriggerFormatAI={onTriggerFormatAI}
                    isNoAI={isNoAI}
                    onProviderChange={onProviderChange}
                    onClose={() => setOpenCard(null)}
                    onOpenAISettings={onOpenAISettings}
                  />
                </div>
              )}
            </div>

            {/* 2. [⬇ Export .docx ▾] - Dark filled button */}
            <div className="relative shrink-0">
              <div className="inline-flex rounded-xl overflow-hidden shadow-xs h-10 min-w-[120px]">
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
                  <Download className="w-4 h-4 text-white shrink-0" />
                  <span className="whitespace-nowrap">Export .docx</span>
                </button>

                <button
                  id="btn-export-dropdown-toggle"
                  type="button"
                  onClick={() => toggleCard("export")}
                  disabled={!canDownload || isAiPolishing}
                  aria-label="Export format options"
                  aria-expanded={openCard === "export"}
                  className="px-2 bg-slate-900 hover:bg-black active:bg-slate-950 border-l border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
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
                  className="absolute right-0 top-full mt-1.5 w-68 bg-white rounded-xl shadow-xl border border-slate-300 p-2 z-50 animate-popover-in motion-reduce:transition-none select-none"
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
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-800 hover:bg-slate-50 flex items-center justify-between transition-colors cursor-pointer"
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
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-800 hover:bg-slate-50 flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded bg-rose-100 text-rose-800 font-bold text-[10px] flex items-center justify-center shrink-0">
                          <Printer className="w-3.5 h-3.5" />
                        </span>
                        <div>
                          <div className="font-semibold text-slate-900">Print to PDF (.pdf)</div>
                          <div className="text-[10px] text-slate-600">Exact Word Layout Print</div>
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
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-800 hover:bg-slate-50 flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded bg-amber-100 text-amber-800 font-bold text-[10px] flex items-center justify-center shrink-0">
                          <FileCode className="w-3.5 h-3.5" />
                        </span>
                        <div>
                          <div className="font-semibold text-slate-900">LaTeX Source (.tex)</div>
                          <div className="text-[10px] text-slate-600">Clean Academic Document</div>
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
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-800 hover:bg-slate-50 flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded bg-slate-100 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0">
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
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-800 hover:bg-slate-50 flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded bg-slate-100 text-slate-600 font-bold text-[10px] flex items-center justify-center shrink-0">
                          TXT
                        </span>
                        <div>
                          <div className="font-semibold text-slate-900">Plain Text (.txt)</div>
                          <div className="text-[10px] text-slate-600">Unformatted Clean Text</div>
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

      {/* ===================== MOBILE TOOLS SHEET MODAL ===================== */}
      {isMobileScreen &&
        openCard === "tools" &&
        renderBottomSheet(
          "FormatAI Academic Tools",
          <div className="space-y-3">
            {/* Horizontal Tabs in Bottom Sheet */}
            <div
              role="tablist"
              aria-label="Academic tool options"
              className="flex overflow-x-auto no-scrollbar gap-1.5 pb-2 border-b border-slate-200"
            >
              {[
                { id: "typography", label: "Font" },
                { id: "theme", label: "Theme" },
                { id: "math", label: "Math" },
                { id: "metrics", label: "Metrics" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  id={`mobile-tab-btn-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={mobileToolsTab === tab.id}
                  aria-controls={`mobile-tab-panel-${tab.id}`}
                  onClick={() => setMobileToolsTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                    mobileToolsTab === tab.id
                      ? "bg-slate-900 text-white shadow-2xs font-bold"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab 1: Typography */}
            {mobileToolsTab === "typography" && (
              <div
                role="tabpanel"
                id="mobile-tab-panel-typography"
                aria-labelledby="mobile-tab-btn-typography"
                className="space-y-1.5 focus-visible:outline-none"
                tabIndex={0}
              >
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
                        ? "bg-rose-50 text-[#881337] font-bold border-rose-200"
                        : "hover:bg-slate-50 text-slate-800 border-slate-200"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold" style={{ fontFamily: f.name }}>
                        {f.name}
                      </div>
                      <div className="text-xs text-slate-600">{f.type}</div>
                    </div>
                    {fontFamily === f.name && <Check className="w-4 h-4 text-[#881337] shrink-0 ml-2" />}
                  </button>
                ))}
              </div>
            )}

            {/* Tab 2: Theme */}
            {mobileToolsTab === "theme" && (
              <div
                role="tabpanel"
                id="mobile-tab-panel-theme"
                aria-labelledby="mobile-tab-btn-theme"
                className="space-y-1.5 max-h-60 overflow-y-auto pr-1 focus-visible:outline-none"
                tabIndex={0}
              >
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
                        isSelected ? "bg-slate-100 font-bold border-slate-400" : "hover:bg-slate-50 border-slate-200"
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

            {/* Tab 3: Math */}
            {mobileToolsTab === "math" && (
              <div
                role="tabpanel"
                id="mobile-tab-panel-math"
                aria-labelledby="mobile-tab-btn-math"
                className="space-y-3 focus-visible:outline-none"
                tabIndex={0}
              >
                <div>
                  <div className="text-xs font-semibold text-slate-800 mb-1.5">Output Equation Format</div>
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => onEquationFormatChange("native")}
                      className={`min-h-[44px] text-xs py-2 px-3 rounded-lg font-semibold transition-all cursor-pointer ${
                        equationFormat === "native" ? "bg-white text-slate-900 shadow-xs border border-slate-200" : "text-slate-600"
                      }`}
                    >
                      Word Math (OMML)
                    </button>
                    <button
                      type="button"
                      onClick={() => onEquationFormatChange("latex")}
                      className={`min-h-[44px] text-xs py-2 px-3 rounded-lg font-semibold transition-all cursor-pointer ${
                        equationFormat === "latex" ? "bg-white text-slate-900 shadow-xs border border-slate-200" : "text-slate-600"
                      }`}
                    >
                      LaTeX ($...$)
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-800 mb-1.5">Insert Symbol into Notes</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {mathCategories[mathTab].map((item) => (
                      <button
                        key={item.symbol}
                        type="button"
                        onClick={() => {
                          if (onInsertSymbol) onInsertSymbol(` ${item.symbol} `);
                          setOpenCard(null);
                        }}
                        className="min-h-[44px] p-2 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-xl text-xs font-mono text-center cursor-pointer"
                        title={item.label}
                      >
                        {item.symbol}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Metrics */}
            {mobileToolsTab === "metrics" && (
              <div
                role="tabpanel"
                id="mobile-tab-panel-metrics"
                aria-labelledby="mobile-tab-btn-metrics"
                className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 focus-visible:outline-none"
                tabIndex={0}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Total Words:</span>
                  <span className="font-mono font-bold text-slate-900">{wordCount.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Total Characters:</span>
                  <span className="font-mono font-bold text-slate-900">{charCount.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Active Theme:</span>
                  <span className="font-medium text-slate-900" style={{ color: currentTheme.hex }}>
                    {currentTheme.label}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Typography:</span>
                  <span className="font-medium text-slate-900">{fontFamily}</span>
                </div>
              </div>
            )}

            {/* Quick Link to Settings & Tools for Migrated Tools */}
            <div className="pt-2 border-t border-slate-200">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                    <GraduationCap className="w-4 h-4 text-amber-800" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      Study Guide, 12 Skills & Samples
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      Available in Settings & Tools sidebar
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    closeDropdown();
                    const hamburger = document.getElementById("btn-hamburger-menu");
                    hamburger?.click();
                  }}
                  aria-label="Open Settings and Tools sidebar"
                  className="px-3 py-1.5 bg-slate-900 hover:bg-black active:bg-slate-950 text-white rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition-colors shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                >
                  Open
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
});
