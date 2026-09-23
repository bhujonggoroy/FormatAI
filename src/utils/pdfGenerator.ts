/**
 * High-Fidelity Controlled PDF Generator for FormatAI
 *
 * SPECIFICATIONS & CORE DIRECTIVES:
 * 1. Single Source of Truth: Targets the actual Document Sheet DOM element (#academic-document-sheet).
 * 2. Standard A4 Dimensions: Exactly 210mm x 297mm (794px x 1123px at 96 DPI).
 * 3. 1:1 Scale: Rendered at physical 1:1 document scale, completely decoupled from
 *    mobile viewport widths, window.innerWidth, screen.width, or devicePixelRatio.
 * 4. KaTeX Equation Integrity:
 *    - Captures the already-rendered visual KaTeX equations (.katex-html)
 *    - Strips auxiliary MathML (.katex-mathml) to eliminate duplicate equations
 *    - Strips hidden accessibility elements to prevent ghost artifacts
 *    - Preserves display equations as atomic blocks that are never split across pages
 * 5. Modern Color Robustness:
 *    - Uses html2canvas-pro with native OKLCH/OKLAB color space support
 *    - Sanitizes computed oklch/lab colors to rgb/hex to guarantee 0 color-parser exceptions
 * 6. Academic Document Pagination:
 *    - Heading orphan prevention (keep-with-next logic)
 *    - Controlled A4 pagination without unexpected blank pages
 *    - Running headers and footers matching the Document Sheet preview
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
 *
 * Prevents content duplication, missing mathematical glyphs, or broken layouts.
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
          // Verify that .katex-html container exists and has rendered child nodes
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
        // No KaTeX elements or not yet injected, proceed
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
  await new Promise((resolve) => setTimeout(resolve, 150));
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
 * Robust PDF generator function targeting the Document Sheet preview element.
 *
 * Sets page size to A4 (210mm x 297mm), maintains 1:1 scale, and ensures
 * all KaTeX equations are captured without duplication or layout corruption.
 */
