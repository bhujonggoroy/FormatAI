import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Palette,
  Cpu,
  Workflow,
  Download,
  BookOpen,
  Scale,
  ChevronDown,
  ChevronRight,
  Check,
  CheckCircle2,
  Sparkles,
  Clipboard,
  Eraser,
  FileText,
  Calculator,
  Layers,
  ShieldCheck,
  Eye,
  Columns,
  FileDown,
  Loader2,
} from "lucide-react";
import { FormatAILogo } from "./FormatAILogo";
import { ACADEMIC_THEMES, getAcademicTheme } from "../utils/theme";
import {
  ACADEMIC_SYSTEM_WORKFLOW,
  RECOMMENDED_ACADEMIC_SYSTEM_PROMPT,
} from "../shared/academicWorkflow.ts";
import {
  getUserPreferences,
  saveUserPreferences,
} from "../utils/userLocalStorage";

export interface SidebarSettingsDrawerProps {
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
  // Workspace Navigation & Actions
  viewLayout?: "editor" | "preview" | "split";
  onViewLayoutChange?: (layout: "editor" | "preview" | "split") => void;
  onTriggerAiPolish?: () => void;
  isAiPolishing?: boolean;
  onDownloadDocx?: () => void;
  // Document Options
  fontFamily: string;
  onFontFamilyChange: (font: string) => void;
  accentColor: string;
  onAccentColorChange: (color: string) => void;
  equationFormat?: "native" | "latex" | "unicode";
  onEquationFormatChange?: (fmt: "native" | "latex" | "unicode") => void;
  formatMode?: "auto" | "study_guide" | "exam_bank";
  onFormatModeChange?: (mode: "auto" | "study_guide" | "exam_bank") => void;
  // Quick Document Actions
  onPasteClipboard?: () => void;
  onClearText?: () => void;
  charCount?: number;
  wordCount?: number;
  // Custom Prompt & Academic Workflow
  customPrompt?: string;
  onCustomPromptChange?: (prompt: string) => void;
  // PWA Installation
  isInstalled?: boolean;
  hasNativePrompt?: boolean;
  onInstallApp?: () => void;
}

interface GroupCardProps {
  id: string;
  open: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  iconClassName?: string;
  iconStyle?: React.CSSProperties;
  title: string;
  subtitle?: string;
  accent?: string;
  children: React.ReactNode;
}

