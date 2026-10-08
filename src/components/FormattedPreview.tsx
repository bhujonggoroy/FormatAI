import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import {
  Copy,
  Check,
  FileDown,
  BookOpen,
  Code,
  Eye,
  Sparkles,
  Sigma,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RefreshCw,
  FileText,
  Printer,
  Download,
  Layers,
  ChevronRight,
  ShieldAlert,
  AlertTriangle,
  X,
  Wrench,
  Loader2,
} from "lucide-react";
import katex from "katex";
import { TextDiffViewer } from "./TextDiffViewer";
import { parseDocumentBlocks, type BlockFormattingIssue, type BrokenFragment } from "../utils/blockIntegrity";

export interface ValidationAlertState {
  failed: boolean;
  reason: string;
  errors: string[];
}

export interface PolishDiffData {
  originalText: string;
  polishedText: string;
  hasChanges: boolean;
  message?: string;
  providerName?: string;
  modelName?: string;
}

interface FormattedPreviewProps {
  markdown: string;
  docTitle: string;
  fontFamily: string;
  accentColor: string;
  equationFormat?: string;
  isAiPolished?: boolean;
  validationAlert?: ValidationAlertState | null;
  onDismissValidationAlert?: () => void;
  onTriggerAiPolish?: () => void;
  isAiPolishing?: boolean;
  onDownloadDocx: () => void;
  onDownloadPdf?: () => void;
  isDownloading: boolean;
  diffData?: PolishDiffData | null;
  onApplyDiffChanges?: () => void;
  onDiscardDiffChanges?: () => void;
  activeViewMode?: "rendered" | "source" | "diff";
  onViewModeChange?: (mode: "rendered" | "source" | "diff") => void;
  failedBlockIds?: string[];
  blockIssuesMap?: Record<string, BlockFormattingIssue>;
  fragments?: BrokenFragment[];
  blockFragmentsMap?: Record<string, BrokenFragment[]>;
  onRepairSingleBlock?: (blockId: string) => void;
  onRepairFragment?: (fragment: BrokenFragment) => void;
  onRepairAllFlagged?: () => void;
  isRepairing?: boolean;
  repairProgress?: { current: number; total: number; currentBlockId?: string } | null;
  onToggleMaximize?: () => void;
  isMaximized?: boolean;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getCssFontFamily(font: string): string {
  switch (font) {
    case "Times New Roman":
      return '"Times New Roman", Times, "Cambria Math", Georgia, serif';
    case "Calibri":
      return 'Calibri, "Segoe UI", Arial, sans-serif';
    case "Arial":
      return 'Arial, "Helvetica Neue", Helvetica, sans-serif';
    case "Georgia":
      return 'Georgia, "Times New Roman", serif';
    case "Aptos":
      return 'Aptos, Calibri, "Segoe UI", sans-serif';
    default:
      return font ? `"${font}", serif` : '"Times New Roman", Times, serif';
  }
}

export const FormattedPreview: React.FC<FormattedPreviewProps> = React.memo(({
  markdown,
  docTitle,
  fontFamily = "Times New Roman",
  accentColor = "#881337",
  equationFormat = "native",
  isAiPolished = false,
  validationAlert = null,
  onDismissValidationAlert,
  onTriggerAiPolish,
  isAiPolishing = false,
  onDownloadDocx,
  onDownloadPdf,
  isDownloading,
  diffData,
  onApplyDiffChanges,
  onDiscardDiffChanges,
  activeViewMode,
  onViewModeChange,
  failedBlockIds = [],
  blockIssuesMap,
  fragments = [],
  blockFragmentsMap,
  onRepairSingleBlock,
  onRepairFragment,
  onRepairAllFlagged,
  isRepairing = false,
  repairProgress = null,
  onToggleMaximize,
  isMaximized = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [internalViewMode, setInternalViewMode] = useState<"rendered" | "source" | "diff">("rendered");
  const viewMode = activeViewMode ?? internalViewMode;
  const setViewMode = (mode: "rendered" | "source" | "diff") => {
    setInternalViewMode(mode);
    onViewModeChange?.(mode);
  };
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const updateScrollProgress = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      setScrollProgress(0);
      return;
    }
    const { scrollTop, scrollHeight, clientHeight } = container;
    const maxScroll = scrollHeight - clientHeight;
    if (maxScroll <= 0) {
      setScrollProgress(0);
    } else {
      const progress = Math.min(100, Math.max(0, (scrollTop / maxScroll) * 100));
      setScrollProgress(progress);
    }
  }, []);

