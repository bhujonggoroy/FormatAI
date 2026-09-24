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
  RefreshCw,
  FileText,
  Printer,
  Download,
  Layers,
  ChevronRight,
  ShieldAlert,
  AlertTriangle,
  X,
} from "lucide-react";
import katex from "katex";
import { downloadPreviewAsPdf, generateDocumentPdf } from "../utils/pdfGenerator";

export interface ValidationAlertState {
  failed: boolean;
  reason: string;
  errors: string[];
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

export const FormattedPreview: React.FC<FormattedPreviewProps> = ({
  markdown,
  docTitle,
  fontFamily = "Times New Roman",
  accentColor = "#1A365D",
  equationFormat = "native",
  isAiPolished = false,
  validationAlert = null,
  onDismissValidationAlert,
  onTriggerAiPolish,
  isAiPolishing = false,
  onDownloadDocx,
  onDownloadPdf,
  isDownloading,
}) => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"rendered" | "source">("rendered");
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
        return `<span class="text-rose-700 font-mono text-xs">${cleanMath}</span>`;
      }
    }, [cleanMath, display]);

    return (
      <span
        className={
          display
            ? "block my-2 overflow-x-auto text-center"
            : "inline-block px-1 align-baseline"
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

  // Parse lines into structured elements with useMemo to prevent re-parsing on scroll/zoom
  const renderedElements = useMemo(() => {
    let seq = 0;
    const lines = markdown.split("\n");
    const renderedElements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const rawLine = lines[i];
      const trimmed = rawLine.trim();

      if (!trimmed) {
        renderedElements.push(<div key={`sp-${seq++}-${i}`} className="h-2.5" />);
        i++;
        continue;
      }

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
        renderedElements.push(
          <div
            key={`eq-${i}`}
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
      // Check if closing bracket is on this same line:
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
        renderedElements.push(
          <div
            key={`eq-bracket-${i}`}
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
      renderedElements.push(
        <div
          key={`eq-auto-${i}`}
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
      renderedElements.push(
        <h1
          key={`h1-${i}`}
          className="text-2xl font-bold tracking-tight mt-6 mb-3 pb-1 border-b border-slate-200"
          style={{
            color: accentColor,
            fontFamily: getCssFontFamily(fontFamily),
          }}
        >
          {renderInline(trimmed.slice(2))}
        </h1>
      );
      i++;
      continue;
    }

    // Heading 2 (## ...)
    if (trimmed.startsWith("## ")) {
      renderedElements.push(
        <h2
          key={`h2-${i}`}
          className="text-lg font-bold tracking-tight mt-5 mb-2"
          style={{
            color: accentColor === "#1A365D" ? "#2B6CB0" : accentColor,
            fontFamily: getCssFontFamily(fontFamily),
          }}
        >
          {renderInline(trimmed.slice(3))}
        </h2>
      );
      i++;
      continue;
    }

    // Heading 3 (### ...)
    if (trimmed.startsWith("### ")) {
      renderedElements.push(
        <h3
          key={`h3-${i}`}
          className="text-sm font-bold text-slate-800 mt-4 mb-1.5 flex items-center gap-1.5"
          style={{ fontFamily: getCssFontFamily(fontFamily) }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
            style={{ backgroundColor: accentColor }}
          />
          {renderInline(trimmed.slice(4))}
        </h3>
      );
      i++;
      continue;
    }

    // Heading 4 (#### ...)
    if (trimmed.startsWith("#### ")) {
      renderedElements.push(
        <h4
          key={`h4-${i}`}
          className="text-xs font-bold uppercase tracking-wider text-slate-700 mt-3.5 mb-1.5 flex items-center gap-1.5"
          style={{ fontFamily: getCssFontFamily(fontFamily) }}
        >
          <span
            className="w-1 h-1 rounded-full inline-block shrink-0 bg-slate-400"
          />
          {renderInline(trimmed.slice(5))}
        </h4>
      );
      i++;
      continue;
    }

    // Heading 5 (##### ...)
    if (trimmed.startsWith("##### ")) {
      renderedElements.push(
        <h5
          key={`h5-${i}`}
          className="text-xs font-semibold text-slate-600 mt-3 mb-1"
          style={{ fontFamily: getCssFontFamily(fontFamily) }}
        >
          {renderInline(trimmed.slice(6))}
        </h5>
      );
      i++;
      continue;
    }

    // Heading 6 (###### ...)
    if (trimmed.startsWith("###### ")) {
      renderedElements.push(
        <h6
          key={`h6-${i}`}
          className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mt-2.5 mb-1"
          style={{ fontFamily: getCssFontFamily(fontFamily) }}
        >
          {renderInline(trimmed.slice(7))}
        </h6>
      );
      i++;
      continue;
    }

    // Horizontal divider (--- or ***)
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
      renderedElements.push(
        <hr key={`hr-${i}`} className="my-5 border-t border-slate-300" />
      );
      i++;
      continue;
    }

    // 4-digit Year Header (e.g. 2019, 2025)
    if (/^\d{4}$/.test(trimmed)) {
      renderedElements.push(
        <h2
          key={`year-${i}`}
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
      renderedElements.push(
        <div
          key={`exam-${i}`}
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

      renderedElements.push(
        <h3
          key={`section-${i}`}
          className="text-base font-bold text-slate-900 mt-6 mb-2 pb-1 border-b border-slate-200 flex items-center gap-2"
          style={{
            color: accentColor,
            fontFamily: getCssFontFamily(fontFamily),
          }}
        >
          {renderInline(fullSectionTitle)}
        </h3>
      );
      i++;
      continue;
    }

    // Topic Header (e.g. Topic 1: ... or #### Topic 1: ...)
    if (/^(?:#{2,4}\s*)?(?:\*{0,2})(Topic\s+\d+:?\s*.*?)(?:\*{0,2})$/i.test(trimmed)) {
      const topicText = trimmed.replace(/^#{2,4}\s*/, '').replace(/^\*+|\*+$/g, '').trim();
      renderedElements.push(
        <h4
          key={`topic-${i}`}
          className="text-sm font-bold text-slate-800 mt-4 mb-2 flex items-center gap-1.5"
          style={{ fontFamily: getCssFontFamily(fontFamily) }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
            style={{ backgroundColor: accentColor }}
          />
          {renderInline(topicText)}
        </h4>
      );
      i++;
      continue;
    }

    // Pure Data Array: Centered comma-separated sequence of numbers
    if (/^(\s*\d+(?:\.\d+)?(?:,\s*|\s+)){3,}\d+(?:\.\d+)?(?:,\s*)?$/.test(trimmed)) {
      const tokens = trimmed.replace(/,/g, ' ').trim().split(/\s+/);
      const formattedData = tokens.join(', ') + (i + 1 < lines.length && /^(\s*\d+(?:\.\d+)?(?:,\s*|\s+)){3,}/.test(lines[i + 1].trim()) ? ',' : '');
      renderedElements.push(
        <div
          key={`data-${i}`}
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

      renderedElements.push(
        <div
          key={`sub-${i}`}
          className="flex items-start gap-2.5 text-sm text-slate-800 my-1.5 ml-6 leading-relaxed"
        >
          <span className="font-bold text-slate-900 shrink-0 select-none min-w-[20px]">
            {prefix}
          </span>
          <div className="flex-1">{renderInline(subContent)}</div>
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

      renderedElements.push(
        <div
          key={`meta-${i}`}
          className={`my-1 ml-6 text-xs text-slate-500 leading-normal ${
            isSideNote ? 'italic' : ''
          }`}
        >
          <span className={isSideNote ? 'italic text-slate-500' : 'font-semibold text-slate-600'}>
            {label}{' '}
          </span>
          <span>{renderInline(noteContent)}</span>
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
        renderedElements.push(
          <div key={`table-${i}`} className="my-3 overflow-x-auto rounded-md border border-slate-300 shadow-2xs">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-slate-900 font-bold">
                  {tableRows[0].map((h, cIdx) => {
                    const isNumeric = /^[\d.,\s/%+-]+$/.test(h) || /^(?:Variable|Income|Expenditure|Speed|GPA|Hour|ID|Year|x\d*|y\d*|Height|Weight|Age)$/i.test(h);
                    return (
                      <th
                        key={cIdx}
                        className={`px-3 py-2 border-r border-slate-300 last:border-r-0 ${
                          isNumeric ? 'text-center' : 'text-left'
                        }`}
                      >
                        {renderInline(h)}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {tableRows.slice(1).map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    className={`border-b border-slate-200 last:border-b-0 ${
                      rIdx % 2 === 1 ? "bg-slate-50/70" : "bg-white"
                    }`}
                  >
                    {row.map((cell, cIdx) => {
                      const isNumeric = /^[\d.,\s/%+-]+$/.test(cell) || /^(?:Variable|Income|Expenditure|Speed|GPA|Hour|ID|Year|x\d*|y\d*|Height|Weight|Age)$/i.test(cell);
                      return (
                        <td
                          key={cIdx}
                          className={`px-3 py-2 border-r border-slate-200 last:border-r-0 text-slate-700 ${
                            isNumeric ? 'text-center font-mono text-[11px]' : 'text-left'
                          }`}
                        >
                          {renderInline(cell)}
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
      renderedElements.push(
        <blockquote
          key={`quote-${i}`}
          className="my-3 p-3.5 bg-blue-50/50 border-l-4 rounded-r-lg text-sm text-slate-800 font-medium shadow-2xs leading-relaxed"
          style={{ borderColor: accentColor }}
        >
          {renderInline(trimmed.slice(2))}
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

      renderedElements.push(
        <div
          key={`bullet-${i}`}
          className={`flex items-start gap-2.5 text-sm text-slate-800 my-1.5 ${marginClass} leading-relaxed`}
        >
          <span className="text-slate-400 mt-1 select-none text-xs leading-none">○</span>
          <div className="flex-1">{renderInline(strippedBullet)}</div>
        </div>
      );
      i++;
      continue;
    }

    // Numbered list item (Main Questions: 1. , 2. , 3. )
    if (/^\s*\d+[\.\)]\s+/.test(trimmed)) {
      const match = trimmed.match(/^(\d+[\.\)])\s*(.*)$/)!;
      renderedElements.push(
        <div
          key={`num-${i}`}
          className="flex items-start gap-2.5 text-sm text-slate-900 my-2.5 ml-1 leading-relaxed"
        >
          <span className="font-bold text-sm select-none" style={{ color: accentColor }}>
            {match[1]}
          </span>
          <div className="flex-1 font-normal">{renderInline(match[2].trim())}</div>
        </div>
      );
      i++;
      continue;
    }

    // Fenced Code block
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
      renderedElements.push(
        <pre
          key={`code-${seq++}-${i}`}
          className="my-3 p-3.5 bg-slate-900 text-slate-100 rounded-lg font-mono text-xs overflow-x-auto select-text shadow-2xs leading-relaxed"
          style={{ contentVisibility: "auto", containIntrinsicSize: "0 60px" }}
        >
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // Standard paragraph with virtualization support for 100+ paragraphs
    renderedElements.push(
      <p
        key={`p-${seq++}-${i}`}
        className="text-sm text-slate-800 my-2 leading-relaxed"
        style={{ contentVisibility: "auto", containIntrinsicSize: "0 28px" }}
      >
        {renderInline(trimmed, `p-${i}`)}
      </p>
    );
    i++;
  }

  return renderedElements;
}, [markdown, fontFamily, accentColor, equationFormat]);

  const wordCount = markdown.trim().split(/\s+/).filter(Boolean).length;
  const mathFormulaCount = (markdown.match(/\$[^$]+\$/g) || []).length;
  // Estimate page count for document simulation (roughly 350-400 words per page in 11pt)
  const estimatedPages = Math.max(1, Math.ceil(wordCount / 380));

  return (
    <div className="border border-slate-200/90 rounded-xl bg-white shadow-xs overflow-hidden flex flex-col h-full transition-all">
      {/* Top Seamless Toolbar */}
      <div className="bg-slate-50/70 border-b border-slate-100 px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs uppercase tracking-wider shrink-0">
            <BookOpen className="w-3.5 h-3.5 text-blue-800" />
            <span className="hidden xs:inline">Word Sheet Preview</span>
            <span className="xs:hidden">Preview</span>
          </div>

          {/* Sync status indicator badge */}
          {isAiPolished ? (
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold shrink-0 border border-emerald-300">
              <Check className="w-3 h-3 text-emerald-600" />
              <span>AI Polished (Validated)</span>
            </span>
          ) : validationAlert?.failed ? (
            <span
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold shrink-0 border border-amber-300"
              title="AI Polish output failed validation and was discarded; FormatAI Result active"
            >
              <ShieldAlert className="w-3 h-3 text-amber-700" />
              <span>FormatAI Result (AI Discarded)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 font-bold shrink-0 border border-blue-200">
              <Sparkles className="w-3 h-3 text-blue-700" />
              <span>FormatAI Result</span>
            </span>
          )}

          {/* Active Font Badge */}
          <span className="hidden sm:inline-block text-[11px] px-2 py-0.5 rounded-md bg-slate-200/60 text-slate-600 font-medium font-serif shrink-0">
            {fontFamily}
          </span>

          {/* Word Count */}
          <span className="text-[11px] px-1.5 sm:px-2 py-0.5 rounded-md bg-slate-200/50 text-slate-500 font-mono shrink-0">
            {wordCount} words
          </span>

          {/* Formula Count */}
          {mathFormulaCount > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-medium border border-indigo-100 shrink-0">
              <Sigma className="w-3 h-3 text-indigo-600" />
              {mathFormulaCount} formulas
            </span>
          )}
        </div>

        {/* Action & View Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Zoom controls */}
          <div className="hidden md:flex items-center bg-slate-200/90 border border-slate-300 rounded-lg p-0.5 text-xs text-slate-700 shadow-2xs">
            <button
              onClick={() => setZoomLevel((z) => Math.max(75, z - 10))}
              className="p-1 hover:text-slate-950 hover:bg-slate-300/60 rounded disabled:opacity-40 transition-colors"
              disabled={zoomLevel <= 75}
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 text-[11px] font-mono font-bold select-none">{zoomLevel}%</span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
              className="p-1 hover:text-slate-950 hover:bg-slate-300/60 rounded disabled:opacity-40 transition-colors"
              disabled={zoomLevel >= 130}
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* View Mode Toggle: Document Sheet vs LaTeX Code */}
          <div className="flex items-center bg-slate-200/90 border border-slate-300 p-0.5 rounded-lg shadow-2xs">
            <button
              onClick={() => setViewMode("rendered")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
                viewMode === "rendered"
                  ? "bg-white text-blue-900 shadow-2xs font-extrabold border border-slate-300/80"
                  : "text-slate-700 hover:text-slate-950 font-medium"
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-blue-700" />
              <span className="hidden sm:inline">Document</span>
              <span className="sm:hidden">Doc</span>
            </button>
            <button
              onClick={() => setViewMode("source")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
                viewMode === "source"
                  ? "bg-white text-blue-900 shadow-2xs font-extrabold border border-slate-300/80"
                  : "text-slate-700 hover:text-slate-950 font-medium"
              }`}
            >
              <Code className="w-3.5 h-3.5 text-slate-700" />
              <span>LaTeX</span>
            </button>
          </div>

          {/* Download Preview PDF Button */}
          <button
            onClick={() => {
              if (onDownloadPdf) {
                onDownloadPdf();
              } else {
                const sheet = document.getElementById("academic-document-sheet");
                if (sheet) {
                  downloadPreviewAsPdf({
                    element: sheet,
                    title: docTitle || "Academic Notes",
                    markdown,
                    fontFamily,
                    accentColor,
                  });
                }
              }
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-800 bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg border-2 border-rose-200 hover:border-rose-400 transition-colors shadow-2xs cursor-pointer active:bg-rose-200"
            title="Download Exact Document Sheet as PDF (100% Vector KaTeX Math)"
          >
            <Download className="w-3.5 h-3.5 text-rose-700" />
            <span className="hidden sm:inline">Download PDF</span>
            <span className="sm:hidden">PDF</span>
          </button>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 bg-white hover:bg-slate-100 px-2.5 py-1.5 rounded-lg border-2 border-slate-300 hover:border-slate-400 transition-colors shadow-2xs cursor-pointer active:bg-slate-200"
            title="Copy formatted markdown with LaTeX"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-600" />
            )}
            <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
          </button>
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
        className="group relative w-full h-[3px] hover:h-[5px] bg-slate-200/60 overflow-hidden shrink-0 transition-all duration-150 cursor-pointer no-print select-none z-10"
      >
        <div
          className="h-full transition-[width] duration-150 ease-out rounded-r-full"
          style={{
            width: `${scrollProgress}%`,
            backgroundColor: accentColor || "#1A365D",
            boxShadow: scrollProgress > 0 ? `0 0 6px ${accentColor}66` : undefined,
          }}
        />
        {/* Subtle hover tooltip showing percentage */}
        <div className="pointer-events-none absolute right-2 -bottom-6 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-30 bg-slate-900/90 text-white text-[10px] font-mono px-1.5 py-0.5 rounded shadow-xs">
          {Math.round(scrollProgress)}% read
        </div>
      </div>

      {/* Main Preview Container */}
      {viewMode === "rendered" ? (
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="p-2 sm:p-5 md:p-8 bg-slate-100/60 overflow-y-auto flex-1 flex flex-col items-center"
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

          {/* Simulated Office Word Paper Sheet */}
          <div
            id="academic-document-sheet"
            data-testid="preview-document-sheet"
            className="academic-paper-sheet w-full max-w-[816px] bg-white rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-300/80 p-4 sm:p-8 md:p-12 text-slate-800 relative transition-transform duration-150 origin-top overflow-x-auto"
            style={{
              fontFamily: getCssFontFamily(fontFamily),
              zoom: zoomLevel !== 100 ? `${zoomLevel}%` : undefined,
            }}
          >
            {/* Word Document Running Header */}
            <div className="pb-4 mb-6 border-b border-slate-200 flex items-center justify-between text-xs text-slate-400 select-none">
              <span className="font-serif italic text-slate-500 truncate max-w-sm">
                {docTitle || "Academic Notes"}
              </span>
              <span className="text-[11px] font-sans tracking-wide uppercase text-slate-400">
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
            <div className="pt-6 mt-10 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400 select-none">
              <span>Standard Academic Typesetting (Times New Roman / OMML)</span>
              <span>Page 1 of {estimatedPages}</span>
            </div>
          </div>
        </div>
      ) : (
        /* Source LaTeX / Markdown View */
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="p-4 bg-slate-900 text-slate-100 font-mono text-xs overflow-y-auto flex-1 leading-relaxed select-text"
        >
          <pre className="whitespace-pre-wrap">{markdown}</pre>
        </div>
      )}

      {/* Footer Info Ribbon */}
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>
            Office Math Equations (<code className="font-mono text-slate-700">m:oMath</code>) formatted with native Word fraction bars & radical roots.
          </span>
        </div>
        <div className="text-slate-400 font-medium">
          Typography: <span className="text-slate-700 font-semibold">{fontFamily}</span>
        </div>
      </div>
    </div>
  );
};