const GroupCard: React.FC<GroupCardProps> = ({
  id,
  open,
  onToggle,
  icon,
  iconClassName = "",
  iconStyle,
  title,
  subtitle,
  accent,
  children,
}) => {
  return (
    <div
      className={`rounded-2xl border bg-white overflow-hidden transition-colors duration-200 shadow-2xs ${
        open ? (accent ? "" : "border-slate-300") : "border-slate-200"
      }`}
      style={open && accent ? { borderColor: accent } : undefined}
    >
      <button
        id={`group-btn-${id}`}
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`group-content-${id}`}
        className="min-h-[56px] w-full flex items-center justify-between p-3.5 bg-white hover:bg-slate-50 transition-colors cursor-pointer text-left gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#881337]"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${iconClassName}`}
            style={iconStyle}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-slate-900 leading-tight break-words">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-slate-500 leading-normal break-words mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        id={`group-content-${id}`}
        role="region"
        aria-labelledby={`group-btn-${id}`}
        inert={!open ? true : undefined}
        className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden min-h-0">
          <div className="p-3.5 pt-1 border-t border-slate-100 space-y-3">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

interface RowProps {
  children: React.ReactNode;
  className?: string;
}

const Row: React.FC<RowProps> = ({ children, className = "" }) => (
  <div className={`rounded-xl border border-slate-200 bg-slate-50/70 p-3 ${className}`}>
    {children}
  </div>
);

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
  viewLayout,
  onViewLayoutChange,
  onTriggerAiPolish,
  isAiPolishing = false,
  onDownloadDocx,
  fontFamily,
  onFontFamilyChange,
  accentColor,
  onAccentColorChange,
  equationFormat = "native",
  onEquationFormatChange,
  formatMode = "study_guide",
  onFormatModeChange,
  onPasteClipboard,
  onClearText,
  charCount = 0,
  wordCount = 0,
  customPrompt = "",
  onCustomPromptChange,
  isInstalled = false,
  onInstallApp,
}) => {
  // Collapsible groups: Appearance open by default
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    appearance: true,
    ai: false,
    academic: false,
    app: false,
    about: false,
  });

  const [showWorkflow, setShowWorkflow] = useState(false);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Internal prompt buffer linked to preferences
  const [promptText, setPromptText] = useState<string>(() => {
    if (customPrompt) return customPrompt;
    try {
      return getUserPreferences()?.customPrompt || "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    if (customPrompt !== undefined) {
      setPromptText(customPrompt);
    }
  }, [customPrompt]);

  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const triggerElRef = useRef<HTMLElement | null>(null);
  const isClosingRef = useRef(false);

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Smooth animated close handler
  const requestClose = () => {
    if (isClosingRef.current) return;
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      onClose();
      return;
    }

    isClosingRef.current = true;
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
      isClosingRef.current = false;
    }, 180);
  };

  // Body scroll lock while open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Track opener element and autofocus close button
  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      isClosingRef.current = false;
      triggerElRef.current =
        (document.activeElement as HTMLElement) ||
        document.getElementById("btn-hamburger-menu");

      const timer = setTimeout(() => {
        closeBtnRef.current?.focus();
      }, 30);
      return () => clearTimeout(timer);
    } else if (triggerElRef.current) {
      triggerElRef.current.focus();
    }
  }, [isOpen]);

  // Keyboard navigation: Escape key closes drawer & Focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
        return;
      }

      if (e.key === "Tab" && panelRef.current) {
        const focusable = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.closest("[inert]"));

        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const currentTheme = getAcademicTheme(accentColor);
  const activeAiSummary = aiProvidersSummary?.[0] || "Gemini 3.8 Flash";

  const handlePromptChange = (newVal: string) => {
    setPromptText(newVal);
    if (onCustomPromptChange) {
      onCustomPromptChange(newVal);
    } else {
      try {
        saveUserPreferences({ customPrompt: newVal });
      } catch {}
    }
  };

  return (
    <div
      id="sidebar-settings-drawer"
      role="dialog"
      aria-modal="true"
      aria-label="Settings and Tools"
      className="fixed inset-0 z-50 overflow-hidden"
    >
      {/* 
        Transparent / ultra-subtle click-away backdrop:
        Keeps the main workspace, equations, and document sheet 100% sharp, readable, and visible 
        without heavy black obscuring layers or blur effects.
      */}
      <div
        className={`absolute inset-0 bg-slate-900/10 sm:bg-slate-900/5 transition-opacity cursor-pointer ${
          isClosing ? "animate-drawer-backdrop-out" : "animate-drawer-backdrop-in"
        }`}
        onClick={requestClose}
        aria-hidden="true"
      />

      {/* 
        ChatGPT-style right-side drawer panel:
        - Desktop: fixed right side, 440-460px width, crisp white background, subtle left border and shadow
        - Mobile: full-screen / responsive drawer taking available viewport width, safe area padding
      */}
      <div
        ref={panelRef}
        className={`absolute z-10 bg-white flex flex-col overflow-hidden shadow-2xl inset-y-0 right-0 h-[100dvh] w-full sm:w-[440px] md:w-[460px] sm:max-w-[calc(100vw-1.5rem)] border-l border-slate-200 ${
          isClosing ? "animate-drawer-out" : "animate-drawer-in"
        }`}
      >
        {/* Top brand gradient accent line */}
        <div
          className="h-1 w-full shrink-0"
          style={{
            background: `linear-gradient(90deg, ${currentTheme.hex}, ${currentTheme.ring})`,
          }}
        />

        {/* Fixed Header: Icon Logo, Title, Badge, and Close Button */}
        <div className="sticky top-0 z-20 px-4 sm:px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-white shadow-2xs shrink-0 gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <FormatAILogo variant="icon" size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 leading-tight">
                  Settings & Tools
                </h2>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 border"
                  style={{
                    backgroundColor: currentTheme.badgeBg,
                    color: currentTheme.badgeText,
                    borderColor: currentTheme.border,
                  }}
                >
                  {currentTheme.label}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-normal truncate mt-0.5">
                FormatAI Academic Publication Engine
              </p>
            </div>
          </div>
          <button
            ref={closeBtnRef}
            data-autofocus
            type="button"
            onClick={requestClose}
            className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-xl text-slate-600 hover:text-slate-950 hover:bg-slate-100 active:bg-slate-200 border border-slate-300 transition-colors cursor-pointer flex items-center justify-center shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#881337]"
            title="Close drawer (Esc)"
            aria-label="Close settings drawer"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Independently Scrollable Content Area */}
        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-5 py-4 space-y-3.5"
          style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        >
          {/* ================= WORKSPACE NAVIGATION & QUICK ACTIONS ================= */}
          <div className="rounded-2xl border border-slate-300 bg-slate-50/80 p-3 space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Workspace Views & Navigation
              </span>
              <span className="text-[11px] text-slate-500">Quick Access</span>
            </div>

            {/* View Switcher: Editor / Preview / Split */}
            {onViewLayoutChange && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-1 bg-white rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    onViewLayoutChange("editor");
                    if (window.innerWidth < 640) requestClose();
                  }}
                  className={`min-h-[40px] px-2 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    viewLayout === "editor"
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-700 hover:text-slate-950 hover:bg-slate-100"
                  }`}
                  aria-pressed={viewLayout === "editor"}
                >
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span>Editor</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onViewLayoutChange("preview");
                    if (window.innerWidth < 640) requestClose();
                  }}
                  className={`min-h-[40px] px-2 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    viewLayout === "preview"
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-700 hover:text-slate-950 hover:bg-slate-100"
                  }`}
                  aria-pressed={viewLayout === "preview"}
                >
                  <Eye className="w-3.5 h-3.5 shrink-0" />
                  <span>Preview</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onViewLayoutChange("split");
                    if (window.innerWidth < 640) requestClose();
                  }}
                  className={`hidden sm:flex min-h-[40px] px-2 py-1.5 rounded-lg text-xs font-bold items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    viewLayout === "split"
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-700 hover:text-slate-950 hover:bg-slate-100"
                  }`}
                  aria-pressed={viewLayout === "split"}
                >
                  <Columns className="w-3.5 h-3.5 shrink-0" />
                  <span>Split</span>
                </button>
              </div>
            )}

            {/* Primary Action Shortcuts inside Menu */}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              {onTriggerAiPolish && (
                <button
                  type="button"
                  onClick={() => {
                    requestClose();
                    onTriggerAiPolish();
                  }}
                  disabled={isAiPolishing}
                  className="min-h-[44px] px-2.5 py-2 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-[0.98] disabled:opacity-50"
                  style={{ backgroundColor: currentTheme.btnPrimary }}
                >
                  {isAiPolishing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  )}
                  <span>{isAiPolishing ? "Normalizing..." : "AI Polish"}</span>
                </button>
              )}

              {onDownloadDocx && (
                <button
                  type="button"
                  onClick={() => {
                    requestClose();
                    onDownloadDocx();
                  }}
                  className="min-h-[44px] px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-black active:bg-slate-950 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                >
                  <FileDown className="w-3.5 h-3.5 text-blue-300" />
                  <span>Export DOCX</span>
                </button>
              )}
            </div>
          </div>

          {/* ================= GROUP 1: APPEARANCE ================= */}
          <GroupCard
            id="appearance"
            open={openGroups.appearance}
            onToggle={() => toggleGroup("appearance")}
            icon={<Palette className="w-4.5 h-4.5 text-white" />}
            iconStyle={{ backgroundColor: currentTheme.hex }}
            title="Appearance & Notation"
            subtitle="Theme color, typography & formula format"
            accent={currentTheme.hex}
          >
            {/* Theme Color Swatches */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800">Theme Color</span>
                <span className="text-xs font-semibold text-slate-600">{currentTheme.label}</span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(40px,1fr))] gap-2 justify-items-center pt-0.5">
                {ACADEMIC_THEMES.map((t) => {
                  const isSelected = accentColor.toLowerCase() === t.hex.toLowerCase();
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onAccentColorChange(t.hex)}
                      aria-pressed={isSelected}
                      className={`w-10 h-10 min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center transition-all cursor-pointer relative shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#881337] ${
                        isSelected
                          ? "ring-2 ring-slate-900 ring-offset-2 scale-105"
                          : "hover:scale-105 opacity-90 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: t.hex }}
                      title={`${t.label}: ${t.desc}`}
                      aria-label={`Select ${t.label} theme`}
                    >
                      {isSelected && <Check className="w-4 h-4 text-white stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Typography Selection (min-height >= 44px buttons) */}
            <div className="space-y-1.5 pt-1">
              <span className="text-xs font-semibold text-slate-800">Typography Standard</span>
              <div className="grid grid-cols-2 min-[400px]:grid-cols-3 gap-2">
                {["Times New Roman", "Georgia", "Calibri", "Arial", "Aptos"].map((f) => {
                  const isSelected = fontFamily === f;
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => onFontFamilyChange(f)}
                      className={`min-h-[44px] px-2 rounded-xl text-xs font-semibold transition-all text-center border cursor-pointer truncate flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#881337] ${
                        isSelected
                          ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                      style={{ fontFamily: f }}
                    >
                      {f}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Equation Format Selection */}
            {onEquationFormatChange && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">Equation Notation</span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {equationFormat === "native"
                      ? "Native Word OMML"
                      : equationFormat === "latex"
                      ? "LaTeX Syntax"
                      : "Unicode Math"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => onEquationFormatChange("native")}
                    className={`min-h-[44px] px-2 py-1.5 rounded-xl text-xs font-semibold border flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#881337] ${
                      equationFormat === "native"
                        ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                    title="Typeset directly into editable Microsoft Word mathematical equations (OMML)"
                  >
                    <Calculator className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-[11px]">Native Word</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onEquationFormatChange("latex")}
                    className={`min-h-[44px] px-2 py-1.5 rounded-xl text-xs font-semibold border flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#881337] ${
                      equationFormat === "latex"
                        ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                    title="Keep standardized LaTeX expressions: \\( ... \\) and \\[ ... \\]"
                  >
                    <span className="font-mono font-bold text-xs">TeX</span>
                    <span className="text-[11px]">LaTeX Code</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onEquationFormatChange("unicode")}
                    className={`min-h-[44px] px-2 py-1.5 rounded-xl text-xs font-semibold border flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#881337] ${
                      equationFormat === "unicode"
                        ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                    title="Render mathematical operators as standard Unicode symbols"
                  >
                    <span className="font-serif font-bold text-xs">∑</span >
                    <span className="text-[11px]">Unicode</span>
                  </button>
                </div>
              </div>
            )}

            {/* Document Structure Mode */}
            {onFormatModeChange && (
              <div className="space-y-1.5 pt-1">
                <span className="text-xs font-semibold text-slate-800">Document Structure Mode</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onFormatModeChange("study_guide")}
                    className={`min-h-[44px] px-2.5 py-1.5 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#881337] ${
                      formatMode === "study_guide"
                        ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    <span>Study Guide & Notes</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onFormatModeChange("exam_bank")}
                    className={`min-h-[44px] px-2.5 py-1.5 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#881337] ${
                      formatMode === "exam_bank"
                        ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5 shrink-0" />
                    <span>Exam Question Bank</span>
                  </button>
                </div>
              </div>
            )}
          </GroupCard>

          {/* ================= GROUP 2: AI ENGINE ================= */}
          <GroupCard
            id="ai"
            open={openGroups.ai}
            onToggle={() => toggleGroup("ai")}
            icon={<Cpu className="w-4.5 h-4.5 text-blue-700" />}
            iconClassName="bg-blue-100"
            title="AI Engine & Models"
            subtitle="Active provider, failover routing & API keys"
          >
            <Row className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1 basis-40">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      readyProvidersCount > 0 ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                  <span className="text-xs font-bold text-slate-900 truncate">
                    {activeAiSummary}
                  </span>
                  <span className="text-[11px] text-slate-500 shrink-0">
                    · {isFreeOnly ? "Free tier" : "Standard"}
                  </span>
                </div>
                <div className="text-xs text-slate-600 mt-1 leading-normal break-words">
                  {aiMode === "failover" ? "Auto-Failover Active" : "Direct Mode"} · {readyProvidersCount} provider{readyProvidersCount === 1 ? "" : "s"} ready
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAISettingsModal();
                }}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-black active:bg-slate-950 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#881337]"
              >
                Manage AI
              </button>
            </Row>
          </GroupCard>

          {/* ================= GROUP 3: ACADEMIC PIPELINE ================= */}
          <GroupCard
            id="academic"
            open={openGroups.academic}
            onToggle={() => toggleGroup("academic")}
            icon={<Workflow className="w-4.5 h-4.5 text-purple-700" />}
            iconClassName="bg-purple-100"
            title="Academic Pipeline"
            subtitle="Skills hub, system workflow & prompt"
          >
            {/* Skills Hub */}
            <Row className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1 basis-40">
                <div className="text-xs font-semibold text-slate-900">Academic Skills Hub</div>
                <div className="text-xs text-slate-500 mt-0.5">{activeSkillsCount} modular skills active</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSkillsModal();
                }}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#881337]"
              >
                View Skills
              </button>
            </Row>

            {/* Publication Workflow */}
            <Row className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1 basis-40">
                  <div className="text-xs font-semibold text-slate-900">Publication Workflow</div>
                  <div className="text-xs text-slate-500 mt-0.5">10-step academic formatting pipeline</div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWorkflow((prev) => !prev)}
                  className="min-h-[40px] text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3.5 py-2 rounded-xl transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#881337]"
                >
                  {showWorkflow ? "Hide Steps" : "View Steps"}
                </button>
              </div>

              {showWorkflow && (
                <ol className="space-y-1.5 pt-2 border-t border-slate-200 list-none m-0 p-0">
                  {(ACADEMIC_SYSTEM_WORKFLOW as readonly string[]).map((step: string, idx: number) => (
                    <li
                      key={step}
                      className="flex items-start gap-2.5 text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs leading-snug break-words"
                    >
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="break-words leading-snug flex-1">{step}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Row>

            {/* Academic System Prompt */}
            <Row className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1 basis-40">
                  <div className="text-xs font-semibold text-slate-900">Academic System Prompt</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {promptText ? "Custom instructions active" : "Default publication rules"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingPrompt((prev) => !prev)}
                  className="min-h-[40px] text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 px-3.5 py-2 rounded-xl transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#881337]"
                >
                  {isEditingPrompt ? "Done" : "Edit"}
                </button>
              </div>

              {isEditingPrompt && (
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-medium">Prompt instructions:</span>
                    <button
                      type="button"
                      onClick={() => {
                        handlePromptChange(RECOMMENDED_ACADEMIC_SYSTEM_PROMPT);
                        setCopiedPrompt(true);
                        setTimeout(() => setCopiedPrompt(false), 2000);
                      }}
                      className="text-[11px] font-bold text-[#881337] hover:underline cursor-pointer flex items-center gap-1 min-h-[32px]"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#881337]" />
                      <span>{copiedPrompt ? "Loaded!" : "Load Recommended"}</span>
                    </button>
                  </div>
                  <textarea
                    value={promptText}
                    onChange={(e) => handlePromptChange(e.target.value)}
                    placeholder="Enter custom academic formatting instructions..."
                    rows={4}
                    className="w-full text-xs font-mono p-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#881337] resize-y"
                  />
                  {promptText && (
                    <button
                      type="button"
                      onClick={() => handlePromptChange("")}
                      className="text-[11px] text-rose-600 hover:underline font-semibold cursor-pointer min-h-[32px] inline-flex items-center"
                    >
                      Clear Custom Prompt
                    </button>
                  )}
                </div>
              )}
            </Row>
          </GroupCard>

          {/* ================= GROUP 4: APP & TOOLS ================= */}
          <GroupCard
            id="app"
            open={openGroups.app}
            onToggle={() => toggleGroup("app")}
            icon={<Download className="w-4.5 h-4.5 text-emerald-700" />}
            iconClassName="bg-emerald-100"
            title="FormatAI App & Tools"
            subtitle="Installation, stats & quick document tools"
          >
            {/* PWA App Installation */}
            <Row className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1 basis-40">
                <div className="text-xs font-semibold text-slate-900">
                  {isInstalled ? "FormatAI Installed" : "Install Web App"}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {isInstalled
                    ? "Ready for fast offline launches"
                    : "Install for offline access & faster launches"}
                </div>
              </div>
              {!isInstalled && onInstallApp ? (
                <button
                  type="button"
                  onClick={onInstallApp}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs font-semibold transition-colors cursor-pointer shrink-0 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#881337]"
                >
                  Install PWA
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-300 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Installed
                </span>
              )}
            </Row>

            {/* Quick Document Actions & Metrics */}
            <Row className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900">Document Metrics</span>
                <span className="text-[11px] font-mono text-slate-600">
                  {charCount.toLocaleString()} chars • {wordCount.toLocaleString()} words
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {onPasteClipboard && (
                  <button
                    type="button"
                    onClick={() => {
                      onPasteClipboard();
                      requestClose();
                    }}
                    className="min-h-[44px] px-3 py-2 rounded-xl bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#881337]"
                    title="Paste content from your clipboard"
                  >
                    <Clipboard className="w-3.5 h-3.5 text-slate-600" />
                    <span>Paste Notes</span>
                  </button>
                )}
                {onClearText && (
                  <button
                    type="button"
                    onClick={() => {
                      onClearText();
                      requestClose();
                    }}
                    className="min-h-[44px] px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 active:bg-rose-200 border border-rose-300 text-rose-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                    title="Clear current text"
                  >
                    <Eraser className="w-3.5 h-3.5 text-rose-600" />
                    <span>Clear All</span>
                  </button>
                )}
              </div>
            </Row>

            {/* Privacy note */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-600 leading-relaxed m-0">
                100% Client-Side Privacy: Your raw notes, mathematical proofs, and generated documents are processed in your browser and never logged or stored remotely.
              </p>
            </div>
          </GroupCard>

          {/* ================= GROUP 5: ABOUT ================= */}
          <GroupCard
            id="about"
            open={openGroups.about}
            onToggle={() => toggleGroup("about")}
            icon={<BookOpen className="w-4.5 h-4.5 text-amber-700" />}
            iconClassName="bg-amber-100"
            title="About & Advanced"
            subtitle="License, open source & academic mission"
          >
            {/* Mission Text */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-slate-800">
              <p className="text-xs leading-relaxed text-slate-700 font-medium break-words">
                ChatGPT, Gemini, Claude, NotebookLM বা যেকোনো উৎস থেকে পাওয়া AI-generated কিংবা লেকচার নোটকে স্বয়ংক্রিয়ভাবে গাণিতিক, বৈজ্ঞানিক ও টেক্সট ফরম্যাটিংসহ একটি প্রকাশনা-উপযোগী, কাস্টমাইজযোগ্য DOCX ফাইলে রূপান্তর করা—শিক্ষার্থী ও গবেষকদের জন্য সম্পূর্ণ উন্মুক্ত ও বিনামূল্যে।
              </p>
            </div>

            {/* License & Upstream Repositories Button */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLicenseModal();
                }}
                className="min-h-[44px] w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#881337]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Scale className="w-4 h-4 text-slate-600 shrink-0" />
                  <span className="truncate">License & Upstream Repositories</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSkillsModal();
                }}
                className="min-h-[44px] w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#881337]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Layers className="w-4 h-4 text-slate-600 shrink-0" />
                  <span className="truncate">Modular Skills Pipeline</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            </div>
          </GroupCard>
        </div>
      </div>
    </div>
  );
};
