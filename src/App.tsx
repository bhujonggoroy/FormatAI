import React, { useState, useMemo, useEffect } from "react";
import { Header } from "./components/Header";
import { FormattedPreview } from "./components/FormattedPreview";
import { AISettingsModal } from "./components/AISettingsModal";
import { SystematicSkillsModal } from "./components/SystematicSkillsModal";
import { SkillsManagerModal, SkillsModalTab } from "./components/SkillsManagerModal";
import { SidebarSettingsDrawer } from "./components/SidebarSettingsDrawer";
import { ToolbarGrid } from "./components/ToolbarGrid";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SplashScreen } from "./components/SplashScreen";
import { SAMPLE_NOTES, SampleNote } from "./data/samples";
import { cleanClientSideNotebookLM } from "./utils/cleaner";
import { generateFilenameFromContent, getDisplayTitleFromContent } from "./utils/filename";
import { downloadPreviewAsPdf } from "./utils/pdfExport";
import { usePWAInstallPrompt } from "./utils/pwaInstall";
import { skillRegistry } from "./skills";
import { ACADEMIC_THEMES, getAcademicTheme } from "./utils/theme";
import { validateAIPolishOutput } from "./utils/aiValidation";
import {
  getUserSettings,
  getUserProviders,
  saveUserProviders,
  getUserPreferences,
} from "./utils/userLocalStorage";
import {
  Sparkles,
  Eraser,
  Clipboard,
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Eye,
  Columns,
  X,
  FileDown,
  ShieldAlert,
} from "lucide-react";

