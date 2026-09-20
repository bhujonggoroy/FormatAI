import React, { useState, useMemo, useEffect } from "react";
import { Header } from "./components/Header";
import { FormattedPreview } from "./components/FormattedPreview";
import { AISettingsModal } from "./components/AISettingsModal";
import { SAMPLE_NOTES, SampleNote } from "./data/samples";
import { cleanClientSideNotebookLM } from "./utils/cleaner";
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
  Type,
  Palette,
  Sigma,
  ChevronDown,
  X,
} from "lucide-react";

export default function App() {
  const [inputText, setInputText] = useState<string>(SAMPLE_NOTES[0].text);
  const [docTitle, setDocTitle] = useState<string>("Thermodynamics Lecture Notes");
  const [fontFamily, setFontFamily] = useState<string>("Times New Roman");
  const [accentColor, setAccentColor] = useState<string>("#1A365D");
  const [equationFormat, setEquationFormat] = useState<"native" | "latex" | "unicode">("native");

  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [conversionStage, setConversionStage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [cleanedMarkdown, setCleanedMarkdown] = useState<string | null>(null);
  const [viewLayout, setViewLayout] = useState<"split" | "editor" | "preview">("split");
  const [isAISettingsModalOpen, setIsAISettingsModalOpen] = useState<boolean>(false);
  const [isSampleDropdownOpen, setIsSampleDropdownOpen] = useState<boolean>(false);

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

  useEffect(() => {
    fetchAIHealth();
  }, []);

  // Compute live markdown instantly: if Gemini AI has polished the text, use it;
  // otherwise, run instant client-side normalizer for zero-latency live preview!
  const effectiveMarkdown = useMemo(() => {
    if (cleanedMarkdown) return cleanedMarkdown;
    return cleanClientSideNotebookLM(inputText);
  }, [cleanedMarkdown, inputText]);

  // Load a sample note
  const handleLoadSample = (sample: SampleNote) => {
    setInputText(sample.text);
    setDocTitle(sample.title);
    setCleanedMarkdown(null);
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSampleDropdownOpen(false);
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
      setErrorMessage("Please paste your NotebookLM notes first.");
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
        body: JSON.stringify({ text: inputText, equationFormat }),
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

  // Trigger main conversion and automatic DOCX file download
  const handleConvertToDocx = async () => {
    if (!inputText.trim()) {
      setErrorMessage("Please paste your NotebookLM notes first.");
      return;
    }

    setIsConverting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      setConversionStage("1/2: Normalizing notes & equations...");

      const response = await fetch("/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: inputText,
          cleanedMarkdown: effectiveMarkdown,
          title: docTitle || "NotebookLM Notes",
          font: fontFamily,
          accent: accentColor,
          equationFormat,
        }),
      });

      if (!response.ok) {
        let errText = "Conversion failed.";
        try {
          const errJson = await response.json();
          errText = errJson.error || errText;
        } catch {}
        throw new Error(errText);
      }

      const providerHeader = response.headers.get("x-ai-provider");

      setConversionStage("2/2: Generating Word document (.docx)...");

      const blob = await response.blob();

      const safeFilename =
        (docTitle || "notebooklm_notes")
          .toLowerCase()
          .replace(/[^a-z0-9_\-]/g, "_") + ".docx";

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
      setErrorMessage(err.message || "An error occurred during conversion.");
    } finally {
      setIsConverting(false);
      setConversionStage("");
    }
  };

  const charCount = inputText.length;
  const wordCount = inputText.trim() ? inputText.trim().split(/\s+/).length : 0;
  const lineCount = inputText ? inputText.split("\n").length : 0;

  const accentColorOptions = [
    { label: "Academic Navy", hex: "#1A365D" },
    { label: "Slate Charcoal", hex: "#2D3748" },
    { label: "Forest Emerald", hex: "#22543D" },
    { label: "Imperial Plum", hex: "#44337A" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col antialiased">
      {/* Seamless Standard Header */}
      <Header
        docTitle={docTitle}
        onDocTitleChange={setDocTitle}
        onOpenAISettingsModal={() => setIsAISettingsModalOpen(true)}
        readyProvidersCount={aiHealthInfo?.readyCount || 1}
        isConverting={isConverting}
        onDownloadDocx={handleConvertToDocx}
        canDownload={Boolean(inputText.trim())}
      />

      {/* Modern Standard Formatting Toolbar */}
      <div className="bg-white border-b border-slate-200 sticky top-[57px] z-20 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Left Toolbar Controls */}
          <div className="flex items-center flex-wrap gap-2.5 sm:gap-3">
            {/* Font Selector */}
            <div className="flex items-center gap-1.5 bg-slate-100/80 rounded-lg px-2 py-1 border border-slate-200">
              <Type className="w-3.5 h-3.5 text-slate-500" />
              <select
                id="font-selector"
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
                title="Document Typography"
              >
                <option value="Times New Roman">Times New Roman (Academic)</option>
                <option value="Georgia">Georgia (Serif)</option>
                <option value="Calibri">Calibri (Office)</option>
                <option value="Arial">Arial (Modern)</option>
                <option value="Aptos">Aptos (Modern)</option>
              </select>
            </div>

            {/* Accent Color Swatches */}
            <div className="flex items-center gap-1 bg-slate-100/80 rounded-lg px-2 py-1 border border-slate-200">
              <Palette className="w-3.5 h-3.5 text-slate-500 mr-1" />
              {accentColorOptions.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setAccentColor(c.hex)}
                  className={`w-4 h-4 rounded-full transition-transform ${
                    accentColor === c.hex
                      ? "ring-2 ring-blue-500 ring-offset-1 scale-110"
                      : "opacity-70 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.label}
                />
              ))}
            </div>

            {/* Math Notation Toggle */}
            <div className="flex items-center bg-slate-100/80 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setEquationFormat("native")}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
                  equationFormat === "native"
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="True Word Office Math equations with stacked fractions and radicals"
              >
                Word Math (OMML)
              </button>
              <button
                type="button"
                onClick={() => setEquationFormat("latex")}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
                  equationFormat === "latex"
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Preserves standard academic LaTeX math notation ($...$)"
              >
                LaTeX ($...$)
              </button>
            </div>

            <div className="hidden md:block w-px h-5 bg-slate-200" />

            {/* Quick Sample Notes Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSampleDropdownOpen(!isSampleDropdownOpen)}
                className="inline-flex items-center gap-1 bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 font-medium transition-colors"
                title="Try with sample NotebookLM notes"
              >
                <span>Samples</span>
                <ChevronDown className="w-3 h-3 text-slate-500" />
              </button>

              {isSampleDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsSampleDropdownOpen(false)}
                  />
                  <div className="absolute left-0 mt-1.5 w-64 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95">
                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Sample NotebookLM Notes
                    </div>
                    {SAMPLE_NOTES.map((sample) => (
                      <button
                        key={sample.id}
                        onClick={() => handleLoadSample(sample)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors flex flex-col"
                      >
                        <span className="font-semibold text-slate-800 truncate">
                          {sample.title}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {sample.category}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Toolbar Controls: Layout Switcher & AI Polish */}
          <div className="flex items-center gap-2">
            {/* View Layout Mode Toggle */}
            <div className="flex items-center bg-slate-100/80 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setViewLayout("split")}
                className={`p-1.5 rounded-md transition-all ${
                  viewLayout === "split"
                    ? "bg-white text-blue-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
                title="Split View (Side-by-Side)"
              >
                <Columns className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewLayout("editor")}
                className={`p-1.5 rounded-md transition-all ${
                  viewLayout === "editor"
                    ? "bg-white text-blue-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
                title="Editor Only"
              >
                <FileText className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewLayout("preview")}
                className={`p-1.5 rounded-md transition-all ${
                  viewLayout === "preview"
                    ? "bg-white text-blue-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
                title="Document Preview Only"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* AI Polish Action Button */}
            <button
              id="btn-ai-polish"
              onClick={handlePreviewClean}
              disabled={isConverting || !inputText.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200/80 font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
              title="Enhance notes and normalize equations with Multi-Provider AI"
            >
              <Sparkles className={`w-3.5 h-3.5 text-blue-600 ${isConverting ? "animate-spin" : ""}`} />
              <span>AI Polish</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-4">
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

        {/* WORKSPACE VIEW: SPLIT (Standard default) */}
        {viewLayout === "split" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start flex-1">
            {/* Left Pane: NotebookLM Editor */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs flex flex-col h-[680px] overflow-hidden">
              {/* Editor Header Bar */}
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Raw Notes (NotebookLM)
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={handlePasteClipboard}
                    className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 px-2 py-1 rounded-md border border-slate-200 transition-colors"
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
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600 bg-white hover:bg-rose-50 px-2 py-1 rounded-md border border-slate-200 transition-colors"
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
                placeholder="Paste raw notes copied from Google NotebookLM here...&#10;&#10;Examples:&#10;• Tree structures with pipes (|--, |__ ) are cleaned automatically&#10;• Formulas like \frac{\partial T}{\partial t} = \alpha \nabla^2 T or SE(\hat{p}) = \sqrt{\frac{p(1-p)}{n}} format to native Word math"
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
            <div className="h-[680px] sticky top-[108px]">
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
                Raw Notes (NotebookLM)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePasteClipboard}
                  className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 transition-colors"
                >
                  <Clipboard className="w-3 h-3 text-slate-500" />
                  <span>Paste</span>
                </button>
                <button
                  onClick={() => {
                    setInputText("");
                    setCleanedMarkdown(null);
                  }}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600 bg-white hover:bg-rose-50 px-2.5 py-1 rounded-md border border-slate-200 transition-colors"
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
              placeholder="Paste raw notes copied from Google NotebookLM here..."
              rows={22}
              className="w-full flex-1 p-4 font-mono text-xs sm:text-sm text-slate-800 bg-transparent resize-y focus:outline-none leading-relaxed select-text"
            />

            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/70 text-[11px] text-slate-500 flex items-center justify-between">
              <span>{charCount.toLocaleString()} chars • {wordCount.toLocaleString()} words • {lineCount} lines</span>
              <button
                onClick={() => setViewLayout("split")}
                className="text-blue-700 font-semibold hover:underline"
              >
                Switch to Split View →
              </button>
            </div>
          </div>
        )}

        {/* WORKSPACE VIEW: DOCUMENT ONLY */}
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

      {/* Multi-Provider AI Settings Modal */}
      <AISettingsModal
        isOpen={isAISettingsModalOpen}
        onClose={() => {
          setIsAISettingsModalOpen(false);
          fetchAIHealth();
        }}
        onConfigChanged={fetchAIHealth}
      />
    </div>
  );
}
