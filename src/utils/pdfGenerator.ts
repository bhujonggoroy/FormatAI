/**
 * High-Fidelity Text-Based & Visual PDF Generator for FormatAI
 *
 * SPECIFICATIONS & CORE DIRECTIVES:
 * 1. Text-Based PDF (Default):
 *    - Generates 100% selectable, searchable, copyable vector text streams.
 *    - Written natively via jsPDF's vector text, font, line, and shape drawing APIs.
 *    - Preserves academic mathematical notation, Greek symbols, superscripts,
 *      subscripts, equations, matrices, tables, lists, and hierarchical headings.
 *    - Standard A4 portrait dimensions: 210mm x 297mm (595.28pt x 841.89pt).
 *    - Atomic equation blocks and heading orphan prevention (keep-with-next).
 *    - Running headers and footers with dynamic "Page X of Y" numbering.
 *    - Tiny file size (15-40 KB) and razor-sharp clarity at any zoom level.
 *
 * 2. Visual Sheet Mode (Optional):
 *    - Preserves rendered DOM sheet appearance via html2canvas-pro.
 *    - Waits for document fonts and KaTeX glyphs to finalize.
 *    - Strips KaTeX MathML to eliminate duplicate equations.
 *    - Normalizes OKLCH/OKLAB colors to standard RGB/HEX.
 */

import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";
import { generateFilenameFromContent } from "./filename.ts";

export interface GeneratePdfOptions {
  element?: HTMLElement | null;
  title?: string;
  markdown?: string;
  fontFamily?: string;
  accentColor?: string;
  mode?: "text" | "visual"; // Default is "text" for true selectable/searchable PDF
  onProgress?: (stage: string) => void;
}

/**
 * Escapes HTML characters for safe template string injection.
 */
function escapeHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Converts modern CSS color functions (like oklch, oklab, lch, lab) to standard RGB/HEX
 * using an off-screen canvas 2D context serializer for maximum backward compatibility.
 */
export function convertColorToStandardRgb(colorStr: string): string {
  if (!colorStr) return colorStr;
  const lower = colorStr.toLowerCase();
  if (!lower.includes("oklch") && !lower.includes("oklab") && !lower.includes("lch") && !lower.includes("lab")) {
    return colorStr;
  }
  if (typeof document === "undefined") return colorStr;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return colorStr;
    ctx.fillStyle = colorStr;
    return ctx.fillStyle || colorStr;
  } catch {
    return colorStr;
  }
}

/**
 * Traverses an element tree and sanitizes all inline and computed color styles
 * to replace any modern oklch/lab functions with safe rgb/hex values.
 */
export function sanitizeElementColors(root: HTMLElement): void {
  const elements = [root, ...Array.from(root.querySelectorAll("*"))] as HTMLElement[];
  for (const el of elements) {
    if (!el.style) continue;
    try {
      if (el.style.color && el.style.color.includes("oklch")) {
        el.style.color = convertColorToStandardRgb(el.style.color);
      }
      if (el.style.backgroundColor && el.style.backgroundColor.includes("oklch")) {
        el.style.backgroundColor = convertColorToStandardRgb(el.style.backgroundColor);
      }
      if (el.style.borderColor && el.style.borderColor.includes("oklch")) {
        el.style.borderColor = convertColorToStandardRgb(el.style.borderColor);
      }
    } catch {
      // Non-blocking
    }
  }
}

/**
 * Ensures the PDF export function waits for document fonts, KaTeX math typesetting,
 * and layout paints to fully finalize before capturing the Document Sheet.
 */
export async function waitForFontsAndKatexFinalization(targetSheet?: HTMLElement | null): Promise<void> {
  // 1. Wait for document fonts and KaTeX math glyphs to complete loading
  if (typeof document !== "undefined" && document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Non-blocking fallback
    }
  }

  // 2. Wait for KaTeX equation elements to finish rendering inside the Document Sheet
  if (targetSheet) {
    const maxWaitMs = 800;
    const pollIntervalMs = 40;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const katexElements = targetSheet.querySelectorAll(".katex");
      if (katexElements.length > 0) {
        let allRendered = true;
        for (const el of Array.from(katexElements)) {
          const htmlPart = el.querySelector(".katex-html");
          if (!htmlPart || htmlPart.children.length === 0) {
            allRendered = false;
            break;
          }
        }
        if (allRendered) {
          break;
        }
      } else {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  // 3. Double requestAnimationFrame to ensure browser paint, layout reflow, and subpixel rasterization settle
  if (typeof window !== "undefined" && window.requestAnimationFrame) {
    await new Promise<void>((resolve) =>
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => resolve());
      })
    );
  }

  // 4. Additional settling delay for crisp glyph antialiasing
  await new Promise((resolve) => setTimeout(resolve, 120));
}