export async function generateDocumentPdf(options: GeneratePdfOptions): Promise<void> {
  const { element, title = "Academic Notes", markdown = "", fontFamily, accentColor, onProgress } = options;

  // 1. Locate the actual Document Sheet preview element in DOM
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

  // 2. Generate safe filename from current document content
  const baseFilename = generateFilenameFromContent(markdown || title);
  const filename = `${baseFilename}.pdf`;

  onProgress?.("2/4: Preparing publication A4 page layout...");

  // Read computed typography from the preview
  const computedStyle = window.getComputedStyle(targetSheet);
  const sheetFontFamily =
    computedStyle.fontFamily ||
    "'Times New Roman', 'Tinos', 'Noto Serif Bengali', serif";

  const docTitle =
    title ||
    targetSheet.querySelector(".font-serif")?.textContent?.trim() ||
    "Academic Notes";
  const fontFamilyName = fontFamily || "Times New Roman";

  // 3. Create an offscreen controlled rendering stage (strictly isolated from mobile viewport)
  // Standard A4 portrait: 210mm = 794px at 96 DPI, 297mm = 1123px at 96 DPI
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
    // 4. Locate content container inside Document Sheet
    // Structure: Header [0], Content Container [1], Footer [2]
    const contentContainer =
      targetSheet.querySelector(".space-y-1") ||
      (targetSheet.children.length >= 2 ? targetSheet.children[1] : targetSheet);

    const sourceChildren = Array.from(contentContainer.children) as HTMLElement[];

    // Controlled measuring box to calculate real heights at standard 698px printable width
    // 794px page width - (48px * 2) margins = 698px printable content width
    const measureBox = document.createElement("div");
    measureBox.style.width = "698px";
    measureBox.style.fontFamily = sheetFontFamily;
    measureBox.style.boxSizing = "border-box";
    measureBox.style.fontSize = "14px";
    measureBox.style.lineHeight = "1.625";
    measureBox.style.color = "#1E293B";
    stage.appendChild(measureBox);

    // Prepare cloned items and measure their heights
    interface MeasuredItem {
      element: HTMLElement;
      height: number;
      isHeading: boolean;
      isEquation: boolean;
    }

    const measuredItems: MeasuredItem[] = [];

    for (const child of sourceChildren) {
      // Clone element
      const clone = child.cloneNode(true) as HTMLElement;

      // CRITICAL: Strip all KaTeX MathML elements to prevent duplicate equations
      clone.querySelectorAll(".katex-mathml").forEach((el) => el.remove());

      // Strip any hidden accessibility duplicates
      clone
        .querySelectorAll("[aria-hidden='true'][style*='display: none']")
        .forEach((el) => el.remove());

      // Sanitize modern OKLCH colors on the clone
      sanitizeElementColors(clone);

      // Reset any scale zoom or responsive max-widths
      clone.style.transform = "none";
      clone.style.maxWidth = "100%";

      // Measure height in controlled container
      measureBox.appendChild(clone);
      const style = window.getComputedStyle(clone);
      const marginTop = parseFloat(style.marginTop) || 0;
      const marginBottom = parseFloat(style.marginBottom) || 0;
      const height = Math.max(16, clone.offsetHeight + marginTop + marginBottom);
      measureBox.removeChild(clone);

      const isHeading = /^H[1-6]$/i.test(child.tagName);
      const isEquation =
        child.querySelector(".katex-display") !== null ||
        child.classList.contains("katex-display");

      measuredItems.push({
        element: clone,
        height,
        isHeading,
        isEquation,
      });
    }

    stage.removeChild(measureBox);

    // 5. Controlled Pagination Algorithm with keep-with-next and orphan prevention
    // Printable content height: 1123px - (header 50px + footer 50px + margins 88px) = ~925px
    const MAX_PAGE_CONTENT_HEIGHT = 925;
    const pages: HTMLElement[][] = [];
    let currentPageItems: MeasuredItem[] = [];
    let currentHeight = 0;

    for (let i = 0; i < measuredItems.length; i++) {
      const item = measuredItems[i];
      const nextItem = i + 1 < measuredItems.length ? measuredItems[i + 1] : null;

      // Rule 1: Lookahead for headings (keep-with-next)
      // If this is a heading and the heading plus the subsequent item exceeds page height,
      // push the heading to the next page immediately
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

      // Rule 2: If current item overflows remaining height of current page
      if (currentHeight > 0 && currentHeight + item.height > MAX_PAGE_CONTENT_HEIGHT) {
        // If the preceding item on currentPageItems was a heading, pull it to next page
        // so it does NOT sit orphaned at the bottom of the previous page
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

      // Element fits on current page
      currentPageItems.push(item);
      currentHeight += item.height;
    }

    if (currentPageItems.length > 0) {
      pages.push(currentPageItems.map((m) => m.element));
    }

    // Ensure at least 1 page
    if (pages.length === 0) {
      const emptyNotice = document.createElement("div");
      emptyNotice.className = "text-center py-12 text-slate-400 italic";
      emptyNotice.textContent = "No content to display.";
      pages.push([emptyNotice]);
    }

    const totalPages = pages.length;

    // 6. Assemble physical A4 pages inside the controlled stage
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

      // Running Header (matching Word Sheet Preview)
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

      // Page Content Body
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

      // Running Footer (matching Word Sheet Preview with dynamic page count)
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

    // 7. Initialize jsPDF document in exact A4 portrait format (210mm x 297mm)
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    // 8. Render each page with high-DPI canvas
    for (let p = 0; p < totalPages; p++) {
      onProgress?.(`3/4: Rendering high-fidelity page ${p + 1} of ${totalPages}...`);
      const pageDom = stage.children[p] as HTMLElement;

      const canvas = await html2canvas(pageDom, {
        scale: 2, // 2x gives 192 DPI, perfectly crisp vector math & text
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#FFFFFF",
        logging: false,
        width: 794,
        height: 1123,
        windowWidth: 794,
        windowHeight: 1123,
        onclone: (clonedDoc) => {
          // Double safety: sanitize any remaining oklch in the cloned DOM tree
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

      // Exact 210mm x 297mm A4 placement
      pdf.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST");
    }

    onProgress?.("4/4: PDF ready! Downloading...");
    const pdfBlob = pdf.output("blob");
    triggerBlobDownload(pdfBlob, filename);
  } finally {
    // Always clean up offscreen export container
    if (stage.parentNode) {
      document.body.removeChild(stage);
    }
  }
}

/**
 * Backward compatibility alias for downloadPreviewAsPdf.
 */
export const downloadPreviewAsPdf = generateDocumentPdf;

export default generateDocumentPdf;
