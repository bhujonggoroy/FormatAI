import PDFDocument from "pdfkit";
import { sanitizeMathToUnicode } from "./docxService.ts";
import { generateFilenameFromContent } from "../utils/filename.ts";
import { parseMarkdown, plainText } from "../shared/markdown/ast.ts";

export { generateFilenameFromContent };

export type ExportFormat = "docx" | "pdf" | "tex" | "md" | "txt";

export interface ExportDocumentOptions {
  title: string;
  fontFamily?: string;
  accentColor?: string;
}

/**
 * Validates and normalizes the export format string.
 * Strictly accepts only 'docx', 'pdf', 'tex', 'md', 'txt'.
 * Throws an error for anything else (strict security validation).
 */
export function validateExportFormat(rawFormat: unknown): ExportFormat {
  if (typeof rawFormat !== "string") {
    throw new Error("Invalid export format. Must be one of: docx, pdf, tex, md, txt.");
  }
  const normalized = rawFormat.trim().toLowerCase();
  const allowedFormats: ExportFormat[] = ["docx", "pdf", "tex", "md", "txt"];
  if (!allowedFormats.includes(normalized as ExportFormat)) {
    throw new Error(`Invalid export format '${rawFormat}'. Allowed formats are: docx, pdf, tex, md, txt.`);
  }
  return normalized as ExportFormat;
}

/**
 * Creates a safe, path-traversal-free filename base.
 * Strips path separators, dots, null bytes, special characters.
 */
export function getSafeFilenameBase(title: string, defaultName = "academic_notes"): string {
  if (!title || typeof title !== "string") return defaultName;
  // Remove directory traversal sequences and invalid characters
  let safe = title
    .replace(/[/\\]+/g, "_")
    .replace(/\.\.+/g, "")
    .replace(/[^a-zA-Z0-9_\-\s]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/_{2,}/g, "_")
    .toLowerCase();

  if (!safe || safe === "_") safe = defaultName;
  return safe.slice(0, 80);
}

/**
 * Generates a complete, publication-ready LaTeX (.tex) document.
 */
