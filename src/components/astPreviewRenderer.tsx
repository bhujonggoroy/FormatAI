import React, { useMemo } from "react";
import katex from "katex";
import { AlertTriangle, Wrench } from "lucide-react";
import type { Node, Parent, Root } from "mdast";
import { parseMarkdown, plainText } from "../shared/markdown/ast";
import type {
  DocumentBlock,
  BlockFormattingIssue,
  BrokenFragment,
} from "../utils/blockIntegrity";

export interface RenderAstOptions {
  markdown: string;
  blocks: DocumentBlock[];
  failedBlockIds?: string[];
  blockIssuesMap?: Record<string, BlockFormattingIssue>;
  blockFragmentsMap?: Record<string, BrokenFragment[]>;
  fontFamily: string;
  accentColor: string;
  equationFormat?: string;
  isRepairing?: boolean;
  onRepairSingleBlock?: (blockId: string) => void;
  onRepairFragment?: (fragment: BrokenFragment) => void;
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

/**
 * KaTeX formula rendering component matching FormattedPreview.
 */
export const MathComponent: React.FC<{ math: string; display?: boolean }> = ({
  math,
  display = false,
}) => {
  const cleanMath = useMemo(() => {
    let m = math.trim();
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
    } catch {
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

interface RenderContext {
  fontFamily: string;
  accentColor: string;
  equationFormat?: string;
  blockFrags: BrokenFragment[];
  isRepairing?: boolean;
  onRepairFragment?: (frag: BrokenFragment) => void;
}

/**
 * Renders raw text with fine-grained broken fragments and embedded math patterns.
 */
function renderTextWithMathAndFragments(
  text: string,
  keyPrefix: string,
  ctx: RenderContext
): React.ReactNode {
  const { blockFrags, onRepairFragment, isRepairing } = ctx;

  // Highlight broken fragments if matched in text
  const matchedFrags = blockFrags.filter(
    (f) => f.brokenText && text.includes(f.brokenText)
  );
  if (matchedFrags.length > 0) {
    let currentRemaining = text;
    const nodes: React.ReactNode[] = [];
    let partIdx = 0;

    for (const frag of matchedFrags) {
      const idx = currentRemaining.indexOf(frag.brokenText);
      if (idx !== -1) {
        const before = currentRemaining.slice(0, idx);
        if (before) {
          nodes.push(
            renderRawTextInline(before, `${keyPrefix}-pre-${partIdx}`)
          );
        }
        nodes.push(
          <mark
            key={`${keyPrefix}-frag-${frag.id}-${partIdx}`}
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
      nodes.push(
        renderRawTextInline(currentRemaining, `${keyPrefix}-post-${partIdx}`)
      );
    }
    return <>{nodes}</>;
  }

  return renderRawTextInline(text, keyPrefix);
}

/**
 * Splits plain text by display/inline math, bold, italic, code for seamless inline KaTeX.
 */
function renderRawTextInline(text: string, keyPrefix: string): React.ReactNode {
  const parts = text.split(
    /(\$\$[\s\S]+?\$\$|(?:\\)+\[[^\n]+?(?:\\)+\]|\$[^$\n]+\$|(?:\\)+\([^\n]+?(?:\\)+\)|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
  );

  return parts.map((part, i) => {
    if (!part) return null;
    const key = `${keyPrefix}-${i}`;

    // Inline LaTeX math: $...$
    if (
      part.startsWith("$") &&
      part.endsWith("$") &&
      part.length >= 3 &&
      !part.startsWith("$$")
    ) {
      const mathContent = part.slice(1, -1);
      return <MathComponent key={key} math={mathContent} display={false} />;
    }

    // Inline LaTeX math: \(...\)
    const inlineParenMatch = part.match(
      /^(?:\\)+\(\s*([\s\S]*?)\s*(?:(?:\\)+(?:quad|qquad|,|;|!|\s|newline)\s*)*(?:\\)+\)$/
    );
    if (inlineParenMatch) {
      const mathContent = inlineParenMatch[1]
        .trim()
        .replace(/(?:\\+(?:quad|qquad|,|;|!|\s|newline)|\\\\)+$/g, "")
        .trim();
      return <MathComponent key={key} math={mathContent} display={false} />;
    }

    // Display LaTeX math: $$...$$
    if (part.startsWith("$$") && part.endsWith("$$") && part.length >= 4) {
      const mathContent = part.slice(2, -2).trim();
      return <MathComponent key={key} math={mathContent} display={true} />;
    }

    // Display bracket LaTeX math: \[...\]
    const inlineBracketMatch = part.match(
      /^(?:\\)+\[\s*([\s\S]*?)\s*(?:(?:\\)+(?:quad|qquad|,|;|!|\s|newline)\s*)*(?:\\)+\]$/
    );
    if (inlineBracketMatch) {
      const mathContent = inlineBracketMatch[1]
        .trim()
        .replace(/(?:\\+(?:quad|qquad|,|;|!|\s|newline)|\\\\)+$/g, "")
        .trim();
      return <MathComponent key={key} math={mathContent} display={true} />;
    }

    // Bold: **...**
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={key} className="font-bold text-slate-900">
          {renderRawTextInline(part.slice(2, -2), `${key}-b`)}
        </strong>
      );
    }

    // Italic: *...*
    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      return (
        <em key={key} className="italic text-slate-800">
          {renderRawTextInline(part.slice(1, -1), `${key}-i`)}
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

/**
 * Recursively renders inline mdast phrasing nodes.
 */
function renderInlineAstNodes(
  children: Node[] | undefined,
  keyPrefix: string,
  ctx: RenderContext
): React.ReactNode {
  if (!children || children.length === 0) return null;

  return children.map((node, i) => {
    const key = `${keyPrefix}-${i}`;
    switch (node.type) {
      case "text": {
        const val = (node as any).value || "";
        return (
          <React.Fragment key={key}>
            {renderTextWithMathAndFragments(val, key, ctx)}
          </React.Fragment>
        );
      }
      case "inlineMath": {
        const mathVal = (node as any).value || "";
        return <MathComponent key={key} math={mathVal} display={false} />;
      }
      case "strong": {
        return (
          <strong key={key} className="font-bold text-slate-900">
            {renderInlineAstNodes((node as Parent).children, `${key}-b`, ctx)}
          </strong>
        );
      }
      case "emphasis": {
        return (
          <em key={key} className="italic text-slate-800">
            {renderInlineAstNodes((node as Parent).children, `${key}-i`, ctx)}
          </em>
        );
      }
      case "inlineCode": {
        return (
          <code
            key={key}
            className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-xs text-rose-700 border border-slate-200"
          >
            {(node as any).value}
          </code>
        );
      }
      case "link": {
        return (
          <a
            key={key}
            href={(node as any).url}
            className="text-blue-600 underline hover:text-blue-800"
            target="_blank"
            rel="noopener noreferrer"
          >
            {renderInlineAstNodes((node as Parent).children, `${key}-a`, ctx)}
          </a>
        );
      }
      case "break":
        return <br key={key} />;
      default:
        if ("children" in node && Array.isArray((node as Parent).children)) {
          return (
            <React.Fragment key={key}>
              {renderInlineAstNodes((node as Parent).children, key, ctx)}
            </React.Fragment>
          );
        }
        if ("value" in node && typeof (node as any).value === "string") {
          return (
            <React.Fragment key={key}>
              {renderTextWithMathAndFragments((node as any).value, key, ctx)}
            </React.Fragment>
          );
        }
        return null;
    }
  });
}

/**
 * Renders an AST block node into styled React elements matching legacy FormattedPreview.
 */
function renderAstBlockNode(
  node: Node,
  keyPrefix: string,
  ctx: RenderContext
): React.ReactNode {
  const { fontFamily, accentColor } = ctx;

  switch (node.type) {
    case "heading": {
      const depth = (node as any).depth || 1;
      const inline = renderInlineAstNodes((node as Parent).children, `${keyPrefix}-h`, ctx);

      if (depth === 1) {
        return (
          <h1
            key={keyPrefix}
            className="text-2xl font-bold tracking-tight mt-6 mb-3 pb-1 border-b border-slate-200"
            style={{
              color: accentColor,
              fontFamily: getCssFontFamily(fontFamily),
            }}
          >
            {inline}
          </h1>
        );
      }
      if (depth === 2) {
        return (
          <h2
            key={keyPrefix}
            className="text-lg font-bold tracking-tight mt-5 mb-2"
            style={{
              color: accentColor === "#1A365D" ? "#2B6CB0" : accentColor,
              fontFamily: getCssFontFamily(fontFamily),
            }}
          >
            {inline}
          </h2>
        );
      }
      if (depth === 3) {
        return (
          <h3
            key={keyPrefix}
            className="text-sm font-bold text-slate-800 mt-4 mb-1.5 flex items-center gap-1.5"
            style={{ fontFamily: getCssFontFamily(fontFamily) }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
              style={{ backgroundColor: accentColor }}
            />
            {inline}
          </h3>
        );
      }
      if (depth === 4) {
        return (
          <h4
            key={keyPrefix}
            className="text-xs font-bold uppercase tracking-wider text-slate-700 mt-3.5 mb-1.5 flex items-center gap-1.5"
            style={{ fontFamily: getCssFontFamily(fontFamily) }}
          >
            <span className="w-1 h-1 rounded-full inline-block shrink-0 bg-slate-400" />
            {inline}
          </h4>
        );
      }
      if (depth === 5) {
        return (
          <h5
            key={keyPrefix}
            className="text-xs font-semibold text-slate-600 mt-3 mb-1"
            style={{ fontFamily: getCssFontFamily(fontFamily) }}
          >
            {inline}
          </h5>
        );
      }
      return (
        <h6
          key={keyPrefix}
          className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mt-2.5 mb-1"
          style={{ fontFamily: getCssFontFamily(fontFamily) }}
        >
          {inline}
        </h6>
      );
    }

    case "math": {
      const mathVal = (node as any).value || "";
      return (
        <div
          key={keyPrefix}
          className="my-2 py-1.5 px-3 flex flex-col items-center justify-center overflow-x-auto text-slate-900 rounded hover:bg-slate-50/70 transition-colors"
        >
          <MathComponent math={mathVal} display={true} />
        </div>
      );
    }

    case "table": {
      const rows = ((node as Parent).children || []) as Parent[];
      if (rows.length === 0) return null;
      const headerRow = rows[0];
      const bodyRows = rows.slice(1);

      return (
        <div
          key={keyPrefix}
          className="my-3 overflow-x-auto rounded-md border border-slate-300 shadow-2xs"
        >
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-900 font-bold">
                {headerRow.children.map((cell: any, cIdx: number) => {
                  const text = plainText(cell).trim();
                  const isNumeric =
                    /^[\d.,\s/%+-]+$/.test(text) ||
                    /^(?:Variable|Income|Expenditure|Speed|GPA|Hour|ID|Year|x\d*|y\d*|Height|Weight|Age)$/i.test(
                      text
                    );
                  return (
                    <th
                      key={`${keyPrefix}-th-${cIdx}`}
                      className={`px-3 py-2 border-r border-slate-300 last:border-r-0 ${
                        isNumeric ? "text-center" : "text-left"
                      }`}
                    >
                      {renderInlineAstNodes(
                        cell.children,
                        `${keyPrefix}-th-${cIdx}`,
                        ctx
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row: any, rIdx: number) => (
                <tr
                  key={`${keyPrefix}-row-${rIdx}`}
                  className={`border-b border-slate-200 last:border-b-0 ${
                    rIdx % 2 === 1 ? "bg-slate-50/70" : "bg-white"
                  }`}
                >
                  {(row.children || []).map((cell: any, cIdx: number) => {
                    const text = plainText(cell).trim();
                    const isNumeric =
                      /^[\d.,\s/%+-]+$/.test(text) ||
                      /^(?:Variable|Income|Expenditure|Speed|GPA|Hour|ID|Year|x\d*|y\d*|Height|Weight|Age)$/i.test(
                        text
                      );
                    return (
                      <td
                        key={`${keyPrefix}-cell-${rIdx}-${cIdx}`}
                        className={`px-3 py-2 border-r border-slate-200 last:border-r-0 text-slate-700 ${
                          isNumeric
                            ? "text-center font-mono text-[11px]"
                            : "text-left"
                        }`}
                      >
                        {renderInlineAstNodes(
                          cell.children,
                          `${keyPrefix}-c-${rIdx}-${cIdx}`,
                          ctx
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case "blockquote": {
      const children = (node as Parent).children || [];
      return (
        <blockquote
          key={keyPrefix}
          className="my-3 p-3.5 bg-blue-50/50 border-l-4 rounded-r-lg text-sm text-slate-800 font-medium shadow-2xs leading-relaxed"
          style={{ borderColor: accentColor }}
        >
          {children.map((child, idx) =>
            renderAstBlockNode(child, `${keyPrefix}-bq-${idx}`, ctx)
          )}
        </blockquote>
      );
    }

    case "code": {
      const codeVal = (node as any).value || "";
      return (
        <pre
          key={keyPrefix}
          className="my-3 p-3.5 bg-slate-900 text-slate-100 rounded-lg font-mono text-xs overflow-x-auto select-text shadow-2xs leading-relaxed"
        >
          <code>{codeVal}</code>
        </pre>
      );
    }

    case "thematicBreak":
      return <hr key={keyPrefix} className="my-5 border-t border-slate-300" />;

    case "list": {
      const ordered = Boolean((node as any).ordered);
      const start = (node as any).start || 1;
      const items = ((node as Parent).children || []) as Parent[];

      return (
        <div key={keyPrefix} className="my-1.5">
          {items.map((item, itemIdx) => {
            const num = start + itemIdx;
            const itemKey = `${keyPrefix}-li-${itemIdx}`;

            if (ordered) {
              return (
                <div
                  key={itemKey}
                  className="flex items-start gap-2.5 text-sm text-slate-900 my-2.5 ml-1 leading-relaxed"
                >
                  <span
                    className="font-bold text-sm select-none"
                    style={{ color: accentColor }}
                  >
                    {num}.
                  </span>
                  <div className="flex-1 font-normal">
                    {item.children.map((c, cIdx) =>
                      renderAstBlockNode(c, `${itemKey}-c-${cIdx}`, ctx)
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={itemKey}
                className="flex items-start gap-2.5 text-sm text-slate-800 my-1.5 ml-3 leading-relaxed"
              >
                <span className="text-slate-400 mt-1 select-none text-xs leading-none">
                  ○
                </span>
                <div className="flex-1">
                  {item.children.map((c, cIdx) =>
                    renderAstBlockNode(c, `${itemKey}-c-${cIdx}`, ctx)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    case "paragraph": {
      const raw = plainText(node).trim();

      // Unwrapped standalone math command starting with \frac, \sqrt, \sum, \int
      if (
        (raw.startsWith("\\frac") ||
          raw.startsWith("\\sqrt") ||
          raw.startsWith("\\sum") ||
          raw.startsWith("\\int")) &&
        !raw.startsWith("$")
      ) {
        return (
          <div
            key={keyPrefix}
            className="my-2 py-1.5 px-3 flex flex-col items-center justify-center overflow-x-auto text-slate-900 rounded hover:bg-slate-50/70 transition-colors"
          >
            <MathComponent math={raw} display={true} />
          </div>
        );
      }

      // 4-digit Year Header (e.g. 2019, 2025)
      if (/^\d{4}$/.test(raw)) {
        return (
          <h2
            key={keyPrefix}
            className="text-xl font-bold tracking-tight mt-6 mb-1"
            style={{
              color: accentColor,
              fontFamily: getCssFontFamily(fontFamily),
            }}
          >
            {raw}
          </h2>
        );
      }

      // Exam Title
      if (
        /^(?:\*{0,2})(?:Final|Midterm|Mid-Semester)\s+Examination(?:\*{0,2})$/i.test(
          raw
        )
      ) {
        const cleanExam = raw.replace(/^\*+|\*+$/g, "").trim();
        return (
          <div
            key={keyPrefix}
            className="text-sm font-semibold italic text-slate-600 mb-3"
            style={{ fontFamily: getCssFontFamily(fontFamily) }}
          >
            {cleanExam}
          </div>
        );
      }

      // Section Header (e.g. Section A: Descriptive Statistics... or **Section A:**)
      if (
        /^(?:#{1,3}\s*)?(?:\*{0,2})Section\s+([A-Z]):?\s*(.*?)(?:\*{0,2})$/i.test(
          raw
        )
      ) {
        const match = raw.match(
          /^(?:#{1,3}\s*)?(?:\*{0,2})Section\s+([A-Z]):?\s*(.*?)(?:\*{0,2})$/i
        )!;
        const sectionLetter = match[1].toUpperCase();
        const sectionDesc = match[2]
          .trim()
          .replace(/^[:\s-]+/, "")
          .replace(/^\*+|\*+$/g, "");
        const fullSectionTitle = `Section ${sectionLetter}:${
          sectionDesc ? " " + sectionDesc : ""
        }`;

        return (
          <h3
            key={keyPrefix}
            className="text-base font-bold text-slate-900 mt-6 mb-2 pb-1 border-b border-slate-200 flex items-center gap-2"
            style={{
              color: accentColor,
              fontFamily: getCssFontFamily(fontFamily),
            }}
          >
            {renderRawTextInline(fullSectionTitle, `${keyPrefix}-sec`)}
          </h3>
        );
      }

      // Topic Header (e.g. Topic 1: ... or #### Topic 1: ...)
      if (
        /^(?:#{2,4}\s*)?(?:\*{0,2})(Topic\s+\d+:?\s*.*?)(?:\*{0,2})$/i.test(raw)
      ) {
        const topicText = raw
          .replace(/^#{2,4}\s*/, "")
          .replace(/^\*+|\*+$/g, "")
          .trim();
        return (
          <h4
            key={keyPrefix}
            className="text-sm font-bold text-slate-800 mt-4 mb-2 flex items-center gap-1.5"
            style={{ fontFamily: getCssFontFamily(fontFamily) }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
              style={{ backgroundColor: accentColor }}
            />
            {renderRawTextInline(topicText, `${keyPrefix}-top`)}
          </h4>
        );
      }

      // Pure Data Array: Centered comma-separated sequence of numbers
      if (
        /^(\s*\d+(?:\.\d+)?(?:,\s*|\s+)){3,}\d+(?:\.\d+)?(?:,\s*)?$/.test(raw)
      ) {
        const tokens = raw.replace(/,/g, " ").trim().split(/\s+/);
        return (
          <div
            key={keyPrefix}
            className="my-1.5 text-center font-mono text-xs text-slate-700 tracking-wide select-text py-0.5"
          >
            {tokens.join(", ")}
          </div>
        );
      }

      // Sub-questions & Lettered list items: e.g. a. Arithmetic mean... or (a) Draw...
      const subMatch = raw.match(
        /^\s*(?:[-*•o]\s+)?(?:\*{0,2})([a-z]\.|\([a-z]\)|[a-z]\)|\(i{1,3}\)|[i-v]+\.|\([0-9]+\))\s*(.*)$/i
      );
      if (subMatch) {
        const prefix = subMatch[1].replace(/^\(/, "").replace(/\)$/, ".");
        const subContent = subMatch[2].replace(/^\*+|\*+$/g, "").trim();

        return (
          <div
            key={keyPrefix}
            className="flex items-start gap-2.5 text-sm text-slate-800 my-1.5 ml-6 leading-relaxed"
          >
            <span className="font-bold text-slate-900 shrink-0 select-none min-w-[20px]">
              {prefix}
            </span>
            <div className="flex-1">
              {renderTextWithMathAndFragments(
                subContent,
                `${keyPrefix}-sub`,
                ctx
              )}
            </div>
          </div>
        );
      }

      // Metadata and Side notes (Frequency: ..., Side note: ..., Note: ...)
      const metaMatch = raw.match(
        /^(?:\s*[-*•o]\s+)?(?:\*{0,2})(\(?Side note:|\(?Note:|Frequency:)\s*(.*?)(?:\*{0,2})$/i
      );
      if (metaMatch) {
        const label = metaMatch[1];
        const noteContent = metaMatch[2].replace(/^\*+|\*+$/g, "").trim();
        const isSideNote = /side note|note/i.test(label);

        return (
          <div
            key={keyPrefix}
            className={`my-1 ml-6 text-xs text-slate-500 leading-normal ${
              isSideNote ? "italic" : ""
            }`}
          >
            <span
              className={
                isSideNote
                  ? "italic text-slate-500"
                  : "font-semibold text-slate-600"
              }
            >
              {label}{" "}
            </span>
            <span>
              {renderTextWithMathAndFragments(
                noteContent,
                `${keyPrefix}-note`,
                ctx
              )}
            </span>
          </div>
        );
      }

      // Standard paragraph
      return (
        <p
          key={keyPrefix}
          className="text-sm text-slate-800 my-2 leading-relaxed"
        >
          {renderInlineAstNodes((node as Parent).children, `${keyPrefix}-p`, ctx)}
        </p>
      );
    }

    default:
      if ("children" in node && Array.isArray((node as Parent).children)) {
        return (
          <div key={keyPrefix} className="my-1 leading-relaxed">
            {renderInlineAstNodes((node as Parent).children, keyPrefix, ctx)}
          </div>
        );
      }
      return null;
  }
}

/**
 * Maps top-level mdast nodes to existing block IDs using node.position offsets.
 */
export function mapAstNodesToBlockIds(
  tree: Root,
  blocks: DocumentBlock[],
  markdown: string
): Map<string, Node[]> {
  const lineStartOffsets: number[] = [0];
  for (let i = 0; i < markdown.length; i++) {
    if (markdown[i] === "\n") {
      lineStartOffsets.push(i + 1);
    }
  }

  const blockRanges = blocks.map((b) => ({
    block: b,
    startOffset: lineStartOffsets[b.lineStart - 1] ?? 0,
    endOffset:
      b.lineEnd < lineStartOffsets.length
        ? lineStartOffsets[b.lineEnd] - 1
        : markdown.length,
  }));

  const nodeMap = new Map<string, Node[]>();
  for (const b of blocks) {
    nodeMap.set(b.id, []);
  }

  for (const node of tree.children) {
    const nodeOffset = node.position?.start?.offset;
    const nodeLine = node.position?.start?.line;

    let targetBlock: DocumentBlock | undefined;

    if (typeof nodeOffset === "number") {
      const match = blockRanges.find(
        (r) => nodeOffset >= r.startOffset && nodeOffset <= r.endOffset
      );
      if (match) {
        targetBlock = match.block;
      }
    }

    if (!targetBlock && typeof nodeLine === "number") {
      targetBlock = blocks.find(
        (b) => nodeLine >= b.lineStart && nodeLine <= b.lineEnd
      );
    }

    if (!targetBlock && blockRanges.length > 0) {
      if (typeof nodeOffset === "number") {
        let closest = blockRanges[0];
        let minDist = Math.abs(nodeOffset - closest.startOffset);
        for (let i = 1; i < blockRanges.length; i++) {
          const dist = Math.abs(nodeOffset - blockRanges[i].startOffset);
          if (dist < minDist) {
            minDist = dist;
            closest = blockRanges[i];
          }
        }
        targetBlock = closest.block;
      } else {
        targetBlock = blocks[0];
      }
    }

    if (targetBlock) {
      const list = nodeMap.get(targetBlock.id);
      if (list) {
        list.push(node);
      } else {
        nodeMap.set(targetBlock.id, [node]);
      }
    }
  }

  return nodeMap;
}

/**
 * Top-level AST preview document renderer.
 * Wraps each block with identical DOM structure, test IDs, and flagged alert UI.
 */
export function renderAstDocument(options: RenderAstOptions): React.ReactNode[] {
  const {
    markdown,
    blocks,
    failedBlockIds = [],
    blockIssuesMap,
    blockFragmentsMap,
    fontFamily,
    accentColor,
    equationFormat,
    isRepairing = false,
    onRepairSingleBlock,
    onRepairFragment,
  } = options;

  if (!blocks || blocks.length === 0) return [];

  const tree = parseMarkdown(markdown);
  const blockNodesMap = mapAstNodesToBlockIds(tree, blocks, markdown);

  return blocks.map((block) => {
    const isFailed = failedBlockIds.includes(block.id);
    const issue = isFailed ? blockIssuesMap?.[block.id] : null;
    const blockFrags = blockFragmentsMap?.[block.id] || issue?.fragments || [];

    const ctx: RenderContext = {
      fontFamily,
      accentColor,
      equationFormat,
      blockFrags,
      isRepairing,
      onRepairFragment,
    };

    let nodes = blockNodesMap.get(block.id) || [];
    // If AST nodes directly matched the block:
    if (nodes.length === 0 && block.rawText.trim()) {
      nodes = parseMarkdown(block.rawText).children;
    }

    const blockContent = nodes.map((node, nIdx) =>
      renderAstBlockNode(node, `${block.id}-ast-${nIdx}`, ctx)
    );

    return (
      <div
        key={block.id}
        id={`block-${block.id}`}
        data-block-id={block.id}
        data-flagged={isFailed ? "true" : undefined}
        className="my-1 relative"
      >
        {/* Flagged issue banner */}
        {isFailed && (
          <div className="flex items-center justify-between text-xs text-rose-800 py-1 px-2.5 mb-1.5 bg-rose-50/70 rounded-lg border border-rose-200">
            <div className="flex items-center gap-1.5 font-semibold text-[11px] flex-wrap">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>
                Flagged: {issue?.reason || "Formatting or LaTeX syntax error"}
              </span>
              <span className="font-mono text-[9px] text-rose-700 bg-rose-100 px-1 py-0.5 rounded border border-rose-300 font-semibold">
                {block.id}
              </span>
              {blockFrags.length > 0 && (
                <span className="text-[10px] text-rose-600 bg-white/80 px-1.5 py-0.5 rounded font-mono border border-rose-200">
                  {blockFrags.length} fragment
                  {blockFrags.length === 1 ? "" : "s"}
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

        {/* Block Body Content */}
        <div className="text-slate-900 overflow-x-auto">{blockContent}</div>
      </div>
    );
  });
}

/**
 * Counts headings, tables, and math blocks according to legacy line-by-line renderer rules.
 */
export function countLegacyPreviewBlocks(markdown: string): {
  headings: number;
  tables: number;
  math: number;
} {
  const lines = markdown.split(/\r?\n/);
  let headings = 0;
  let tables = 0;
  let math = 0;
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Display equation block: $$...$$
    if (trimmed.startsWith("$$")) {
      math++;
      if (trimmed.length >= 4 && trimmed.slice(2).includes("$$")) {
        i++;
      } else {
        i++;
        while (i < lines.length) {
          const nextTrimmed = lines[i].trim();
          if (nextTrimmed.includes("$$")) {
            i++;
            break;
          }
          if (/^#{1,6}\s+|^(\*{3,}|-{3,}|_{3,})$|^>\s+|^\|/.test(nextTrimmed)) {
            break;
          }
          i++;
        }
      }
      continue;
    }

    // Display equation block: \[...\]
    if (/^(?:\\)+\[/.test(trimmed)) {
      math++;
      if (trimmed.search(/(?:\\)+\]/) !== -1) {
        i++;
      } else {
        i++;
        while (i < lines.length) {
          const nextTrimmed = lines[i].trim();
          if (nextTrimmed.search(/(?:\\)+\]/) !== -1) {
            i++;
            break;
          }
          if (/^#{1,6}\s+|^(\*{3,}|-{3,}|_{3,})$|^>\s+|^\|/.test(nextTrimmed)) {
            break;
          }
          i++;
        }
      }
      continue;
    }

    // Unwrapped equation block starting with math commands (\frac, \sqrt, \sum, \int)
    if (
      (trimmed.startsWith("\\frac") ||
        trimmed.startsWith("\\sqrt") ||
        trimmed.startsWith("\\sum") ||
        trimmed.startsWith("\\int")) &&
      !trimmed.startsWith("$")
    ) {
      math++;
      i++;
      continue;
    }

    // Headings
    if (
      trimmed.startsWith("# ") ||
      trimmed.startsWith("## ") ||
      trimmed.startsWith("### ") ||
      trimmed.startsWith("#### ") ||
      trimmed.startsWith("##### ") ||
      trimmed.startsWith("###### ") ||
      /^\d{4}$/.test(trimmed) ||
      /^(?:#{1,3}\s*)?(?:\*{0,2})Section\s+([A-Z]):?\s*(.*?)(?:\*{0,2})$/i.test(
        trimmed
      ) ||
      /^(?:#{2,4}\s*)?(?:\*{0,2})(Topic\s+\d+:?\s*.*?)(?:\*{0,2})$/i.test(
        trimmed
      )
    ) {
      headings++;
      i++;
      continue;
    }

    // Markdown Table
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      tables++;
      while (
        i < lines.length &&
        lines[i].trim().startsWith("|") &&
        lines[i].trim().endsWith("|")
      ) {
        i++;
      }
      continue;
    }

    i++;
  }

  return { headings, tables, math };
}

/**
 * Counts headings, tables, and math blocks according to AST preview renderer rules.
 */
export function countAstPreviewBlocks(markdown: string): {
  headings: number;
  tables: number;
  math: number;
} {
  const tree = parseMarkdown(markdown);
  let headings = 0;
  let tables = 0;
  let math = 0;

  for (const node of tree.children) {
    if (node.type === "heading") {
      headings++;
    } else if (node.type === "table") {
      tables++;
    } else if (node.type === "math") {
      math++;
    } else if (node.type === "paragraph") {
      const raw = plainText(node).trim();
      if (
        (raw.startsWith("\\frac") ||
          raw.startsWith("\\sqrt") ||
          raw.startsWith("\\sum") ||
          raw.startsWith("\\int")) &&
        !raw.startsWith("$")
      ) {
        math++;
      } else if (
        /^\d{4}$/.test(raw) ||
        /^(?:#{1,3}\s*)?(?:\*{0,2})Section\s+([A-Z]):?\s*(.*?)(?:\*{0,2})$/i.test(
          raw
        ) ||
        /^(?:#{2,4}\s*)?(?:\*{0,2})(Topic\s+\d+:?\s*.*?)(?:\*{0,2})$/i.test(raw)
      ) {
        headings++;
      }
    }
  }

  return { headings, tables, math };
}
