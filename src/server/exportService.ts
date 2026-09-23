import PDFDocument from "pdfkit";
import { sanitizeMathToUnicode } from "./docxService.ts";

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
export function generateLaTeXDocument(markdown: string, title: string): string {
  const safeTitle = (title || "Academic Notes")
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([%$&#_{}])/g, "\\$1");

  const lines = markdown.split("\n");
  const latexLines: string[] = [];

  let inItemize = false;
  let inEnumerate = false;

  const closeLists = () => {
    if (inItemize) {
      latexLines.push("\\end{itemize}\n");
      inItemize = false;
    }
    if (inEnumerate) {
      latexLines.push("\\end{enumerate}\n");
      inEnumerate = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      closeLists();
      latexLines.push("");
      continue;
    }

    // Display Math block: $$ ... $$
    if (trimmed.startsWith("$$")) {
      closeLists();
      let mathContent = "";
      if (trimmed.endsWith("$$") && trimmed.length > 2) {
        mathContent = trimmed.slice(2, -2).trim();
      } else {
        const mathLines: string[] = [];
        const first = trimmed.slice(2).trim();
        if (first) mathLines.push(first);
        i++;
        while (i < lines.length) {
          const next = lines[i].trim();
          if (next.endsWith("$$")) {
            const endPart = next.slice(0, -2).trim();
            if (endPart) mathLines.push(endPart);
            break;
          }
          mathLines.push(lines[i]);
          i++;
        }
        mathContent = mathLines.join("\n").trim();
      }
      latexLines.push(`\\[\n${mathContent}\n\\]\n`);
      continue;
    }

    // Headings
    if (trimmed.startsWith("# ")) {
      closeLists();
      latexLines.push(`\\section{${escapeTextForLaTeX(trimmed.slice(2).trim())}}\n`);
      continue;
    }
    if (trimmed.startsWith("## ")) {
      closeLists();
      latexLines.push(`\\subsection{${escapeTextForLaTeX(trimmed.slice(3).trim())}}\n`);
      continue;
    }
    if (trimmed.startsWith("### ")) {
      closeLists();
      latexLines.push(`\\subsubsection{${escapeTextForLaTeX(trimmed.slice(4).trim())}}\n`);
      continue;
    }
    if (trimmed.startsWith("#### ")) {
      closeLists();
      latexLines.push(`\\paragraph{${escapeTextForLaTeX(trimmed.slice(5).trim())}}\n`);
      continue;
    }

    // Table: | col1 | col2 |
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      closeLists();
      const tableRows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
        const row = lines[i].trim();
        if (!/^\|[-:\s|]+\|$/.test(row)) {
          const cells = row.slice(1, -1).split("|").map((c) => c.trim());
          tableRows.push(cells);
        }
        i++;
      }
      i--; // Step back one line

      if (tableRows.length > 0) {
        const colCount = Math.max(...tableRows.map((r) => r.length));
        const colAlign = "l".repeat(colCount);
        latexLines.push("\\begin{table}[htbp]");
        latexLines.push("\\centering");
        latexLines.push(`\\begin{tabular}{${colAlign}}`);
        latexLines.push("\\toprule");

        const header = tableRows[0];
        latexLines.push(header.map(formatTableCellLaTeX).join(" & ") + " \\\\");
        latexLines.push("\\midrule");

        for (let r = 1; r < tableRows.length; r++) {
          const row = tableRows[r];
          while (row.length < colCount) row.push("");
          latexLines.push(row.map(formatTableCellLaTeX).join(" & ") + " \\\\");
        }

        latexLines.push("\\bottomrule");
        latexLines.push("\\end{tabular}");
        latexLines.push("\\end{table}\n");
      }
      continue;
    }

    // Bullet List
    if (/^\s*[-*•]\s+/.test(rawLine)) {
      if (inEnumerate) closeLists();
      if (!inItemize) {
        latexLines.push("\\begin{itemize}");
        inItemize = true;
      }
      const itemText = trimmed.replace(/^[-*•]\s+/, "");
      latexLines.push(`  \\item ${formatInlineLaTeX(itemText)}`);
      continue;
    }

    // Numbered List
    if (/^\s*\d+[\.\)]\s+/.test(trimmed)) {
      if (inItemize) closeLists();
      if (!inEnumerate) {
        latexLines.push("\\begin{enumerate}");
        inEnumerate = true;
      }
      const itemText = trimmed.replace(/^\d+[\.\)]\s+/, "");
      latexLines.push(`  \\item ${formatInlineLaTeX(itemText)}`);
      continue;
    }

    // Standard Paragraph
    closeLists();
    latexLines.push(`${formatInlineLaTeX(trimmed)}\n`);
  }

  closeLists();

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

