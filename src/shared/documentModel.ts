/**
 * Centralized Document Model & Style Specification for FormatAI
 *
 * ARCHITECTURAL DIRECTIVE: "Format Once → Render Everywhere"
 *
 * RAW INPUT
 *    ↓
 * FormatAI Native Formatting Engine
 *    ↓
 * Authoritative Formatted Document Result (effectiveMarkdown)
 *    ↓
 * Shared Document Structure / AST (DocumentAST)
 *    ↓
 * ├── Preview Renderer (FormattedPreview)
 * ├── DOCX Renderer (buildDocxFromMarkdown / docxService)
 * └── PDF Renderer (pdfGenerator / exportService)
 *
 * INVARIANTS:
 * 1. The formatted result is created exactly once.
 * 2. Preview, DOCX, and PDF must never independently reinterpret or reformat raw input.
 * 3. Typography, margins, page dimensions, heading levels, equations, tables, and lists
 *    are defined in the single authoritative DocumentStyleSpec.
 */

export interface HeadingStyleSpec {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  fontSizePt: number;
  fontSizeHalfPt: number; // For DOCX (half-points: 1 pt = 2 half-points)
  lineHeight: number;
  spacingBeforePt: number;
  spacingAfterPt: number;
  spacingBeforeTwips: number;
  spacingAfterTwips: number;
  color: string;
  isBold: boolean;
  keepWithNext: boolean;
}

export interface DocumentStyleSpec {
  pageSize: "A4";
  pageDimensions: {
    widthPt: number; // 595.28 pt (210 mm)
    heightPt: number; // 841.89 pt (297 mm)
    widthTwips: number; // 11906 twips
    heightTwips: number; // 16838 twips
    widthMm: number; // 210 mm
    heightMm: number; // 297 mm
  };
  margins: {
    topPt: number;
    bottomPt: number;
    leftPt: number;
    rightPt: number;
    topTwips: number;
    bottomTwips: number;
    leftTwips: number;
    rightTwips: number;
    topMm: number;
    bottomMm: number;
    leftMm: number;
    rightMm: number;
  };
  bodyFont: string;
  bodyFontSizePt: number;
  bodyFontSizeHalfPt: number;
  bodyColor: string;
  lineHeight: number;
  paragraphSpacing: {
    beforePt: number;
    afterPt: number;
    beforeTwips: number;
    afterTwips: number;
  };
  headings: Record<1 | 2 | 3 | 4 | 5 | 6, HeadingStyleSpec>;
  list: {
    indentPt: number;
    indentTwips: number;
    bulletColor: string;
    itemSpacingAfterPt: number;
    itemSpacingAfterTwips: number;
  };
  table: {
    borderColor: string;
    borderWidthPt: number;
    headerBgColor: string;
    headerTextColor: string;
    alternateRowBgColor: string;
    cellPaddingPt: { top: number; bottom: number; left: number; right: number };
    fontSizePt: number;
    fontSizeHalfPt: number;
  };
  equation: {
    spacingBeforePt: number;
    spacingAfterPt: number;
    spacingBeforeTwips: number;
    spacingAfterTwips: number;
    alignment: "center";
    fontSizePt: number;
    fontSizeHalfPt: number;
    color: string;
  };
  code: {
    fontFamily: string;
    fontSizePt: number;
    fontSizeHalfPt: number;
    bgColor: string;
    textColor: string;
    borderColor: string;
  };
  blockquote: {
    borderLeftColor: string;
    borderLeftWidthPt: number;
    bgColor: string;
    textColor: string;
    fontSizePt: number;
    isItalic: boolean;
  };
  accentColor: string;
  secondaryAccentColor: string;
}

/**
 * Normalizes hex color string (ensures no '#' prefix for DOCX and standard format).
 */
export function normalizeHexColor(color: string, fallback = "1A365D"): string {
  if (!color) return fallback;
  const clean = color.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return clean.split("").map((c) => c + c).join("");
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return clean;
  }
  return fallback;
}

/**
 * Normalizes font family to one of standard supported academic typography suites.
 */