export default function App() {
  const [inputText, setInputText] = useState<string>(SAMPLE_NOTES[0].text);
  const [docTitle, setDocTitle] = useState<string>(() => getDisplayTitleFromContent(SAMPLE_NOTES[0].text));
  const [fontFamily, setFontFamily] = useState<string>("Times New Roman");
  const [accentColor, setAccentColor] = useState<string>("#1A365D");
  const [equationFormat, setEquationFormat] = useState<"native" | "latex" | "unicode">("native");
  const [formatMode, setFormatMode] = useState<"auto" | "study_guide" | "exam_bank">("study_guide");

  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [conversionStage, setConversionStage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [validationAlert, setValidationAlert] = useState<{
    failed: boolean;
    reason: string;
    errors: string[];
  } | null>(null);

  const [cleanedMarkdown, setCleanedMarkdown] = useState<string | null>(null);
  const [viewLayout, setViewLayout] = useState<"split" | "editor" | "preview">("editor");
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isAISettingsModalOpen, setIsAISettingsModalOpen] = useState<boolean>(false);
  const [isSkillModalOpen, setIsSkillModalOpen] = useState<boolean>(false);
  const [isSkillsManagerModalOpen, setIsSkillsManagerModalOpen] = useState<boolean>(false);
  const [skillsModalTab, setSkillsModalTab] = useState<SkillsModalTab>("skills");
  const [activeSkillsCount, setActiveSkillsCount] = useState<number>(() => skillRegistry.getEnabledSkillIds().length);

  // PWA In-App Installation hook (Vanilla JS direct install system)
  const { hasNativePrompt, isInstalled, directInstall } = usePWAInstallPrompt();

  const handleInstallApp = async () => {
    setIsSidebarOpen(false);
    await directInstall();
  };

  // Multi-Provider AI telemetry state
  const [aiHealthInfo, setAiHealthInfo] = useState<{
    readyCount: number;
    providersSummary: string[];
    mode: string;
    freeOnly: boolean;
  } | null>(null);

  const fetchAIHealth = async () => {
    try {
      let templates: any[] = [];
      try {
        const res = await fetch("/api/ai/config");
        if (res.ok) {
          const data = await res.json();
          templates = data.providers || [];
        }
      } catch {}

      const userConfig = getUserSettings();
      const userProvs = getUserProviders(templates);
      const ready = userProvs.filter((p) => p.enabled && (p.apiKeys || []).some((k) => k.enabled));
      setAiHealthInfo({
        readyCount: ready.length,
        providersSummary: ready.map((p) => p.name),
        mode: userConfig.mode,
        freeOnly: userConfig.freeOnlyMode,
      });
    } catch {
      // Non-blocking
    }
  };

  const [isAppReady, setIsAppReady] = useState<boolean>(false);

  useEffect(() => {
    fetchAIHealth().finally(() => {
      setIsAppReady(true);
    });
  }, []);

  // Compute live markdown instantly
  const effectiveMarkdown = useMemo(() => {
    if (cleanedMarkdown) return cleanedMarkdown;
    return cleanClientSideNotebookLM(inputText, formatMode, skillRegistry.getEnabledSkillIds());
  }, [cleanedMarkdown, inputText, formatMode, activeSkillsCount]);

  // Load a sample note
  const handleLoadSample = (sample: SampleNote) => {
    setInputText(sample.text);
    setDocTitle(getDisplayTitleFromContent(sample.text));
    setCleanedMarkdown(null);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  // Paste from clipboard
  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputText(text);
        setDocTitle(getDisplayTitleFromContent(text));
        setCleanedMarkdown(null);
        setErrorMessage(null);
      }
    } catch {
      setErrorMessage("Please use Ctrl+V / Cmd+V to paste directly into the box.");
    }
  };

  // Determine if running in "No AI" state (offline mode, no configured AI keys, or FormatAI selected)
  const isNoAI = useMemo(() => {
    const userConfig = getUserSettings();
    if (
      userConfig.activeProviderId === "formatai" ||
      userConfig.activeProviderId === "local" ||
      (userConfig as any).mode === "no_ai" ||
      (userConfig as any).mode === "formatai"
    ) {
      return true;
    }
    const userProvs = getUserProviders();
    const hasActiveKey = userProvs.some(
      (p) => p.enabled && (p.apiKeys || []).some((k) => k.enabled && k.key.trim().length > 0)
    );
    const hasServerAI = (aiHealthInfo?.readyCount ?? 0) > 0;
    return !hasActiveKey && !hasServerAI;
  }, [aiHealthInfo]);

  // Trigger deterministic FormatAI normalization directly (Zero AI / No API key needed)
  const handleRunFormatAI = () => {
    if (!inputText.trim()) {
      setErrorMessage("Please paste your content first.");
      return;
    }

    setIsConverting(true);
    setErrorMessage(null);
    setValidationAlert(null);
    setConversionStage("Normalizing with FormatAI Academic Engine (No AI)...");

    try {
      const cleaned = cleanClientSideNotebookLM(
        inputText,
        formatMode,
        skillRegistry.getEnabledSkillIds()
      );
      setCleanedMarkdown(cleaned);
      setSuccessMessage("Normalized successfully with FormatAI (Deterministic Academic Engine — No AI).");
    } catch (err: any) {
      setErrorMessage(err.message || "FormatAI normalization failed.");
    } finally {
      setIsConverting(false);
      setConversionStage("");
    }
  };

  // Trigger preview AI polish (or FormatAI if in No AI mode)
  const handlePreviewClean = async () => {
    if (!inputText.trim()) {
      setErrorMessage("Please paste your content first.");
      return;
    }

    // When No AI is available/active, route directly to FormatAI without making external AI calls
    if (isNoAI) {
      handleRunFormatAI();
      return;
    }

    setIsConverting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setConversionStage("AI Engine is polishing notes & equations...");

    // Capture the current verified FormatAI Result before firing AI Polish
    const prePolishFormatAiResult = effectiveMarkdown;

    try {
      const userConfig = getUserSettings();
      const userProvs = getUserProviders();
      const userPrefs = getUserPreferences();

      const res = await fetch("/api/preview-clean", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: inputText,
          equationFormat,
          formatMode,
          enabledSkillIds: skillRegistry.getEnabledSkillIds(),
          customPrompt: userPrefs.customPrompt,
          aiConfig: userConfig,
          userProviders: userProvs,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        // Update provider statuses if returned in error payload
        if (data.fallback_chain && Array.isArray(data.fallback_chain)) {
          const currentProvs = getUserProviders();
          let changed = false;
          data.fallback_chain.forEach((step: any) => {
            const prov = currentProvs.find((p) => p.id === step.providerId);
            if (prov) {
              if (step.status === "rate_limited") {
                prov.status = "rate_limited";
                prov.lastError = step.errorMessage || "Free tier rate limit / quota exceeded (429)";
                changed = true;
              } else if (step.status === "invalid_key" || step.status === "permission_denied") {
                prov.status = "invalid_key";
                prov.lastError = step.errorMessage || "API key error or invalid authentication";
                changed = true;
              }
            }
          });
          if (changed) saveUserProviders(currentProvs);
        }
        throw new Error(data.error || "Failed to polish notes with AI.");
      }

      // ── STRICT QUALITY-GATE VALIDATION ─────────────────────────────────────────
      // FormatAI Result -> AI Polish -> AI Output ❌ -> Validation FAILED ->
      // Discard AI Output -> Restore/Keep FormatAI Result -> Preview remains unchanged
      const clientValidation = validateAIPolishOutput(
        data.cleaned_markdown,
        inputText,
        prePolishFormatAiResult
      );

      const isValidationFailed =
        Boolean(data.validation_failed) ||
        Boolean(data.discarded_ai_output) ||
        !clientValidation.isValid;

      if (isValidationFailed) {
        console.warn("AI Polish output failed validation! Discarding AI Output and keeping FormatAI Result.");

        // 1. Discard AI Output: DO NOT apply data.cleaned_markdown
        // 2. Restore/Keep FormatAI Result: Setting cleanedMarkdown to null ensures
        //    effectiveMarkdown immediately falls back to / retains the deterministic
        //    rule-based FormatAI result cleanClientSideNotebookLM(...)
        setCleanedMarkdown(null);

        // 3. Preview remains unchanged!
        const reason =
          data.discard_reason ||
          clientValidation.discardReason ||
          clientValidation.errors[0] ||
          "Formula syntax, delimiter balance, or content preservation checks failed.";

        const errorsList =
          data.validation_errors && data.validation_errors.length > 0
            ? data.validation_errors
            : clientValidation.errors;

        setValidationAlert({
          failed: true,
          reason,
          errors: errorsList,
        });

        setErrorMessage(
          `AI Output ❌ Validation FAILED (${reason}). Discarded AI Output. FormatAI Result restored — preview remains unchanged.`
        );
        return;
      }

      // ── VALIDATION PASSED ───────────────────────────────────────────────────────
      setValidationAlert(null);
      setCleanedMarkdown(data.cleaned_markdown);

      // Update provider statuses from fallback chain if present
      if (data.fallback_chain && Array.isArray(data.fallback_chain)) {
        const currentProvs = getUserProviders();
        let changed = false;
        data.fallback_chain.forEach((step: any) => {
          const prov = currentProvs.find((p) => p.id === step.providerId);
          if (prov) {
            if (step.status === "rate_limited") {
              prov.status = "rate_limited";
              prov.lastError = step.errorMessage || "Free tier quota exceeded (429)";
              changed = true;
            } else if (step.status === "invalid_key" || step.status === "permission_denied") {
              prov.status = "invalid_key";
              prov.lastError = step.errorMessage || "API key error or connection failed";
              changed = true;
            } else if (step.status === "success" && prov.status === "rate_limited") {
              prov.status = "active";
              changed = true;
            }
          }
        });
        if (changed) saveUserProviders(currentProvs);
      }

      if (data.provider_name) {
        const fallbackNote =
          data.fallback_count > 0
            ? ` (recovered via ${data.fallback_count} failover)`
            : "";
        setSuccessMessage(`Polished by ${data.provider_name} (${data.model})${fallbackNote}`);
      } else {
        setSuccessMessage("Notes normalized successfully with standard academic equations.");
      }
      fetchAIHealth();
    } catch (err: any) {
      setErrorMessage(err.message || "AI polish failed.");
    } finally {
      setIsConverting(false);
      setConversionStage("");
    }
  };

  // Main export handler: Supports docx, pdf, tex, md, txt formats
  const downloadFile = async (format: "docx" | "pdf" | "tex" | "md" | "txt" = "docx") => {
    if (!inputText.trim()) {
      setErrorMessage("Please paste your content first.");
      return;
    }

    setIsConverting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const formatLabels: Record<string, string> = {
      docx: "Word document (.docx)",
      pdf: "PDF document (.pdf)",
      tex: "LaTeX document (.tex)",
      md: "Markdown document (.md)",
      txt: "Plain text document (.txt)",
    };

    try {
      // Generate safe filename from CURRENT content for EVERY generation
      const activeContent = inputText.trim() || effectiveMarkdown || "";
      const safeBaseName = generateFilenameFromContent(activeContent);
      const safeFilename = `${safeBaseName}.${format === "pdf" ? "pdf" : format === "docx" ? "docx" : format}`;

      // If exporting as PDF: the document preview is the single source of truth.
      // Generate the PDF directly from the rendered document representation.
      if (format === "pdf") {
        const previewSheet =
          document.getElementById("academic-document-sheet") ||
          document.getElementById("preview-document-sheet") ||
          document.querySelector(".academic-paper-sheet");
        if (previewSheet) {
          setConversionStage("1/2: Preparing preview sheet for PDF generation...");
          await downloadPreviewAsPdf({
            element: previewSheet,
            title: safeBaseName,
            markdown: activeContent,
            onProgress: (stage) => setConversionStage(stage),
          });
          setSuccessMessage(`"${safeFilename}" generated successfully matching the preview!`);
          return;
        }
      }

      setConversionStage(`1/2: Preparing ${formatLabels[format] || format}...`);

      const userConfig = getUserSettings();
      const userProvs = getUserProviders();
      const userPrefs = getUserPreferences();

      const response = await fetch(`/api/export?format=${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: inputText,
          cleanedMarkdown: effectiveMarkdown,
          title: safeBaseName,
          font: fontFamily,
          accent: accentColor,
          equationFormat,
          formatMode,
          format,
          enabledSkillIds: skillRegistry.getEnabledSkillIds(),
          customPrompt: userPrefs.customPrompt,
          aiConfig: userConfig,
          userProviders: userProvs,
        }),
      });

      if (!response.ok) {
        let errText = "Export failed.";
        try {
          const errJson = await response.json();
          errText = errJson.error || errText;
        } catch {}
        throw new Error(errText);
      }

      const providerHeader = response.headers.get("x-ai-provider");

      setConversionStage(`2/2: Generating ${formatLabels[format] || format}...`);

      const blob = await response.blob();

      // Download strictly using the content-generated safeFilename, completely avoiding sample or reference file naming conventions
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = safeFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      const providerNote = providerHeader ? ` via ${providerHeader}` : "";
      setSuccessMessage(`"${safeFilename}" downloaded successfully!${providerNote}`);

      // Background AI polish update if not yet polished
      if (!cleanedMarkdown) {
        fetch("/api/preview-clean", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: inputText,
            equationFormat,
            formatMode,
            enabledSkillIds: skillRegistry.getEnabledSkillIds(),
            customPrompt: userPrefs.customPrompt,
            aiConfig: userConfig,
            userProviders: userProvs,
          }),
        })
          .then((r) => r.json())
          .then((d) => {
            if (d.cleaned_markdown) setCleanedMarkdown(d.cleaned_markdown);
          })
          .catch(() => {});
      }
      fetchAIHealth();
    } catch (err: any) {
      setErrorMessage(err.message || "An error occurred during export.");
    } finally {
      setIsConverting(false);
      setConversionStage("");
    }
  };

  // Keep handleConvertToDocx for backward compatibility
  const handleConvertToDocx = () => downloadFile("docx");

  const charCount = inputText.length;
  const wordCount = inputText.trim() ? inputText.trim().split(/\s+/).length : 0;
  const lineCount = inputText ? inputText.split("\n").length : 0;
  const currentTheme = getAcademicTheme(accentColor);

  return (
    <div className="min-h-screen bg-[#F4F6F8] text-slate-900 flex flex-col antialiased w-full overflow-x-hidden">
      {/* Precision Top Header */}
      <Header
        docTitle={docTitle}
        onDocTitleChange={setDocTitle}
        onToggleSidebar={() => setIsSidebarOpen(true)}
        accentColor={accentColor}
      />

      {/* Main Container Area */}
      <div className="max-w-7xl w-full mx-auto px-3 sm:px-5 pt-3 sm:pt-5 pb-2 sm:pb-3 flex flex-col gap-3 sm:gap-4">
        {/* Interactive 7-Tile Toolbar Card matching Mockup */}
        <ToolbarGrid
          fontFamily={fontFamily}
          onFontFamilyChange={setFontFamily}
          accentColor={accentColor}
          onAccentColorChange={setAccentColor}
          equationFormat={equationFormat}
          onEquationFormatChange={setEquationFormat}
          onInsertSymbol={(sym) => {
            setInputText((prev) => prev + sym);
          }}
          isAiPolishing={isConverting}
          onTriggerAiPolish={handlePreviewClean}
          onTriggerFormatAI={handleRunFormatAI}
          isNoAI={isNoAI}
          aiProviderName={isNoAI ? "FormatAI" : aiHealthInfo?.providersSummary?.[0]}
          onDownloadDocx={handleConvertToDocx}
          onExportFormat={downloadFile}
          canDownload={Boolean(inputText.trim())}
          formatMode={formatMode}
          onFormatModeChange={(mode) => {
            setFormatMode(mode);
            setCleanedMarkdown(null);
          }}
          activeSkillsCount={activeSkillsCount}
          onOpenSkillsManager={() => {
            setSkillsModalTab("skills");
            setIsSkillsManagerModalOpen(true);
          }}
          onSkillsChanged={() => {
            setActiveSkillsCount(skillRegistry.getEnabledSkillIds().length);
            setCleanedMarkdown(null);
          }}
          onSelectSample={handleLoadSample}
          onOpenAISettings={() => setIsAISettingsModalOpen(true)}
        />

        {/* High-Contrast Segmented View Switcher Bar (Split | Editor | Preview) */}
        <div className="w-full bg-slate-200/90 rounded-2xl border-2 border-slate-300 p-1 sm:p-1.5 shadow-2xs flex items-center justify-between text-xs font-bold text-slate-700">
          <button
            type="button"
            id="view-tab-split"
            onClick={() => setViewLayout("split")}
            className={`flex-1 min-h-[42px] flex items-center justify-center gap-1.5 sm:gap-2 py-2 px-2 sm:px-4 rounded-xl transition-all cursor-pointer ${
              viewLayout === "split"
                ? "bg-white text-slate-900 shadow-xs font-extrabold border-2 border-slate-400"
                : "text-slate-700 hover:text-slate-950 hover:bg-slate-300/60"
            }`}
          >
            <Columns
              className="w-4 h-4 shrink-0"
              style={{ color: viewLayout === "split" ? currentTheme.hex : undefined }}
            />
            <span className="text-xs sm:text-sm">Split View</span>
            <span className="hidden md:inline-block text-[10px] text-slate-500 font-normal ml-0.5">(Desktop)</span>
          </button>

          <div className="w-px h-5 bg-slate-300 shrink-0" />

          <button
            type="button"
            id="view-tab-editor"
            onClick={() => setViewLayout("editor")}
            className={`flex-1 min-h-[42px] flex items-center justify-center gap-1.5 sm:gap-2 py-2 px-2 sm:px-4 rounded-xl transition-all cursor-pointer ${
              viewLayout === "editor"
                ? "bg-white text-slate-900 shadow-xs font-extrabold border-2 border-slate-400"
                : "text-slate-700 hover:text-slate-950 hover:bg-slate-300/60"
            }`}
          >
            <FileText
              className="w-4 h-4 shrink-0"
              style={{ color: viewLayout === "editor" ? currentTheme.hex : undefined }}
            />
            <span className="text-xs sm:text-sm">Raw Editor</span>
            {charCount > 0 && (
              <span className="text-[10px] bg-slate-300/80 text-slate-900 px-1.5 py-0.2 rounded-full font-bold">
                {wordCount}w
              </span>
            )}
          </button>

          <div className="w-px h-5 bg-slate-300 shrink-0" />

          <button
            type="button"
            id="view-tab-preview"
            onClick={() => setViewLayout("preview")}
            className={`flex-1 min-h-[42px] flex items-center justify-center gap-1.5 sm:gap-2 py-2 px-2 sm:px-4 rounded-xl transition-all cursor-pointer ${
              viewLayout === "preview"
                ? "bg-white text-slate-900 shadow-xs font-extrabold border-2 border-slate-400"
                : "text-slate-700 hover:text-slate-950 hover:bg-slate-300/60"
            }`}
          >
            <Eye
              className="w-4 h-4 shrink-0"
              style={{ color: viewLayout === "preview" ? currentTheme.hex : undefined }}
            />
            <span className="text-xs sm:text-sm">Document Sheet</span>
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-5 pb-6 flex flex-col gap-3 sm:gap-4">
        {/* Progress feedback bar */}
        {isConverting && (
          <div className="bg-blue-50 border border-blue-200 text-blue-900 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between animate-fadeIn shadow-2xs">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
              <span className="font-medium">{conversionStage || "Processing..."}</span>
            </div>
            <span className="text-[11px] text-blue-700 font-mono">Word • {fontFamily}</span>
          </div>
        )}

        {/* Error notification */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-900 px-4 py-3 rounded-xl text-xs flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-700 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Validation Failure Banner (FormatAI Result Restored & Preview Unchanged) */}
        {validationAlert?.failed && (
          <div className="bg-amber-50 border-2 border-amber-300 text-amber-950 px-4 py-3 rounded-xl text-xs flex items-start justify-between gap-3 animate-fadeIn shadow-2xs">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-amber-950">AI Output ❌ Validation FAILED</span>
                  <span className="text-[10px] bg-rose-100 text-rose-800 font-extrabold px-1.5 py-0.2 rounded border border-rose-300 uppercase">
                    Discarded AI Output
                  </span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.2 rounded border border-emerald-300">
                    FormatAI Result Restored
                  </span>
                  <span className="text-[10px] bg-slate-200 text-slate-800 font-bold px-1.5 py-0.2 rounded">
                    Preview Unchanged
                  </span>
                </div>
                <p className="mt-1 text-slate-700 text-[11px] leading-relaxed">
                  Reason: <span className="font-semibold text-amber-900">{validationAlert.reason}</span>.
                  The AI Polish output was automatically discarded to protect equation syntax. The FormatAI Result is kept and the preview remains unchanged.
                </p>
              </div>
            </div>
            <button
              onClick={() => setValidationAlert(null)}
              className="text-amber-600 hover:text-amber-800 p-1 cursor-pointer shrink-0"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Success notification */}
        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-xl text-xs flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-500 hover:text-emerald-700 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* WORKSPACE VIEW: SPLIT */}
        {viewLayout === "split" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 items-start flex-1">
            {/* Left Pane: Raw Notes & AI Content Editor */}
            <div className="bg-white rounded-2xl border-2 border-slate-300 shadow-sm flex flex-col h-[480px] sm:h-[580px] lg:h-[680px] overflow-hidden">
              {/* Editor Header Bar with clear, distinct action buttons */}
              <div className="px-4 py-2.5 border-b-2 border-slate-200 flex items-center justify-between bg-slate-100/90">
                <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  Raw Content (ChatGPT, Gemini, Claude, NotebookLM)
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePasteClipboard}
                    className="min-h-[34px] inline-flex items-center gap-1.5 text-xs font-extrabold text-white px-3 py-1.5 rounded-xl shadow-2xs transition-colors cursor-pointer"
                    style={{ backgroundColor: currentTheme.btnPrimary }}
                    title="Paste from clipboard"
                  >
                    <Clipboard className="w-3.5 h-3.5 text-white" />
                    <span>Paste</span>
                  </button>
                  <button
                    onClick={() => {
                      setInputText("");
                      setDocTitle("FormatAI Document");
                      setCleanedMarkdown(null);
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className="min-h-[34px] inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 px-2.5 py-1.5 rounded-lg border border-rose-300 shadow-2xs transition-colors cursor-pointer"
                    title="Clear input"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                </div>
              </div>

              {/* Editor Textarea */}
              <textarea
                value={inputText}
                onChange={(e) => {
                  const val = e.target.value;
                  setInputText(val);
                  setDocTitle(getDisplayTitleFromContent(val));
                  if (cleanedMarkdown) setCleanedMarkdown(null);
                  if (validationAlert) setValidationAlert(null);
                }}
                placeholder="Paste AI-generated or copy-pasted content here (from ChatGPT, Gemini, Claude, NotebookLM, DeepSeek, or any lecture notes/formulas)...&#10;&#10;Examples:&#10;• Mathematical LaTeX: \frac{\partial T}{\partial t} = \alpha \nabla^2 T or SE(\hat{p}) = \sqrt{\frac{p(1-p)}{n}} typeset to native Word equations&#10;• Tree structures, markdown headers, bold terms, and lists format cleanly into professional academic DOCX"
                className="w-full flex-1 p-4 font-mono text-xs sm:text-[13px] text-slate-900 bg-white resize-none focus:outline-none leading-relaxed select-text placeholder:text-slate-400"
              />

              {/* Editor Status Bar */}
              <div className="px-4 py-2.5 border-t-2 border-slate-200 bg-slate-100/90 text-xs text-slate-700 font-semibold flex items-center justify-between">
                <span>
                  {charCount.toLocaleString()} chars • {wordCount.toLocaleString()} words • {lineCount} lines
                </span>
                <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync Active
                </span>
              </div>
            </div>

            {/* Right Pane: Live Document Sheet */}
            <div className="h-[520px] sm:h-[620px] lg:h-[680px] lg:sticky lg:top-[108px]">
              <FormattedPreview
                markdown={effectiveMarkdown}
                docTitle={docTitle}
                fontFamily={fontFamily}
                accentColor={accentColor}
                equationFormat={equationFormat}
                isAiPolished={Boolean(cleanedMarkdown)}
                validationAlert={validationAlert}
                onDismissValidationAlert={() => setValidationAlert(null)}
                onTriggerAiPolish={handlePreviewClean}
                isAiPolishing={isConverting}
                onDownloadDocx={handleConvertToDocx}
                onDownloadPdf={() => downloadFile("pdf")}
                isDownloading={isConverting}
              />
            </div>
          </div>
        )}

        {/* WORKSPACE VIEW: EDITOR ONLY */}
        {viewLayout === "editor" && (
          <div className="bg-white rounded-2xl border-2 border-slate-300 shadow-sm flex flex-col min-h-[640px] overflow-hidden">
            <div className="px-4 py-2.5 border-b-2 border-slate-200 flex items-center justify-between bg-slate-100/90">
              <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                Raw Content (ChatGPT, Gemini, Claude, NotebookLM)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePasteClipboard}
                  className="min-h-[34px] inline-flex items-center gap-1.5 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-3 py-1.5 rounded-lg shadow-2xs transition-colors cursor-pointer"
                >
                  <Clipboard className="w-3.5 h-3.5 text-white" />
                  <span>Paste</span>
                </button>
                <button
                  onClick={() => {
                    setInputText("");
                    setDocTitle("FormatAI Document");
                    setCleanedMarkdown(null);
                    setValidationAlert(null);
                  }}
                  className="min-h-[34px] inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 px-2.5 py-1.5 rounded-lg border border-rose-300 shadow-2xs transition-colors cursor-pointer"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              </div>
            </div>

            <textarea
              value={inputText}
              onChange={(e) => {
                const val = e.target.value;
                setInputText(val);
                setDocTitle(getDisplayTitleFromContent(val));
                if (cleanedMarkdown) setCleanedMarkdown(null);
                if (validationAlert) setValidationAlert(null);
              }}
              placeholder="Paste AI-generated or copy-pasted content here (from ChatGPT, Gemini, Claude, NotebookLM, or any notes/equations)..."
              rows={22}
              className="w-full flex-1 p-4 font-mono text-xs sm:text-sm text-slate-900 bg-white resize-y focus:outline-none leading-relaxed select-text placeholder:text-slate-400"
            />

            <div className="px-4 py-2.5 border-t-2 border-slate-200 bg-slate-100/90 text-xs text-slate-700 font-semibold flex items-center justify-between">
              <span>{charCount.toLocaleString()} chars • {wordCount.toLocaleString()} words • {lineCount} lines</span>
              <button
                onClick={() => setViewLayout("split")}
                className="text-blue-700 font-extrabold hover:underline cursor-pointer"
              >
                Switch to Split View →
              </button>
            </div>
          </div>
        )}

        {/* WORKSPACE VIEW: DOCUMENT PREVIEW ONLY */}
        {viewLayout === "preview" && (
          <div className="flex flex-col gap-4">
            <FormattedPreview
              markdown={effectiveMarkdown}
              docTitle={docTitle}
              fontFamily={fontFamily}
              accentColor={accentColor}
              equationFormat={equationFormat}
              isAiPolished={Boolean(cleanedMarkdown)}
              validationAlert={validationAlert}
              onDismissValidationAlert={() => setValidationAlert(null)}
              onTriggerAiPolish={handlePreviewClean}
              isAiPolishing={isConverting}
              onDownloadDocx={handleConvertToDocx}
              onDownloadPdf={() => downloadFile("pdf")}
              isDownloading={isConverting}
            />
          </div>
        )}
      </main>

      {/* Mobile Sticky Bottom Floating Action Dock (Mobile Users only, hidden on sm+) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t-2 border-slate-300 px-2.5 py-2 flex items-center justify-between gap-1.5 shadow-[0_-4px_20px_rgba(0,0,0,0.12)]">
        {/* View Switcher Toggle (Edit & Preview: at least 48x48px touch hit-box) */}
        <div className="flex bg-slate-200 p-0.5 rounded-xl border border-slate-300 shrink-0 gap-0.5">
          <button
            type="button"
            onClick={() => setViewLayout("editor")}
            className={`min-h-[48px] min-w-[48px] px-3 py-2.5 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
              viewLayout === "editor" ? "bg-white text-slate-900 shadow-xs border border-slate-300" : "text-slate-700 hover:text-slate-900"
            }`}
            title="Switch to Editor"
            aria-label="Edit"
          >
            <FileText
              className="w-4 h-4 shrink-0"
              style={{ color: viewLayout === "editor" ? currentTheme.hex : undefined }}
            />
            <span>Edit</span>
          </button>
          <button
            type="button"
            onClick={() => setViewLayout("preview")}
            className={`min-h-[48px] min-w-[48px] px-3 py-2.5 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
              viewLayout === "preview" ? "bg-white text-slate-900 shadow-xs border border-slate-300" : "text-slate-700 hover:text-slate-900"
            }`}
            title="Switch to Preview"
            aria-label="Preview"
          >
            <Eye
              className="w-4 h-4 shrink-0"
              style={{ color: viewLayout === "preview" ? currentTheme.hex : undefined }}
            />
            <span>Preview</span>
          </button>
        </div>

        {/* FormatAI / AI Polish Button (at least 48x48px touch hit-box) */}
        <button
          type="button"
          onClick={isNoAI ? handleRunFormatAI : handlePreviewClean}
          disabled={isConverting}
          className="flex-1 min-h-[48px] min-w-[48px] px-3 py-2.5 rounded-xl text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          style={{ backgroundColor: currentTheme.btnPrimary }}
          title={isNoAI ? "Run FormatAI (No AI)" : "Run AI Polish"}
          aria-label={isNoAI ? "FormatAI" : "AI Polish"}
        >
          {isConverting ? (
            <Loader2 className="w-4 h-4 animate-spin shrink-0 text-white" />
          ) : (
            <Sparkles className="w-4 h-4 shrink-0 text-amber-300" />
          )}
          <span className="whitespace-nowrap">
            {isConverting ? "Normalizing..." : isNoAI ? "FormatAI" : "AI Polish"}
          </span>
        </button>

        {/* Export DOCX Button (at least 48x48px touch hit-box) */}
        <button
          type="button"
          onClick={() => downloadFile("docx")}
          disabled={!inputText.trim() || isConverting}
          className="flex-1 min-h-[48px] min-w-[48px] px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-black active:scale-95 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          title="Download Word Document"
          aria-label="Export"
        >
          <FileDown className="w-4 h-4 shrink-0 text-blue-300" />
          <span className="whitespace-nowrap">
            <span>Export</span>
            <span className="hidden min-[370px]:inline"> DOCX</span>
          </span>
        </button>
      </div>

      {/* Educational Dedication & Open Source Footer */}
      <footer className="border-t-2 border-slate-300 bg-white py-4 px-4 sm:px-6 mt-8 pb-24 sm:pb-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2 text-center sm:text-left flex-wrap justify-center sm:justify-start">
            <span className="font-semibold text-slate-700">FormatAI</span>
            <span>•</span>
            <span>AI to Academic DOCX Typesetter</span>
            <span>•</span>
            <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Free for Students
            </span>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <button
              type="button"
              onClick={() => {
                setSkillsModalTab("license");
                setIsSkillsManagerModalOpen(true);
              }}
              className="font-semibold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer"
            >
              License & 4 Upstream Repos
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => {
                setSkillsModalTab("skills");
                setIsSkillsManagerModalOpen(true);
              }}
              className="font-medium text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
            >
              Modular Skills Pipeline
            </button>
          </div>
        </div>
      </footer>

      {/* 3-Lines (Hamburger) Drawer holding all configuration settings */}
      <SidebarSettingsDrawer
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        readyProvidersCount={aiHealthInfo?.readyCount || 1}
        aiProvidersSummary={aiHealthInfo?.providersSummary || []}
        aiMode={aiHealthInfo?.mode || "failover"}
        isFreeOnly={aiHealthInfo?.freeOnly || false}
        onOpenAISettingsModal={() => setIsAISettingsModalOpen(true)}
        activeSkillsCount={activeSkillsCount}
        onOpenSkillsModal={() => {
          setSkillsModalTab("skills");
          setIsSkillsManagerModalOpen(true);
        }}
        onOpenLicenseModal={() => {
          setSkillsModalTab("license");
          setIsSkillsManagerModalOpen(true);
        }}
        fontFamily={fontFamily}
        onFontFamilyChange={setFontFamily}
        accentColor={accentColor}
        onAccentColorChange={setAccentColor}
        equationFormat={equationFormat}
        onEquationFormatChange={setEquationFormat}
        formatMode={formatMode}
        onFormatModeChange={(mode) => {
          setFormatMode(mode);
          setCleanedMarkdown(null);
        }}
        onPasteClipboard={handlePasteClipboard}
        onClearText={() => {
          setInputText("");
          setDocTitle("FormatAI Document");
          setCleanedMarkdown(null);
        }}
        charCount={charCount}
        wordCount={wordCount}
        isInstalled={isInstalled}
        hasNativePrompt={hasNativePrompt}
        onInstallApp={handleInstallApp}
      />

      {/* Multi-Provider AI Settings Modal */}
      <AISettingsModal
        isOpen={isAISettingsModalOpen}
        onClose={() => {
          setIsAISettingsModalOpen(false);
          fetchAIHealth();
        }}
        onConfigChanged={fetchAIHealth}
      />

      {/* Systematic Formatting Skills Modal */}
      <SystematicSkillsModal
        isOpen={isSkillModalOpen}
        onClose={() => setIsSkillModalOpen(false)}
        activeMode={formatMode}
        onSelectMode={(mode) => {
          setFormatMode(mode);
          setCleanedMarkdown(null);
        }}
        onLoadSample={() => {
          handleLoadSample(SAMPLE_NOTES[0]);
          setFormatMode("study_guide");
        }}
      />

      {/* Modular GitHub Skills Manager Modal */}
      <ErrorBoundary fallbackTitle="Academic Skills Modal Paused">
        {isSkillsManagerModalOpen && (
          <SkillsManagerModal
            isOpen={isSkillsManagerModalOpen}
            initialTab={skillsModalTab}
            onClose={() => setIsSkillsManagerModalOpen(false)}
            onSkillsChanged={() => {
              setActiveSkillsCount(skillRegistry.getEnabledSkillIds().length);
              setCleanedMarkdown(null);
            }}
            onApplyText={(text) => {
              setInputText(text);
              setDocTitle(getDisplayTitleFromContent(text));
              setCleanedMarkdown(null);
            }}
          />
        )}
      </ErrorBoundary>

      {/* Initial FormatAI Splash / Loading Screen */}
      <SplashScreen isAppReady={isAppReady} />
    </div>
  );
}
