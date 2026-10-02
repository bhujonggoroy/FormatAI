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
} from "lucide-react";
import { FormatAILogo } from "./FormatAILogo";
import { ACADEMIC_THEMES, getAcademicTheme } from "../utils/theme";
import {
  ACADEMIC_SYSTEM_WORKFLOW,
  RECOMMENDED_ACADEMIC_SYSTEM_PROMPT,
} from "../shared/academicWorkflow.ts";

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
        className="min-h-[56px] w-full flex items-center justify-between p-3.5 bg-white hover:bg-slate-50 transition-colors cursor-pointer text-left gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
  <div className={`rounded-xl border border-slate-200 bg-slate-50 p-3 ${className}`}>
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
  fontFamily,
  onFontFamilyChange,
  accentColor,
  onAccentColorChange,
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

  // Animated close handler
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
  const activeAiSummary = aiProvidersSummary?.[0] || "Gemini 2.5 Flash";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Settings and Tools"
      className="fixed inset-0 z-50"
    >
      {/* Dark semi-transparent backdrop with blur and animated transition */}
      <div
        className={`absolute inset-0 bg-slate-900/45 backdrop-blur-[2px] transition-opacity cursor-pointer ${
          isClosing ? "animate-drawer-backdrop-out" : "animate-drawer-backdrop-in"
        }`}
        onClick={requestClose}
        aria-hidden="true"
      />

      {/* Drawer panel: Desktop right-side full-height drawer, Mobile bottom sheet */}
      <div
        ref={panelRef}
        className={`absolute z-10 bg-[#F6F8FB] flex flex-col overflow-hidden shadow-2xl inset-x-0 bottom-0 max-h-[88dvh] rounded-t-3xl border-t border-slate-200 sm:inset-y-0 sm:left-auto sm:right-0 sm:bottom-auto sm:top-0 sm:h-[100dvh] sm:max-h-none sm:w-[420px] sm:max-w-[calc(100vw-2rem)] sm:rounded-none sm:border-t-0 sm:border-l ${
          isClosing ? "animate-drawer-out" : "animate-drawer-in"
        }`}
      >
        {/* Mobile Drag Handle button that closes the sheet */}
        <button
          type="button"
          tabIndex={-1}
          onClick={requestClose}
          aria-label="Close settings sheet"
          className="w-full py-2.5 flex items-center justify-center sm:hidden shrink-0 cursor-pointer bg-transparent border-none focus:outline-none"
        >
          <span className="block w-12 h-1.5 bg-slate-300 rounded-full" aria-hidden="true" />
        </button>

        {/* Thin top gradient accent bar */}
        <div
          className="h-1 w-full shrink-0"
          style={{
            background: `linear-gradient(90deg, ${currentTheme.hex}, ${currentTheme.ring})`,
          }}
        />

        {/* Header with Icon Logo, Title + Badge, and 40x40 Close button */}
        <div className="sticky top-0 z-10 px-4 sm:px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-white shadow-2xs shrink-0 gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <FormatAILogo variant="icon" size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-900 leading-tight">
                  Settings & Tools
                </h2>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0"
                  style={{
                    backgroundColor: currentTheme.badgeBg,
                    color: currentTheme.badgeText,
                  }}
                >
                  {currentTheme.label}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-normal truncate mt-0.5">
                FormatAI Academic Engine
              </p>
            </div>
          </div>
          <button
            ref={closeBtnRef}
            data-autofocus
            type="button"
            onClick={requestClose}
            className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer flex items-center justify-center shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            title="Close menu (Esc)"
            aria-label="Close menu"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Scroll Area with max safe-area padding-bottom */}
        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-5 pt-4 space-y-3"
          style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        >
          {/* ================= GROUP 1: APPEARANCE ================= */}
          <GroupCard
            id="appearance"
            open={openGroups.appearance}
            onToggle={() => toggleGroup("appearance")}
            icon={<Palette className="w-4.5 h-4.5 text-white" />}
            iconStyle={{ backgroundColor: currentTheme.hex }}
            title="Appearance"
            subtitle="Theme color & typography standards"
            accent={currentTheme.hex}
          >
            {/* Theme Color Swatches */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Theme Color</span>
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
                      className={`w-10 h-10 min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center transition-all cursor-pointer relative shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        isSelected
                          ? "ring-2 ring-slate-800 ring-offset-2 scale-105"
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
              <span className="text-xs font-semibold text-slate-700">Typography Standard</span>
              <div className="grid grid-cols-2 min-[400px]:grid-cols-3 gap-2">
                {["Times New Roman", "Georgia", "Calibri", "Arial", "Aptos"].map((f) => {
                  const isSelected = fontFamily === f;
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => onFontFamilyChange(f)}
                      className={`min-h-[44px] px-2 rounded-xl text-xs font-semibold transition-all text-center border cursor-pointer truncate flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
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
          </GroupCard>

          {/* ================= GROUP 2: AI ENGINE ================= */}
          <GroupCard
            id="ai"
            open={openGroups.ai}
            onToggle={() => toggleGroup("ai")}
            icon={<Cpu className="w-4.5 h-4.5 text-blue-700" />}
            iconClassName="bg-blue-100"
            title="AI Engine"
            subtitle="Active provider & failover configuration"
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
                <div className="text-xs text-slate-500 mt-1 leading-normal break-words">
                  {aiMode === "failover" ? "Auto-Failover Active" : "Direct Mode"} · {readyProvidersCount} provider{readyProvidersCount === 1 ? "" : "s"} ready
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAISettingsModal();
                }}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Manage
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
            subtitle="Skills, system workflow & prompts"
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
                className="min-h-[40px] px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
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
                  className="min-h-[40px] text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3.5 py-2 rounded-xl transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  {showWorkflow ? "Hide Steps" : "View Steps"}
                </button>
              </div>

              {showWorkflow && (
                <ol className="space-y-1.5 pt-2 border-t border-slate-200/80 list-none m-0 p-0">
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
                    {customPrompt ? "Custom instructions active" : "Default publication rules"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingPrompt((prev) => !prev)}
                  className="min-h-[40px] text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 px-3.5 py-2 rounded-xl transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
                        if (onCustomPromptChange) {
                          onCustomPromptChange(RECOMMENDED_ACADEMIC_SYSTEM_PROMPT);
                          setCopiedPrompt(true);
                          setTimeout(() => setCopiedPrompt(false), 2000);
                        }
                      }}
                      className="text-[11px] font-bold text-blue-700 hover:underline cursor-pointer flex items-center gap-1 min-h-[32px]"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      <span>{copiedPrompt ? "Loaded!" : "Load Recommended"}</span>
                    </button>
                  </div>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => onCustomPromptChange && onCustomPromptChange(e.target.value)}
                    placeholder="Enter custom formatting instructions..."
                    rows={4}
                    className="w-full text-xs font-mono p-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y"
                  />
                  {customPrompt && (
                    <button
                      type="button"
                      onClick={() => onCustomPromptChange && onCustomPromptChange("")}
                      className="text-[11px] text-rose-600 hover:underline font-medium cursor-pointer min-h-[32px] inline-flex items-center"
                    >
                      Clear Custom Prompt
                    </button>
                  )}
                </div>
              )}
            </Row>
          </GroupCard>

          {/* ================= GROUP 4: APP ================= */}
          <GroupCard
            id="app"
            open={openGroups.app}
            onToggle={() => toggleGroup("app")}
            icon={<Download className="w-4.5 h-4.5 text-emerald-700" />}
            iconClassName="bg-emerald-100"
            title="FormatAI App"
            subtitle="Installation & offline capability"
          >
            <Row className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1 basis-40">
                <div className="text-xs font-semibold text-slate-900">
                  {isInstalled ? "FormatAI Installed" : "Install Web App"}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {isInstalled ? "Ready for fast offline launches" : "Install for offline access & faster launches"}
                </div>
              </div>
              {!isInstalled && onInstallApp ? (
                <button
                  type="button"
                  onClick={onInstallApp}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold transition-colors cursor-pointer shrink-0 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  Install PWA
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Installed
                </span>
              )}
            </Row>
          </GroupCard>

          {/* ================= GROUP 5: ABOUT ================= */}
          <GroupCard
            id="about"
            open={openGroups.about}
            onToggle={() => toggleGroup("about")}
            icon={<BookOpen className="w-4.5 h-4.5 text-amber-700" />}
            iconClassName="bg-amber-100"
            title="About FormatAI"
            subtitle="Mission, license & open source repos"
          >
            {/* Mission Text */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-slate-800">
              <p className="text-xs leading-relaxed text-slate-700 font-medium break-words">
                ChatGPT, Gemini, Claude, NotebookLM বা যেকোনো উৎস থেকে পাওয়া AI-generated কিংবা লেকচার নোটকে স্বয়ংক্রিয়ভাবে গাণিতিক, বৈজ্ঞানিক ও টেক্সট ফরম্যাটিংসহ একটি প্রকাশনা-উপযোগী, কাস্টমাইজযোগ্য DOCX ফাইলে রূপান্তর করা—শিক্ষার্থী ও গবেষকদের জন্য সম্পূর্ণ উন্মুক্ত ও বিনামূল্যে।
              </p>
            </div>

            {/* License & Upstream Repositories Button */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenLicenseModal();
              }}
              className="min-h-[44px] w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Scale className="w-4 h-4 text-slate-600 shrink-0" />
                <span className="truncate">License & Upstream Repositories</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
          </GroupCard>
        </div>
      </div>
    </div>
  );
};