export function normalizeFontFamily(font: string): string {
  const f = (font || "").toLowerCase();
  if (f.includes("calibri")) return "Calibri";
  if (f.includes("arial") || f.includes("helvetica")) return "Arial";
  if (f.includes("georgia")) return "Georgia";
  if (f.includes("aptos")) return "Aptos";
  return "Times New Roman";
}

/**
 * Centralized constructor for DocumentStyleSpec.
 * Every renderer (Preview, DOCX, PDF) queries this single source of truth.
 */
export function getDocumentStyleSpec(
  fontFamily = "Times New Roman",
  accentColor = "1A365D"
): DocumentStyleSpec {
  const primaryAccent = normalizeHexColor(accentColor, "1A365D");
  const secondaryAccent = primaryAccent === "1A365D" ? "2B6CB0" : primaryAccent;
  const normalizedFont = normalizeFontFamily(fontFamily);

  return {
    pageSize: "A4",
    pageDimensions: {
      widthPt: 595.28,
      heightPt: 841.89,
      widthTwips: 11906,
      heightTwips: 16838,
      widthMm: 210,
      heightMm: 297,
    },
    // Standard 1-inch (72pt / 1440 twips / 25.4mm) academic margins
    margins: {
      topPt: 72,
      bottomPt: 72,
      leftPt: 72,
      rightPt: 72,
      topTwips: 1440,
      bottomTwips: 1440,
      leftTwips: 1440,
      rightTwips: 1440,
      topMm: 25.4,
      bottomMm: 25.4,
      leftMm: 25.4,
      rightMm: 25.4,
    },
    bodyFont: normalizedFont,
    bodyFontSizePt: 11,
    bodyFontSizeHalfPt: 22,
    bodyColor: "1E293B",
    lineHeight: 1.35,
    paragraphSpacing: {
      beforePt: 0,
      afterPt: 6,
      beforeTwips: 0,
      afterTwips: 120,
    },
    headings: {
      1: {
        level: 1,
        fontSizePt: 18,
        fontSizeHalfPt: 36,
        lineHeight: 1.25,
        spacingBeforePt: 14,
        spacingAfterPt: 6,
        spacingBeforeTwips: 280,
        spacingAfterTwips: 120,
        color: primaryAccent,
        isBold: true,
        keepWithNext: true,
      },
      2: {
        level: 2,
        fontSizePt: 14,
        fontSizeHalfPt: 28,
        lineHeight: 1.25,
        spacingBeforePt: 12,
        spacingAfterPt: 4,
        spacingBeforeTwips: 240,
        spacingAfterTwips: 80,
        color: secondaryAccent,
        isBold: true,
        keepWithNext: true,
      },
      3: {
        level: 3,
        fontSizePt: 12,
        fontSizeHalfPt: 24,
        lineHeight: 1.3,
        spacingBeforePt: 10,
        spacingAfterPt: 3,
        spacingBeforeTwips: 200,
        spacingAfterTwips: 60,
        color: "0F172A",
        isBold: true,
        keepWithNext: true,
      },
      4: {
        level: 4,
        fontSizePt: 11,
        fontSizeHalfPt: 22,
        lineHeight: 1.3,
        spacingBeforePt: 8,
        spacingAfterPt: 2,
        spacingBeforeTwips: 160,
        spacingAfterTwips: 40,
        color: "334155",
        isBold: true,
        keepWithNext: true,
      },
      5: {
        level: 5,
        fontSizePt: 10.5,
        fontSizeHalfPt: 21,
        lineHeight: 1.3,
        spacingBeforePt: 6,
        spacingAfterPt: 2,
        spacingBeforeTwips: 120,
        spacingAfterTwips: 40,
        color: "475569",
        isBold: true,
        keepWithNext: true,
      },
      6: {
        level: 6,
        fontSizePt: 10,
        fontSizeHalfPt: 20,
        lineHeight: 1.3,
        spacingBeforePt: 6,
        spacingAfterPt: 2,
        spacingBeforeTwips: 120,
        spacingAfterTwips: 40,
        color: "64748B",
        isBold: true,
        keepWithNext: true,
      },
    },
    list: {
      indentPt: 18,
      indentTwips: 360,
      bulletColor: "64748B",
      itemSpacingAfterPt: 3,
      itemSpacingAfterTwips: 60,
    },
    table: {
      borderColor: "CBD5E1",
      borderWidthPt: 0.75,
      headerBgColor: "F1F5F9",
      headerTextColor: "0F172A",
      alternateRowBgColor: "F8FAFC",
      cellPaddingPt: { top: 4, bottom: 4, left: 6, right: 6 },
      fontSizePt: 9.5,
      fontSizeHalfPt: 19,
    },
    equation: {
      spacingBeforePt: 6,
      spacingAfterPt: 6,
      spacingBeforeTwips: 120,
      spacingAfterTwips: 120,
      alignment: "center",
      fontSizePt: 11,
      fontSizeHalfPt: 22,
      color: "0F172A",
    },
    code: {
      fontFamily: "Consolas, 'Courier New', monospace",
      fontSizePt: 9.5,
      fontSizeHalfPt: 19,
      bgColor: "1E293B",
      textColor: "F8FAFC",
      borderColor: "334155",
    },
    blockquote: {
      borderLeftColor: primaryAccent,
      borderLeftWidthPt: 3,
      bgColor: "F0F9FF",
      textColor: "0F172A",
      fontSizePt: 10.5,
      isItalic: true,
    },
    accentColor: primaryAccent,
    secondaryAccentColor: secondaryAccent,
  };
}

