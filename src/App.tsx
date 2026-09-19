import React, { useState, useMemo, useEffect } from "react";
import { Header } from "./components/Header";
import { DeploymentModal } from "./components/DeploymentModal";
import { FormattedPreview } from "./components/FormattedPreview";
import { AISettingsModal } from "./components/AISettingsModal";
import { SAMPLE_NOTES, SampleNote } from "./data/samples";
import { cleanClientSideNotebookLM } from "./utils/cleaner";
import {
  FileDown,
  Sparkles,
  Eraser,
  Clipboard,
  AlertCircle,
  CheckCircle2,
  Settings2,
  FileText,
  Loader2,
  Eye,
  Columns,
  Maximize2,
  RefreshCw,
  Sigma,
  BookOpen,
  Layers,
  ArrowRight,
  ShieldCheck,
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
  const [isDeployModalOpen, setIsDeployModalOpen] = useState<boolean>(false);
  const [isAISettingsModalOpen, setIsAISettingsModalOpen] = useState<boolean>(false);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState<boolean>(false);

  // Multi-Provider execution telemetry
  const [aiHealthInfo, setAiHealthInfo] = useState<{
    readyCount: number;
    providersSummary: string[];
    mode: string;
    freeOnly: boolean;
  } | null>(null);

  const [lastAIExecution, setLastAIExecution] = useState<{
    providerName: string;
    model: string;
    fallbackCount: number;
    fallbackChain?: any[];
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

  // Handle loading a sample note
  const handleLoadSample = (sample: SampleNote) => {
    setInputText(sample.text);
    setDocTitle(sample.title);
    setCleanedMarkdown(null);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  // Handle paste from clipboard
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

  // Trigger preview AI polish (calling Multi-Provider AI backend with failover)
  const handlePreviewClean = async () => {
    if (!inputText.trim()) {
      setErrorMessage("Please paste your NotebookLM notes first.");
      return;
    }

    setIsConverting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setConversionStage("AI Engine is normalizing notes & standardizing equations (with auto-fallback)...");

    try {
      const res = await fetch("/api/preview-clean", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText, equationFormat }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to preview cleaned notes.");
      }

      setCleanedMarkdown(data.cleaned_markdown);

      if (data.provider_name) {
        setLastAIExecution({
          providerName: data.provider_name,
          model: data.model || "",
          fallbackCount: data.fallback_count || 0,
          fallbackChain: data.fallback_chain,
        });

        const fallbackNote =
          data.fallback_count > 0
            ? ` (recovered via ${data.fallback_count} failover hop${data.fallback_count > 1 ? "s" : ""})`
            : "";
        setSuccessMessage(
          `Processed by ${data.provider_name} (${data.model})${fallbackNote}!`
        );
      } else {
        setSuccessMessage("Notes normalized successfully with standard academic equations!");
      }
      fetchAIHealth();
    } catch (err: any) {
      setErrorMessage(err.message || "Preview failed.");
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
      setConversionStage("1/3: Normalizing notes & equations with Multi-Provider AI...");

      const response = await fetch("/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: inputText,
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

      // Read fallback response headers
      const providerHeader = response.headers.get("x-ai-provider");
      const modelHeader = response.headers.get("x-ai-model");
      const fallbackCountHeader = response.headers.get("x-ai-fallback-count");

      if (providerHeader) {
        setLastAIExecution({
          providerName: providerHeader,
          model: modelHeader || "",
          fallbackCount: Number(fallbackCountHeader || 0),
        });
      }

      setConversionStage("2/3: Generating styled Microsoft Word document (.docx)...");

      const blob = await response.blob();
      setConversionStage("3/3: Initiating download...");

      const safeFilename =
        (docTitle || "notebooklm_notes")
          .toLowerCase()
          .replace(/[^a-z0-9_\-]/g, "_") + ".docx";

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("link");
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = safeFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      const providerNote = providerHeader ? ` [via ${providerHeader}]` : "";
      setSuccessMessage(`"${safeFilename}" (${fontFamily}) downloaded successfully!${providerNote}`);

      // If not yet AI polished, polish in background for preview
      if (!cleanedMarkdown) {
        fetch("/api/preview-clean", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: inputText, equationFormat }),
        })
          .then((r) => r.json())
          .then((d) => {
            if (d.cleaned_markdown) setCleanedMarkdown(d.cleaned_markdown);
            if (d.provider_name) {
              setLastAIExecution({
                providerName: d.provider_name,
                model: d.model || "",
                fallbackCount: d.fallback_count || 0,
                fallbackChain: d.fallback_chain,
              });
            }
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
  const lineCount = inputText ? inputText.split("\n").length : 0;

  // Render the Document Styling controls card
  const renderStylingControls = () => (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-slate-700" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Word (.docx) Styling
          </h3>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 font-semibold">
          Times New Roman Default
        </span>
      </div>

      <div className="mt-4 space-y-4 text-xs">
        {/* Font Family Selector */}
        <div>
          <label className="font-semibold text-slate-700 block mb-1">
            Body & Heading Font
          </label>
          <select
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            className="w-full text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer font-serif"
          >
            <option value="Times New Roman">Times New Roman (Academic & Journal Standard)</option>
            <option value="Calibri">Calibri (Modern Office)</option>
            <option value="Arial">Arial (Clean Modern)</option>
            <option value="Georgia">Georgia (Serif Editorial)</option>
            <option value="Aptos">Aptos (Modern Office)</option>
          </select>
        </div>

        {/* Accent Color Palette */}
        <div>
          <label className="font-semibold text-slate-700 block mb-1">
            Heading Accent Color
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Academic Navy", hex: "#1A365D" },
              { label: "Slate Charcoal", hex: "#2D3748" },
              { label: "Forest Emerald", hex: "#22543D" },
              { label: "Imperial Plum", hex: "#44337A" },
            ].map((theme) => (
              <button
                key={theme.hex}
                type="button"
                onClick={() => setAccentColor(theme.hex)}
                className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                  accentColor === theme.hex
                    ? "border-blue-600 bg-blue-50/50 font-semibold text-blue-900 shadow-2xs"
                    : "border-slate-200 hover:bg-slate-50 text-slate-600"
                }`}
              >
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10"
                  style={{ backgroundColor: theme.hex }}
                />
                <span className="text-[11px] truncate">{theme.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Equation Standards Selector */}
        <div className="pt-2 border-t border-slate-100">
          <label className="font-semibold text-slate-700 block mb-1.5 flex items-center justify-between">
            <span>Equation Standards</span>
            <span className="text-[10px] text-blue-700 font-semibold">Word OMML</span>
          </label>
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setEquationFormat("native")}
              className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                equationFormat === "native"
                  ? "border-blue-600 bg-blue-50/60 text-blue-900 shadow-2xs"
                  : "border-slate-200 hover:bg-slate-50 text-slate-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[11px]">Native Word Equation (OMML)</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold uppercase">
                  Active
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                True Word equation objects with stacked fractions, radicals, hats, and editable formulas.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setEquationFormat("latex")}
              className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                equationFormat === "latex"
                  ? "border-blue-600 bg-blue-50/60 text-blue-900 shadow-2xs"
                  : "border-slate-200 hover:bg-slate-50 text-slate-700"
              }`}
            >
              <div className="font-semibold text-[11px]">Standard Academic LaTeX ($...$)</div>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                Preserves standard LaTeX math syntax compatible with Overleaf & KaTeX.
              </p>
            </button>
          </div>
        </div>

        {/* Formatting Notice */}
        <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
          <div>• 1-inch standard academic margins</div>
          <div>• Times New Roman 11pt typography</div>
          <div>• Tree branch artifacts automatically stripped</div>
          <div>• Native Word math equations (<code className="font-mono text-slate-700">m:oMath</code>)</div>
        </div>
      </div>
    </div>
  );

  // Render the Raw Input Editor Card
  const renderInputCard = () => (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 flex flex-col flex-1">
      {/* Title input and quick tools */}
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-100 gap-2">
        <div className="flex items-center gap-2">
          <label
            htmlFor="doc-title-input"
            className="text-xs font-bold uppercase tracking-wider text-slate-500"
          >
            Document Title
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePasteClipboard}
            className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-md transition-colors"
            title="Paste from clipboard"
          >
            <Clipboard className="w-3.5 h-3.5" />
            <span>Paste</span>
          </button>
          <button
            onClick={() => {
              setInputText("");
              setCleanedMarkdown(null);
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 px-2 py-1 rounded-md transition-colors"
            title="Clear textarea"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Document Title Input */}
      <div className="mt-3">
        <input
          id="doc-title-input"
          type="text"
          value={docTitle}
          onChange={(e) => setDocTitle(e.target.value)}
          placeholder="e.g. Physics 101 - Lecture 4 (Thermodynamics)"
          className="w-full text-sm font-semibold text-slate-900 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
        />
      </div>

      {/* Textarea */}
      <div className="mt-3 flex-1 flex flex-col min-h-[340px]">
        <textarea
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value);
            // Invalidate previously cached AI markdown so user immediately sees live typing
            if (cleanedMarkdown) setCleanedMarkdown(null);
          }}
          placeholder="Paste raw notes copied from Google NotebookLM here...&#10;&#10;Examples:&#10;- Tree structures with pipes (|--, |__ ) are cleaned automatically&#10;- Raw LaTeX like \frac{\partial T}{\partial t} = \alpha \nabla^2 T&#10;- Inline formulas like SE(\hat{p}) = \sqrt{\frac{p(1-p)}{n}}"
          rows={14}
          className="w-full flex-1 p-3.5 text-xs sm:text-sm font-mono text-slate-800 bg-slate-50/30 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 leading-relaxed resize-y transition-all"
        />

        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>{charCount.toLocaleString()} characters • {lineCount} lines</span>
          <span className="text-emerald-600 font-sans font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Preview Sync
          </span>
        </div>
      </div>

      {/* Action Bar */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePreviewClean}
            disabled={isConverting || !inputText.trim()}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-blue-200 bg-blue-50/60 hover:bg-blue-100 text-blue-900 text-xs font-semibold disabled:opacity-50 transition-all shadow-2xs"
            title="Normalize notes and math using Gemini AI"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-700" />
            <span>AI Polish (Gemini)</span>
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleConvertToDocx}
            disabled={isConverting || !inputText.trim()}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs sm:text-sm font-semibold disabled:opacity-50 transition-all shadow-md hover:shadow-lg"
          >
            {isConverting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-blue-300" />
                <span>Converting...</span>
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4 text-blue-300" />
                <span>Download Word (.docx)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Progress Feedback */}
      {isConverting && (
        <div className="mt-3 p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center gap-2 animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin text-blue-700 shrink-0" />
          <span className="font-medium">{conversionStage || "Processing notes..."}</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col antialiased">
      <Header
        onOpenDeployModal={() => setIsDeployModalOpen(true)}
        onOpenAISettingsModal={() => setIsAISettingsModalOpen(true)}
        readyProvidersCount={aiHealthInfo?.readyCount || 1}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-5">
        {/* Multi-Provider AI Fallback & Health Bar */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-3 sm:px-4 sm:py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>AI Engine:</span>
            </div>

            {/* Provider priority badges */}
            <div className="flex items-center gap-1 flex-wrap">
              {aiHealthInfo?.providersSummary && aiHealthInfo.providersSummary.length > 0 ? (
                aiHealthInfo.providersSummary.map((prov, pIdx) => (
                  <React.Fragment key={pIdx}>
                    <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-900 font-semibold text-[11px] border border-blue-200/60">
                      {pIdx + 1}. {prov}
                    </span>
                    {pIdx < (aiHealthInfo?.providersSummary?.length || 0) - 1 && (
                      <span className="text-slate-400 text-[10px] font-bold">→</span>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px]">
                  Gemini AI (Default)
                </span>
              )}
            </div>

            {/* Free-only protection badge */}
            {aiHealthInfo?.freeOnly && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-semibold text-[10px] border border-emerald-200">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>Free-Only Mode</span>
              </span>
            )}

            {/* Last Execution Info badge */}
            {lastAIExecution && (
              <div className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-500 pl-2 border-l border-slate-200">
                <span>Last run:</span>
                <span className="font-semibold text-slate-800">
                  {lastAIExecution.providerName}
                </span>
                {lastAIExecution.fallbackCount > 0 ? (
                  <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                    {lastAIExecution.fallbackCount} Fallback{lastAIExecution.fallbackCount > 1 ? "s" : ""}
                  </span>
                ) : (
                  <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-900 font-medium text-[10px]">
                    Primary Success
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAISettingsModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-900 hover:text-blue-700 hover:underline cursor-pointer"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Configure AI & Keys</span>
            </button>
          </div>
        </div>

        {/* Banner with Title & Quick Info */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 text-xs font-bold tracking-wide uppercase">
                NotebookLM to Word (.docx)
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-serif font-semibold">
                Times New Roman
              </span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 text-xs font-semibold">
                Native Office Math (OMML)
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2 tracking-tight">
              Academic Notes & Equation Converter
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Seamlessly cleans tree-drawing artifacts from NotebookLM and converts formulas into true native Microsoft Word Office Math (<code className="font-mono text-slate-700">m:oMath</code>) in Times New Roman.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsDeployModalOpen(true)}
              className="text-xs font-semibold text-blue-900 hover:text-blue-800 bg-blue-50 hover:bg-blue-100/80 px-3.5 py-2 rounded-xl border border-blue-200 transition-colors"
            >
              Export Python Code & Configs
            </button>
          </div>
        </div>

        {/* Seamless View Selector Bar: Split View (Side-by-Side) | Editor Only | Document Sheet Only */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-3 gap-3">
          <div className="flex items-center bg-slate-200/80 p-1 rounded-xl">
            <button
              onClick={() => setViewLayout("split")}
              className={`text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                viewLayout === "split"
                  ? "bg-white text-blue-950 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Columns className="w-3.5 h-3.5 text-blue-700" />
              <span>Split View (Live)</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </button>

            <button
              onClick={() => setViewLayout("editor")}
              className={`text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                viewLayout === "editor"
                  ? "bg-white text-blue-950 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Editor Only</span>
            </button>

            <button
              onClick={() => setViewLayout("preview")}
              className={`text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                viewLayout === "preview"
                  ? "bg-white text-blue-950 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-indigo-600" />
              <span>Document Sheet</span>
              {cleanedMarkdown && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
            </button>
          </div>

          {/* Quick sample loader chips */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
            <span>Load Sample:</span>
            {SAMPLE_NOTES.map((sample) => (
              <button
                key={sample.id}
                onClick={() => handleLoadSample(sample)}
                className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-50 text-slate-700 font-medium border border-slate-200 transition-colors text-[11px]"
              >
                {sample.title.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Error / Success feedback alerts */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm rounded-xl p-4 flex items-start gap-2.5 animate-fadeIn">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong className="font-semibold">Error: </strong>
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-700 font-bold ml-2"
            >
              ×
            </button>
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm rounded-xl p-4 flex items-start gap-2.5 animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong className="font-semibold">Success: </strong>
              <span>{successMessage}</span>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-500 hover:text-emerald-700 font-bold ml-2"
            >
              ×
            </button>
          </div>
        )}

        {/* LAYOUT 1: SPLIT VIEW (Live Side-by-Side) */}
        {viewLayout === "split" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Left Column: Input + Collapsible Word Styling */}
            <div className="flex flex-col gap-4">
              {renderInputCard()}
              {renderStylingControls()}
            </div>

            {/* Right Column: Seamless Live Document Sheet Preview */}
            <div className="flex flex-col gap-4 sticky top-4">
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

        {/* LAYOUT 2: EDITOR ONLY */}
        {viewLayout === "editor" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 flex flex-col gap-4">
              {renderInputCard()}
            </div>
            <div className="flex flex-col gap-5">
              {renderStylingControls()}
              {/* Sample Notes Picker Card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Sample NotebookLM Notes
                  </h3>
                  <span className="text-[10px] text-slate-400 font-medium">Click to try</span>
                </div>

                <div className="mt-3 space-y-2.5">
                  {SAMPLE_NOTES.map((sample) => (
                    <button
                      key={sample.id}
                      onClick={() => handleLoadSample(sample)}
                      className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-800 group-hover:text-blue-900 font-serif">
                          {sample.title}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {sample.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
                        {sample.text.replace(/\\/g, "").slice(0, 100)}...
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LAYOUT 3: DOCUMENT SHEET ONLY (Full-Width Preview) */}
        {viewLayout === "preview" && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-600 font-medium">
                Viewing full-page Microsoft Word simulation in <strong>{fontFamily}</strong>.
              </span>
              <button
                onClick={() => setViewLayout("split")}
                className="text-xs font-semibold text-blue-800 hover:underline flex items-center gap-1"
              >
                <Columns className="w-3.5 h-3.5" />
                <span>Switch to Side-by-Side Split View</span>
              </button>
            </div>

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

      {/* Deployment modal for serverless Python configs */}
      <DeploymentModal
        isOpen={isDeployModalOpen}
        onClose={() => setIsDeployModalOpen(false)}
      />

      {/* Multi-Provider AI Settings & Fallback Manager Modal */}
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