export function escapeTextForLaTeX(text: string): string {
  return text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([%$&#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

export function formatInlineLaTeX(text: string): string {
  // Protect math spans $...$ and \(...\)
  const mathSpans: string[] = [];
  let s = text.replace(/(\$[^$]+\$|\\\([^\\]+\\\))/g, (m) => {
    const idx = mathSpans.length;
    mathSpans.push(m);
    return `__MATH_SPAN_${idx}__`;
  });

  // Escape special LaTeX characters in non-math text
  s = s
    .replace(/([%$&#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");

  // Bold **...** -> \textbf{...}
  s = s.replace(/\*\*([^*]+)\*\*/g, "\\textbf{$1}");

  // Italic *...* -> \textit{...}
  s = s.replace(/\*([^*]+)\*/g, "\\textit{$1}");

  // Inline code `...` -> \texttt{...}
  s = s.replace(/`([^`]+)`/g, "\\texttt{$1}");

  // Restore math spans
  s = s.replace(/__MATH_SPAN_(\d+)__/g, (_, id) => {
    const orig = mathSpans[parseInt(id, 10)];
    if (orig.startsWith("\\(") && orig.endsWith("\\)")) {
      return `$${orig.slice(2, -2)}$`;
    }
    return orig;
  });

  return s;
}

export function formatTableCellLaTeX(cell: string): string {
  return formatInlineLaTeX(cell.trim());
}

/**
 * Generates a complete, publication-ready LaTeX (.tex) document from AST.
 */
export function generateLaTeXDocument(markdown: string, title: string): string {
  const safeTitle = (title || "Academic Notes")
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([%$&#_{}])/g, "\\$1");

  const ast = parseMarkdown(markdown);
  const latexLines: string[] = [];

  function renderInline(nodeOrNodes: any): string {
    if (!nodeOrNodes) return "";
    if (Array.isArray(nodeOrNodes)) {
      return nodeOrNodes.map(renderInline).join("");
    }
    const node = nodeOrNodes;
    if (node.type === "text") {
      return formatInlineLaTeX(node.value);
    }
    if (node.type === "inlineMath") {
      return `$${node.value}$`;
    }
    if (node.type === "strong") {
      return `\\textbf{${renderInline(node.children)}}`;
    }
    if (node.type === "emphasis") {
      return `\\textit{${renderInline(node.children)}}`;
    }
    if (node.type === "inlineCode") {
      return `\\texttt{${escapeTextForLaTeX(node.value)}}`;
    }
    if (node.type === "link") {
      return `\\href{${node.url}}{${renderInline(node.children)}}`;
    }
    if (node.type === "break") {
      return "\\\\ ";
    }
    if (node.type === "delete") {
      return renderInline(node.children);
    }
    if ("children" in node && Array.isArray(node.children)) {
      return renderInline(node.children);
    }
    if ("value" in node && typeof node.value === "string") {
      return formatInlineLaTeX(node.value);
    }
    return "";
  }

  function renderBlock(node: any): void {
    if (node.type === "heading") {
      const text = renderInline(node.children).trim();
      const depth = node.depth || 1;
      if (depth === 1) {
        latexLines.push(`\\section{${text}}\n`);
      } else if (depth === 2) {
        latexLines.push(`\\subsection{${text}}\n`);
      } else if (depth === 3) {
        latexLines.push(`\\subsubsection{${text}}\n`);
      } else if (depth === 4) {
        latexLines.push(`\\paragraph{${text}}\n`);
      } else {
        latexLines.push(`\\subparagraph{${text}}\n`);
      }
    } else if (node.type === "math") {
      latexLines.push(`\\[\n${node.value}\n\\]\n`);
    } else if (node.type === "table") {
      const rows = (node.children || []).filter((c: any) => c.type === "tableRow");
      if (rows.length > 0) {
        const tableRows: string[][] = rows.map((r: any) =>
          (r.children || []).map((c: any) => renderInline(c.children).trim())
        );
        const colCount = Math.max(...tableRows.map((r: any) => r.length), 1);
        const colAlign = (node.align || [])
          .map((a: string) => (a === "right" ? "r" : a === "center" ? "c" : "l"))
          .join("")
          .padEnd(colCount, "l")
          .slice(0, colCount);

        latexLines.push("\\begin{table}[htbp]");
        latexLines.push("\\centering");
        latexLines.push(`\\begin{tabular}{${colAlign}}`);
        latexLines.push("\\toprule");

        const header = tableRows[0];
        latexLines.push(header.join(" & ") + " \\\\");
        latexLines.push("\\midrule");

        for (let r = 1; r < tableRows.length; r++) {
          const row = tableRows[r];
          while (row.length < colCount) row.push("");
          latexLines.push(row.join(" & ") + " \\\\");
        }

        latexLines.push("\\bottomrule");
        latexLines.push("\\end{tabular}");
        latexLines.push("\\end{table}\n");
      }
    } else if (node.type === "list") {
      const env = node.ordered ? "enumerate" : "itemize";
      latexLines.push(`\\begin{${env}}`);
      for (const item of (node.children || [])) {
        if (item.type === "listItem") {
          const itemText = (item.children || [])
            .map((c: any) => {
              if (c.type === "paragraph") return renderInline(c.children).trim();
              if (c.type === "list") {
                const subEnv = c.ordered ? "enumerate" : "itemize";
                const subItems = (c.children || [])
                  .map((sc: any) => `  \\item ${renderInline(sc.children).trim()}`)
                  .join("\n");
                return `\n\\begin{${subEnv}}\n${subItems}\n\\end{${subEnv}}`;
              }
              return renderInline(c).trim();
            })
            .join("\n");
          latexLines.push(`  \\item ${itemText}`);
        }
      }
      latexLines.push(`\\end{${env}}\n`);
    } else if (node.type === "blockquote") {
      const quoteText = (node.children || [])
        .map((c: any) => {
          if (c.type === "paragraph") return renderInline(c.children).trim();
          return renderInline(c).trim();
        })
        .join("\n\n");
      latexLines.push(`\\begin{quote}\n${quoteText}\n\\end{quote}\n`);
    } else if (node.type === "code") {
      latexLines.push(`\\begin{verbatim}\n${node.value}\n\\end{verbatim}\n`);
    } else if (node.type === "thematicBreak") {
      latexLines.push("\\noindent\\rule{\\textwidth}{0.4pt}\n");
    } else if (node.type === "paragraph") {
      latexLines.push(`${renderInline(node.children)}\n`);
    } else {
      const fallback = renderInline(node).trim();
      if (fallback) latexLines.push(`${fallback}\n`);
    }
  }

  for (const child of ast.children) {
    renderBlock(child);
  }

  return `\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath,amssymb,amsfonts,amsthm}
\\usepackage{geometry}
\\geometry{margin=1in}
\\usepackage{booktabs}
\\usepackage{hyperref}
\\usepackage{enumitem}
\\usepackage{microtype}

\\hypersetup{
    colorlinks=true,
    linkcolor=blue!70!black,
    citecolor=blue!70!black,
    urlcolor=blue!70!black
}

\\title{\\textbf{${safeTitle}}}
\\author{Formatted via Format AI}
\\date{\\today}

\\begin{document}
\\maketitle

${latexLines.join("\n")}

\\end{document}
`;
}

/**
 * Generates clean Markdown (.md) document with standardized title from AST.
 */
export function generateMarkdownDocument(markdown: string, title: string): string {
  const safeTitle = title.trim() || "Academic Notes";
  const ast = parseMarkdown(markdown);
  const blocks: string[] = [];

  const firstBlock = ast.children[0];
  const hasH1AtTop = firstBlock && firstBlock.type === "heading" && (firstBlock as any).depth === 1;

  if (!hasH1AtTop) {
    blocks.push(`# ${safeTitle}`);
  }

  function renderInline(nodeOrNodes: any): string {
    if (!nodeOrNodes) return "";
    if (Array.isArray(nodeOrNodes)) {
      return nodeOrNodes.map(renderInline).join("");
    }
    const node = nodeOrNodes;
    if (node.type === "text") return node.value;
    if (node.type === "inlineMath") return `$${node.value}$`;
    if (node.type === "strong") return `**${renderInline(node.children)}**`;
    if (node.type === "emphasis") return `*${renderInline(node.children)}*`;
    if (node.type === "inlineCode") return `\`${node.value}\``;
    if (node.type === "link") return `[${renderInline(node.children)}](${node.url})`;
    if (node.type === "delete") return `~~${renderInline(node.children)}~~`;
    if (node.type === "break") return "  \n";
    if ("children" in node && Array.isArray(node.children)) return renderInline(node.children);
    if ("value" in node && typeof node.value === "string") return node.value;
    return "";
  }

  function renderBlock(node: any, indent = ""): string {
    if (node.type === "heading") {
      const hashes = "#".repeat(node.depth || 1);
      return `${hashes} ${renderInline(node.children).trim()}`;
    }
    if (node.type === "math") {
      return `$$\n${node.value.trim()}\n$$`;
    }
    if (node.type === "paragraph") {
      return renderInline(node.children).trim();
    }
    if (node.type === "table") {
      const rows = (node.children || []).filter((c: any) => c.type === "tableRow");
      if (rows.length === 0) return "";
      const tableRows: string[][] = rows.map((r: any) =>
        (r.children || []).map((c: any) => renderInline(c.children).trim())
      );
      const colCount = Math.max(...tableRows.map((r: any) => r.length), 1);
      const colWidths = new Array(colCount).fill(3);
      for (const row of tableRows) {
        for (let c = 0; c < row.length; c++) {
          colWidths[c] = Math.max(colWidths[c], (row[c] || "").length);
        }
      }
      const aligns = node.align || [];
      const lines: string[] = [];
      for (let r = 0; r < tableRows.length; r++) {
        const row = tableRows[r];
        const cells: string[] = [];
        for (let c = 0; c < colCount; c++) {
          cells.push((row[c] || "").padEnd(colWidths[c]));
        }
        lines.push(`| ${cells.join(" | ")} |`);
        if (r === 0) {
          const sepCells: string[] = [];
          for (let c = 0; c < colCount; c++) {
            const a = aligns[c];
            const w = colWidths[c];
            if (a === "center") sepCells.push(`:${"-".repeat(Math.max(1, w - 2))}:`);
            else if (a === "right") sepCells.push(`${"-".repeat(Math.max(2, w - 1))}:`);
            else sepCells.push("-".repeat(Math.max(3, w)));
          }
          lines.push(`| ${sepCells.join(" | ")} |`);
        }
      }
      return lines.join("\n");
    }
    if (node.type === "list") {
      const lines: string[] = [];
      const ordered = !!node.ordered;
      const startIdx = node.start || 1;
      for (let i = 0; i < (node.children || []).length; i++) {
        const item = node.children[i];
        const prefix = ordered ? `${startIdx + i}. ` : "- ";
        const itemChildren = item.children || [];
        const itemLines: string[] = [];
        for (let j = 0; j < itemChildren.length; j++) {
          const c = itemChildren[j];
          if (c.type === "paragraph") {
            itemLines.push(renderInline(c.children).trim());
          } else if (c.type === "list") {
            itemLines.push(renderBlock(c, indent + "  "));
          } else {
            itemLines.push(renderBlock(c, indent + "  "));
          }
        }
        const first = itemLines[0] || "";
        const rest = itemLines.slice(1);
        lines.push(`${indent}${prefix}${first}`);
        for (const line of rest) {
          lines.push(line.startsWith(indent) ? line : `${indent}  ${line}`);
        }
      }
      return lines.join("\n");
    }
    if (node.type === "blockquote") {
      const inner = (node.children || []).map((c: any) => renderBlock(c)).join("\n\n");
      return inner
        .split("\n")
        .map((l: string) => `> ${l}`)
        .join("\n");
    }
    if (node.type === "code") {
      const lang = node.lang || "";
      return `\`\`\`${lang}\n${node.value}\n\`\`\``;
    }
    if (node.type === "thematicBreak") {
      return "---";
    }
    return plainText(node).trim();
  }

  for (const child of ast.children) {
    const rendered = renderBlock(child).trim();
    if (rendered) {
      blocks.push(rendered);
    }
  }

  return blocks.join("\n\n") + "\n";
}

/**
 * Generates Plain Text (.txt) with readable ASCII layout and Unicode math notation from AST.
 */
export function generatePlainTextDocument(markdown: string, title: string): string {
  const safeTitle = title.trim() || "Academic Notes";
  const divider = "=".repeat(Math.min(70, Math.max(safeTitle.length, 40)));
  const ast = parseMarkdown(markdown);
  const blocks: string[] = [];

  function renderInline(nodeOrNodes: any): string {
    if (!nodeOrNodes) return "";
    if (Array.isArray(nodeOrNodes)) {
      return nodeOrNodes.map(renderInline).join("");
    }
    const node = nodeOrNodes;
    if (node.type === "text") {
      let t = node.value;
      t = t.replace(/\$([^$\n]+)\$/g, (_: string, m: string) => sanitizeMathToUnicode(m.trim()));
      return t;
    }
    if (node.type === "inlineMath") {
      return sanitizeMathToUnicode(node.value.trim());
    }
    if (node.type === "strong" || node.type === "emphasis" || node.type === "delete") {
      return renderInline(node.children);
    }
    if (node.type === "inlineCode") {
      return node.value;
    }
    if (node.type === "link") {
      const text = renderInline(node.children);
      return text ? `${text} (${node.url})` : node.url;
    }
    if (node.type === "break") {
      return "\n";
    }
    if ("children" in node && Array.isArray(node.children)) {
      return renderInline(node.children);
    }
    if ("value" in node && typeof node.value === "string") {
      return node.value;
    }
    return "";
  }

  function renderBlock(node: any, indent = ""): string {
    if (node.type === "heading") {
      const text = renderInline(node.children).trim();
      const depth = node.depth || 1;
      if (depth === 1) {
        return `${text.toUpperCase()}\n${"=".repeat(Math.max(text.length, 10))}`;
      }
      if (depth === 2) {
        return `${text}\n${"-".repeat(Math.max(text.length, 10))}`;
      }
      if (depth === 3) {
        return `--- ${text} ---`;
      }
      return `[${text}]`;
    }
    if (node.type === "math") {
      const mathUnicode = sanitizeMathToUnicode(node.value.trim());
      return mathUnicode
        .split("\n")
        .map((l) => `    ${l}`)
        .join("\n");
    }
    if (node.type === "paragraph") {
      return renderInline(node.children).trim();
    }
    if (node.type === "table") {
      const rows = (node.children || []).filter((c: any) => c.type === "tableRow");
      if (rows.length === 0) return "";
      const tableRows: string[][] = rows.map((r: any) =>
        (r.children || []).map((c: any) => renderInline(c.children).trim())
      );
      const colCount = Math.max(...tableRows.map((r: any) => r.length), 1);
      const colWidths = new Array(colCount).fill(0);
      for (const row of tableRows) {
        for (let c = 0; c < row.length; c++) {
          colWidths[c] = Math.max(colWidths[c], (row[c] || "").length);
        }
      }
      const lines: string[] = [];
      for (let r = 0; r < tableRows.length; r++) {
        const row = tableRows[r];
        const formattedCells = [];
        for (let c = 0; c < colCount; c++) {
          formattedCells.push((row[c] || "").padEnd(colWidths[c]));
        }
        lines.push(formattedCells.join("  |  "));
        if (r === 0) {
          lines.push(colWidths.map((w) => "-".repeat(Math.max(w, 1))).join("--+--"));
        }
      }
      return lines.join("\n");
    }
    if (node.type === "list") {
      const lines: string[] = [];
      const ordered = !!node.ordered;
      const startIdx = node.start || 1;
      for (let i = 0; i < (node.children || []).length; i++) {
        const item = node.children[i];
        const prefix = ordered ? `${startIdx + i}. ` : "• ";
        const itemText = (item.children || [])
          .map((c: any) => {
            if (c.type === "paragraph") return renderInline(c.children).trim();
            if (c.type === "list") return renderBlock(c, indent + "  ");
            return renderBlock(c, indent + "  ");
          })
          .join("\n");
        lines.push(`${indent}${prefix}${itemText}`);
      }
      return lines.join("\n");
    }
    if (node.type === "blockquote") {
      const inner = (node.children || []).map((c: any) => renderBlock(c)).join("\n\n");
      return inner
        .split("\n")
        .map((l: string) => `| ${l}`)
        .join("\n");
    }
    if (node.type === "code") {
      return (node.value || "")
        .split("\n")
        .map((l: string) => `    ${l}`)
        .join("\n");
    }
    if (node.type === "thematicBreak") {
      return "----------------------------------------";
    }
    return plainText(node).trim();
  }

  for (const child of ast.children) {
    const rendered = renderBlock(child).trim();
    if (rendered) {
      blocks.push(rendered);
    }
  }

  const body = blocks.join("\n\n").trim();
  return `${divider}\n${safeTitle}\n${divider}\n\n${body}\n`;
}

/**
 * Formats LaTeX mathematical markup into clean, publication-quality typography
 * suitable for PDF documents with standard or embedded academic fonts.
 */
export function formatLatexForPdf(latex: string, isDisplay = false): string {
  if (!latex) return "";
  let s = latex.trim();

  // Strip enclosing math delimiters
  s = s.replace(/^\${1,2}/, "").replace(/\${1,2}$/, "").trim();
  s = s.replace(/^\\\[/, "").replace(/\\\]$/, "").trim();
  s = s.replace(/^\\\(/, "").replace(/\\\)$/, "").trim();

  // Normalize spaces and quad/qquad
  s = s.replace(/\\qquad/g, "   ");
  s = s.replace(/\\quad/g, "  ");
  s = s.replace(/\\([,;! ])/g, " ");

  // Normalizations for sample statistics and accents
  s = s.replace(/\\bar\{([A-Za-z])\}/g, "$1̄");
  s = s.replace(/\\hat\{([A-Za-z])\}/g, "$1̂");
  s = s.replace(/\\tilde\{([A-Za-z])\}/g, "$1̃");
  s = s.replace(/\\vec\{([A-Za-z])\}/g, "$1→");

  // Operators
  s = s.replace(/\\operatorname\{([A-Za-z0-9_.-]+)\}/g, "$1");
  s = s.replace(/\\text\{([^{}]+)\}/g, "$1");
  s = s.replace(/\\mathrm\{([^{}]+)\}/g, "$1");
  s = s.replace(/\\mathbf\{([^{}]+)\}/g, "$1");
  s = s.replace(/\\mathsf\{([^{}]+)\}/g, "$1");
  s = s.replace(/\\mathit\{([^{}]+)\}/g, "$1");

  // Transpose
  s = s.replace(/\^\{\\mathsf\s*T\}/g, "ᵀ");
  s = s.replace(/\^\{\\mathrm\s*T\}/g, "ᵀ");
  s = s.replace(/\^T\b/g, "ᵀ");

  // Fractions: \frac{num}{den}
  let prev = "";
  let iterations = 0;
  while (s.includes("\\frac") && s !== prev && iterations < 5) {
    prev = s;
    iterations++;
    s = s.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (match, num, den) => {
      const cleanNum = num.trim();
      const cleanDen = den.trim();
      const wrapNum = /[+\-=><]|\s/.test(cleanNum) && !cleanNum.startsWith("(") ? `(${cleanNum})` : cleanNum;
      const wrapDen = /[+\-=><]|\s/.test(cleanDen) && !cleanDen.startsWith("(") ? `(${cleanDen})` : cleanDen;
      return `${wrapNum} / ${wrapDen}`;
    });
  }

  // Radicals: \sqrt{arg} or \sqrt[n]{arg}
  s = s.replace(/\\sqrt\[([^{}]+)\]\{([^{}]+)\}/g, "ⁿ√($2)");
  prev = "";
  iterations = 0;
  while (s.includes("\\sqrt") && s !== prev && iterations < 5) {
    prev = s;
    iterations++;
    s = s.replace(/\\sqrt\{([^{}]+)\}/g, "√($1)");
  }

  // Common math symbols and Greek letters
  const symbolMap: Record<string, string> = {
    "\\alpha": "α", "\\beta": "β", "\\gamma": "γ", "\\Gamma": "Γ",
    "\\delta": "δ", "\\Delta": "Δ", "\\epsilon": "ε", "\\varepsilon": "ε",
    "\\zeta": "ζ", "\\eta": "η", "\\theta": "θ", "\\Theta": "Θ",
    "\\lambda": "λ", "\\Lambda": "Λ", "\\mu": "μ", "\\nu": "ν",
    "\\xi": "ξ", "\\Xi": "Ξ", "\\pi": "π", "\\Pi": "Π",
    "\\rho": "ρ", "\\sigma": "σ", "\\Sigma": "Σ", "\\tau": "τ",
    "\\phi": "φ", "\\Phi": "Φ", "\\chi": "χ", "\\psi": "ψ",
    "\\Psi": "Ψ", "\\omega": "ω", "\\Omega": "Ω",
    "\\pm": "±", "\\mp": "∓", "\\times": "×", "\\cdot": "·",
    "\\div": "÷", "\\approx": "≈", "\\sim": "~", "\\equiv": "≡",
    "\\le": "≤", "\\leq": "≤", "\\ge": "≥", "\\geq": "≥",
    "\\neq": "≠", "\\ne": "≠", "\\propto": "∝", "\\infty": "∞",
    "\\sum": "∑", "\\prod": "∏", "\\int": "∫", "\\partial": "∂",
    "\\nabla": "∇", "\\rightarrow": "→", "\\leftarrow": "←",
    "\\Rightarrow": "⇒", "\\Leftarrow": "⇐", "\\leftrightarrow": "↔",
    "\\in": "∈", "\\notin": "∉", "\\subset": "⊂", "\\subseteq": "⊆",
    "\\cap": "∩", "\\cup": "∪", "\\forall": "∀", "\\exists": "∃",
    "\\mathbb{R}": "ℝ", "\\mathbb{N}": "ℕ", "\\mathbb{Z}": "ℤ",
  };

  for (const [tex, sym] of Object.entries(symbolMap)) {
    s = s.split(tex).join(sym);
  }

  // Brackets
  s = s.replace(/\\left\(/g, "(").replace(/\\right\)/g, ")");
  s = s.replace(/\\left\[/g, "[").replace(/\\right\]/g, "]");
  s = s.replace(/\\left\\\{/g, "{").replace(/\\right\\\}/g, "}");
  s = s.replace(/\\left\|/g, "|").replace(/\\right\|/g, "|");

  // Superscripts
  s = s.replace(/\^2\b/g, "²");
  s = s.replace(/\^3\b/g, "³");
  s = s.replace(/\^0\b/g, "⁰");
  s = s.replace(/\^1\b/g, "¹");
  s = s.replace(/\^\{2\}/g, "²");
  s = s.replace(/\^\{3\}/g, "³");
  s = s.replace(/\^\{n\}/g, "ⁿ");
  s = s.replace(/\^\{i\}/g, "ⁱ");
  s = s.replace(/\^\{t\}/g, "ᵗ");

  // Subscripts
  s = s.replace(/_1\b/g, "₁");
  s = s.replace(/_2\b/g, "₂");
  s = s.replace(/_0\b/g, "₀");
  s = s.replace(/_\{1\}/g, "₁");
  s = s.replace(/_\{2\}/g, "₂");
  s = s.replace(/_\{0\}/g, "₀");
  s = s.replace(/_\{n\}/g, "ₙ");
  s = s.replace(/_\{i\}/g, "ᵢ");
  s = s.replace(/_\{x\}/g, "ₓ");

  // Remove remaining loose backslashes before plain letters
  s = s.replace(/\\([a-zA-Z]+)/g, "$1");

  // Clean double spaces
  s = s.replace(/\s{2,}/g, " ").trim();

  return s;
}

/**
 * Replaces inline math delimiters ($...$ and \(...\)) inside text with formatted math notation.
 */
export function formatInlineMathForPdf(text: string): string {
  if (!text) return "";
  let s = text;

  // Replace display math if inline
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => formatLatexForPdf(math, true));

  // Replace inline $...$
  s = s.replace(/\$([^$\n]+)\$/g, (_, math) => formatLatexForPdf(math, false));

  // Replace inline \(...\)
  s = s.replace(/(?:\\)+\(\s*([^\n]+?)\s*(?:\\)+\)/g, (_, math) => formatLatexForPdf(math, false));

  return s;
}

/**
 * Generates an academic publication-ready PDF document Buffer using PDFKit,
 * exactly matching the structure, typography, and styling of FormattedPreview.
 */
export async function generatePdfBuffer(
  markdown: string,
  options: ExportDocumentOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const { title = "Academic Notes", fontFamily = "Times New Roman", accentColor = "#1A365D" } = options;

      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 48, bottom: 48, left: 48, right: 48 },
        bufferPages: true,
        info: {
          Title: title,
          Author: "Format AI",
          Subject: "Academic Notes and Mathematical Formulas",
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
      doc.on("error", (err) => reject(err));

      // Font mapping for PDFKit standard fonts
      const isSans = /calibri|arial|aptos/i.test(fontFamily);
      const fontRegular = isSans ? "Helvetica" : "Times-Roman";
      const fontBold = isSans ? "Helvetica-Bold" : "Times-Bold";
      const fontItalic = isSans ? "Helvetica-Oblique" : "Times-Italic";
      const fontMono = "Courier";

      const primaryColor = accentColor.startsWith("#") ? accentColor : `#${accentColor}`;
      const secondaryColor = accentColor === "#1A365D" ? "#2B6CB0" : primaryColor;
      const contentWidth = doc.page.width - 96;

      // Ensure enough vertical space before drawing a block element; add page if needed
      const ensureSpace = (neededHeight: number) => {
        if (doc.y + neededHeight > doc.page.height - 48) {
          doc.addPage();
        }
      };

      // Document Running Header on Page 1
      doc.y = 48;

      // Document Title Banner matching Word Sheet Preview
      doc.font(fontBold).fontSize(19).fillColor(primaryColor);
      doc.text(title || "Academic Notes", 48, doc.y, { width: contentWidth, align: "left" });
      doc.moveDown(0.25);
      doc.moveTo(48, doc.y).lineTo(doc.page.width - 48, doc.y).lineWidth(1.5).strokeColor(primaryColor).stroke();
      doc.moveDown(0.6);

      const ast = parseMarkdown(markdown);

      for (const node of ast.children) {
        // 1. Display Math: $$ ... $$
        if (node.type === "math") {
          const formattedMath = formatLatexForPdf(node.value, true);
          ensureSpace(42);

          doc.moveDown(0.3);
          const boxY = doc.y;
          const boxHeight = Math.max(30, doc.heightOfString(formattedMath, { width: contentWidth - 24 }) + 14);

          doc.rect(48, boxY, contentWidth, boxHeight).fillColor("#F8FAFC").fill();
          doc.rect(48, boxY, contentWidth, boxHeight).lineWidth(0.75).strokeColor("#CBD5E1").stroke();

          doc.font(fontItalic).fontSize(10.5).fillColor("#0F172A");
          doc.text(formattedMath, 60, boxY + 7, {
            width: contentWidth - 24,
            align: "center",
          });

          doc.y = boxY + boxHeight + 6;
          continue;
        }

        // 2. Headings
        if (node.type === "heading") {
          const rawHeading = plainText(node).trim();
          const depth = (node as any).depth || 1;

          // Section Header (e.g. Section A: Descriptive Statistics...)
          const secMatch = rawHeading.match(/^(?:\*{0,2})Section\s+([A-Z]):?\s*(.*?)(?:\*{0,2})$/i);
          if (secMatch) {
            const sectionLetter = secMatch[1].toUpperCase();
            const sectionDesc = secMatch[2].trim().replace(/^[:\s-]+/, "").replace(/^\*+|\*+$/g, "");
            const fullSectionTitle = `Section ${sectionLetter}:${sectionDesc ? " " + sectionDesc : ""}`;
            const formattedTitle = formatInlineMathForPdf(fullSectionTitle);

            ensureSpace(32);
            doc.moveDown(0.5);
            doc.font(fontBold).fontSize(12.5).fillColor(primaryColor);
            doc.text(formattedTitle, 48, doc.y, { width: contentWidth });
            doc.moveDown(0.15);
            doc.moveTo(48, doc.y).lineTo(doc.page.width - 48, doc.y).lineWidth(0.5).strokeColor("#E2E8F0").stroke();
            doc.moveDown(0.3);
            continue;
          }

          if (depth === 1) {
            ensureSpace(40);
            doc.moveDown(0.7);
            const hText = formatInlineMathForPdf(rawHeading);
            doc.font(fontBold).fontSize(16).fillColor(primaryColor);
            doc.text(hText, 48, doc.y, { width: contentWidth });
            doc.moveDown(0.2);
            doc.moveTo(48, doc.y).lineTo(doc.page.width - 48, doc.y).lineWidth(0.75).strokeColor("#CBD5E1").stroke();
            doc.moveDown(0.4);
            continue;
          }

          if (depth === 2) {
            ensureSpace(34);
            doc.moveDown(0.55);
            const hText = formatInlineMathForPdf(rawHeading);
            doc.font(fontBold).fontSize(13).fillColor(secondaryColor);
            doc.text(hText, 48, doc.y, { width: contentWidth });
            doc.moveDown(0.25);
            continue;
          }

          if (depth === 3) {
            ensureSpace(28);
            doc.moveDown(0.45);
            const hText = formatInlineMathForPdf(rawHeading);
            const dotY = doc.y + 4.5;
            doc.circle(52, dotY, 2.5).fillColor(primaryColor).fill();
            doc.font(fontBold).fontSize(11).fillColor("#1E293B");
            doc.text(hText, 60, doc.y, { width: contentWidth - 12 });
            doc.moveDown(0.2);
            continue;
          }

          if (depth >= 4) {
            ensureSpace(24);
            doc.moveDown(0.35);
            const hText = formatInlineMathForPdf(rawHeading);
            doc.font(fontBold).fontSize(9.5).fillColor("#475569");
            doc.text(hText.toUpperCase(), 48, doc.y, { width: contentWidth });
            doc.moveDown(0.2);
            continue;
          }
        }

        // 3. Tables
        if (node.type === "table") {
          const rows = ((node as any).children || []).filter((c: any) => c.type === "tableRow");
          if (rows.length > 0) {
            doc.moveDown(0.35);
            const tableRows: string[][] = rows.map((r: any) =>
              ((r as any).children || []).map((c: any) => plainText(c).trim())
            );
            const colCount = Math.max(...tableRows.map((r) => r.length), 1);
            const colWidth = contentWidth / colCount;

            for (let r = 0; r < tableRows.length; r++) {
              const isHeader = r === 0;
              const rowCells = tableRows[r];

              let maxCellHeight = 12;
              const formattedCells = rowCells.map((c) => formatInlineMathForPdf(c.replace(/\*\*([^*]+)\*\*/g, "$1")));

              doc.font(isHeader ? fontBold : fontRegular).fontSize(isHeader ? 9 : 8.5);
              for (let c = 0; c < colCount; c++) {
                const text = formattedCells[c] || "";
                const h = doc.heightOfString(text, { width: colWidth - 10 });
                if (h > maxCellHeight) maxCellHeight = h;
              }

              const rowHeight = maxCellHeight + 8;
              ensureSpace(rowHeight + 4);

              const rowY = doc.y;

              if (isHeader) {
                doc.rect(48, rowY, contentWidth, rowHeight).fillColor("#F1F5F9").fill();
              } else if (r % 2 === 1) {
                doc.rect(48, rowY, contentWidth, rowHeight).fillColor("#F8FAFC").fill();
              }

              doc.rect(48, rowY, contentWidth, rowHeight).lineWidth(0.5).strokeColor("#CBD5E1").stroke();

              doc.font(isHeader ? fontBold : fontRegular).fontSize(isHeader ? 9 : 8.5);
              doc.fillColor(isHeader ? "#0F172A" : "#334155");

              for (let c = 0; c < colCount; c++) {
                const cellText = formattedCells[c] || "";
                doc.text(cellText, 48 + c * colWidth + 5, rowY + 4, {
                  width: colWidth - 10,
                  align: "left",
                  lineGap: 1.5,
                });
                if (c > 0) {
                  doc.moveTo(48 + c * colWidth, rowY).lineTo(48 + c * colWidth, rowY + rowHeight).lineWidth(0.5).strokeColor("#E2E8F0").stroke();
                }
              }

              doc.y = rowY + rowHeight;
            }
            doc.moveDown(0.35);
          }
          continue;
        }

        // 4. Lists
        if (node.type === "list") {
          const ordered = !!(node as any).ordered;
          const startNum = (node as any).start || 1;
          const items = (node as any).children || [];

          for (let idx = 0; idx < items.length; idx++) {
            const item = items[idx];
            const itemText = formatInlineMathForPdf(
              plainText(item).replace(/\*\*([^*]+)\*\*/g, "$1").trim()
            );

            ensureSpace(18);
            const currentY = doc.y;

            if (ordered) {
              const prefix = `${startNum + idx}.`;
              doc.font(fontBold).fontSize(9.5).fillColor(primaryColor);
              doc.text(prefix, 50, currentY, { width: 18, align: "left" });
              doc.font(fontRegular).fontSize(9.5).fillColor("#1E293B");
              doc.text(itemText, 70, currentY, {
                width: contentWidth - 22,
                lineGap: 2.5,
              });
              doc.moveDown(0.15);
            } else {
              doc.font(fontRegular).fontSize(9.5).fillColor("#334155");
              doc.text("• " + itemText, 56, currentY, {
                width: contentWidth - 16,
                lineGap: 2.5,
              });
              doc.moveDown(0.1);
            }
          }
          continue;
        }

        // 5. Blockquote
        if (node.type === "blockquote") {
          const quoteText = formatInlineMathForPdf(plainText(node).trim());
          const quoteHeight = doc.heightOfString(quoteText, { width: contentWidth - 24 }) + 12;
          ensureSpace(quoteHeight);

          doc.moveDown(0.25);
          const quoteY = doc.y;
          doc.rect(48, quoteY, contentWidth, quoteHeight).fillColor("#F0F7FF").fill();
          doc.rect(48, quoteY, 3.5, quoteHeight).fillColor(primaryColor).fill();

          doc.font(fontItalic).fontSize(9.5).fillColor("#1E293B");
          doc.text(quoteText, 58, quoteY + 6, {
            width: contentWidth - 20,
            lineGap: 2.5,
          });

          doc.y = quoteY + quoteHeight + 4;
          continue;
        }

        // 6. Code
        if (node.type === "code") {
          const codeText = (node as any).value || "";
          const codeHeight = doc.heightOfString(codeText, { width: contentWidth - 24 }) + 12;
          ensureSpace(codeHeight);

          doc.moveDown(0.25);
          const codeY = doc.y;
          doc.rect(48, codeY, contentWidth, codeHeight).fillColor("#F8FAFC").fill();
          doc.rect(48, codeY, contentWidth, codeHeight).lineWidth(0.5).strokeColor("#CBD5E1").stroke();

          doc.font(fontMono).fontSize(8.5).fillColor("#1E293B");
          doc.text(codeText, 56, codeY + 6, {
            width: contentWidth - 16,
            lineGap: 2,
          });

          doc.y = codeY + codeHeight + 4;
          continue;
        }

        // 7. Paragraph
        if (node.type === "paragraph") {
          const trimmed = plainText(node).trim();
          if (!trimmed) continue;

          // 4-digit Year Header (e.g. 2019, 2025)
          if (/^\d{4}$/.test(trimmed)) {
            ensureSpace(30);
            doc.moveDown(0.5);
            doc.font(fontBold).fontSize(15).fillColor(primaryColor);
            doc.text(trimmed, 48, doc.y, { width: contentWidth });
            doc.moveDown(0.15);
            continue;
          }

          // Exam Title (e.g. Final Examination)
          if (/^(?:\*{0,2})(?:Final|Midterm|Mid-Semester)\s+Examination(?:\*{0,2})$/i.test(trimmed)) {
            const cleanExam = trimmed.replace(/^\*+|\*+$/g, "").trim();
            ensureSpace(22);
            doc.font(fontItalic).fontSize(11).fillColor("#475569");
            doc.text(cleanExam, 48, doc.y, { width: contentWidth });
            doc.moveDown(0.3);
            continue;
          }

          // Section Header
          const secMatch = trimmed.match(/^(?:\*{0,2})Section\s+([A-Z]):?\s*(.*?)(?:\*{0,2})$/i);
          if (secMatch) {
            const sectionLetter = secMatch[1].toUpperCase();
            const sectionDesc = secMatch[2].trim().replace(/^[:\s-]+/, "").replace(/^\*+|\*+$/g, "");
            const fullSectionTitle = `Section ${sectionLetter}:${sectionDesc ? " " + sectionDesc : ""}`;
            const formattedTitle = formatInlineMathForPdf(fullSectionTitle);

            ensureSpace(32);
            doc.moveDown(0.5);
            doc.font(fontBold).fontSize(12.5).fillColor(primaryColor);
            doc.text(formattedTitle, 48, doc.y, { width: contentWidth });
            doc.moveDown(0.15);
            doc.moveTo(48, doc.y).lineTo(doc.page.width - 48, doc.y).lineWidth(0.5).strokeColor("#E2E8F0").stroke();
            doc.moveDown(0.3);
            continue;
          }

          // Sub-questions & Lettered list items: e.g. (a) Define... or a. Define...
          const subMatch = trimmed.match(/^\s*(?:[-*•o]\s+)?(?:\*{0,2})([a-z]\.|\([a-z]\)|[a-z]\)|\(i{1,3}\)|[i-v]+\.|\([0-9]+\))\s*(.*)$/i);
          if (subMatch) {
            const prefix = subMatch[1].replace(/^\(/, "").replace(/\)$/, ".");
            const subContent = formatInlineMathForPdf(
              subMatch[2].replace(/^\*+|\*+$/g, "").trim()
            );

            ensureSpace(20);
            const currentY = doc.y;
            doc.font(fontBold).fontSize(9.5).fillColor("#0F172A");
            doc.text(prefix, 64, currentY, { width: 22, align: "left" });
            doc.font(fontRegular).fontSize(9.5).fillColor("#334155");
            doc.text(subContent, 88, currentY, {
              width: contentWidth - 40,
              lineGap: 2.5,
            });
            doc.moveDown(0.15);
            continue;
          }

          // Metadata and Side notes
          const metaMatch = trimmed.match(/^(?:\s*[-*•o]\s+)?(?:\*{0,2})(\(?Side note:|\(?Note:|Frequency:)\s*(.*?)(?:\*{0,2})$/i);
          if (metaMatch) {
            const label = metaMatch[1];
            const noteContent = formatInlineMathForPdf(
              metaMatch[2].replace(/^\*+|\*+$/g, "").trim()
            );
            const isSideNote = /side note|note/i.test(label);

            ensureSpace(18);
            doc.font(isSideNote ? fontItalic : fontBold).fontSize(8.5).fillColor("#64748B");
            doc.text(`${label} ${noteContent}`, 64, doc.y, {
              width: contentWidth - 24,
              lineGap: 2,
            });
            doc.moveDown(0.15);
            continue;
          }

          // Regular Paragraph
          const cleanParagraph = formatInlineMathForPdf(
            trimmed
              .replace(/\*\*([^*]+)\*\*/g, "$1")
              .replace(/\*([^*]+)\*/g, "$1")
              .replace(/`([^`]+)`/g, "$1")
          );

          ensureSpace(20);
          doc.font(fontRegular).fontSize(9.5).fillColor("#1E293B");
          doc.text(cleanParagraph, 48, doc.y, {
            width: contentWidth,
            lineGap: 2.8,
          });
          doc.moveDown(0.2);
        }
      }

      // Running Headers and Footers on all pages
      const totalPages = doc.bufferedPageRange().count;
      for (let p = 0; p < totalPages; p++) {
        doc.switchToPage(p);

        // Running Header (top of page)
        doc.font(fontItalic).fontSize(8).fillColor("#64748B");
        doc.text(title || "Academic Notes", 48, 26, {
          width: contentWidth,
          align: "left",
          lineBreak: false,
        });
        doc.font(fontRegular).fontSize(8).fillColor("#94A3B8");
        doc.text("Word Document • Standard Typesetting", 48, 26, {
          width: contentWidth,
          align: "right",
          lineBreak: false,
        });
        doc.moveTo(48, 38).lineTo(doc.page.width - 48, 38).lineWidth(0.5).strokeColor("#E2E8F0").stroke();

        // Running Footer (bottom of page)
        doc.moveTo(48, doc.page.height - 38).lineTo(doc.page.width - 48, doc.page.height - 38).lineWidth(0.5).strokeColor("#E2E8F0").stroke();
        doc.font(fontRegular).fontSize(8).fillColor("#94A3B8");
        doc.text("Standard Academic Typesetting (Times New Roman / OMML)", 48, doc.page.height - 28, {
          width: contentWidth,
          align: "left",
        });
        doc.text(`Page ${p + 1} of ${totalPages}`, 48, doc.page.height - 28, {
          width: contentWidth,
          align: "right",
        });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