// ============================================================================
// CANONICAL AST NODES (Single Shared Document Representation)
// ============================================================================

export interface CanonicalHeading {
  id: string;
  type: "heading";
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  rawText: string;
}

export interface CanonicalParagraph {
  id: string;
  type: "paragraph";
  text: string;
  rawText: string;
}

export interface CanonicalEquation {
  id: string;
  type: "equation";
  latex: string;
  display: boolean;
  rawText: string;
}

export interface CanonicalTable {
  id: string;
  type: "table";
  headers: string[];
  rows: string[][];
  alignments?: ("left" | "center" | "right")[];
  rawText: string;
}

export interface CanonicalListItem {
  prefix: string;
  depth: number;
  text: string;
  ordered: boolean;
}

export interface CanonicalList {
  id: string;
  type: "list";
  ordered: boolean;
  items: CanonicalListItem[];
  rawText: string;
}

export interface CanonicalCode {
  id: string;
  type: "code";
  language?: string;
  code: string;
  rawText: string;
}

export interface CanonicalBlockquote {
  id: string;
  type: "blockquote";
  text: string;
  rawText: string;
}

export interface CanonicalDivider {
  id: string;
  type: "divider";
  rawText: string;
}

export type CanonicalASTNode =
  | CanonicalHeading
  | CanonicalParagraph
  | CanonicalEquation
  | CanonicalTable
  | CanonicalList
  | CanonicalCode
  | CanonicalBlockquote
  | CanonicalDivider;

export interface DocumentAST {
  title: string;
  styleSpec: DocumentStyleSpec;
  nodes: CanonicalASTNode[];
  stats: {
    blockCount: number;
    headingCount: number;
    equationCount: number;
    tableCount: number;
    listCount: number;
    paragraphCount: number;
    charCount: number;
    wordCount: number;
  };
}

/**
 * Parses markdown into the canonical DocumentAST.
 * This is the SINGLE AUTHORITATIVE PARSER for all renderers (Preview, DOCX, PDF).
 */