/**
 * Downloads a Blob as a file with the given filename.
 * Reliable cross-platform download mechanism for desktop, iOS Safari, and Android.
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
}

/**
 * Converts LaTeX math expressions into clean, mathematically precise Unicode text strings
 * suitable for real selectable, searchable text-based PDF rendering.
 */
export function formatLatexForPdfText(math: string, isDisplay = false): string {
  if (!math) return "";
  let s = math.trim();

  // Matrices: \begin{pmatrix} a & b \\ c & d \end{pmatrix}
  s = s.replace(/\\begin\{(?:p|b|v|V|B)?matrix\}([\s\S]*?)\\end\{(?:p|b|v|V|B)?matrix\}/g, (_, inner) => {
    const rows = inner
      .split(/\\\\/)
      .map((r: string) =>
        r
          .split("&")
          .map((c: string) => formatLatexForPdfText(c.trim(), false))
          .join("   ")
      )
      .filter((r: string) => r.length > 0);
    return `[ ${rows.join("  |  ")} ]`;
  });

  // Operators with custom words
  s = s.replace(/\\operatorname\{([^}]+)\}/g, "$1");
  s = s.replace(/\\mathrm\{([^}]+)\}/g, "$1");
  s = s.replace(/\\mathbf\{([^}]+)\}/g, "$1");
  s = s.replace(/\\mathit\{([^}]+)\}/g, "$1");
  s = s.replace(/\\text(?:bf|it|rm)?\{([^}]+)\}/g, "$1");

  // Statistical standard notations
  s = s.replace(/\\bar\{([A-Za-z])\}/g, "$1̄");
  s = s.replace(/\\hat\{([A-Za-z])\}/g, "$1̂");
  s = s.replace(/\\tilde\{([A-Za-z])\}/g, "$1̃");
  s = s.replace(/\\vec\{([A-Za-z])\}/g, "$1→");

  // Common matrix transpose
  s = s.replace(/\^\{\\mathsf\{T\}\}/g, "ᵀ");
  s = s.replace(/\^\{\\mathrm\{T\}\}/g, "ᵀ");
  s = s.replace(/\^\{T\}/g, "ᵀ");
  s = s.replace(/\^T\b/g, "ᵀ");

  // Limits / summations / products / integrals
  s = s.replace(/\\sum_\{([^}]+)\}\^\{([^}]+)\}/g, "∑($1 to $2)");
  s = s.replace(/\\sum_\{([^}]+)\}/g, "∑($1)");
  s = s.replace(/\\prod_\{([^}]+)\}\^\{([^}]+)\}/g, "∏($1 to $2)");
  s = s.replace(/\\int_\{([^}]+)\}\^\{([^}]+)\}/g, "∫($1 to $2)");
  s = s.replace(/\\lim_\{([^}]+)\}/g, "lim($1)");

  // Convergence in distribution
  s = s.replace(/\\overset\{d\}\{\\longrightarrow\}/g, " ⎯d→ ");
  s = s.replace(/\\xrightarrow\{d\}/g, " ⎯d→ ");

  // Fractions: \frac{num}{den}
  s = s.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (_match, num, den) => {
    const cleanNum = num.trim();
    const cleanDen = den.trim();
    if (/^[0-9a-zA-Z]$/.test(cleanNum) && /^[0-9a-zA-Z]$/.test(cleanDen)) {
      return `${cleanNum}/${cleanDen}`;
    }
    return `(${cleanNum}) / (${cleanDen})`;
  });

  // Square roots: \sqrt{arg} or \sqrt[n]{arg}
  s = s.replace(/\\sqrt\[([^{}]+)\]\{([^{}]+)\}/g, "ⁿ√($2)");
  s = s.replace(/\\sqrt\{([^{}]+)\}/g, "√($1)");

  // Greek and mathematical symbol replacements
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
    "\\mathbb{R}": "ℝ", "\\mathbb{N}": "ℕ", "\\mathbb{Z}": "ℤ", "\\mathbb{C}": "ℂ",
    "\\quad": "   ", "\\qquad": "     ", "\\,": " ", "\\;": " ", "\\!": "",
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
  s = s.replace(/\^\{0\}/g, "⁰");
  s = s.replace(/\^\{1\}/g, "¹");
  s = s.replace(/\^\{n\}/g, "ⁿ");
  s = s.replace(/\^\{i\}/g, "ⁱ");
  s = s.replace(/\^\{t\}/g, "ᵗ");
  s = s.replace(/\^\{k\}/g, "ᵏ");

  // Subscripts
  s = s.replace(/_1\b/g, "₁");
  s = s.replace(/_2\b/g, "₂");
  s = s.replace(/_0\b/g, "₀");
  s = s.replace(/_\{1\}/g, "₁");
  s = s.replace(/_\{2\}/g, "₂");
  s = s.replace(/_\{0\}/g, "₀");
  s = s.replace(/_\{n\}/g, "ₙ");
  s = s.replace(/_\{i\}/g, "ᵢ");
  s = s.replace(/_\{j\}/g, "ⱼ");
  s = s.replace(/_\{k\}/g, "ₖ");
  s = s.replace(/_\{x\}/g, "ₓ");
  s = s.replace(/_\{y\}/g, "ᵧ");

  // Remove loose backslashes before plain letters
  s = s.replace(/\\([a-zA-Z]+)/g, "$1");

  // Clean double spaces
  s = s.replace(/\s{2,}/g, " ").trim();

  return s;
}