  const handleScroll = () => {
    updateScrollProgress();
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      updateScrollProgress();
    });
    return () => cancelAnimationFrame(frame);
  }, [markdown, viewMode, zoomLevel, updateScrollProgress]);

  useEffect(() => {
    window.addEventListener("resize", updateScrollProgress);
    return () => window.removeEventListener("resize", updateScrollProgress);
  }, [updateScrollProgress]);

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const maxScroll = container.scrollHeight - container.clientHeight;
    if (maxScroll > 0) {
      container.scrollTo({
        top: ratio * maxScroll,
        behavior: "smooth",
      });
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper component to render KaTeX formula safely
  const MathComponent: React.FC<{ math: string; display?: boolean }> = ({
    math,
    display = false,
  }) => {
    const cleanMath = useMemo(() => {
      let m = math.trim();
      // Strip trailing spacers and spurious newline tokens that trigger KaTeX display mode warnings
      m = m.replace(/(?:\\+(?:quad|qquad|,|;|!|\s|newline)|\\\\)+$/g, "");
      m = m.replace(/^(?:\\+(?:quad|qquad|,|;|!|\s|newline)|\\\\)+/g, "");
      return m.trim();
    }, [math]);

    const html = useMemo(() => {
      try {
        return katex.renderToString(cleanMath, {
          displayMode: display,
          throwOnError: false,
          strict: "ignore",
        });
      } catch (err) {
        return `<span class="text-rose-700 font-mono text-xs">${escapeHtml(cleanMath)}</span>`;
      }
    }, [cleanMath, display]);

    return (
      <span
        className={
          display
            ? "block my-2 max-w-full overflow-x-auto text-center"
            : "inline-block max-w-full overflow-x-auto px-1 align-baseline"
        }
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  };

  function renderInline(text: string, prefix = "inl") {
    // Splits by display math ($$...$$ or \[...\]), inline math ($...$ or \(...\)), bold (**...**), italic (*...*), and inline code (`...`)
    const parts = text.split(/(\$\$[\s\S]+?\$\$|(?:\\)+\[[^\n]+?(?:\\)+\]|\$[^$\n]+\$|(?:\\)+\([^\n]+?(?:\\)+\)|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);

    return parts.map((part, i) => {
      if (!part) return null;
      const key = `${prefix}-${i}`;

      // Inline LaTeX math: $...$
      if (part.startsWith("$") && part.endsWith("$") && part.length >= 3 && !part.startsWith("$$")) {
        const mathContent = part.slice(1, -1);
        return <MathComponent key={key} math={mathContent} display={false} />;
      }

      // Inline LaTeX math: \(...\) or \\(...\\)
      const inlineParenMatch = part.match(/^(?:\\)+\(\s*([\s\S]*?)\s*(?:(?:\\)+(?:quad|qquad|,|;|!|\s|newline)\s*)*(?:\\)+\)$/);
      if (inlineParenMatch) {
        const mathContent = inlineParenMatch[1].trim().replace(/(?:\\+(?:quad|qquad|,|;|!|\s|newline)|\\\\)+$/g, "").trim();
        return <MathComponent key={key} math={mathContent} display={false} />;
      }

      // Display LaTeX math if embedded: $$...$$
      if (part.startsWith("$$") && part.endsWith("$$") && part.length >= 4) {
        const mathContent = part.slice(2, -2).trim();
        return <MathComponent key={key} math={mathContent} display={true} />;
      }

      // Display bracket LaTeX math if embedded inline: \[...\]
      const inlineBracketMatch = part.match(/^(?:\\)+\[\s*([\s\S]*?)\s*(?:(?:\\)+(?:quad|qquad|,|;|!|\s|newline)\s*)*(?:\\)+\]$/);
      if (inlineBracketMatch) {
        const mathContent = inlineBracketMatch[1].trim().replace(/(?:\\+(?:quad|qquad|,|;|!|\s|newline)|\\\\)+$/g, "").trim();
        return <MathComponent key={key} math={mathContent} display={true} />;
      }

      // Bold: **...**
      if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
        return (
          <strong key={key} className="font-bold text-slate-900">
            {renderInline(part.slice(2, -2), `${key}-b`)}
          </strong>
        );
      }

      // Italic: *...*
      if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
        return (
          <em key={key} className="italic text-slate-800">
            {renderInline(part.slice(1, -1), `${key}-i`)}
          </em>
        );
      }

      // Inline code: `...`
      if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
        return (
          <code
            key={key}
            className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-xs text-rose-700 border border-slate-200"
          >
            {part.slice(1, -1)}
          </code>
        );
      }

      return <span key={key}>{part}</span>;
    });
  }

  // Helper function to render text with fine-grained broken fragments highlighted inline
  function renderTextWithFragments(
    text: string,
    prefix: string,
    blockFrags: BrokenFragment[] = []
  ): React.ReactNode {
    if (!blockFrags || blockFrags.length === 0) {
      return renderInline(text, prefix);
    }

    const matchedFrags = blockFrags.filter((f) => f.brokenText && text.includes(f.brokenText));
    if (matchedFrags.length === 0) {
      return renderInline(text, prefix);
    }

    let currentRemaining = text;
    const nodes: React.ReactNode[] = [];
    let partIdx = 0;

    for (const frag of matchedFrags) {
      const idx = currentRemaining.indexOf(frag.brokenText);
      if (idx !== -1) {
        const beforeText = currentRemaining.slice(0, idx);
        if (beforeText) {
          nodes.push(renderInline(beforeText, `${prefix}-pre-${partIdx}`));
        }
        nodes.push(
          <mark
            key={`${prefix}-frag-${frag.id}-${partIdx}`}
            className="bg-rose-100 text-rose-900 border border-rose-400 rounded px-1.5 py-0.5 mx-0.5 inline-flex items-center gap-1 font-mono text-xs select-text shadow-2xs group relative cursor-help"
            title={`Flagged issue: ${frag.reason}`}
          >
            <AlertTriangle className="w-3 h-3 text-rose-600 inline shrink-0" />
            <span className="font-semibold text-rose-900">{frag.brokenText}</span>
            {onRepairFragment && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRepairFragment(frag);
                }}
                disabled={isRepairing}
                className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-sans font-bold cursor-pointer transition-colors shadow-2xs"
                title={`Repair fragment ${frag.id}`}
              >
                Fix
              </button>
            )}
          </mark>
        );
        currentRemaining = currentRemaining.slice(idx + frag.brokenText.length);
        partIdx++;
      }
    }

    if (currentRemaining) {
      nodes.push(renderInline(currentRemaining, `${prefix}-post-${partIdx}`));
    }

    return <>{nodes}</>;
  }

  // Helper function to render a list of lines within a block into structured React elements
  function renderLinesToElements(
    lines: string[],
    blockIdPrefix: string,
    blockFrags: BrokenFragment[] = []
  ): React.ReactNode[] {
    let seq = 0;
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const rawLine = lines[i];
      const trimmed = rawLine.trim();

      if (!trimmed) {
        const blockId = `${blockIdPrefix}-sp-${seq++}`;
        elements.push(<div key={blockId} className="h-2.5" />);
        i++;
        continue;
      }

      const blockId = `${blockIdPrefix}-${seq++}`;

      // Display equation block: $$...$$ (single or multi-line)
      if (trimmed.startsWith("$$")) {
        let mathContent = "";
        if (trimmed.length >= 4 && trimmed.slice(2).includes("$$")) {
          const endIdx = trimmed.slice(2).indexOf("$$");
          mathContent = trimmed.slice(2, 2 + endIdx).trim();
          i++;
        } else {
          const mathLines: string[] = [];
          const first = trimmed.slice(2).trim();
          if (first) mathLines.push(first);
          i++;
          while (i < lines.length) {
            const nextTrimmed = lines[i].trim();
            if (nextTrimmed.includes("$$")) {
              const endIdx = nextTrimmed.indexOf("$$");
              const endPart = nextTrimmed.slice(0, endIdx).trim();
              if (endPart) mathLines.push(endPart);
              i++;
              break;
            }
            // CRITICAL SAFETY GUARD: Never swallow structural markdown into an unclosed equation
            if (/^#{1,6}\s+|^(\*{3,}|-{3,}|_{3,})$|^>\s+|^\|/.test(nextTrimmed)) {
              break;
            }
            mathLines.push(lines[i]);
            i++;
          }
          mathContent = mathLines.join(" ").trim();
        }

        if (mathContent) {
          elements.push(
            <div
              key={blockId}
              className="my-2 py-1.5 px-3 flex flex-col items-center justify-center overflow-x-auto text-slate-900 rounded hover:bg-slate-50/70 transition-colors"
            >
              <MathComponent math={mathContent} display={true} />
            </div>
          );
        }
        continue;
      }

      // Display equation block: \[...\] or \\[...\\] (single or multi-line)
      if (/^(?:\\)+\[/.test(trimmed)) {
        let mathContent = "";
        const closeBracketIndex = trimmed.search(/(?:\\)+\]/);
        if (closeBracketIndex !== -1) {
          const openMatch = trimmed.match(/^(?:\\)+\[\s*/)!;
          const startIdx = openMatch[0].length;
          mathContent = trimmed.slice(startIdx, closeBracketIndex).trim();
          mathContent = mathContent.replace(/(?:\\+(?:quad|qquad|,|;|!|\s|newline)|\\\\)+$/g, "").trim();
          i++;
        } else {
          const mathLines: string[] = [];
          const first = trimmed.replace(/^(?:\\)+\[\s*/, "").trim();
          if (first) mathLines.push(first);
          i++;
          while (i < lines.length) {
            const nextTrimmed = lines[i].trim();
            const nextCloseIdx = nextTrimmed.search(/(?:\\)+\]/);
            if (nextCloseIdx !== -1) {
              const endPart = nextTrimmed.slice(0, nextCloseIdx).trim();
              if (endPart) mathLines.push(endPart);
              i++;
              break;
            }
            // CRITICAL SAFETY GUARD: Never swallow structural markdown into an unclosed equation
            if (/^#{1,6}\s+|^(\*{3,}|-{3,}|_{3,})$|^>\s+|^\|/.test(nextTrimmed)) {
              break;
            }
            mathLines.push(lines[i]);
            i++;
          }
          mathContent = mathLines.join(" ").trim().replace(/(?:\\+(?:quad|qquad|,|;|!|\s|newline)|\\\\)+$/g, "").trim();
        }

        if (mathContent) {
          elements.push(
            <div
              key={blockId}
              className="my-2 py-1.5 px-3 flex flex-col items-center justify-center overflow-x-auto text-slate-900 rounded hover:bg-slate-50/70 transition-colors"
            >
              <MathComponent math={mathContent} display={true} />
            </div>
          );
        }
        continue;
      }

      // Unwrapped equation block starting with math commands (e.g. \frac{...} or \sqrt{...})
      if (
        (trimmed.startsWith("\\frac") ||
          trimmed.startsWith("\\sqrt") ||
          trimmed.startsWith("\\sum") ||
          trimmed.startsWith("\\int")) &&
        !trimmed.startsWith("$")
      ) {
        elements.push(
          <div
            key={blockId}
            className="my-2 py-1.5 px-3 flex flex-col items-center justify-center overflow-x-auto text-slate-900 rounded hover:bg-slate-50/70 transition-colors"
          >
            <MathComponent math={trimmed} display={true} />
          </div>
        );
        i++;
        continue;
      }

      // Heading 1 (# ...)
      if (trimmed.startsWith("# ")) {
        elements.push(
          <h1
            key={blockId}
            className="text-2xl font-bold tracking-tight mt-6 mb-3 pb-1 border-b border-slate-200"
            style={{
              color: accentColor,
              fontFamily: getCssFontFamily(fontFamily),
            }}
          >
            {renderInline(trimmed.slice(2), `${blockId}-inl`)}
          </h1>
        );
        i++;
        continue;
      }

      // Heading 2 (## ...)
      if (trimmed.startsWith("## ")) {
        elements.push(
          <h2
            key={blockId}
            className="text-lg font-bold tracking-tight mt-5 mb-2"
            style={{
              color: accentColor === "#1A365D" ? "#2B6CB0" : accentColor,
              fontFamily: getCssFontFamily(fontFamily),
            }}
          >
            {renderInline(trimmed.slice(3), `${blockId}-inl`)}
          </h2>
        );
        i++;
        continue;
      }

      // Heading 3 (### ...)
      if (trimmed.startsWith("### ")) {
        elements.push(
          <h3
            key={blockId}
            className="text-sm font-bold text-slate-800 mt-4 mb-1.5 flex items-center gap-1.5"
            style={{ fontFamily: getCssFontFamily(fontFamily) }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
              style={{ backgroundColor: accentColor }}
            />
            {renderInline(trimmed.slice(4), `${blockId}-inl`)}
          </h3>
        );
        i++;
        continue;
      }

      // Heading 4 (#### ...)
      if (trimmed.startsWith("#### ")) {
        elements.push(
          <h4
            key={blockId}
            className="text-xs font-bold uppercase tracking-wider text-slate-700 mt-3.5 mb-1.5 flex items-center gap-1.5"
            style={{ fontFamily: getCssFontFamily(fontFamily) }}
          >
            <span
              className="w-1 h-1 rounded-full inline-block shrink-0 bg-slate-400"
            />
            {renderInline(trimmed.slice(5), `${blockId}-inl`)}
          </h4>
        );
        i++;
        continue;
      }

      // Heading 5 (##### ...)
      if (trimmed.startsWith("##### ")) {
        elements.push(
          <h5
            key={blockId}
            className="text-xs font-semibold text-slate-600 mt-3 mb-1"
            style={{ fontFamily: getCssFontFamily(fontFamily) }}
          >
            {renderInline(trimmed.slice(6), `${blockId}-inl`)}
          </h5>
        );
        i++;
        continue;
      }

      // Heading 6 (###### ...)
      if (trimmed.startsWith("###### ")) {
        elements.push(
          <h6
            key={blockId}
            className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mt-2.5 mb-1"
            style={{ fontFamily: getCssFontFamily(fontFamily) }}
          >
            {renderInline(trimmed.slice(7), `${blockId}-inl`)}
          </h6>
        );
        i++;
        continue;
      }

      // Horizontal divider (--- or ***)
      if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
        elements.push(
          <hr key={blockId} className="my-5 border-t border-slate-300" />
        );
        i++;
        continue;
      }

      // 4-digit Year Header (e.g. 2019, 2025)
      if (/^\d{4}$/.test(trimmed)) {
        elements.push(
          <h2
            key={blockId}
            className="text-xl font-bold tracking-tight mt-6 mb-1"
            style={{
              color: accentColor,
              fontFamily: getCssFontFamily(fontFamily),
            }}
          >
            {trimmed}
          </h2>
        );
        i++;
        continue;
      }

      // Exam Title (e.g. Final Examination, Midterm Examination)
      if (/^(?:\*{0,2})(?:Final|Midterm|Mid-Semester)\s+Examination(?:\*{0,2})$/i.test(trimmed)) {
        const cleanExam = trimmed.replace(/^\*+|\*+$/g, '').trim();
        elements.push(
          <div
            key={blockId}
            className="text-sm font-semibold italic text-slate-600 mb-3"
            style={{ fontFamily: getCssFontFamily(fontFamily) }}
          >
            {cleanExam}
          </div>
        );
        i++;
        continue;
      }

      // Section Header (e.g. Section A: Descriptive Statistics... or **Section A:**)
      if (/^(?:#{1,3}\s*)?(?:\*{0,2})Section\s+([A-Z]):?\s*(.*?)(?:\*{0,2})$/i.test(trimmed)) {
        const match = trimmed.match(/^(?:#{1,3}\s*)?(?:\*{0,2})Section\s+([A-Z]):?\s*(.*?)(?:\*{0,2})$/i)!;
        const sectionLetter = match[1].toUpperCase();
        const sectionDesc = match[2].trim().replace(/^[:\s-]+/, '').replace(/^\*+|\*+$/g, '');
        const fullSectionTitle = `Section ${sectionLetter}:${sectionDesc ? " " + sectionDesc : ""}`;

        elements.push(
          <h3
            key={blockId}
            className="text-base font-bold text-slate-900 mt-6 mb-2 pb-1 border-b border-slate-200 flex items-center gap-2"
            style={{
              color: accentColor,
              fontFamily: getCssFontFamily(fontFamily),
            }}
          >
            {renderInline(fullSectionTitle, `${blockId}-inl`)}
          </h3>
        );
        i++;
        continue;
      }

      // Topic Header (e.g. Topic 1: ... or #### Topic 1: ...)
      if (/^(?:#{2,4}\s*)?(?:\*{0,2})(Topic\s+\d+:?\s*.*?)(?:\*{0,2})$/i.test(trimmed)) {
        const topicText = trimmed.replace(/^#{2,4}\s*/, '').replace(/^\*+|\*+$/g, '').trim();
        elements.push(
          <h4
            key={blockId}
            className="text-sm font-bold text-slate-800 mt-4 mb-2 flex items-center gap-1.5"
            style={{ fontFamily: getCssFontFamily(fontFamily) }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
              style={{ backgroundColor: accentColor }}
            />
            {renderInline(topicText, `${blockId}-inl`)}
          </h4>
        );
        i++;
        continue;
      }

      // Pure Data Array: Centered comma-separated sequence of numbers
      if (/^(\s*\d+(?:\.\d+)?(?:,\s*|\s+)){3,}\d+(?:\.\d+)?(?:,\s*)?$/.test(trimmed)) {
        const tokens = trimmed.replace(/,/g, ' ').trim().split(/\s+/);
        const formattedData = tokens.join(', ') + (i + 1 < lines.length && /^(\s*\d+(?:\.\d+)?(?:,\s*|\s+)){3,}/.test(lines[i + 1].trim()) ? ',' : '');
        elements.push(
          <div
            key={blockId}
            className="my-1.5 text-center font-mono text-xs text-slate-700 tracking-wide select-text py-0.5"
          >
            {formattedData}
          </div>
        );
        i++;
        continue;
      }

      // Sub-questions & Lettered list items: e.g. a. Arithmetic mean... or i. E(y)... or (i) Draw...
      const subMatch = trimmed.match(/^\s*(?:[-*•o]\s+)?(?:\*{0,2})([a-z]\.|\([a-z]\)|[a-z]\)|\(i{1,3}\)|[i-v]+\.|\([0-9]+\))\s*(.*)$/i);
      if (subMatch) {
        const prefix = subMatch[1].replace(/^\(/, '').replace(/\)$/, '.');
        const subContent = subMatch[2].replace(/^\*+|\*+$/g, '').trim();

        elements.push(
          <div
            key={blockId}
            className="flex items-start gap-2.5 text-sm text-slate-800 my-1.5 ml-6 leading-relaxed"
          >
            <span className="font-bold text-slate-900 shrink-0 select-none min-w-[20px]">
              {prefix}
            </span>
            <div className="flex-1">{renderTextWithFragments(subContent, `${blockId}-inl`, blockFrags)}</div>
          </div>
        );
        i++;
        continue;
      }

      // Metadata and Side notes (Frequency: ..., Side note: ..., Note: ...)
      const metaMatch = trimmed.match(/^(?:\s*[-*•o]\s+)?(?:\*{0,2})(\(?Side note:|\(?Note:|Frequency:)\s*(.*?)(?:\*{0,2})$/i);
      if (metaMatch) {
        const label = metaMatch[1];
        const noteContent = metaMatch[2].replace(/^\*+|\*+$/g, '').trim();
        const isSideNote = /side note|note/i.test(label);

        elements.push(
          <div
            key={blockId}
            className={`my-1 ml-6 text-xs text-slate-500 leading-normal ${
              isSideNote ? 'italic' : ''
            }`}
          >
            <span className={isSideNote ? 'italic text-slate-500' : 'font-semibold text-slate-600'}>
              {label}{' '}
            </span>
            <span>{renderTextWithFragments(noteContent, `${blockId}-inl`, blockFrags)}</span>
          </div>
        );
        i++;
        continue;
      }

      // Markdown Table detection: | col1 | col2 |
      if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
        const tableRows: string[][] = [];

        while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
          const rowText = lines[i].trim();
          // Skip separator row: |---|---|
          if (/^\|[-:\s|]+\|$/.test(rowText)) {
            i++;
            continue;
          }
          const cells = rowText
            .slice(1, -1)
            .split("|")
            .map((c) => c.trim());
          tableRows.push(cells);
          i++;
        }

        if (tableRows.length > 0) {
          elements.push(
            <div key={blockId} className="my-3 overflow-x-auto rounded-md border border-slate-300 shadow-2xs">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-slate-900 font-bold">
                    {tableRows[0].map((h, cIdx) => {
                      const isNumeric = /^[\d.,\s/%+-]+$/.test(h) || /^(?:Variable|Income|Expenditure|Speed|GPA|Hour|ID|Year|x\d*|y\d*|Height|Weight|Age)$/i.test(h);
                      return (
                        <th
                          key={`${blockId}-th-${cIdx}`}
                          className={`px-3 py-2 border-r border-slate-300 last:border-r-0 ${
                            isNumeric ? 'text-center' : 'text-left'
                          }`}
                        >
                          {renderInline(h, `${blockId}-th-${cIdx}`)}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.slice(1).map((row, rIdx) => (
                    <tr
                      key={`${blockId}-row-${rIdx}`}
                      className={`border-b border-slate-200 last:border-b-0 ${
                        rIdx % 2 === 1 ? "bg-slate-50/70" : "bg-white"
                      }`}
                    >
                      {row.map((cell, cIdx) => {
                        const isNumeric = /^[\d.,\s/%+-]+$/.test(cell) || /^(?:Variable|Income|Expenditure|Speed|GPA|Hour|ID|Year|x\d*|y\d*|Height|Weight|Age)$/i.test(cell);
                        return (
                          <td
                            key={`${blockId}-cell-${rIdx}-${cIdx}`}
                            className={`px-3 py-2 border-r border-slate-200 last:border-r-0 text-slate-700 ${
                              isNumeric ? 'text-center font-mono text-[11px]' : 'text-left'
                            }`}
                          >
                            {renderInline(cell, `${blockId}-c-${rIdx}-${cIdx}`)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          continue;
        }
      }

      // Blockquote or formula callout
      if (trimmed.startsWith("> ")) {
        elements.push(
          <blockquote
            key={blockId}
            className="my-3 p-3.5 bg-blue-50/50 border-l-4 rounded-r-lg text-sm text-slate-800 font-medium shadow-2xs leading-relaxed"
            style={{ borderColor: accentColor }}
          >
            {renderTextWithFragments(trimmed.slice(2), `${blockId}-inl`, blockFrags)}
          </blockquote>
        );
        i++;
        continue;
      }

      // Bullet list item (supports -, *, •, and open circle o)
      if (/^\s*(?:[-*•⁃◦▪▫–—]|\bo\b)\s+/.test(rawLine) || /^\s*o\s{1,}/.test(rawLine)) {
        const indent = rawLine.match(/^(\s*)/)![0].length;
        const isNested = indent >= 2 || /^\s{2,}/.test(rawLine);
        const marginClass = indent >= 6 ? "ml-12" : indent >= 4 ? "ml-8" : isNested ? "ml-6" : "ml-3";
        const strippedBullet = trimmed.replace(/^(?:[-*•⁃◦▪▫–—]|o)\s+/, "");

        elements.push(
          <div
            key={blockId}
            className={`flex items-start gap-2.5 text-sm text-slate-800 my-1.5 ${marginClass} leading-relaxed`}
          >
            <span className="text-slate-400 mt-1 select-none text-xs leading-none">○</span>
            <div className="flex-1">{renderTextWithFragments(strippedBullet, `${blockId}-inl`, blockFrags)}</div>
          </div>
        );
        i++;
        continue;
      }

      // Numbered list item (Main Questions: 1. , 2. , 3. )
      if (/^\s*\d+[\.\)]\s+/.test(trimmed)) {
        const match = trimmed.match(/^(\d+[\.\)])\s*(.*)$/)!;
        elements.push(
          <div
            key={blockId}
            className="flex items-start gap-2.5 text-sm text-slate-900 my-2.5 ml-1 leading-relaxed"
          >
            <span className="font-bold text-sm select-none" style={{ color: accentColor }}>
              {match[1]}
            </span>
            <div className="flex-1 font-normal">{renderTextWithFragments(match[2].trim(), `${blockId}-inl`, blockFrags)}</div>
          </div>
        );
        i++;
        continue;
      }

      // Fenced Code block (pure native rendering, no artificial CSS virtualization)
      if (trimmed.startsWith("```")) {
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith("```")) {
          codeLines.push(lines[i]);
          i++;
        }
        if (i < lines.length && lines[i].trim().startsWith("```")) {
          i++;
        }
        elements.push(
          <pre
            key={blockId}
            className="my-3 p-3.5 bg-slate-900 text-slate-100 rounded-lg font-mono text-xs overflow-x-auto select-text shadow-2xs leading-relaxed"
          >
            <code>{codeLines.join("\n")}</code>
          </pre>
        );
        continue;
      }

      // Standard paragraph: 100% physically rendered without CSS contentVisibility
      // This ensures 100+ paragraphs are fully visible, printable, selectable, and measurable
      elements.push(
        <p
          key={blockId}
          className="text-sm text-slate-800 my-2 leading-relaxed"
        >
          {renderTextWithFragments(trimmed, `${blockId}-p`, blockFrags)}
        </p>
      );
      i++;
    }

    return elements;
  }

  // Parse document into atomic blocks with deterministic stable IDs
  // Ref cache for expensive block rendering (math parsing, KaTeX, tables)
  const blockRenderCacheRef = useRef<Map<string, React.ReactNode>>(new Map());

  // Expensive document block parsing memoized strictly by markdown string
  const blocks = useMemo(() => {
    if (!markdown || !markdown.trim()) return [];
    return parseDocumentBlocks(markdown);
  }, [markdown]);

  // Parse document into atomic blocks with deterministic stable IDs
  // Blocks with formatting/KaTeX issues have fine-grained fragments highlighted inline
  const renderedElements = useMemo(() => {
    if (!blocks || blocks.length === 0) return [];

    const elements: React.ReactNode[] = [];

    // Keep cache size bounded
    if (blockRenderCacheRef.current.size > 300) {
      blockRenderCacheRef.current.clear();
    }

    blocks.forEach((block) => {
      const isFailed = failedBlockIds.includes(block.id);
      const issue = isFailed ? blockIssuesMap?.[block.id] : null;
      const blockFrags = blockFragmentsMap?.[block.id] || issue?.fragments || [];

      const cacheKey = `${block.id}:${block.rawText}:${isFailed}:${blockFrags.length}:${fontFamily}:${accentColor}:${equationFormat}`;
      let blockContent = blockRenderCacheRef.current.get(cacheKey);
      if (!blockContent) {
        const blockLines = block.rawText.split("\n");
        blockContent = renderLinesToElements(blockLines, block.id, blockFrags);
        blockRenderCacheRef.current.set(cacheKey, blockContent);
      }

      elements.push(
        <div
          key={block.id}
          id={`block-${block.id}`}
          data-block-id={block.id}
          data-flagged={isFailed ? "true" : undefined}
          className="my-1 relative"
        >
          {/* Subtle compact badge if block has flagged fragments */}
          {isFailed && (
            <div className="flex items-center justify-between text-xs text-rose-800 py-1 px-2.5 mb-1.5 bg-rose-50/70 rounded-lg border border-rose-200">
              <div className="flex items-center gap-1.5 font-semibold text-[11px] flex-wrap">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>Flagged: {issue?.reason || "Formatting or LaTeX syntax error"}</span>
                <span className="font-mono text-[9px] text-rose-700 bg-rose-100 px-1 py-0.5 rounded border border-rose-300 font-semibold">
                  {block.id}
                </span>
                {blockFrags.length > 0 && (
                  <span className="text-[10px] text-rose-600 bg-white/80 px-1.5 py-0.5 rounded font-mono border border-rose-200">
                    {blockFrags.length} fragment{blockFrags.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              {onRepairSingleBlock && (
                <button
                  type="button"
                  onClick={() => onRepairSingleBlock(block.id)}
                  disabled={isRepairing}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 cursor-pointer shadow-2xs transition-colors shrink-0"
                  title={`Repair flagged fragments in block ${block.id}`}
                >
                  <Wrench className="w-3 h-3" />
                  <span>Fix block</span>
                </button>
              )}
            </div>
          )}

          {/* Block Body Content with exact broken fragments highlighted inline */}
          <div className="text-slate-900 overflow-x-auto">
            {blockContent}
          </div>
        </div>
      );
    });

    return elements;
  }, [markdown, fontFamily, accentColor, equationFormat, failedBlockIds, blockIssuesMap, blockFragmentsMap, fragments, isRepairing, onRepairSingleBlock, onRepairFragment]);

  const wordCount = markdown.trim().split(/\s+/).filter(Boolean).length;
  const mathFormulaCount = (markdown.match(/\$[^$]+\$/g) || []).length;
  // Estimate page count for document simulation (roughly 350-400 words per page in 11pt)
  const estimatedPages = Math.max(1, Math.ceil(wordCount / 380));

  return (
    <div className="border border-slate-300 rounded-xl bg-white shadow-xs overflow-hidden flex flex-col h-full transition-all">
      {/* Top Seamless Toolbar - Single line max 44px, no overflow-x */}
      <div className="h-10 px-2 sm:px-3 bg-slate-100 border-b border-slate-300 flex items-center justify-between gap-1 sm:gap-2 shrink-0 flex-nowrap min-w-0 select-none overflow-hidden">
        {/* Left: Preview Title + ONE status badge */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink">
          <div className="flex items-center gap-1 sm:gap-1.5 text-slate-900 font-bold text-xs uppercase tracking-wider shrink-0">
            <BookOpen className="w-3.5 h-3.5 text-slate-800" />
            <span className="hidden min-[380px]:inline">Preview</span>
          </div>

          {/* Single Sync status indicator badge */}
          {isAiPolished ? (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold shrink truncate border border-emerald-300">
              <Check className="w-3 h-3 text-emerald-600 shrink-0" />
              <span className="truncate hidden min-[480px]:inline">FormatAI Result</span>
              <span className="min-[480px]:hidden text-[10px]">Ready</span>
            </span>
          ) : validationAlert?.failed ? (
            <span
              className="inline-flex items-center gap-1 text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold shrink truncate border border-amber-300"
              title="AI Polish output failed validation and was discarded; FormatAI Result active"
            >
              <ShieldAlert className="w-3 h-3 text-amber-700 shrink-0" />
              <span className="truncate hidden min-[480px]:inline">AI Discarded</span>
              <span className="min-[480px]:hidden text-[10px]">Discarded</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 font-bold shrink truncate border border-slate-300">
              <Sparkles className="w-3 h-3 text-slate-700 shrink-0" />
              <span className="truncate hidden min-[480px]:inline">FormatAI Result</span>
              <span className="min-[480px]:hidden text-[10px]">FormatAI</span>
            </span>
          )}
        </div>

        {/* Right: view toggles + copy + zoom controls + panel maximize toggle */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-auto flex-nowrap">
          {/* View Mode Toggle: Document Sheet vs LaTeX Code vs Polish Diff */}
          <div className="flex items-center bg-slate-200 border border-slate-300 p-0.5 rounded-lg shadow-2xs shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("rendered")}
              className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
                viewMode === "rendered"
                  ? "bg-white text-slate-950 shadow-2xs font-extrabold"
                  : "text-slate-700 hover:text-slate-950 font-medium"
              }`}
              title="Formatted Document Sheet View"
            >
              <Eye className="w-3.5 h-3.5 shrink-0" style={{ color: viewMode === "rendered" ? accentColor : undefined }} />
              <span className="text-[11px] sm:text-xs">Doc</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("source")}
              className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
                viewMode === "source"
                  ? "bg-white text-slate-950 shadow-2xs font-extrabold"
                  : "text-slate-700 hover:text-slate-950 font-medium"
              }`}
              title="Raw LaTeX / Markdown Source View"
            >
              <Code className="w-3.5 h-3.5 text-slate-700 shrink-0" />
              <span className="text-[11px] sm:text-xs">TeX</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("diff")}
              className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
                viewMode === "diff"
                  ? "bg-white text-slate-950 shadow-2xs font-extrabold"
                  : "text-slate-700 hover:text-slate-950 font-medium"
              }`}
              title="Compare text before and after AI Polish"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: viewMode === "diff" ? accentColor : undefined }} />
              <span className="text-[11px] sm:text-xs">Diff</span>
            </button>
          </div>

          {/* Fix Flagged Only Button (Dedicated Targeted Repair) */}
          {failedBlockIds.length > 0 && onRepairAllFlagged && (
            <button
              type="button"
              id="btn-fix-flagged-preview"
              onClick={onRepairAllFlagged}
              disabled={isRepairing}
              className="inline-flex items-center gap-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 px-2 py-1 rounded-lg shadow-2xs transition-all cursor-pointer shrink-0"
              title="Fix flagged blocks"
            >
              {isRepairing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Wrench className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Fix ({failedBlockIds.length})</span>
            </button>
          )}

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer active:bg-slate-200 shrink-0"
            title="Copy formatted markdown"
            aria-label="Copy"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            )}
            <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
          </button>

          {/* Zoom controls with tap-percentage-to-reset (hidden on narrow mobile <380px for cleaner fit) */}
          <div className="hidden min-[380px]:flex items-center bg-white border border-slate-200 rounded-lg p-0.5 text-xs text-slate-700 shadow-2xs shrink-0">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(75, z - 10))}
              className="p-1 hover:text-slate-950 hover:bg-slate-100 rounded disabled:opacity-40 transition-colors cursor-pointer"
              disabled={zoomLevel <= 75}
              title="Zoom out (75% min)"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(100)}
              className="px-1 text-[11px] font-mono font-bold select-none hover:text-slate-950 hover:bg-slate-100 rounded cursor-pointer transition-colors"
              title="Click to reset zoom to 100%"
              aria-label="Reset zoom to 100%"
            >
              {zoomLevel}%
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
              className="p-1 hover:text-slate-950 hover:bg-slate-100 rounded disabled:opacity-40 transition-colors cursor-pointer"
              disabled={zoomLevel >= 130}
              title="Zoom in (130% max)"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Panel Maximize/Restore Toggle in Split View */}
          {onToggleMaximize && (
            <button
              type="button"
              onClick={onToggleMaximize}
              className="hidden sm:inline-flex items-center justify-center p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 shadow-2xs transition-colors cursor-pointer shrink-0"
              title={isMaximized ? "Restore split view" : "Maximize preview panel"}
              aria-label={isMaximized ? "Restore split view" : "Maximize preview panel"}
            >
              {isMaximized ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Subtle Document Reading Scroll Progress Bar */}
      <div
        onClick={handleProgressBarClick}
        role="progressbar"
        aria-label="Document scroll progress"
        aria-valuenow={Math.round(scrollProgress)}
        aria-valuemin={0}
        aria-valuemax={100}
        title={
          scrollProgress > 0
            ? `Scrolled: ${Math.round(scrollProgress)}% • Click anywhere to jump`
            : "Document top • 0% scrolled"
        }
        className="group relative w-full h-[3px] hover:h-[5px] bg-slate-200 overflow-hidden shrink-0 transition-all duration-150 cursor-pointer no-print select-none z-10"
      >
        <div
          className="h-full transition-[width] duration-150 ease-out rounded-r-full"
          style={{
            width: `${scrollProgress}%`,
            backgroundColor: accentColor || "#881337",
            boxShadow: scrollProgress > 0 ? `0 0 6px ${accentColor || "#881337"}66` : undefined,
          }}
        />
        {/* Subtle hover tooltip showing percentage */}
        <div className="pointer-events-none absolute right-2 -bottom-6 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-30 bg-slate-900 text-white text-[10px] font-mono px-1.5 py-0.5 rounded shadow-xs">
          {Math.round(scrollProgress)}% read
        </div>
      </div>

      {/* Main Preview Container */}
      {viewMode === "diff" ? (
        <div className="p-2 sm:p-4 bg-slate-100 overflow-y-auto flex-1 flex flex-col items-center">
          <div className="w-full max-w-[890px]">
            <TextDiffViewer
              originalText={diffData?.originalText || markdown}
              polishedText={diffData?.polishedText || markdown}
              onApplyChanges={onApplyDiffChanges || (() => setViewMode("rendered"))}
              onKeepOriginal={onDiscardDiffChanges || (() => setViewMode("rendered"))}
              onClose={() => setViewMode("rendered")}
              providerName={diffData?.providerName || "AI Polish"}
              modelName={diffData?.modelName}
            />
          </div>
        </div>
      ) : viewMode === "rendered" ? (
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="p-2 sm:p-5 md:p-8 bg-slate-100 overflow-y-auto flex-1 flex flex-col items-center"
        >
          {/* Validation Failure Warning Banner */}
          {validationAlert?.failed && (
            <div className="w-full max-w-[816px] mb-3 bg-amber-50 border-2 border-amber-300 rounded-xl p-3 text-xs text-amber-950 shadow-xs animate-fadeIn">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-amber-950 text-xs">AI Output ❌ Validation FAILED</span>
                      <span className="text-[10px] bg-rose-100 text-rose-800 font-extrabold px-1.5 py-0.2 rounded border border-rose-300 uppercase">
                        Discarded AI Output
                      </span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.2 rounded border border-emerald-300">
                        FormatAI Result Restored
                      </span>
                      <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-1.5 py-0.2 rounded border border-slate-300">
                        Preview Unchanged
                      </span>
                    </div>
                    <p className="text-slate-700 text-[11px] leading-relaxed">
                      The AI Polish output failed strict academic validation ({validationAlert.reason}).
                      The invalid AI output was discarded, the reliable <strong>FormatAI Result</strong> is restored, and the preview remains completely unchanged.
                    </p>
                    {validationAlert.errors?.length > 0 && (
                      <div className="mt-1">
                        <span className="text-[10px] font-bold text-amber-900">Validation issues detected:</span>
                        <ul className="list-disc list-inside text-[10px] font-mono text-rose-800 bg-white/90 p-1.5 mt-0.5 rounded border border-amber-200 space-y-0.5">
                          {validationAlert.errors.slice(0, 3).map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                          {validationAlert.errors.length > 3 && (
                            <li>...and {validationAlert.errors.length - 3} more issues</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
                {onDismissValidationAlert && (
                  <button
                    onClick={onDismissValidationAlert}
                    className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer shrink-0"
                    title="Dismiss alert"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Flagged Blocks Warning & Targeted Repair Banner */}
          {failedBlockIds.length > 0 && (
            <div className="w-full max-w-[816px] mb-3 bg-rose-50/95 border-2 border-rose-400 rounded-xl p-3.5 text-xs text-rose-950 shadow-xs animate-fadeIn flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-rose-950 text-xs">
                      {failedBlockIds.length} Block{failedBlockIds.length === 1 ? "" : "s"} Flagged with Issues
                    </span>
                    <span className="text-[10px] bg-rose-200 text-rose-900 font-extrabold px-1.5 py-0.2 rounded border border-rose-300 uppercase">
                      Needs Repair
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded border border-emerald-300">
                      Other Blocks Intact
                    </span>
                  </div>
                  <p className="text-slate-700 text-[11px] leading-relaxed mt-0.5">
                    Highlighted in red below with KaTeX/syntax issue details. Click <strong>"Fix flagged only"</strong> to repair these blocks without re-sending or modifying any intact blocks.
                  </p>
                </div>
              </div>
              {onRepairAllFlagged && (
                <button
                  type="button"
                  id="btn-fix-flagged-banner"
                  onClick={onRepairAllFlagged}
                  disabled={isRepairing}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-black text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 shadow-2xs cursor-pointer transition-all shrink-0 whitespace-nowrap"
                >
                  {isRepairing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Fixing {repairProgress ? `${repairProgress.current}/${repairProgress.total}` : "..."}</span>
                    </>
                  ) : (
                    <>
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Fix flagged only</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Simulated Office Word Paper Sheet */}
          <div
            id="academic-document-sheet"
            data-testid="preview-document-sheet"
            className="academic-paper-sheet w-full max-w-[816px] bg-white rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-300/80 px-3.5 py-4 sm:p-8 md:p-12 text-slate-800 relative transition-transform duration-150 origin-top break-words"
            style={{
              fontFamily: getCssFontFamily(fontFamily),
              zoom: zoomLevel !== 100 ? `${zoomLevel}%` : undefined,
            }}
          >
            {/* Word Document Running Header */}
            <div className="pb-3 sm:pb-4 mb-4 sm:mb-6 border-b border-slate-200 flex items-center justify-between text-[11px] sm:text-xs text-slate-400 select-none gap-2">
              <span className="font-serif italic text-slate-500 truncate max-w-[200px] sm:max-w-sm">
                {docTitle || "Academic Notes"}
              </span>
              <span className="text-[10px] sm:text-[11px] font-sans tracking-wide uppercase text-slate-400 shrink-0">
                Word Document • {fontFamily}
              </span>
            </div>

            {/* Document Content */}
            <div className="space-y-1 select-text leading-relaxed">
              {renderedElements.length > 0 ? (
                renderedElements
              ) : (
                <div className="text-center py-12 text-slate-400 italic">
                  No notes to display. Paste content on the left to preview instantly.
                </div>
              )}
            </div>

            {/* Word Document Running Footer */}
            <div className="pt-4 sm:pt-6 mt-8 sm:mt-10 border-t border-slate-200 flex items-center justify-between text-[10px] sm:text-[11px] text-slate-400 select-none gap-2">
              <span className="truncate">Standard Academic Typesetting (Times New Roman / OMML)</span>
              <span className="shrink-0">Page 1 of {estimatedPages}</span>
            </div>
          </div>
        </div>
      ) : (
        /* Source LaTeX / Markdown View */
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="p-3 sm:p-4 bg-slate-900 text-slate-100 font-mono text-xs overflow-y-auto flex-1 leading-relaxed select-text overscroll-contain"
        >
          <pre className="whitespace-pre-wrap break-words max-w-full font-mono">{markdown}</pre>
        </div>
      )}

      {/* Footer Info Ribbon */}
      <div className="h-8 px-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-1.5 text-slate-500 text-xs font-normal truncate">
          <span>{fontFamily}</span>
          <span className="text-slate-300">·</span>
          <span>{wordCount.toLocaleString()} words</span>
          <span className="text-slate-300">·</span>
          <span>{mathFormulaCount} formulas</span>
        </div>
        <div className="text-[11px] text-slate-500 hidden sm:flex items-center gap-1 shrink-0">
          <Sparkles className="w-3 h-3 text-amber-600" />
          <span>Office OMML Equations</span>
        </div>
      </div>
    </div>
  );
});