export function parseMarkdownToCanonicalAST(
  markdown: string,
  options?: {
    title?: string;
    fontFamily?: string;
    accentColor?: string;
  }
): DocumentAST {
  const text = (markdown || "").replace(/\r\n/g, "\n").trim();
  const title = options?.title || "Academic Notes";
  const styleSpec = getDocumentStyleSpec(options?.fontFamily, options?.accentColor);

  if (!text) {
    return {
      title,
      styleSpec,
      nodes: [],
      stats: {
        blockCount: 0,
        headingCount: 0,
        equationCount: 0,
        tableCount: 0,
        listCount: 0,
        paragraphCount: 0,
        charCount: 0,
        wordCount: 0,
      },
    };
  }

  const lines = text.split("\n");
  const nodes: CanonicalASTNode[] = [];
  let seq = 0;
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    const nodeId = `node-${++seq}`;

    // 1. Fenced Code block: ``` ... ```
    if (trimmed.startsWith("```")) {
      const langMatch = trimmed.match(/^```([a-zA-Z0-9_-]*)/);
      const language = langMatch ? langMatch[1] : undefined;
      const codeLines: string[] = [];
      const startIdx = i;
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith("```")) {
        i++;
      }
      const rawText = lines.slice(startIdx, i).join("\n");
      nodes.push({
        id: nodeId,
        type: "code",
        language,
        code: codeLines.join("\n"),
        rawText,
      });
      continue;
    }

    // 2. Display equation: $$ ... $$ (single or multi-line)
    if (trimmed.startsWith("$$")) {
      let latex = "";
      const startIdx = i;
      if (trimmed.length >= 4 && trimmed.slice(2).includes("$$")) {
        const endIdx = trimmed.slice(2).indexOf("$$");
        latex = trimmed.slice(2, 2 + endIdx).trim();
        i++;
      } else {
        const eqLines: string[] = [];
        const first = trimmed.slice(2).trim();
        if (first) eqLines.push(first);
        i++;
        while (i < lines.length) {
          const nextTrimmed = lines[i].trim();
          if (nextTrimmed.includes("$$")) {
            const endIdx = nextTrimmed.indexOf("$$");
            const endPart = nextTrimmed.slice(0, endIdx).trim();
            if (endPart) eqLines.push(endPart);
            i++;
            break;
          }
          if (/^#{1,6}\s+|^(\*{3,}|-{3,}|_{3,})$|^>\s+|^\|/.test(nextTrimmed)) {
            break;
          }
          eqLines.push(lines[i]);
          i++;
        }
        latex = eqLines.join(" ").trim();
      }
      const rawText = lines.slice(startIdx, i).join("\n");
      nodes.push({
        id: nodeId,
        type: "equation",
        latex,
        display: true,
        rawText,
      });
      continue;
    }

    // 3. Display equation: \[ ... \] or \\[ ... \\]
    if (/^(?:\\)+\[/.test(trimmed)) {
      let latex = "";
      const startIdx = i;
      const closeBracketIndex = trimmed.search(/(?:\\)+\]/);
      if (closeBracketIndex !== -1) {
        const openMatch = trimmed.match(/^(?:\\)+\[\s*/)!;
        latex = trimmed.slice(openMatch[0].length, closeBracketIndex).trim();
        i++;
      } else {
        const eqLines: string[] = [];
        const first = trimmed.replace(/^(?:\\)+\[\s*/, "").trim();
        if (first) eqLines.push(first);
        i++;
        while (i < lines.length) {
          const nextTrimmed = lines[i].trim();
          const nextCloseIdx = nextTrimmed.search(/(?:\\)+\]/);
          if (nextCloseIdx !== -1) {
            const endPart = nextTrimmed.slice(0, nextCloseIdx).trim();
            if (endPart) eqLines.push(endPart);
            i++;
            break;
          }
          if (/^#{1,6}\s+|^(\*{3,}|-{3,}|_{3,})$|^>\s+|^\|/.test(nextTrimmed)) {
            break;
          }
          eqLines.push(lines[i]);
          i++;
        }
        latex = eqLines.join(" ").trim();
      }
      const rawText = lines.slice(startIdx, i).join("\n");
      nodes.push({
        id: nodeId,
        type: "equation",
        latex,
        display: true,
        rawText,
      });
      continue;
    }

    // 4. Standalone unwrapped LaTeX math line starting with math command
    if (
      (trimmed.startsWith("\\frac") ||
        trimmed.startsWith("\\sqrt") ||
        trimmed.startsWith("\\sum") ||
        trimmed.startsWith("\\int")) &&
      !trimmed.startsWith("$")
    ) {
      nodes.push({
        id: nodeId,
        type: "equation",
        latex: trimmed,
        display: true,
        rawText: rawLine,
      });
      i++;
      continue;
    }

    // 5. Headings: #, ##, ###, ####, #####, ######
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      nodes.push({
        id: nodeId,
        type: "heading",
        level,
        text: headingMatch[2].trim(),
        rawText: rawLine,
      });
      i++;
      continue;
    }

    // 6. Horizontal divider: ---, ***, ___
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
      nodes.push({
        id: nodeId,
        type: "divider",
        rawText: rawLine,
      });
      i++;
      continue;
    }

    // 7. Markdown Table: | col1 | col2 |
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const tableRows: string[][] = [];
      const startIdx = i;
      let alignments: ("left" | "center" | "right")[] | undefined = undefined;

      while (
        i < lines.length &&
        lines[i].trim().startsWith("|") &&
        lines[i].trim().endsWith("|")
      ) {
        const rowText = lines[i].trim();
        // Check separator row for alignments: |:---|:---:|---:|
        if (/^\|[-:\s|]+\|$/.test(rowText)) {
          const alignCells = rowText.slice(1, -1).split("|");
          alignments = alignCells.map((c) => {
            const trimmedC = c.trim();
            if (trimmedC.startsWith(":") && trimmedC.endsWith(":")) return "center";
            if (trimmedC.endsWith(":")) return "right";
            return "left";
          });
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
        const rawText = lines.slice(startIdx, i).join("\n");
        const headers = tableRows[0];
        const rows = tableRows.slice(1);
        nodes.push({
          id: nodeId,
          type: "table",
          headers,
          rows,
          alignments,
          rawText,
        });
        continue;
      }
    }

    // 8. Blockquote: > ...
    if (trimmed.startsWith("> ")) {
      const quoteLines: string[] = [trimmed.slice(2)];
      const startIdx = i;
      i++;
      while (i < lines.length && lines[i].trim().startsWith("> ")) {
        quoteLines.push(lines[i].trim().slice(2));
        i++;
      }
      const rawText = lines.slice(startIdx, i).join("\n");
      nodes.push({
        id: nodeId,
        type: "blockquote",
        text: quoteLines.join(" "),
        rawText,
      });
      continue;
    }

    // 9. List Items: Unordered (-, *, •, o) or Ordered (1., 2., etc.)
    const isBulletItem = /^\s*(?:[-*•⁃◦▪▫–—]|\bo\b)\s+/.test(rawLine);
    const isNumItem = /^\s*\d+[\.\)]\s+/.test(trimmed);

    if (isBulletItem || isNumItem) {
      const items: CanonicalListItem[] = [];
      const startIdx = i;
      const isOrdered = isNumItem;

      while (i < lines.length) {
        const lineToTest = lines[i];
        const trimmedLine = lineToTest.trim();
        if (!trimmedLine) break;

        const bulletMatch = lineToTest.match(/^(\s*)(?:[-*•⁃◦▪▫–—]|\bo\b)\s+(.*)$/);
        const numMatch = trimmedLine.match(/^(\d+[\.\)])\s*(.*)$/);

        if (bulletMatch) {
          const indent = bulletMatch[1].length;
          const depth = Math.floor(indent / 2);
          items.push({
            prefix: "•",
            depth,
            text: bulletMatch[2].trim(),
            ordered: false,
          });
          i++;
        } else if (numMatch) {
          items.push({
            prefix: numMatch[1],
            depth: 0,
            text: numMatch[2].trim(),
            ordered: true,
          });
          i++;
        } else {
          // If continuation line of a list item
          if (items.length > 0 && /^\s{2,}\S/.test(lineToTest)) {
            items[items.length - 1].text += " " + trimmedLine;
            i++;
          } else {
            break;
          }
        }
      }

      if (items.length > 0) {
        const rawText = lines.slice(startIdx, i).join("\n");
        nodes.push({
          id: nodeId,
          type: "list",
          ordered: isOrdered,
          items,
          rawText,
        });
        continue;
      }
    }

    // 10. Standard Paragraph (consumes consecutive non-empty lines that aren't other block types)
    const paraLines: string[] = [trimmed];
    const startIdx = i;
    i++;
    while (i < lines.length) {
      const nextLine = lines[i];
      const nextTrimmed = nextLine.trim();
      if (!nextTrimmed) break;
      // Stop if next line begins another block element
      if (
        nextTrimmed.startsWith("```") ||
        nextTrimmed.startsWith("$$") ||
        /^(?:\\)+\[/.test(nextTrimmed) ||
        /^#{1,6}\s+/.test(nextTrimmed) ||
        /^(\*{3,}|-{3,}|_{3,})$/.test(nextTrimmed) ||
        (nextTrimmed.startsWith("|") && nextTrimmed.endsWith("|")) ||
        nextTrimmed.startsWith("> ") ||
        /^\s*(?:[-*•⁃◦▪▫–—]|\bo\b)\s+/.test(nextLine) ||
        /^\s*\d+[\.\)]\s+/.test(nextTrimmed)
      ) {
        break;
      }
      paraLines.push(nextTrimmed);
      i++;
    }

    const rawText = lines.slice(startIdx, i).join("\n");
    nodes.push({
      id: nodeId,
      type: "paragraph",
      text: paraLines.join(" "),
      rawText,
    });
  }

  // Compute stats for export verification & quality assurance
  const headingCount = nodes.filter((n) => n.type === "heading").length;
  const equationCount = nodes.filter((n) => n.type === "equation").length;
  const tableCount = nodes.filter((n) => n.type === "table").length;
  const listCount = nodes.filter((n) => n.type === "list").length;
  const paragraphCount = nodes.filter((n) => n.type === "paragraph").length;

  return {
    title,
    styleSpec,
    nodes,
    stats: {
      blockCount: nodes.length,
      headingCount,
      equationCount,
      tableCount,
      listCount,
      paragraphCount,
      charCount: text.length,
      wordCount: text.split(/\s+/).filter(Boolean).length,
    },
  };
}

