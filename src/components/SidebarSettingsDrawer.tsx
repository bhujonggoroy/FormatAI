import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Palette,
  Type,
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
  FORMATTING_ORDER_COMMANDS,
  RECOMMENDED_ACADEMIC_SYSTEM_PROMPT,
} from "../shared/academicWorkflow.ts";

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
  // Collapsible groups: only the first open by default
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
  const drawerRef = useRef<HTMLDivElement>(null);

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Keyboard navigation: Escape key closes drawer & Focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Tab" && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentTheme = getAcademicTheme(accentColor);
  const activeAiSummary = aiProvidersSummary?.[0] || "Gemini 2.5 Flash";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Settings and Tools"
      className="fixed inset-0 z-50 flex justify-end"
    >
      {/* Dark semi-transparent backdrop with blur and fade */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-200 ease-out motion-reduce:transition-none"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel: Desktop right-side 400px, Mobile full-height bottom sheet with rounded top */}
      <div
        ref={drawerRef}
        className="relative z-10 w-full sm:w-[400px] sm:max-w-[400px] bg-[#F8FAFC] h-[92vh] sm:h-full max-h-[92vh] sm:max-h-full rounded-t-2xl sm:rounded-none border-t sm:border-t-0 sm:border-l border-slate-200 shadow-2xl flex flex-col overflow-hidden self-end sm:self-auto transition-transform duration-200 ease-out motion-reduce:transition-none"
      >
        {/* Mobile Drag Handle */}
        <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto my-2 sm:hidden shrink-0" aria-hidden="true" />

        {/* Top dynamic theme accent bar */}
        <div
          className="h-1 w-full shrink-0 transition-colors duration-200"
          style={{ backgroundColor: currentTheme.hex }}
        />

        {/* Sticky Header with Title + Close */}
        <div className="sticky top-0 z-10 px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-white shadow-2xs shrink-0">
          <div className="flex items-center gap-2.5">
            <FormatAILogo size="sm" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-900 leading-tight">Settings & Tools</h2>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{
                    backgroundColor: currentTheme.badgeBg,
                    color: currentTheme.badgeText,
                  }}
                >
                  {currentTheme.label}
                </span>
              </div>
              <p className="text-[13px] text-slate-500 font-normal">FormatAI Academic Engine</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            title="Close menu (Esc)"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Scrollable Content with 5 Collapsible Groups */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {/* ================= GROUP 1: APPEARANCE ================= */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => toggleGroup("appearance")}
              aria-expanded={openGroups.appearance}
              className="min-h-[48px] w-full flex items-center justify-between p-3.5 bg-white hover:bg-slate-50 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white shadow-2xs shrink-0"
                  style={{ backgroundColor: currentTheme.hex }}
                >
                  <Palette className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Appearance</h3>
                  <p className="text-[13px] text-slate-500">Theme color & typography standards</p>
                </div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  openGroups.appearance ? "rotate-180" : ""
                }`}
              />
            </button>

            {openGroups.appearance && (
              <div className="p-3.5 pt-1 border-t border-slate-100 space-y-3.5">
                {/* Compact Theme Color Swatch Row */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium text-slate-700">Theme Color</span>
                    <span className="text-xs font-semibold text-slate-600">{currentTheme.label}</span>
                  </div>
                  <div className="flex items-center justify-between gap-1.5 pt-0.5">
                    {ACADEMIC_THEMES.map((t) => {
                      const isSelected = accentColor.toLowerCase() === t.hex.toLowerCase();
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => onAccentColorChange(t.hex)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer relative shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                            isSelected
                              ? "ring-2 ring-slate-800 ring-offset-2 scale-105"
                              : "hover:scale-105 opacity-90 hover:opacity-100"
                          }`}
                          style={{ backgroundColor: t.hex }}
                          title={`${t.label}: ${t.desc}`}
                          aria-label={`Select ${t.label} theme`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Typography Selection (min-height >= 48px rows) */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[13px] font-medium text-slate-700">Typography Standard</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {["Times New Roman", "Georgia", "Calibri", "Arial", "Aptos"].map((f) => {
                      const isSelected = fontFamily === f;
                      return (
                        <button
                          key={f}
                          type="button"
                          onClick={() => onFontFamilyChange(f)}
                          className={`min-h-[48px] px-2 rounded-xl text-xs font-semibold transition-all text-center border cursor-pointer truncate flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
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
              </div>
            )}
          </div>

          {/* ================= GROUP 2: AI ENGINE ================= */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => toggleGroup("ai")}
              aria-expanded={openGroups.ai}
              className="min-h-[48px] w-full flex items-center justify-between p-3.5 bg-white hover:bg-slate-50 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">AI Engine</h3>
                  <p className="text-[13px] text-slate-500">Active provider & failover configuration</p>
                </div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  openGroups.ai ? "rotate-180" : ""
                }`}
              />
            </button>

            {openGroups.ai && (
              <div className="p-3.5 pt-1 border-t border-slate-100 space-y-2.5">
                {/* ONE Single Summary Row + Manage Button */}
                <div className="min-h-[48px] bg-slate-50 rounded-xl p-3 border border-slate-200 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {activeAiSummary} · {isFreeOnly ? "Free tier" : "Standard tier"} · {readyProvidersCount > 0 ? "Ready" : "Standby"}
                    </div>
                    <div className="text-[13px] text-slate-500 truncate mt-0.5">
                      {aiMode === "failover" ? "Auto-Failover Active" : "Direct Mode"} · {readyProvidersCount} configured
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAISettingsModal();
                    }}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    Manage
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ================= GROUP 3: ACADEMIC ================= */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => toggleGroup("academic")}
              aria-expanded={openGroups.academic}
              className="min-h-[48px] w-full flex items-center justify-between p-3.5 bg-white hover:bg-slate-50 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <Workflow className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Academic Pipeline</h3>
                  <p className="text-[13px] text-slate-500">Skills, system workflow & prompts</p>
                </div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  openGroups.academic ? "rotate-180" : ""
                }`}
              />
            </button>

            {openGroups.academic && (
              <div className="p-3.5 pt-1 border-t border-slate-100 space-y-2.5">
                {/* Row 1: Skills */}
                <div className="min-h-[48px] bg-slate-50 rounded-xl p-3 border border-slate-200 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-slate-900">Academic Skills Hub</div>
                    <div className="text-[13px] text-slate-500">{activeSkillsCount} modular skills active</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenSkillsModal();
                    }}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                  >
                    View Skills
                  </button>
                </div>

                {/* Row 2: System Workflow */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2">
                  <div className="min-h-[36px] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-900">Publication Workflow</div>
                      <div className="text-[13px] text-slate-500">10-step academic formatting pipeline</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowWorkflow((prev) => !prev)}
                      className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                      {showWorkflow ? "Hide Steps" : "View Steps"}
                    </button>
                  </div>

                  {showWorkflow && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-200/80">
                      {(ACADEMIC_SYSTEM_WORKFLOW as readonly string[]).map((step: string, idx: number) => (
                        <div key={step} className="flex items-center gap-2 text-xs text-slate-700 bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                          <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="truncate">{step}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Row 3: System Prompt (collapsed by default, Edit button reveals textarea) */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2">
                  <div className="min-h-[36px] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-900">Academic System Prompt</div>
                      <div className="text-[13px] text-slate-500">
                        {customPrompt ? "Custom instructions active" : "Default publication rules"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsEditingPrompt((prev) => !prev)}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
                          className="text-[11px] font-bold text-blue-700 hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3 text-blue-600" />
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
                          className="text-[11px] text-rose-600 hover:underline font-medium cursor-pointer"
                        >
                          Clear Custom Prompt
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ================= GROUP 4: APP ================= */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => toggleGroup("app")}
              aria-expanded={openGroups.app}
              className="min-h-[48px] w-full flex items-center justify-between p-3.5 bg-white hover:bg-slate-50 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">FormatAI App</h3>
                  <p className="text-[13px] text-slate-500">Installation & offline capability</p>
                </div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  openGroups.app ? "rotate-180" : ""
                }`}
              />
            </button>

            {openGroups.app && (
              <div className="p-3.5 pt-1 border-t border-slate-100">
                <div className="min-h-[48px] bg-slate-50 rounded-xl p-3 border border-slate-200 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-slate-900">
                      {isInstalled ? "FormatAI Installed" : "Install Web App"}
                    </div>
                    <div className="text-[13px] text-slate-500">
                      {isInstalled ? "Ready for fast offline launches" : "Install for offline access & faster launches"}
                    </div>
                  </div>
                  {!isInstalled && onInstallApp ? (
                    <button
                      type="button"
                      onClick={onInstallApp}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold transition-colors cursor-pointer shrink-0 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    >
                      Install PWA
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Installed
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ================= GROUP 5: ABOUT ================= */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => toggleGroup("about")}
              aria-expanded={openGroups.about}
              className="min-h-[48px] w-full flex items-center justify-between p-3.5 bg-white hover:bg-slate-50 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">About FormatAI</h3>
                  <p className="text-[13px] text-slate-500">Mission, license & open source repos</p>
                </div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  openGroups.about ? "rotate-180" : ""
                }`}
              />
            </button>

            {openGroups.about && (
              <div className="p-3.5 pt-1 border-t border-slate-100 space-y-3">
                {/* Mission Text */}
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-slate-800">
                  <p className="text-xs leading-relaxed text-slate-700 font-medium">
                    ChatGPT, Gemini, Claude, NotebookLM বা যেকোনো উৎস থেকে পাওয়া AI-generated কিংবা লেকচার নোটকে স্বয়ংক্রিয়ভাবে গাণিতিক, বৈজ্ঞানিক ও টেক্সট ফরম্যাটিংসহ একটি প্রকাশনা-উপযোগী, কাস্টমাইজযোগ্য DOCX ফাইলে রূপান্তর করা—শিক্ষার্থী ও গবেষকদের জন্য সম্পূর্ণ উন্মুক্ত ও বিনামূল্যে।
                  </p>
                </div>

                {/* License Button */}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenLicenseModal();
                  }}
                  className="min-h-[48px] w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-slate-600" />
                    <span>License & Upstream Repositories</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
