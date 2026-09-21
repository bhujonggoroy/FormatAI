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
  Plus,
  FileDown,
  ChevronRight,
} from "lucide-react";
import { SAMPLE_NOTES, SampleNote } from "../data/samples";
import { skillRegistry } from "../skills";

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
  // AI Polish & Export Word (Group 4)
  isAiPolishing: boolean;
  onTriggerAiPolish: () => void;
  aiProviderName?: string;
  onDownloadDocx: () => void;
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
  aiProviderName,
  onDownloadDocx,
  canDownload,
  formatMode,
  onFormatModeChange,
  activeSkillsCount,
  onOpenSkillsManager,
  onSkillsChanged,
  onSelectSample,
}) => {
  const [openCard, setOpenCard] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpenCard(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleCard = (cardId: string) => {
    setOpenCard((prev) => (prev === cardId ? null : cardId));
  };

  const fontOptions = [
    { name: "Times New Roman", type: "Academic Serif Standard", sample: "Aa Bb Gg" },
    { name: "Georgia", type: "Classic Warm Serif", sample: "Aa Bb Gg" },
    { name: "Calibri", type: "Office Clear Sans", sample: "Aa Bb Gg" },
    { name: "Arial", type: "Clean Modern Sans", sample: "Aa Bb Gg" },
    { name: "Aptos", type: "Contemporary Standard", sample: "Aa Bb Gg" },
  ];

  const themeColors = [
    { label: "Academic Navy", hex: "#1A365D", desc: "Default Oxford Navy" },
    { label: "Slate Charcoal", hex: "#2D3748", desc: "Minimalist Charcoal" },
    { label: "Forest Emerald", hex: "#22543D", desc: "Scientific Forest Green" },
    { label: "Imperial Plum", hex: "#44337A", desc: "Distinguished Academic Plum" },
    { label: "Crimson Burgundy", hex: "#881337", desc: "Traditional University Red" },
  ];

  const quickMathSymbols = [
    { symbol: "\\hat{p}", label: "p̂ (Sample prop)" },
    { symbol: "\\bar{X}", label: "X̄ (Sample mean)" },
    { symbol: "S^2", label: "S² (Sample var)" },
    { symbol: "\\sigma^2", label: "σ² (Pop var)" },
    { symbol: "\\mu", label: "μ (Pop mean)" },
    { symbol: "\\pi", label: "π (Pop prop)" },
    { symbol: "\\operatorname{Var}(X)", label: "Var(X)" },
    { symbol: "\\sum_{i=1}^{n}", label: "∑ (Summation)" },
    { symbol: "\\frac{a}{b}", label: "Fraction" },
    { symbol: "\\sqrt{x}", label: "Square root" },
    { symbol: "\\approx", label: "≈ (Approx)" },
    { symbol: "\\sim", label: "~ (Distr. as)" },
    { symbol: "\\le", label: "≤" },
    { symbol: "\\ge", label: "≥" },
    { symbol: "\\infty", label: "∞ (Infinity)" },
    { symbol: "\\pm", label: "± (Plus/Minus)" },
  ];

  return (
    <div ref={containerRef} className="w-full">
      {/* Container card matching the user mockup */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-5 shadow-xs transition-all">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
          {/* ===================== CARD 1: FONT ===================== */}
          <div className="relative">
            <button
              id="card-toolbar-font"
              type="button"
              onClick={() => toggleCard("font")}
              className={`w-full h-full bg-white border ${
                openCard === "font" ? "border-emerald-500 ring-2 ring-emerald-100" : "border-slate-200/80"
              } hover:border-emerald-400 hover:shadow-xs rounded-xl p-3 sm:p-3.5 transition-all text-left flex flex-col justify-between cursor-pointer group`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500 shrink-0 fill-emerald-50" />
                  <span className="font-bold text-slate-800 text-sm sm:text-[15px]">Font</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-transform ${
                    openCard === "font" ? "rotate-180 text-emerald-600" : ""
                  }`}
                />
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 group-hover:text-slate-500 mt-1 sm:mt-2 font-normal line-clamp-1">
                Change font, size and style
              </p>
            </button>

            {openCard === "font" && (
              <div className="absolute left-0 top-full mt-2 w-72 max-w-[calc(100vw-2.5rem)] bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-40 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                  Document Typography
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
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors text-left cursor-pointer ${
                        fontFamily === f.name ? "bg-emerald-50 text-emerald-950 font-bold" : "hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-slate-900" style={{ fontFamily: f.name }}>
                          {f.name}
                        </div>
                        <div className="text-[10px] text-slate-400">{f.type}</div>
                      </div>
                      {fontFamily === f.name && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ===================== CARD 2: THEME ===================== */}
          <div className="relative">
            <button
              id="card-toolbar-theme"
              type="button"
              onClick={() => toggleCard("theme")}
              className={`w-full h-full bg-white border ${
                openCard === "theme" ? "border-slate-800 ring-2 ring-slate-100" : "border-slate-200/80"
              } hover:border-slate-400 hover:shadow-xs rounded-xl p-3 sm:p-3.5 transition-all text-left flex flex-col justify-between cursor-pointer group`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Palette className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700 shrink-0" />
                  <span className="font-bold text-slate-800 text-sm sm:text-[15px]">Theme</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border border-slate-300"
                    style={{ backgroundColor: accentColor }}
                  />
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-transform ${
                      openCard === "theme" ? "rotate-180 text-slate-800" : ""
                    }`}
                  />
                </div>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 group-hover:text-slate-500 mt-1 sm:mt-2 font-normal line-clamp-1">
                Switch between academic themes
              </p>
            </button>

            {openCard === "theme" && (
              <div className="absolute right-0 sm:left-0 top-full mt-2 w-64 max-w-[calc(100vw-2.5rem)] bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-40 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                  Academic Accent Palettes
                </div>
                <div className="space-y-1">
                  {themeColors.map((t) => (
                    <button
                      key={t.hex}
                      type="button"
                      onClick={() => {
                        onAccentColorChange(t.hex);
                        setOpenCard(null);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                        accentColor === t.hex ? "bg-slate-100 font-bold" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-4 h-4 rounded-full border border-slate-300 shadow-2xs shrink-0"
                          style={{ backgroundColor: t.hex }}
                        />
                        <div className="text-left">
                          <span className="text-slate-800 font-medium block">{t.label}</span>
                          <span className="text-[10px] text-slate-400 block">{t.desc}</span>
                        </div>
                      </div>
                      {accentColor === t.hex && <Check className="w-4 h-4 text-slate-700 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ===================== CARD 3: MATH ===================== */}
          <div className="relative">
            <button
              id="card-toolbar-math"
              type="button"
              onClick={() => toggleCard("math")}
              className={`w-full h-full bg-white border ${
                openCard === "math" ? "border-slate-800 ring-2 ring-slate-100" : "border-slate-200/80"
              } hover:border-slate-400 hover:shadow-xs rounded-xl p-3 sm:p-3.5 transition-all text-left flex flex-col justify-between cursor-pointer group`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <SquareRadical className="w-4 h-4 sm:w-5 sm:h-5 text-slate-800 shrink-0" />
                  <span className="font-bold text-slate-800 text-sm sm:text-[15px]">Math</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-transform ${
                    openCard === "math" ? "rotate-180 text-slate-800" : ""
                  }`}
                />
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 group-hover:text-slate-500 mt-1 sm:mt-2 font-normal line-clamp-1">
                Insert equations and symbols
              </p>
            </button>

            {openCard === "math" && (
              <div className="absolute left-0 lg:-left-12 top-full mt-2 w-80 max-w-[calc(100vw-2.5rem)] bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-40 animate-in fade-in zoom-in-95">
                <div className="mb-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Word Output Math Format
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => onEquationFormatChange("native")}
                      className={`text-xs py-1 px-2 rounded-md font-medium transition-colors cursor-pointer ${
                        equationFormat === "native"
                          ? "bg-white text-slate-900 shadow-2xs font-semibold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Word Math (OMML)
                    </button>
                    <button
                      type="button"
                      onClick={() => onEquationFormatChange("latex")}
                      className={`text-xs py-1 px-2 rounded-md font-medium transition-colors cursor-pointer ${
                        equationFormat === "latex"
                          ? "bg-white text-slate-900 shadow-2xs font-semibold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      LaTeX ($...$)
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Insert Standard Academic Symbols
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {quickMathSymbols.map((item) => (
                      <button
                        key={item.symbol}
                        type="button"
                        onClick={() => {
                          if (onInsertSymbol) {
                            onInsertSymbol(` ${item.symbol} `);
                          }
                        }}
                        className="p-1.5 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 rounded-lg text-xs font-mono text-center transition-colors cursor-pointer"
                        title={item.label}
                      >
                        {item.symbol}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 text-center">
                    Click any symbol to insert it into raw notes.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ===================== CARD 4: AI POLISH ===================== */}
          <div className="relative">
            <button
              id="card-toolbar-ai-polish"
              type="button"
              onClick={() => {
                onTriggerAiPolish();
              }}
              disabled={isAiPolishing}
              className={`w-full h-full bg-white border ${
                openCard === "ai-polish" ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200/80"
              } hover:border-blue-400 hover:shadow-xs rounded-xl p-3 sm:p-3.5 transition-all text-left flex flex-col justify-between cursor-pointer group disabled:opacity-60`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Sparkles
                    className={`w-4 h-4 sm:w-5 sm:h-5 text-blue-600 shrink-0 ${isAiPolishing ? "animate-spin" : ""}`}
                  />
                  <span className="font-bold text-slate-800 text-sm sm:text-[15px]">AI Polish</span>
                </div>
                <div className="flex items-center gap-1">
                  {isAiPolishing ? (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  ) : (
                    <ChevronDown
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCard("ai-polish");
                      }}
                      className={`w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-transform ${
                        openCard === "ai-polish" ? "rotate-180 text-blue-600" : ""
                      }`}
                    />
                  )}
                </div>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 group-hover:text-slate-500 mt-1 sm:mt-2 font-normal line-clamp-1">
                {isAiPolishing ? "Normalizing equations..." : "Improve clarity, grammar & tone"}
              </p>
            </button>

            {openCard === "ai-polish" && (
              <div className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2.5rem)] bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-40 animate-in fade-in zoom-in-95">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Multi-Provider AI Polishing
                </div>
                <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                  Formats raw notes with standard LaTeX equations, cleans ASCII artifacts, and repairs math notation.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setOpenCard(null);
                    onTriggerAiPolish();
                  }}
                  disabled={isAiPolishing}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Run AI Polish Now
                </button>
                {aiProviderName && (
                  <div className="text-[11px] text-slate-400 text-center mt-2">
                    Engine: <span className="font-semibold text-slate-600">{aiProviderName}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ===================== CARD 5: STUDY GUIDE & FORMULAS ===================== */}
          <div className="relative">
            <button
              id="card-toolbar-study-guide"
              type="button"
              onClick={() => toggleCard("study-guide")}
              className={`w-full h-full bg-white border ${
                openCard === "study-guide" ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200/80"
              } hover:border-blue-400 hover:shadow-xs rounded-xl p-3 sm:p-3.5 transition-all text-left flex flex-col justify-between cursor-pointer group`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 shrink-0" />
                  <span className="font-bold text-slate-800 text-sm sm:text-[15px] truncate">
                    Study Guide & Formulas
                  </span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 group-hover:text-slate-600 shrink-0 transition-transform ${
                    openCard === "study-guide" ? "rotate-180 text-blue-600" : ""
                  }`}
                />
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 group-hover:text-slate-500 mt-1 sm:mt-2 font-normal line-clamp-1">
                Get key concepts, formulas and practice
              </p>
            </button>

            {openCard === "study-guide" && (
              <div className="absolute left-0 top-full mt-2 w-80 max-w-[calc(100vw-2.5rem)] bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-40 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                  Document Structure Preset
                </div>
                <div className="space-y-1">
                  {[
                    {
                      id: "study_guide",
                      title: "🎓 Study Guide & Formulas",
                      desc: "Structured sections, numbered equations, definition callouts",
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
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors text-left cursor-pointer ${
                        formatMode === mode.id ? "bg-blue-50 text-blue-950 font-bold" : "hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-slate-900">{mode.title}</div>
                        <div className="text-[10px] text-slate-400 leading-normal">{mode.desc}</div>
                      </div>
                      {formatMode === mode.id && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ===================== CARD 6: ACADEMIC SKILLS ===================== */}
          <div className="relative">
            <button
              id="card-toolbar-academic-skills"
              type="button"
              onClick={() => toggleCard("skills")}
              className={`w-full h-full bg-white border ${
                openCard === "skills" ? "border-purple-500 ring-2 ring-purple-100" : "border-slate-200/80"
              } hover:border-purple-400 hover:shadow-xs rounded-xl p-3 sm:p-3.5 transition-all text-left flex flex-col justify-between cursor-pointer group`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 shrink-0" />
                  <span className="font-bold text-slate-800 text-sm sm:text-[15px] truncate">Academic Skills</span>
                  <span className="text-[10px] sm:text-[11px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 shrink-0">
                    {activeSkillsCount}
                  </span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 group-hover:text-slate-600 shrink-0 transition-transform ${
                    openCard === "skills" ? "rotate-180 text-purple-600" : ""
                  }`}
                />
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 group-hover:text-slate-500 mt-1 sm:mt-2 font-normal line-clamp-1">
                Build your academic writing and research skills
              </p>
            </button>

            {openCard === "skills" && (
              <div className="absolute right-0 sm:left-0 top-full mt-2 w-80 max-w-[calc(100vw-2.5rem)] bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-40 animate-in fade-in zoom-in-95">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  4 Modular GitHub Academic Skills
                </div>
                <div className="space-y-2 mb-3">
                  {skillRegistry.getAllSkills().map((skill) => {
                    const isEnabled = skill.enabled;
                    return (
                      <div
                        key={skill.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100"
                      >
                        <div className="flex-1 pr-2">
                          <div className="font-semibold text-slate-800 text-xs">{skill.name}</div>
                          <div className="text-[10px] text-slate-400 line-clamp-1">{skill.description}</div>
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
                  className="w-full bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 font-semibold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5 text-purple-600" />
                  <span>Open Full Skills Hub & 15 Rules</span>
                  <ExternalLink className="w-3 h-3 text-purple-500" />
                </button>
              </div>
            )}
          </div>

          {/* ===================== CARD 7: SAMPLES ===================== */}
          <div className="relative">
            <button
              id="card-toolbar-samples"
              type="button"
              onClick={() => toggleCard("samples")}
              className={`w-full h-full bg-white border ${
                openCard === "samples" ? "border-slate-800 ring-2 ring-slate-100" : "border-slate-200/80"
              } hover:border-slate-400 hover:shadow-xs rounded-xl p-3 sm:p-3.5 transition-all text-left flex flex-col justify-between cursor-pointer group`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700 shrink-0" />
                  <span className="font-bold text-slate-800 text-sm sm:text-[15px]">Samples</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-transform ${
                    openCard === "samples" ? "rotate-180 text-slate-800" : ""
                  }`}
                />
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 group-hover:text-slate-500 mt-1 sm:mt-2 font-normal line-clamp-1">
                View example documents and templates
              </p>
            </button>

            {openCard === "samples" && (
              <div className="absolute left-0 sm:left-auto sm:right-0 lg:left-0 lg:-left-12 top-full mt-2 w-80 max-w-[calc(100vw-2.5rem)] bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-40 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                  Ready-to-Test Academic Notes
                </div>
                <div className="space-y-1">
                  {SAMPLE_NOTES.map((sample) => (
                    <button
                      key={sample.id}
                      type="button"
                      onClick={() => {
                        onSelectSample(sample);
                        setOpenCard(null);
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 rounded-lg transition-colors flex flex-col cursor-pointer"
                    >
                      <span className="font-semibold text-slate-800 truncate">{sample.title}</span>
                      <span className="text-[10px] text-slate-400">{sample.category}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ===================== CARD 8: EXPORT WORD (Dedicated Tile right below Card 4 AI Polish) ===================== */}
          <div className="relative">
            <button
              id="card-toolbar-export-word"
              type="button"
              onClick={onDownloadDocx}
              disabled={!canDownload || isAiPolishing}
              className="w-full h-full bg-[#0f2343] hover:bg-[#0a1a32] active:scale-[0.99] border border-[#0f2343] hover:border-slate-900 hover:shadow-md rounded-xl p-3 sm:p-3.5 transition-all text-left flex flex-col justify-between cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
              title="Download publication-ready Microsoft Word (.docx) document"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <FileDown className="w-4 h-4 sm:w-5 sm:h-5 text-blue-300 shrink-0" />
                  <span className="font-bold text-white text-sm sm:text-[15px]">Export Word</span>
                </div>
                <ChevronRight className="w-4 h-4 text-blue-200 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="text-[11px] sm:text-xs text-blue-200/80 mt-1 sm:mt-2 font-normal line-clamp-1">
                Save publication-ready .docx document
              </p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