/**
 * Validates export consistency before exporting DOCX or PDF.
 * Ensures that the document to be exported matches the authoritative preview document 100%.
 */
export function validateExportConsistency(
  authoritativeMarkdown: string,
  exportPayloadMarkdown: string,
  exportFormat: string
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const auth = (authoritativeMarkdown || "").trim();
  const payload = (exportPayloadMarkdown || "").trim();

  if (!auth) {
    errors.push("Cannot export: authoritative formatted document is empty.");
    return { isValid: false, errors };
  }

  if (!payload) {
    errors.push(`Cannot export to ${exportFormat}: export payload is empty.`);
    return { isValid: false, errors };
  }

  // Verify byte-level equality (normalizing line breaks)
  const normAuth = auth.replace(/\r\n/g, "\n");
  const normPayload = payload.replace(/\r\n/g, "\n");

  if (normAuth !== normPayload) {
    // Structural AST comparison in case of trivial trailing whitespace differences
    const astAuth = parseMarkdownToCanonicalAST(normAuth);
    const astPayload = parseMarkdownToCanonicalAST(normPayload);

    if (astAuth.stats.blockCount !== astPayload.stats.blockCount) {
      errors.push(
        `Export consistency violation: Block count mismatch (Preview has ${astAuth.stats.blockCount} blocks, Export payload has ${astPayload.stats.blockCount} blocks).`
      );
    }
    if (astAuth.stats.headingCount !== astPayload.stats.headingCount) {
      errors.push(
        `Export consistency violation: Heading count mismatch (${astAuth.stats.headingCount} vs ${astPayload.stats.headingCount}).`
      );
    }
    if (astAuth.stats.equationCount !== astPayload.stats.equationCount) {
      errors.push(
        `Export consistency violation: Equation count mismatch (${astAuth.stats.equationCount} vs ${astPayload.stats.equationCount}).`
      );
    }
    if (astAuth.stats.tableCount !== astPayload.stats.tableCount) {
      errors.push(
        `Export consistency violation: Table count mismatch (${astAuth.stats.tableCount} vs ${astPayload.stats.tableCount}).`
      );
    }
    if (astAuth.stats.listCount !== astPayload.stats.listCount) {
      errors.push(
        `Export consistency violation: List count mismatch (${astAuth.stats.listCount} vs ${astPayload.stats.listCount}).`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