function escapeTextForLaTeX(text: string): string {
  return text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([%$&#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

function formatInlineLaTeX(text: string): string {
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

function formatTableCellLaTeX(cell: string): string {
  return formatInlineLaTeX(cell.trim());
}

/**
 * Generates clean Markdown (.md) document with standardized title.
 */
export function generateMarkdownDocument(markdown: string, title: string): string {
  const trimmed = markdown.trim();
  const safeTitle = title.trim() || "Academic Notes";

  if (!trimmed.startsWith("# ")) {
    return `# ${safeTitle}\n\n${trimmed}\n`;
  }
  return `${trimmed}\n`;
}

/**
 * Generates Plain Text (.txt) with readable ASCII layout and Unicode math notation.
 */
export function generatePlainTextDocument(markdown: string, title: string): string {
  const safeTitle = title.trim() || "Academic Notes";
  const divider = "=".repeat(Math.min(70, Math.max(safeTitle.length, 40)));

  let text = markdown;

  // Convert LaTeX math in $...$ and $$...$$ to unicode notation
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => `\n    ${sanitizeMathToUnicode(math.trim())}\n`);
  text = text.replace(/\$([^$\n]+)\$/g, (_, math) => sanitizeMathToUnicode(math.trim()));

  // Headings
  text = text.replace(/^#\s+(.*)$/gm, (_, h) => `\n\n${h.toUpperCase()}\n${"=".repeat(h.length)}`);
  text = text.replace(/^##\s+(.*)$/gm, (_, h) => `\n\n${h}\n${"-".repeat(h.length)}`);
  text = text.replace(/^###\s+(.*)$/gm, (_, h) => `\n\n--- ${h} ---`);

  // Bold & Italic markdown tokens
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/\*([^*]+)\*/g, "$1");
  text = text.replace(/`([^`]+)`/g, "$1");

  // Format Tables into clean plain text columns
  const lines = text.split("\n");
  const processedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("|") && line.endsWith("|")) {
      const tableRows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
        const row = lines[i].trim();
        if (!/^\|[-:\s|]+\|$/.test(row)) {
          tableRows.push(row.slice(1, -1).split("|").map((c) => c.trim()));
        }
        i++;
      }
      i--;

      if (tableRows.length > 0) {
        const colCount = Math.max(...tableRows.map((r) => r.length));
        const colWidths = new Array(colCount).fill(0);
        for (const row of tableRows) {
          for (let c = 0; c < row.length; c++) {
            colWidths[c] = Math.max(colWidths[c], row[c].length);
          }
        }

        for (let r = 0; r < tableRows.length; r++) {
          const row = tableRows[r];
          const formattedCells = row.map((cell, c) => cell.padEnd(colWidths[c]));
          processedLines.push(formattedCells.join("  |  "));
          if (r === 0) {
            processedLines.push(colWidths.map((w) => "-".repeat(w)).join("--+--"));
          }
        }
        processedLines.push("");
      }
      continue;
    }
    processedLines.push(lines[i]);
  }

  const body = processedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
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

      const lines = markdown.split("\n");
      let i = 0;

      while (i < lines.length) {
        const rawLine = lines[i];
        const trimmed = rawLine.trim();

        if (!trimmed) {
          doc.moveDown(0.35);
          i++;
          continue;
        }

        // 1. Display Math: $$ ... $$ or \[ ... \]
        if (trimmed.startsWith("$$") || /^(?:\\)+\[/.test(trimmed)) {
          let mathContent = "";
          if (trimmed.startsWith("$$")) {
            if (trimmed.endsWith("$$") && trimmed.length >= 4) {
              mathContent = trimmed.slice(2, -2).trim();
              i++;
            } else {
              const mathLines: string[] = [];
              const first = trimmed.slice(2).trim();
              if (first) mathLines.push(first);
              i++;
              while (i < lines.length) {
                const next = lines[i].trim();
                if (next.endsWith("$$")) {
                  const endPart = next.slice(0, -2).trim();
                  if (endPart) mathLines.push(endPart);
                  i++;
                  break;
                }
                mathLines.push(lines[i]);
                i++;
              }
              mathContent = mathLines.join(" ").trim();
            }
          } else {
            // \[ ... \]
            const singleMatch = trimmed.match(/^(?:\\)+\[\s*([\s\S]*?)\s*(?:\\)+\]$/);
            if (singleMatch) {
              mathContent = singleMatch[1].trim();
              i++;
            } else {
              const mathLines: string[] = [];
              const first = trimmed.replace(/^(?:\\)+\[\s*/, "").trim();
              if (first) mathLines.push(first);
              i++;
              while (i < lines.length) {
                const next = lines[i].trim();
                if (/(?:\\)+\]$/.test(next)) {
                  const endPart = next.replace(/(?:\\)+\]$/, "").trim();
                  if (endPart) mathLines.push(endPart);
                  i++;
                  break;
                }
                mathLines.push(lines[i]);
                i++;
              }
              mathContent = mathLines.join(" ").trim();
            }
          }

          const formattedMath = formatLatexForPdf(mathContent, true);
          ensureSpace(42);

          doc.moveDown(0.3);
          const boxY = doc.y;
          const boxHeight = Math.max(30, doc.heightOfString(formattedMath, { width: contentWidth - 24 }) + 14);

          // Subtle equation card with border
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
        if (trimmed.startsWith("# ")) {
          ensureSpace(40);
          doc.moveDown(0.7);
          const hText = formatInlineMathForPdf(trimmed.slice(2).trim());
          doc.font(fontBold).fontSize(16).fillColor(primaryColor);
          doc.text(hText, 48, doc.y, { width: contentWidth });
          doc.moveDown(0.2);
          doc.moveTo(48, doc.y).lineTo(doc.page.width - 48, doc.y).lineWidth(0.75).strokeColor("#CBD5E1").stroke();
          doc.moveDown(0.4);
          i++;
          continue;
        }

        if (trimmed.startsWith("## ")) {
          ensureSpace(34);
          doc.moveDown(0.55);
          const hText = formatInlineMathForPdf(trimmed.slice(3).trim());
          doc.font(fontBold).fontSize(13).fillColor(secondaryColor);
          doc.text(hText, 48, doc.y, { width: contentWidth });
          doc.moveDown(0.25);
          i++;
          continue;
        }

        if (trimmed.startsWith("### ")) {
          ensureSpace(28);
          doc.moveDown(0.45);
          const hText = formatInlineMathForPdf(trimmed.slice(4).trim());
          // Circular accent dot indicator
          const dotY = doc.y + 4.5;
          doc.circle(52, dotY, 2.5).fillColor(primaryColor).fill();
          doc.font(fontBold).fontSize(11).fillColor("#1E293B");
          doc.text(hText, 60, doc.y, { width: contentWidth - 12 });
          doc.moveDown(0.2);
          i++;
          continue;
        }

        if (trimmed.startsWith("#### ")) {
          ensureSpace(24);
          doc.moveDown(0.35);
          const hText = formatInlineMathForPdf(trimmed.slice(5).trim());
          doc.font(fontBold).fontSize(9.5).fillColor("#475569");
          doc.text(hText.toUpperCase(), 48, doc.y, { width: contentWidth });
          doc.moveDown(0.2);
          i++;
          continue;
        }

        // 3. 4-digit Year Header (e.g. 2019, 2025)
        if (/^\d{4}$/.test(trimmed)) {
          ensureSpace(30);
          doc.moveDown(0.5);
          doc.font(fontBold).fontSize(15).fillColor(primaryColor);
          doc.text(trimmed, 48, doc.y, { width: contentWidth });
          doc.moveDown(0.15);
          i++;
          continue;
        }

        // 4. Exam Title (e.g. Final Examination, Midterm Examination)
        if (/^(?:\*{0,2})(?:Final|Midterm|Mid-Semester)\s+Examination(?:\*{0,2})$/i.test(trimmed)) {
          const cleanExam = trimmed.replace(/^\*+|\*+$/g, "").trim();
          ensureSpace(22);
          doc.font(fontItalic).fontSize(11).fillColor("#475569");
          doc.text(cleanExam, 48, doc.y, { width: contentWidth });
          doc.moveDown(0.3);
          i++;
          continue;
        }

        // 5. Section Header (e.g. Section A: Descriptive Statistics...)
        if (/^(?:#{1,3}\s*)?(?:\*{0,2})Section\s+([A-Z]):?\s*(.*?)(?:\*{0,2})$/i.test(trimmed)) {
          const match = trimmed.match(/^(?:#{1,3}\s*)?(?:\*{0,2})Section\s+([A-Z]):?\s*(.*?)(?:\*{0,2})$/i)!;
          const sectionLetter = match[1].toUpperCase();
          const sectionDesc = match[2].trim().replace(/^[:\s-]+/, "").replace(/^\*+|\*+$/g, "");
          const fullSectionTitle = `Section ${sectionLetter}:${sectionDesc ? " " + sectionDesc : ""}`;
          const formattedTitle = formatInlineMathForPdf(fullSectionTitle);

          ensureSpace(32);
          doc.moveDown(0.5);
          doc.font(fontBold).fontSize(12.5).fillColor(primaryColor);
          doc.text(formattedTitle, 48, doc.y, { width: contentWidth });
          doc.moveDown(0.15);
          doc.moveTo(48, doc.y).lineTo(doc.page.width - 48, doc.y).lineWidth(0.5).strokeColor("#E2E8F0").stroke();
          doc.moveDown(0.3);
          i++;
          continue;
        }

        // 6. Topic Header (e.g. Topic 1: ...)
        if (/^(?:#{2,4}\s*)?(?:\*{0,2})(Topic\s+\d+:?\s*.*?)(?:\*{0,2})$/i.test(trimmed)) {
          const topicText = trimmed.replace(/^#{2,4}\s*/, "").replace(/^\*+|\*+$/g, "").trim();
          const formattedTopic = formatInlineMathForPdf(topicText);

          ensureSpace(26);
          doc.moveDown(0.35);
          const dotY = doc.y + 4;
          doc.circle(52, dotY, 2).fillColor(primaryColor).fill();
          doc.font(fontBold).fontSize(10.5).fillColor("#1E293B");
          doc.text(formattedTopic, 60, doc.y, { width: contentWidth - 12 });
          doc.moveDown(0.2);
          i++;
          continue;
        }

        // 7. Pure Data Array: Centered comma-separated sequence of numbers
        if (/^(\s*\d+(?:\.\d+)?(?:,\s*|\s+)){3,}\d+(?:\.\d+)?(?:,\s*)?$/.test(trimmed)) {
          const tokens = trimmed.replace(/,/g, " ").trim().split(/\s+/);
          const formattedData = tokens.join(", ");
          ensureSpace(24);

          doc.moveDown(0.2);
          const dataY = doc.y;
          doc.rect(58, dataY, contentWidth - 20, 18).fillColor("#F8FAFC").fill();
          doc.font(fontMono).fontSize(8.5).fillColor("#334155");
          doc.text(formattedData, 62, dataY + 4, {
            width: contentWidth - 28,
            align: "center",
          });
          doc.y = dataY + 22;
          i++;
          continue;
        }

        // 8. Sub-questions & Lettered list items: e.g. a. Arithmetic mean... or (i) Draw...
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
          i++;
          continue;
        }

        // 9. Metadata and Side notes (Frequency: ..., Side note: ...)
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
          i++;
          continue;
        }

        // 10. Tables: | col1 | col2 |
        if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
          const tableRows: string[][] = [];
          while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
            const rowText = lines[i].trim();
            if (!/^\|[-:\s|]+\|$/.test(rowText)) {
              tableRows.push(rowText.slice(1, -1).split("|").map((c) => c.trim()));
            }
            i++;
          }

          if (tableRows.length > 0) {
            doc.moveDown(0.35);
            const colCount = Math.max(...tableRows.map((r) => r.length));
            const colWidth = contentWidth / colCount;

            for (let r = 0; r < tableRows.length; r++) {
              const isHeader = r === 0;
              const rowCells = tableRows[r];

              // Calculate maximum cell text height to prevent ANY truncation
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

              // Row background fill
              if (isHeader) {
                doc.rect(48, rowY, contentWidth, rowHeight).fillColor("#F1F5F9").fill();
              } else if (r % 2 === 1) {
                doc.rect(48, rowY, contentWidth, rowHeight).fillColor("#F8FAFC").fill();
              }

              // Row border outline
              doc.rect(48, rowY, contentWidth, rowHeight).lineWidth(0.5).strokeColor("#CBD5E1").stroke();

              // Draw cell content
              doc.font(isHeader ? fontBold : fontRegular).fontSize(isHeader ? 9 : 8.5);
              doc.fillColor(isHeader ? "#0F172A" : "#334155");

              for (let c = 0; c < colCount; c++) {
                const cellText = formattedCells[c] || "";
                doc.text(cellText, 48 + c * colWidth + 5, rowY + 4, {
                  width: colWidth - 10,
                  align: "left",
                  lineGap: 1.5,
                });
                // Vertical divider line between columns
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

        // 11. Blockquotes / Formula callouts: > ...
        if (trimmed.startsWith("> ")) {
          const quoteText = formatInlineMathForPdf(trimmed.slice(2).trim());
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
          i++;
          continue;
        }

        // 12. Bullet list items: - or * or •
        if (/^\s*[-*•]\s+/.test(rawLine)) {
          const itemText = formatInlineMathForPdf(
            trimmed.replace(/^[-*•]\s+/, "").replace(/\*\*([^*]+)\*\*/g, "$1")
          );
          ensureSpace(18);
          doc.font(fontRegular).fontSize(9.5).fillColor("#334155");
          doc.text("• " + itemText, 56, doc.y, {
            width: contentWidth - 16,
            lineGap: 2.5,
          });
          doc.moveDown(0.1);
          i++;
          continue;
        }

        // 13. Numbered list item: 1. or 2)
        if (/^\s*\d+[\.\)]\s+/.test(trimmed)) {
          const match = trimmed.match(/^(\d+[\.\)])\s+(.*)$/);
          if (match) {
            const prefix = match[1];
            const itemText = formatInlineMathForPdf(
              match[2].replace(/\*\*([^*]+)\*\*/g, "$1")
            );
            ensureSpace(18);
            const currentY = doc.y;
            doc.font(fontBold).fontSize(9.5).fillColor(primaryColor);
            doc.text(prefix, 50, currentY, { width: 18, align: "left" });
            doc.font(fontRegular).fontSize(9.5).fillColor("#1E293B");
            doc.text(itemText, 70, currentY, {
              width: contentWidth - 22,
              lineGap: 2.5,
            });
            doc.moveDown(0.15);
            i++;
            continue;
          }
        }

        // 14. Regular Paragraph
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
        i++;
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
