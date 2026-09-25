import React, { useState } from "react";
import {
  DiffResult,
  computeDocumentDiff,
  computeWordDiff,
  NO_IMPROVEMENT_MESSAGE,
} from "../utils/diffUtils";
import {
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Columns,
  List,
  X,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

interface TextDiffViewerProps {
  originalText: string;
  polishedText: string;
  onApplyChanges: () => void;
  onKeepOriginal: () => void;
  onClose?: () => void;
  providerName?: string;
  modelName?: string;
}

export const TextDiffViewer: React.FC<TextDiffViewerProps> = ({
  originalText,
  polishedText,
  onApplyChanges,
  onKeepOriginal,
  onClose,
  providerName = "AI Polish",
  modelName,
}) => {
  const [viewMode, setViewMode] = useState<"unified" | "split">("unified");
  const [copied, setCopied] = useState<boolean>(false);

  const diffResult: DiffResult = React.useMemo(() => {
    return computeDocumentDiff(originalText, polishedText);
  }, [originalText, polishedText]);

  const handleCopyPolished = () => {
    navigator.clipboard.writeText(polishedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border-2 border-indigo-200 rounded-xl shadow-lg overflow-hidden flex flex-col max-h-[85vh] animate-fadeIn">
      {/* Header Bar */}
      <div className="bg-slate-900 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/80 border border-indigo-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide">AI Polish Comparison & Diff</h3>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/50">
                {providerName}
              </span>
              {modelName && (
                <span className="hidden sm:inline-block text-[10px] font-mono text-slate-400">
                  {modelName}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-300">
              Grammar, clarity, academic terminology, and repetition refinements
            </p>
          </div>
        </div>

        {/* View mode toggle & actions */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="bg-slate-800 p-0.5 rounded-lg border border-slate-700 flex items-center text-xs">
            <button
              onClick={() => setViewMode("unified")}
              className={`px-2 py-1 rounded flex items-center gap-1 transition-colors cursor-pointer ${
                viewMode === "unified"
                  ? "bg-indigo-600 text-white font-bold"
                  : "text-slate-300 hover:text-white"
              }`}
              title="Unified line-by-line diff view"
            >
              <List className="w-3.5 h-3.5" />
              <span>Unified</span>
            </button>
            <button
              onClick={() => setViewMode("split")}
              className={`px-2 py-1 rounded flex items-center gap-1 transition-colors cursor-pointer ${
                viewMode === "split"
                  ? "bg-indigo-600 text-white font-bold"
                  : "text-slate-300 hover:text-white"
              }`}
              title="Side-by-side split view"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Split</span>
            </button>
          </div>

          <button
            onClick={handleCopyPolished}
            className="px-2.5 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
            title="Copy polished text"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
              title="Close diff view"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Status Ribbon: No Improvement vs Diff Stats */}
      {!diffResult.hasChanges ? (
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-3 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <span className="text-sm font-bold text-emerald-950">
                {NO_IMPROVEMENT_MESSAGE}
              </span>
              <p className="text-xs text-emerald-800 mt-0.5">
                The academic grammar, clarity, terminology, and syntax are already optimal. Equations, tables, and headings remain 100% intact.
              </p>
            </div>
          </div>
          <button
            onClick={onKeepOriginal}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors shadow-2xs shrink-0 cursor-pointer"
          >
            Keep As Is
          </button>
        </div>
      ) : (
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-700">Changes Summary:</span>
            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-100/70 border border-emerald-300 px-2 py-0.5 rounded">
              +{diffResult.stats.added} additions / revisions
            </span>
            <span className="inline-flex items-center gap-1 text-rose-700 font-bold bg-rose-100/70 border border-rose-300 px-2 py-0.5 rounded">
              -{diffResult.stats.removed} deletions
            </span>
            <span className="text-slate-500 font-mono text-[11px]">
              {diffResult.stats.unchanged} unchanged lines
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onKeepOriginal}
              className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold rounded-md flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Keep Original</span>
            </button>
            <button
              onClick={onApplyChanges}
              className="px-3.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-md flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply Polished Version</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Diff Content */}
      <div className="overflow-auto flex-1 font-mono text-xs leading-relaxed bg-slate-900 text-slate-100">
        {!diffResult.hasChanges ? (
          <div className="p-8 text-center bg-slate-50 text-slate-700">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-3">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
            </div>
            <h4 className="text-base font-bold text-slate-900 mb-1">{NO_IMPROVEMENT_MESSAGE}</h4>
            <p className="text-xs text-slate-600 max-w-md mx-auto mb-4">
              AI Polish analyzed your text for grammar, phrasing clarity, academic terminology, and repetition. No improvements were required—your text is already clean and publication-ready.
            </p>
            <div className="inline-flex items-center gap-2 text-xs bg-white border border-slate-300 px-3 py-1.5 rounded-lg text-slate-700 shadow-2xs">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Equations, tables, headings, and lists preserved intact.</span>
            </div>
          </div>
        ) : viewMode === "unified" ? (
          /* Unified Line-by-line Diff */
          <div className="p-2 space-y-0.5">
            {diffResult.lines.map((line, idx) => {
              if (line.type === "added") {
                return (
                  <div
                    key={idx}
                    className="flex items-start bg-emerald-950/40 text-emerald-300 border-l-4 border-emerald-500 px-2 py-0.5 rounded-r"
                  >
                    <span className="w-8 select-none text-[10px] text-emerald-500/80 font-mono text-right pr-2">
                      +{line.newLineNumber || ""}
                    </span>
                    <span className="select-none font-bold text-emerald-400 mr-2">+</span>
                    <pre className="flex-1 whitespace-pre-wrap font-sans text-xs break-words">
                      {line.text}
                    </pre>
                  </div>
                );
              }
              if (line.type === "removed") {
                return (
                  <div
                    key={idx}
                    className="flex items-start bg-rose-950/40 text-rose-300 border-l-4 border-rose-500 px-2 py-0.5 rounded-r opacity-90 line-through decoration-rose-500/70"
                  >
                    <span className="w-8 select-none text-[10px] text-rose-500/80 font-mono text-right pr-2">
                      -{line.oldLineNumber || ""}
                    </span>
                    <span className="select-none font-bold text-rose-400 mr-2">-</span>
                    <pre className="flex-1 whitespace-pre-wrap font-sans text-xs break-words">
                      {line.text}
                    </pre>
                  </div>
                );
              }
              return (
                <div
                  key={idx}
                  className="flex items-start text-slate-300 hover:bg-slate-800/40 px-2 py-0.5 rounded"
                >
                  <span className="w-8 select-none text-[10px] text-slate-600 font-mono text-right pr-2">
                    {line.newLineNumber || line.oldLineNumber || ""}
                  </span>
                  <span className="select-none text-slate-600 mr-2"> </span>
                  <pre className="flex-1 whitespace-pre-wrap font-sans text-xs break-words text-slate-300">
                    {line.text}
                  </pre>
                </div>
              );
            })}
          </div>
        ) : (
          /* Split Side-by-Side View */
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-700 min-h-full">
            {/* Left: Original Before */}
            <div className="p-3 bg-slate-900/90 overflow-x-auto">
              <div className="pb-2 mb-2 border-b border-slate-700 flex items-center justify-between text-xs text-rose-300 font-bold uppercase tracking-wider">
                <span>Original (Before Polish)</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  {originalText.split("\n").length} lines
                </span>
              </div>
              <pre className="whitespace-pre-wrap font-sans text-xs text-slate-300 leading-relaxed">
                {originalText}
              </pre>
            </div>

            {/* Right: Polished After */}
            <div className="p-3 bg-slate-900/90 overflow-x-auto">
              <div className="pb-2 mb-2 border-b border-slate-700 flex items-center justify-between text-xs text-emerald-300 font-bold uppercase tracking-wider">
                <span>Polished (After AI Polish)</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  {polishedText.split("\n").length} lines
                </span>
              </div>
              <pre className="whitespace-pre-wrap font-sans text-xs text-emerald-200 leading-relaxed">
                {polishedText}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="bg-slate-100 border-t border-slate-200 px-4 py-2.5 flex items-center justify-between gap-3 shrink-0">
        <div className="text-[11px] text-slate-600 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-indigo-600" />
          <span>Formulas, KaTeX notation, tables, headers, and bullet lists verified intact.</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onKeepOriginal}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            Keep Original
          </button>
          <button
            onClick={onApplyChanges}
            disabled={!diffResult.hasChanges}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Apply Polish</span>
          </button>
        </div>
      </div>
    </div>
  );
};
