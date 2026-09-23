import PDFDocument from "pdfkit";
import { sanitizeMathToUnicode } from "./docxService.ts";
import { generateFilenameFromContent, sanitizeFilenameBase } from "../utils/filename.ts";

export { generateFilenameFromContent, sanitizeFilenameBase };

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
 * Preserves Unicode letters (including Bangla and accented chars) while stripping invalid filesystem chars.
 */
export function getSafeFilenameBase(title: string, defaultName = "FormatAI_Document"): string {
  return sanitizeFilenameBase(title, defaultName);
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
 * Generates an academic publication-ready PDF document Buffer using PDFKit.
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
        margins: { top: 54, bottom: 54, left: 54, right: 54 },
        bufferPages: true,
        info: {
          Title: title,
          Author: "Format AI",
          Subject: "Academic Notes and Formulas",
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

      const primaryColor = accentColor.startsWith("#") ? accentColor : `#${accentColor}`;

      // Running Header on each page
      const printHeader = () => {
        doc.font(fontItalic).fontSize(8).fillColor("#64748B");
        doc.text(title || "Academic Notes", 54, 30, {
          width: doc.page.width - 108,
          align: "left",
          lineBreak: false,
        });
        doc.font(fontRegular).fontSize(8).fillColor("#94A3B8");
        doc.text("Format AI • Typeset Notes", 54, 30, {
          width: doc.page.width - 108,
          align: "right",
          lineBreak: false,
        });
        doc.moveTo(54, 42).lineTo(doc.page.width - 54, 42).lineWidth(0.5).strokeColor("#E2E8F0").stroke();
      };

      printHeader();

      // Document Title
      doc.moveDown(1.5);
      doc.font(fontBold).fontSize(20).fillColor(primaryColor);
      doc.text(title || "Academic Notes", { align: "left" });
      doc.moveDown(0.3);
      doc.moveTo(54, doc.y).lineTo(doc.page.width - 54, doc.y).lineWidth(1.5).strokeColor(primaryColor).stroke();
      doc.moveDown(0.8);

      const lines = markdown.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        const trimmed = rawLine.trim();

        if (!trimmed) {
          doc.moveDown(0.4);
          continue;
        }

        // Display Math: $$ ... $$ or \[ ... \]
        if (trimmed.startsWith("$$") || /^(?:\\)+\[/.test(trimmed)) {
          let mathContent = "";
          const isBracket = /^(?:\\)+\[/.test(trimmed);

          if (isBracket) {
            const singleMatch = trimmed.match(/^(?:\\)+\[\s*([\s\S]*?)\s*(?:(?:\\)+(?:quad|qquad|,|;|!)\s*)*(?:\\)+\]$/);
            if (singleMatch) {
              mathContent = singleMatch[1].trim().replace(/(?:\\)+(?:quad|qquad|,|;|!)\s*$/g, "").trim();
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
                  break;
                }
                mathLines.push(lines[i]);
                i++;
              }
              mathContent = mathLines.join(" ").trim();
            }
          } else if (trimmed.endsWith("$$") && trimmed.length > 2) {
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
            mathContent = mathLines.join(" ").trim();
          }

          const readableMath = sanitizeMathToUnicode(mathContent);
          doc.moveDown(0.3);
          const mathBoxY = doc.y;
          // Background box for equation
          doc.rect(54, mathBoxY, doc.page.width - 108, 28).fillColor("#F8FAFC").fill();
          doc.rect(54, mathBoxY, doc.page.width - 108, 28).lineWidth(0.5).strokeColor("#E2E8F0").stroke();

          doc.font(fontItalic).fontSize(11).fillColor("#0F172A");
          doc.text(readableMath, 60, mathBoxY + 7, {
            width: doc.page.width - 120,
            align: "center",
          });
          doc.y = mathBoxY + 34;
          doc.moveDown(0.3);
          continue;
        }

        // Horizontal divider (---, ***, ___)
        if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
          doc.moveDown(0.5);
          doc.moveTo(54, doc.y).lineTo(doc.page.width - 54, doc.y).lineWidth(0.5).strokeColor("#CBD5E1").stroke();
          doc.moveDown(0.5);
          continue;
        }

        // Heading 1: # ...
        if (trimmed.startsWith("# ")) {
          doc.moveDown(0.8);
          doc.font(fontBold).fontSize(15).fillColor(primaryColor);
          doc.text(trimmed.slice(2).trim());
          doc.moveDown(0.3);
          continue;
        }

        // Heading 2: ## ...
        if (trimmed.startsWith("## ")) {
          doc.moveDown(0.6);
          doc.font(fontBold).fontSize(13).fillColor("#1E293B");
          doc.text(trimmed.slice(3).trim());
          doc.moveDown(0.25);
          continue;
        }

        // Heading 3: ### ...
        if (trimmed.startsWith("### ")) {
          doc.moveDown(0.5);
          doc.font(fontBold).fontSize(11).fillColor("#334155");
          doc.text(trimmed.slice(4).trim());
          doc.moveDown(0.2);
          continue;
        }

        // Table detection: | col1 | col2 |
        if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
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
            doc.moveDown(0.4);
            const colCount = Math.max(...tableRows.map((r) => r.length));
            const availableWidth = doc.page.width - 108;
            const colWidth = availableWidth / colCount;

            for (let r = 0; r < tableRows.length; r++) {
              const rowY = doc.y;
              const isHeader = r === 0;

              // Row background
              if (isHeader) {
                doc.rect(54, rowY, availableWidth, 20).fillColor("#F1F5F9").fill();
              } else if (r % 2 === 1) {
                doc.rect(54, rowY, availableWidth, 18).fillColor("#F8FAFC").fill();
              }

              // Row text
              doc.font(isHeader ? fontBold : fontRegular).fontSize(isHeader ? 9 : 8.5);
              doc.fillColor(isHeader ? "#0F172A" : "#334155");

              for (let c = 0; c < colCount; c++) {
                const cellRaw = tableRows[r][c] || "";
                const cellText = sanitizeMathToUnicode(cellRaw.replace(/\*\*([^*]+)\*\*/g, "$1"));
                doc.text(cellText, 58 + c * colWidth, rowY + (isHeader ? 5 : 4), {
                  width: colWidth - 8,
                  align: "left",
                  ellipsis: true,
                });
              }

              doc.y = rowY + (isHeader ? 20 : 18);
              doc.moveTo(54, doc.y).lineTo(doc.page.width - 54, doc.y).lineWidth(0.5).strokeColor("#E2E8F0").stroke();
            }
            doc.moveDown(0.4);
          }
          continue;
        }

        // Bullet point: - or *
        if (/^\s*[-*•]\s+/.test(rawLine)) {
          const itemText = sanitizeMathToUnicode(
            trimmed.replace(/^[-*•]\s+/, "").replace(/\*\*([^*]+)\*\*/g, "$1")
          );
          doc.font(fontRegular).fontSize(9.5).fillColor("#334155");
          doc.text("• " + itemText, {
            indent: 10,
            lineGap: 2.5,
          });
          continue;
        }

        // Numbered list item: 1. or 2)
        if (/^\s*\d+[\.\)]\s+/.test(trimmed)) {
          const match = trimmed.match(/^(\d+[\.\)])\s+(.*)$/);
          if (match) {
            const prefix = match[1];
            const itemText = sanitizeMathToUnicode(match[2].replace(/\*\*([^*]+)\*\*/g, "$1"));
            doc.font(fontBold).fontSize(9.5).fillColor(primaryColor);
            doc.text(prefix + " ", { continued: true, indent: 8 });
            doc.font(fontRegular).fillColor("#334155");
            doc.text(itemText, { lineGap: 2.5 });
            continue;
          }
        }

        // Regular Paragraph
        const cleanParagraph = sanitizeMathToUnicode(
          trimmed
            .replace(/\*\*([^*]+)\*\*/g, "$1")
            .replace(/\*([^*]+)\*/g, "$1")
            .replace(/`([^`]+)`/g, "$1")
        );

        doc.font(fontRegular).fontSize(9.5).fillColor("#1E293B");
        doc.text(cleanParagraph, {
          lineGap: 3,
        });
        doc.moveDown(0.2);
      }

      // Page numbers on all pages
      const totalPages = doc.bufferedPageRange().count;
      for (let p = 0; p < totalPages; p++) {
        doc.switchToPage(p);
        // Running Footer
        doc.moveTo(54, doc.page.height - 40).lineTo(doc.page.width - 54, doc.page.height - 40).lineWidth(0.5).strokeColor("#E2E8F0").stroke();
        doc.font(fontRegular).fontSize(8).fillColor("#94A3B8");
        doc.text("Standard Academic Typesetting", 54, doc.page.height - 32, {
          width: doc.page.width - 108,
          align: "left",
        });
        doc.text(`Page ${p + 1} of ${totalPages}`, 54, doc.page.height - 32, {
          width: doc.page.width - 108,
          align: "right",
        });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