/**
 * Replaces inline math delimiters ($...$, \(...\), $$...$$) inside text with formatted math text.
 */
export function formatInlineMathInText(text: string): string {
  if (!text) return "";
  let s = text;

  // Display math if found inside text line
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => ` ${formatLatexForPdfText(math, true)} `);

  // Inline $...$
  s = s.replace(/\$([^$\n]+)\$/g, (_, math) => formatLatexForPdfText(math, false));

  // Inline \(...\)
  s = s.replace(/(?:\\)+\(\s*([^\n]+?)\s*(?:\\)+\)/g, (_, math) => formatLatexForPdfText(math, false));

  // Clean Markdown formatting tokens for pure text presentation
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\*([^*]+)\*/g, "$1");
  s = s.replace(/`([^`]+)`/g, "$1");

  return s;
}

/**
 * Generates a publication-grade, 100% Text-Based PDF using jsPDF's native vector text engine.
 *
 * All text (headings, paragraphs, equations, tables, numbers) is written as real selectable,
 * searchable, and copyable text streams.
 */
export async function generateTextBasedPdf(options: GeneratePdfOptions): Promise<void> {
  const { title = "Academic Notes", markdown = "", fontFamily = "Times New Roman", accentColor = "#1E293B", onProgress } = options;

  onProgress?.("1/3: Parsing academic document structure & equations...");

  // Generate safe filename
  const baseFilename = generateFilenameFromContent(markdown || title);
  const filename = `${baseFilename}.pdf`;

  // Standard A4 portrait in points: 210mm x 297mm = 595.28pt x 841.89pt
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
    compress: true,
  });

  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const MARGIN_LEFT = 44;
  const MARGIN_RIGHT = 44;
  const MARGIN_TOP = 46;
  const MARGIN_BOTTOM = 46;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT; // ~507.28 pt
  const CONTENT_BOTTOM = PAGE_HEIGHT - MARGIN_BOTTOM;

  // Choose standard PDF font family
  const isSans = /calibri|arial|aptos|helvetica/i.test(fontFamily);
  const FONT_REGULAR = isSans ? "helvetica" : "times";

  // Parse accent color
  let accentR = 30, accentG = 41, accentB = 59;
  if (accentColor && accentColor.startsWith("#")) {
    const hex = accentColor.replace("#", "");
    if (hex.length === 6) {
      accentR = parseInt(hex.slice(0, 2), 16);
      accentG = parseInt(hex.slice(2, 4), 16);
      accentB = parseInt(hex.slice(4, 6), 16);
    }
  }

  let currentY = MARGIN_TOP + 18;

  // Track page numbers and headers
  const drawRunningHeader = () => {
    pdf.setFont(FONT_REGULAR, "italic");
    pdf.setFontSize(8.5);
    pdf.setTextColor(100, 116, 139); // #64748B
    const headerTitle = title.length > 55 ? `${title.slice(0, 52)}...` : title;
    pdf.text(headerTitle, MARGIN_LEFT, MARGIN_TOP - 8);

    pdf.setFont(FONT_REGULAR, "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184); // #94A3B8
    pdf.text(`Word Document • ${fontFamily}`, PAGE_WIDTH - MARGIN_RIGHT, MARGIN_TOP - 8, { align: "right" });

    // Separator line
    pdf.setDrawColor(226, 232, 240); // #E2E8F0
    pdf.setLineWidth(0.75);
    pdf.line(MARGIN_LEFT, MARGIN_TOP - 2, PAGE_WIDTH - MARGIN_RIGHT, MARGIN_TOP - 2);
  };

  const addPageIfNeeded = (neededHeight: number) => {
    if (currentY + neededHeight > CONTENT_BOTTOM - 20) {
      pdf.addPage("a4", "portrait");
      drawRunningHeader();
      currentY = MARGIN_TOP + 18;
      return true;
    }
    return false;
  };

  // Draw header on first page
  drawRunningHeader();

  // Document Title Banner on Page 1
  const docTitle = title || "Academic Notes";
  pdf.setFont(FONT_REGULAR, "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(accentR, accentG, accentB);
  pdf.text(docTitle, MARGIN_LEFT, currentY, { maxWidth: CONTENT_WIDTH });
  currentY += 24;

  // Title underline accent rule
  pdf.setDrawColor(accentR, accentG, accentB);
  pdf.setLineWidth(1.5);
  pdf.line(MARGIN_LEFT, currentY, PAGE_WIDTH - MARGIN_RIGHT, currentY);
  currentY += 16;

  onProgress?.("2/3: Generating text-based vector layout & typography...");

  const lines = markdown.split("\n");
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      currentY += 6;
      i++;
      continue;
    }

    // 1. Display Math Block: $$ ... $$ or \[ ... \]
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

      const formattedMath = formatLatexForPdfText(mathContent, true);
      pdf.setFont(FONT_REGULAR, "italic");
      pdf.setFontSize(10.5);
      const mathLinesWrapped = pdf.splitTextToSize(formattedMath, CONTENT_WIDTH - 24);
      const boxHeight = Math.max(30, mathLinesWrapped.length * 15 + 14);

      addPageIfNeeded(boxHeight + 8);

      // Render subtle equation card
      pdf.setFillColor(248, 250, 252); // #F8FAFC
      pdf.setDrawColor(226, 232, 240); // #CBD5E1
      pdf.setLineWidth(0.75);
      pdf.roundedRect(MARGIN_LEFT, currentY, CONTENT_WIDTH, boxHeight, 3, 3, "FD");

      pdf.setTextColor(15, 23, 42); // #0F172A
      let textY = currentY + 14 + (boxHeight - 14 - mathLinesWrapped.length * 14) / 2;
      for (const line of mathLinesWrapped) {
        pdf.text(line, MARGIN_LEFT + CONTENT_WIDTH / 2, textY, { align: "center" });
        textY += 14;
      }

      currentY += boxHeight + 10;
      continue;
    }

    // 2. Headings: #, ##, ###, ####
    if (trimmed.startsWith("# ")) {
      const headingText = formatInlineMathInText(trimmed.slice(2).trim());
      addPageIfNeeded(42); // Keep-with-next guarantee
      currentY += 8;

      pdf.setFont(FONT_REGULAR, "bold");
      pdf.setFontSize(15);
      pdf.setTextColor(accentR, accentG, accentB);
      pdf.text(headingText, MARGIN_LEFT, currentY, { maxWidth: CONTENT_WIDTH });
      currentY += 18;

      pdf.setDrawColor(203, 213, 225); // #CBD5E1
      pdf.setLineWidth(0.75);
      pdf.line(MARGIN_LEFT, currentY, PAGE_WIDTH - MARGIN_RIGHT, currentY);
      currentY += 10;
      i++;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      const headingText = formatInlineMathInText(trimmed.slice(3).trim());
      addPageIfNeeded(34);
      currentY += 6;

      pdf.setFont(FONT_REGULAR, "bold");
      pdf.setFontSize(12.5);
      pdf.setTextColor(accentR, accentG, accentB);
      pdf.text(headingText, MARGIN_LEFT, currentY, { maxWidth: CONTENT_WIDTH });
      currentY += 16;
      i++;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      const headingText = formatInlineMathInText(trimmed.slice(4).trim());
      addPageIfNeeded(28);
      currentY += 4;

      // Small accent dot
      pdf.setFillColor(accentR, accentG, accentB);
      pdf.circle(MARGIN_LEFT + 3, currentY - 3.5, 2.5, "F");

      pdf.setFont(FONT_REGULAR, "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(30, 41, 59);
      pdf.text(headingText, MARGIN_LEFT + 12, currentY, { maxWidth: CONTENT_WIDTH - 12 });
      currentY += 15;
      i++;
      continue;
    }

    if (trimmed.startsWith("#### ")) {
      const headingText = formatInlineMathInText(trimmed.slice(5).trim()).toUpperCase();
      addPageIfNeeded(22);

      pdf.setFont(FONT_REGULAR, "bold");
      pdf.setFontSize(9.5);
      pdf.setTextColor(71, 85, 105); // #475569
      pdf.text(headingText, MARGIN_LEFT, currentY, { maxWidth: CONTENT_WIDTH });
      currentY += 14;
      i++;
      continue;
    }

    // 3. Section Header (e.g. Section A: ...)
    if (/^(?:#{1,3}\s*)?(?:\*{0,2})Section\s+([A-Z]):?\s*(.*?)(?:\*{0,2})$/i.test(trimmed)) {
      const match = trimmed.match(/^(?:#{1,3}\s*)?(?:\*{0,2})Section\s+([A-Z]):?\s*(.*?)(?:\*{0,2})$/i)!;
      const fullSection = `Section ${match[1].toUpperCase()}:${match[2] ? " " + match[2].trim() : ""}`;
      const formattedTitle = formatInlineMathInText(fullSection);

      addPageIfNeeded(32);
      currentY += 6;

      pdf.setFont(FONT_REGULAR, "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(accentR, accentG, accentB);
      pdf.text(formattedTitle, MARGIN_LEFT, currentY, { maxWidth: CONTENT_WIDTH });
      currentY += 16;

      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.5);
      pdf.line(MARGIN_LEFT, currentY, PAGE_WIDTH - MARGIN_RIGHT, currentY);
      currentY += 8;
      i++;
      continue;
    }

    // 4. Tables: | col1 | col2 |
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
        currentY += 4;
        const colCount = Math.max(...tableRows.map((r) => r.length));
        const colWidth = CONTENT_WIDTH / colCount;

        for (let r = 0; r < tableRows.length; r++) {
          const isHeader = r === 0;
          const rowCells = tableRows[r];
          const formattedCells = rowCells.map((c) => formatInlineMathInText(c));

          pdf.setFont(FONT_REGULAR, isHeader ? "bold" : "normal");
          pdf.setFontSize(isHeader ? 9.5 : 9);

          let maxLines = 1;
          const wrappedCells = formattedCells.map((text) => {
            const spl = pdf.splitTextToSize(text, colWidth - 10);
            if (spl.length > maxLines) maxLines = spl.length;
            return spl;
          });

          const rowHeight = Math.max(18, maxLines * 12 + 6);
          addPageIfNeeded(rowHeight + 4);

          // Row background
          if (isHeader) {
            pdf.setFillColor(241, 245, 249); // #F1F5F9
            pdf.rect(MARGIN_LEFT, currentY, CONTENT_WIDTH, rowHeight, "F");
          } else if (r % 2 === 1) {
            pdf.setFillColor(248, 250, 252); // #F8FAFC
            pdf.rect(MARGIN_LEFT, currentY, CONTENT_WIDTH, rowHeight, "F");
          }

          // Row borders
          pdf.setDrawColor(226, 232, 240);
          pdf.setLineWidth(0.5);
          pdf.rect(MARGIN_LEFT, currentY, CONTENT_WIDTH, rowHeight, "S");

          // Cell text
          pdf.setTextColor(isHeader ? 15 : 51, isHeader ? 23 : 65, isHeader ? 42 : 85);
          for (let c = 0; c < colCount; c++) {
            const cellLines = wrappedCells[c] || [];
            let cellY = currentY + 11;
            for (const cl of cellLines) {
              pdf.text(cl, MARGIN_LEFT + c * colWidth + 5, cellY);
              cellY += 12;
            }
          }

          currentY += rowHeight;
        }

        currentY += 8;
      }
      continue;
    }

    // 5. Bullet List: - item or * item
    if (/^\s*[-*•]\s+/.test(rawLine)) {
      const itemText = formatInlineMathInText(trimmed.replace(/^[-*•]\s+/, ""));
      pdf.setFont(FONT_REGULAR, "normal");
      pdf.setFontSize(10);
      const wrapped = pdf.splitTextToSize(itemText, CONTENT_WIDTH - 20);

      addPageIfNeeded(wrapped.length * 14 + 4);

      // Vector bullet point dot
      pdf.setFillColor(71, 85, 105);
      pdf.circle(MARGIN_LEFT + 6, currentY + 7, 2, "F");

      pdf.setTextColor(30, 41, 59);
      let textY = currentY + 10;
      for (const line of wrapped) {
        pdf.text(line, MARGIN_LEFT + 16, textY);
        textY += 14;
      }

      currentY += wrapped.length * 14 + 4;
      i++;
      continue;
    }

    // 6. Numbered List: 1. item or a. item
    const numMatch = trimmed.match(/^(\d+[\.\)]|[a-z][\.\)])\s+(.*)$/i);
    if (numMatch) {
      const prefix = numMatch[1];
      const itemText = formatInlineMathInText(numMatch[2]);

      pdf.setFont(FONT_REGULAR, "normal");
      pdf.setFontSize(10);
      const wrapped = pdf.splitTextToSize(itemText, CONTENT_WIDTH - 24);

      addPageIfNeeded(wrapped.length * 14 + 4);

      pdf.setFont(FONT_REGULAR, "bold");
      pdf.setTextColor(15, 23, 42);
      pdf.text(prefix, MARGIN_LEFT + 4, currentY + 10);

      pdf.setFont(FONT_REGULAR, "normal");
      pdf.setTextColor(30, 41, 59);
      let textY = currentY + 10;
      for (const line of wrapped) {
        pdf.text(line, MARGIN_LEFT + 22, textY);
        textY += 14;
      }

      currentY += wrapped.length * 14 + 4;
      i++;
      continue;
    }

    // 7. Standard Paragraph
    const paragraphText = formatInlineMathInText(trimmed);
    pdf.setFont(FONT_REGULAR, "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(30, 41, 59);
    const wrapped = pdf.splitTextToSize(paragraphText, CONTENT_WIDTH);

    addPageIfNeeded(wrapped.length * 14 + 4);

    let textY = currentY + 10;
    for (const line of wrapped) {
      pdf.text(line, MARGIN_LEFT, textY);
      textY += 14;
    }

    currentY += wrapped.length * 14 + 6;
    i++;
  }

  // Running Footers on all pages ("Page X of Y")
  const totalPages = (pdf as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);

    // Footer rule
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.75);
    pdf.line(MARGIN_LEFT, PAGE_HEIGHT - MARGIN_BOTTOM + 6, PAGE_WIDTH - MARGIN_RIGHT, PAGE_HEIGHT - MARGIN_BOTTOM + 6);

    // Footer text
    pdf.setFont(FONT_REGULAR, "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184); // #94A3B8
    pdf.text("Standard Academic Typesetting (Times New Roman / OMML)", MARGIN_LEFT, PAGE_HEIGHT - MARGIN_BOTTOM + 18);
    pdf.text(`Page ${p} of ${totalPages}`, PAGE_WIDTH - MARGIN_RIGHT, PAGE_HEIGHT - MARGIN_BOTTOM + 18, { align: "right" });
  }

  onProgress?.("3/3: Text-based PDF ready! Downloading...");
  const pdfBlob = pdf.output("blob");
  triggerBlobDownload(pdfBlob, filename);
}

/**
 * Visual Sheet capture using html2canvas-pro for full CSS-exact raster capture.
 */
export async function generateDocumentSheetVisualPdf(options: GeneratePdfOptions): Promise<void> {
  const { element, title = "Academic Notes", markdown = "", fontFamily, onProgress } = options;

  const targetSheet =
    element ||
    document.getElementById("academic-document-sheet") ||
    document.getElementById("preview-document-sheet") ||
    document.querySelector(".academic-paper-sheet");

  if (!targetSheet) {
    throw new Error("Document Sheet preview element not found. Please ensure the preview is active.");
  }

  onProgress?.("1/4: Waiting for document fonts & KaTeX rendering to finalize...");
  await waitForFontsAndKatexFinalization(targetSheet as HTMLElement);

  const baseFilename = generateFilenameFromContent(markdown || title);
  const filename = `${baseFilename}.pdf`;

  onProgress?.("2/4: Preparing publication A4 page layout...");

  const computedStyle = window.getComputedStyle(targetSheet);
  const sheetFontFamily =
    computedStyle.fontFamily ||
    "'Times New Roman', 'Tinos', 'Noto Serif Bengali', serif";

  const docTitle =
    title ||
    targetSheet.querySelector(".font-serif")?.textContent?.trim() ||
    "Academic Notes";
  const fontFamilyName = fontFamily || "Times New Roman";

  const stage = document.createElement("div");
  stage.id = "formatai-controlled-pdf-stage";
  stage.style.position = "fixed";
  stage.style.left = "-99999px";
  stage.style.top = "0";
  stage.style.width = "794px";
  stage.style.minWidth = "794px";
  stage.style.maxWidth = "794px";
  stage.style.background = "#FFFFFF";
  stage.style.color = "#1E293B";
  stage.style.zIndex = "-99999";
  stage.style.opacity = "1";
  stage.style.pointerEvents = "none";
  stage.style.boxSizing = "border-box";
  stage.style.margin = "0";
  stage.style.padding = "0";
  stage.style.transform = "none";
  stage.style.fontFamily = sheetFontFamily;

  document.body.appendChild(stage);

  try {
    const contentContainer =
      targetSheet.querySelector(".space-y-1") ||
      (targetSheet.children.length >= 2 ? targetSheet.children[1] : targetSheet);

    const sourceChildren = Array.from(contentContainer.children) as HTMLElement[];

    const measureBox = document.createElement("div");
    measureBox.style.width = "698px";
    measureBox.style.fontFamily = sheetFontFamily;
    measureBox.style.boxSizing = "border-box";
    measureBox.style.fontSize = "14px";
    measureBox.style.lineHeight = "1.625";
    measureBox.style.color = "#1E293B";
    stage.appendChild(measureBox);

    interface MeasuredItem {
      element: HTMLElement;
      height: number;
      isHeading: boolean;
      isEquation: boolean;
    }

    const measuredItems: MeasuredItem[] = [];

    for (const child of sourceChildren) {
      const clone = child.cloneNode(true) as HTMLElement;

      clone.querySelectorAll(".katex-mathml").forEach((el) => el.remove());
      clone.querySelectorAll("annotation").forEach((el) => el.remove());
      clone
        .querySelectorAll("[aria-hidden='true'][style*='display: none']")
        .forEach((el) => el.remove());

      sanitizeElementColors(clone);

      clone.style.transform = "none";
      clone.style.maxWidth = "100%";

      measureBox.appendChild(clone);
      const style = window.getComputedStyle(clone);
      const marginTop = parseFloat(style.marginTop) || 0;
      const marginBottom = parseFloat(style.marginBottom) || 0;
      const height = Math.max(16, clone.offsetHeight + marginTop + marginBottom);
      measureBox.removeChild(clone);

      const isHeading = /^H[1-6]$/i.test(child.tagName);
      const isEquation =
        child.querySelector(".katex-display") !== null ||
        child.classList.contains("katex-display") ||
        child.classList.contains("equation-card");

      measuredItems.push({
        element: clone,
        height,
        isHeading,
        isEquation,
      });
    }

    stage.removeChild(measureBox);

    const MAX_PAGE_CONTENT_HEIGHT = 925;
    const pages: HTMLElement[][] = [];
    let currentPageItems: MeasuredItem[] = [];
    let currentHeight = 0;

    for (let i = 0; i < measuredItems.length; i++) {
      const item = measuredItems[i];
      const nextItem = i + 1 < measuredItems.length ? measuredItems[i + 1] : null;

      if (
        item.isHeading &&
        currentHeight > 0 &&
        nextItem &&
        currentHeight + item.height + nextItem.height > MAX_PAGE_CONTENT_HEIGHT
      ) {
        pages.push(currentPageItems.map((m) => m.element));
        currentPageItems = [item];
        currentHeight = item.height;
        continue;
      }

      if (currentHeight > 0 && currentHeight + item.height > MAX_PAGE_CONTENT_HEIGHT) {
        if (
          currentPageItems.length > 0 &&
          currentPageItems[currentPageItems.length - 1].isHeading
        ) {
          const orphanedHeading = currentPageItems.pop()!;
          if (currentPageItems.length > 0) {
            pages.push(currentPageItems.map((m) => m.element));
          }
          currentPageItems = [orphanedHeading, item];
          currentHeight = orphanedHeading.height + item.height;
        } else {
          pages.push(currentPageItems.map((m) => m.element));
          currentPageItems = [item];
          currentHeight = item.height;
        }
        continue;
      }

      currentPageItems.push(item);
      currentHeight += item.height;
    }

    if (currentPageItems.length > 0) {
      pages.push(currentPageItems.map((m) => m.element));
    }

    if (pages.length === 0) {
      const emptyNotice = document.createElement("div");
      emptyNotice.className = "text-center py-12 text-slate-400 italic";
      emptyNotice.textContent = "No content to display.";
      pages.push([emptyNotice]);
    }

    const totalPages = pages.length;

    for (let p = 0; p < totalPages; p++) {
      const pageEl = document.createElement("div");
      pageEl.className = "formatai-pdf-page-sheet";
      pageEl.style.width = "794px";
      pageEl.style.height = "1123px";
      pageEl.style.minHeight = "1123px";
      pageEl.style.maxHeight = "1123px";
      pageEl.style.boxSizing = "border-box";
      pageEl.style.padding = "44px 48px";
      pageEl.style.background = "#FFFFFF";
      pageEl.style.display = "flex";
      pageEl.style.flexDirection = "column";
      pageEl.style.justifyContent = "space-between";
      pageEl.style.position = "relative";
      pageEl.style.overflow = "hidden";
      pageEl.style.fontFamily = sheetFontFamily;
      pageEl.style.color = "#1E293B";

      const headerEl = document.createElement("div");
      headerEl.style.paddingBottom = "12px";
      headerEl.style.marginBottom = "16px";
      headerEl.style.borderBottom = "1px solid #E2E8F0";
      headerEl.style.display = "flex";
      headerEl.style.alignItems = "center";
      headerEl.style.justifyContent = "space-between";
      headerEl.style.fontSize = "12px";
      headerEl.style.color = "#94A3B8";
      headerEl.style.boxSizing = "border-box";
      headerEl.innerHTML = `
        <span style="font-style: italic; color: #64748B; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 440px;">
          ${escapeHtml(docTitle)}
        </span>
        <span style="font-size: 11px; font-family: sans-serif; letter-spacing: 0.05em; text-transform: uppercase; color: #94A3B8;">
          Word Document • ${escapeHtml(fontFamilyName)}
        </span>
      `;

      const bodyEl = document.createElement("div");
      bodyEl.style.flex = "1";
      bodyEl.style.display = "flex";
      bodyEl.style.flexDirection = "column";
      bodyEl.style.gap = "4px";
      bodyEl.style.overflow = "hidden";
      bodyEl.style.boxSizing = "border-box";

      for (const el of pages[p]) {
        bodyEl.appendChild(el);
      }

      const footerEl = document.createElement("div");
      footerEl.style.paddingTop = "12px";
      footerEl.style.marginTop = "16px";
      footerEl.style.borderTop = "1px solid #E2E8F0";
      footerEl.style.display = "flex";
      footerEl.style.alignItems = "center";
      footerEl.style.justifyContent = "space-between";
      footerEl.style.fontSize = "11px";
      footerEl.style.color = "#94A3B8";
      footerEl.style.boxSizing = "border-box";
      footerEl.innerHTML = `
        <span>Standard Academic Typesetting (Times New Roman / OMML)</span>
        <span>Page ${p + 1} of ${totalPages}</span>
      `;

      pageEl.appendChild(headerEl);
      pageEl.appendChild(bodyEl);
      pageEl.appendChild(footerEl);
      stage.appendChild(pageEl);
    }

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    for (let p = 0; p < totalPages; p++) {
      onProgress?.(`3/4: Rendering visual page ${p + 1} of ${totalPages}...`);
      const pageDom = stage.children[p] as HTMLElement;

      const canvas = await html2canvas(pageDom, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#FFFFFF",
        logging: false,
        width: 794,
        height: 1123,
        windowWidth: 794,
        windowHeight: 1123,
        onclone: (clonedDoc) => {
          try {
            const stageClone = clonedDoc.getElementById("formatai-controlled-pdf-stage");
            if (stageClone) {
              sanitizeElementColors(stageClone as HTMLElement);
            }
          } catch {
            // Non-blocking
          }
        },
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.98);

      if (p > 0) {
        pdf.addPage("a4", "portrait");
      }

      pdf.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST");
    }

    onProgress?.("4/4: Visual PDF ready! Downloading...");
    const pdfBlob = pdf.output("blob");
    triggerBlobDownload(pdfBlob, filename);
  } finally {
    if (stage.parentNode) {
      document.body.removeChild(stage);
    }
  }
}

/**
 * Authoritative PDF generator entry point.
 * By default, generates a true Text-Based PDF (selectable, searchable vector text).
 * If options.mode is 'visual', generates visual sheet capture.
 */
export async function generateDocumentPdf(options: GeneratePdfOptions): Promise<void> {
  if (options.mode === "visual") {
    return generateDocumentSheetVisualPdf(options);
  }
  return generateTextBasedPdf(options);
}

/**
 * Backward compatibility alias for downloadPreviewAsPdf.
 */
export const downloadPreviewAsPdf = generateDocumentPdf;

export default generateDocumentPdf;
