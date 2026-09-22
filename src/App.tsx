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
import { usePWAInstallPrompt } from "./utils/pwaInstall";
import { skillRegistry } from "./skills";
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
} from "lucide-react";

export default function App() {
  const [inputText, setInputText] = useState<string>(SAMPLE_NOTES[0].text);
  const [docTitle, setDocTitle] = useState<string>("STT251: Statistics");
  const [fontFamily, setFontFamily] = useState<string>("Times New Roman");
  const [accentColor, setAccentColor] = useState<string>("#1A365D");
  const [equationFormat, setEquationFormat] = useState<"native" | "latex" | "unicode">("native");
  const [formatMode, setFormatMode] = useState<"auto" | "study_guide" | "exam_bank">("study_guide");

  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [conversionStage, setConversionStage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
      const res = await fetch("/api/ai/config");
      if (res.ok) {
        const data = await res.json();
        const ready = data.providers.filter((p: any) => p.enabled && p.keyCount > 0);
        setAiHealthInfo({
          readyCount: ready.length,
          providersSummary: ready.map((p: any) => p.name),
          mode: data.config.mode,
          freeOnly: data.config.freeOnlyMode,
        });
      }
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
    setDocTitle(sample.title);
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
        setCleanedMarkdown(null);
        setErrorMessage(null);
      }
    } catch {
      setErrorMessage("Please use Ctrl+V / Cmd+V to paste directly into the box.");
    }
  };

  // Trigger preview AI polish
  const handlePreviewClean = async () => {
    if (!inputText.trim()) {
      setErrorMessage("Please paste your content first.");
      return;
    }

    setIsConverting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setConversionStage("AI Engine is polishing notes & equations...");

    try {
      const res = await fetch("/api/preview-clean", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: inputText,
          equationFormat,
          formatMode,
          enabledSkillIds: skillRegistry.getEnabledSkillIds(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to polish notes with AI.");
      }

      setCleanedMarkdown(data.cleaned_markdown);

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
      setConversionStage(`1/2: Preparing ${formatLabels[format] || format}...`);

      const response = await fetch(`/export?format=${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: inputText,
          cleanedMarkdown: effectiveMarkdown,
          title: docTitle.trim() || "Notes",
          font: fontFamily,
          accent: accentColor,
          equationFormat,
          formatMode,
          format,
          enabledSkillIds: skillRegistry.getEnabledSkillIds(),
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

      // Extract filename from Content-Disposition header if available
      let safeFilename = "";
      const disposition = response.headers.get("Content-Disposition");
      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
          safeFilename = match[1];
        }
      }

      if (!safeFilename) {
        const baseName = (docTitle.trim() || "notes")
          .toLowerCase()
          .replace(/[^a-z0-9_\-]/g, "_");
        safeFilename = `${baseName}.${format}`;
      }

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
          body: JSON.stringify({ text: inputText, equationFormat }),
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

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-800 flex flex-col antialiased w-full overflow-x-hidden">
      {/* Precision Top Header */}
      <Header
        docTitle={docTitle}
        onDocTitleChange={setDocTitle}
        onToggleSidebar={() => setIsSidebarOpen(true)}
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
          aiProviderName={aiHealthInfo?.providersSummary?.[0]}
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
        />

        {/* Segmented View Switcher Bar (Split | Editor | Preview) matching Mockup */}
        <div className="w-full bg-white rounded-2xl border border-slate-200/90 p-1 sm:p-1.5 shadow-2xs flex items-center justify-between text-xs font-semibold text-slate-700">
          <button
            type="button"
            id="view-tab-split"
            onClick={() => setViewLayout("split")}
            className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-4 rounded-xl transition-all cursor-pointer ${
              viewLayout === "split"
                ? "bg-[#EFF6FF] text-[#1D4ED8] shadow-2xs font-bold"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Columns className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 shrink-0" />
            <span className="text-xs sm:text-sm">Split</span>
          </button>

          <div className="w-px h-4 sm:h-5 bg-slate-200/90 shrink-0" />

          <button
            type="button"
            id="view-tab-editor"
            onClick={() => setViewLayout("editor")}
            className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-4 rounded-xl transition-all cursor-pointer ${
              viewLayout === "editor"
                ? "bg-[#EFF6FF] text-[#1D4ED8] shadow-2xs font-bold"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-700 shrink-0" />
            <span className="text-xs sm:text-sm">Editor</span>
          </button>

          <div className="w-px h-4 sm:h-5 bg-slate-200/90 shrink-0" />

          <button
            type="button"
            id="view-tab-preview"
            onClick={() => setViewLayout("preview")}
            className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-4 rounded-xl transition-all cursor-pointer ${
              viewLayout === "preview"
                ? "bg-[#EFF6FF] text-[#1D4ED8] shadow-2xs font-bold"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-700 shrink-0" />
            <span className="text-xs sm:text-sm">Preview</span>
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
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs flex flex-col h-[480px] sm:h-[580px] lg:h-[680px] overflow-hidden">
              {/* Editor Header Bar */}
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Raw Content (ChatGPT, Gemini, Claude, NotebookLM)
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={handlePasteClipboard}
                    className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 px-2 py-1 rounded-md border border-slate-200 transition-colors cursor-pointer"
                    title="Paste from clipboard"
                  >
                    <Clipboard className="w-3 h-3 text-slate-500" />
                    <span>Paste</span>
                  </button>
                  <button
                    onClick={() => {
                      setInputText("");
                      setCleanedMarkdown(null);
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600 bg-white hover:bg-rose-50 px-2 py-1 rounded-md border border-slate-200 transition-colors cursor-pointer"
                    title="Clear input"
                  >
                    <Eraser className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                </div>
              </div>

              {/* Editor Textarea */}
              <textarea
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  if (cleanedMarkdown) setCleanedMarkdown(null);
                }}
                placeholder="Paste AI-generated or copy-pasted content here (from ChatGPT, Gemini, Claude, NotebookLM, DeepSeek, or any lecture notes/formulas)...&#10;&#10;Examples:&#10;• Mathematical LaTeX: \frac{\partial T}{\partial t} = \alpha \nabla^2 T or SE(\hat{p}) = \sqrt{\frac{p(1-p)}{n}} typeset to native Word equations&#10;• Tree structures, markdown headers, bold terms, and lists format cleanly into professional academic DOCX"
                className="w-full flex-1 p-4 font-mono text-xs sm:text-[13px] text-slate-800 bg-transparent resize-none focus:outline-none leading-relaxed select-text"
              />

              {/* Editor Status Bar */}
              <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/70 text-[11px] text-slate-500 flex items-center justify-between">
                <span>
                  {charCount.toLocaleString()} chars • {wordCount.toLocaleString()} words • {lineCount} lines
                </span>
                <span className="text-emerald-700 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
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
                onTriggerAiPolish={handlePreviewClean}
                isAiPolishing={isConverting}
                onDownloadDocx={handleConvertToDocx}
                isDownloading={isConverting}
              />
            </div>
          </div>
        )}

        {/* WORKSPACE VIEW: EDITOR ONLY */}
        {viewLayout === "editor" && (
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs flex flex-col min-h-[640px] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Raw Content (ChatGPT, Gemini, Claude, NotebookLM)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePasteClipboard}
                  className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 transition-colors cursor-pointer"
                >
                  <Clipboard className="w-3 h-3 text-slate-500" />
                  <span>Paste</span>
                </button>
                <button
                  onClick={() => {
                    setInputText("");
                    setCleanedMarkdown(null);
                  }}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600 bg-white hover:bg-rose-50 px-2.5 py-1 rounded-md border border-slate-200 transition-colors cursor-pointer"
                >
                  <Eraser className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              </div>
            </div>

            <textarea
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                if (cleanedMarkdown) setCleanedMarkdown(null);
              }}
              placeholder="Paste AI-generated or copy-pasted content here (from ChatGPT, Gemini, Claude, NotebookLM, or any notes/equations)..."
              rows={22}
              className="w-full flex-1 p-4 font-mono text-xs sm:text-sm text-slate-800 bg-transparent resize-y focus:outline-none leading-relaxed select-text"
            />

            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/70 text-[11px] text-slate-500 flex items-center justify-between">
              <span>{charCount.toLocaleString()} chars • {wordCount.toLocaleString()} words • {lineCount} lines</span>
              <button
                onClick={() => setViewLayout("split")}
                className="text-blue-700 font-semibold hover:underline cursor-pointer"
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
              onTriggerAiPolish={handlePreviewClean}
              isAiPolishing={isConverting}
              onDownloadDocx={handleConvertToDocx}
              isDownloading={isConverting}
            />
          </div>
        )}
      </main>

      {/* Educational Dedication & Open Source Footer */}
      <footer className="border-t border-slate-200 bg-white/80 py-4 px-4 sm:px-6 mt-8">
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
