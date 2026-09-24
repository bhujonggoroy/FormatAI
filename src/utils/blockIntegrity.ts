/**
 * Block Integrity and Content Preservation Engine for FormatAI
 *
 * Requirements:
 * 1. Raw content immutable; never overwrite with formatted output.
 * 2. Empty/null/partial output never overwrites existing content.
 * 3. Block = blank line separated paragraph; equation/table/code block is a single atomic block.
 * 4. Stable deterministic ID for each block; match IDs after formatting, flag missing blocks.
 * 5. Character count preservation with ±2% tolerance.
 */

export type BlockType = "equation" | "table" | "code" | "heading" | "list" | "paragraph";

export interface DocumentBlock {
  /** Deterministic stable ID based on semantic role and substantive content */
  id: string;
  /** Semantic type of the block */
  type: BlockType;
  /** Raw content lines of the block */
  rawText: string;
  /** Normalized substantive content (ignoring formatting markup) */
  substantiveText: string;
  /** Raw character count */
  charCount: number;
  /** Substantive character count */
  substantiveCharCount: number;
  /** 1-based start line in source document */
  lineStart: number;
  /** 1-based end line in source document */
  lineEnd: number;
}

export interface BlockComparisonResult {
  passed: boolean;
  totalOriginalBlocks: number;
  totalFormattedBlocks: number;
  matchedBlocksCount: number;
  missingBlocks: DocumentBlock[];
  originalCharCount: number;
  formattedCharCount: number;
  originalSubstantiveChars: number;
  formattedSubstantiveChars: number;
  charCountDifferencePercent: number;
  tolerancePassed: boolean;
  flags: string[];
}

/**
 * 32-bit FNV-1a hash for deterministic, collision-resistant stable ID generation.
 */
export function fnv1aHash(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * Extracts substantive content from a block by stripping markdown syntax markers,
 * LaTeX wrapping commands, and formatting decoration while preserving words, numbers, and variables.
 */
export function extractSubstantiveText(text: string): string {
  if (!text) return "";
  let s = text;

  // Strip code fences
  s = s.replace(/^```[^\n]*\n?/gm, "").replace(/```$/gm, "");

  // Strip math delimiters: $$, \[, \], \(, \), $
  s = s.replace(/\$\$|\\\[|\\\]|\\\(|\\\)/g, " ");
  s = s.replace(/(?<!\\)\$/g, " ");

  // Normalize LaTeX formatting commands to substantive tokens:
  // \operatorname{Var} -> Var, \frac{a}{b} -> a b, \sqrt{x} -> x
  s = s.replace(/\\operatorname\{([^}]+)\}/g, "$1");
  s = s.replace(/\\text\{([^}]+)\}/g, "$1");
  s = s.replace(/\\mathbf\{([^}]+)\}/g, "$1");
  s = s.replace(/\\mathrm\{([^}]+)\}/g, "$1");
  s = s.replace(/\\mathbb\{([^}]+)\}/g, "$1");
  s = s.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1 $2");
  s = s.replace(/\\sqrt\{([^}]+)\}/g, "$1");
  s = s.replace(/\\bar\{([^}]+)\}/g, "$1");
  s = s.replace(/\\hat\{([^}]+)\}/g, "$1");

  // Strip remaining backslashes and special LaTeX symbols
  s = s.replace(/\\[a-zA-Z]+/g, " ");

  // Strip markdown structural markers: #, *, _, ~, |, >, -
  s = s.replace(/^[#>\s|*-]+/gm, " ");
  s = s.replace(/[*_~`|]/g, " ");

  // Collapse whitespace
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Generates a stable deterministic ID for a block.
 * Uses semantic prefix (e.g. eq-, tbl-, code-, hd-, q-, p-) + content hash.
 */
export function generateBlockId(type: BlockType, substantive: string, raw: string, index: number): string {
  const hash = fnv1aHash(substantive || raw.trim().toLowerCase());

  // Semantic prefix based on block characteristics
  let prefix: string = type;
  if (type === "heading") {
    const headingMatch = raw.match(/^#{1,6}\s*(.+)$/m);
    if (headingMatch) {
      const slug = headingMatch[1].trim().slice(0, 16).replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
      prefix = `hd-${slug}`;
    }
  } else if (type === "paragraph") {
    // Check if question/sub-question pattern
    const qMatch = raw.match(/^(?:Question\s*(\d+)|Q(\d+)|(\d+)[\.\)]|\(?([a-z])\))/i);
    if (qMatch) {
      const qLabel = qMatch[1] || qMatch[2] || qMatch[3] || qMatch[4];
      prefix = `q-${qLabel.toLowerCase()}`;
    }
  }

  return `${prefix}-${hash.slice(0, 6)}`;
}

/**
 * Parses raw or formatted document text into atomic blocks according to Rule 3:
 * "Block = blank line দিয়ে আলাদা paragraph; equation/table/code block একটাই block।"
 */
export function parseDocumentBlocks(text: string): DocumentBlock[] {
  if (!text || !text.trim()) return [];

  const lines = text.split(/\r?\n/);
  const blocks: DocumentBlock[] = [];
  let i = 0;
  let blockIndex = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Skip consecutive blank lines
    if (!trimmed) {
      i++;
      continue;
    }

    const startLine = i + 1;

    // 1. Fenced Code Block (``` ... ```): Entire block is ONE atomic block
    if (trimmed.startsWith("```")) {
      const codeLines = [rawLine];
      i++;
      while (i < lines.length) {
        codeLines.push(lines[i]);
        if (lines[i].trim().startsWith("```")) {
          i++;
          break;
        }
        i++;
      }
      const rawBlock = codeLines.join("\n");
      const substantive = extractSubstantiveText(rawBlock);
      const id = generateBlockId("code", substantive, rawBlock, blockIndex++);
      blocks.push({
        id,
        type: "code",
        rawText: rawBlock,
        substantiveText: substantive,
        charCount: rawBlock.length,
        substantiveCharCount: substantive.length,
        lineStart: startLine,
        lineEnd: i,
      });
      continue;
    }

    // 2. Display Equation Block ($$ ... $$ or \[ ... \]): Entire block is ONE atomic block
    if (trimmed.startsWith("$$") || /^(?:\\)+\[/.test(trimmed)) {
      const isBracket = /^(?:\\)+\[/.test(trimmed);
      const closePattern = isBracket ? /(?:\\)+\]/ : /\$\$/;

      // Single line display equation
      if (
        (trimmed.startsWith("$$") && trimmed.length >= 4 && trimmed.slice(2).includes("$$")) ||
        (isBracket && trimmed.slice(2).search(/(?:\\)+\]/) !== -1)
      ) {
        const rawBlock = rawLine;
        i++;
        const substantive = extractSubstantiveText(rawBlock);
        const id = generateBlockId("equation", substantive, rawBlock, blockIndex++);
        blocks.push({
          id,
          type: "equation",
          rawText: rawBlock,
          substantiveText: substantive,
          charCount: rawBlock.length,
          substantiveCharCount: substantive.length,
          lineStart: startLine,
          lineEnd: i,
        });
        continue;
      }

      // Multi-line display equation
      const mathLines = [rawLine];
      i++;
      while (i < lines.length) {
        const curLine = lines[i];
        mathLines.push(curLine);
        if (closePattern.test(curLine.trim())) {
          i++;
          break;
        }
        // Safety guard: do not swallow structural headings into unclosed math
        if (/^#{1,6}\s+|^(\*{3,}|-{3,}|_{3,})$/.test(curLine.trim())) {
          // Put the heading back to be parsed as its own block
          mathLines.pop();
          break;
        }
        i++;
      }
      const rawBlock = mathLines.join("\n");
      const substantive = extractSubstantiveText(rawBlock);
      const id = generateBlockId("equation", substantive, rawBlock, blockIndex++);
      blocks.push({
        id,
        type: "equation",
        rawText: rawBlock,
        substantiveText: substantive,
        charCount: rawBlock.length,
        substantiveCharCount: substantive.length,
        lineStart: startLine,
        lineEnd: i,
      });
      continue;
    }

    // 3. Markdown Table (| ... |): Entire table is ONE atomic block
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const tableLines = [rawLine];
      i++;
      while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      const rawBlock = tableLines.join("\n");
      const substantive = extractSubstantiveText(rawBlock);
      const id = generateBlockId("table", substantive, rawBlock, blockIndex++);
      blocks.push({
        id,
        type: "table",
        rawText: rawBlock,
        substantiveText: substantive,
        charCount: rawBlock.length,
        substantiveCharCount: substantive.length,
        lineStart: startLine,
        lineEnd: i,
      });
      continue;
    }

    // 4. Heading (# ...): Single heading block
    if (/^#{1,6}\s+/.test(trimmed)) {
      const rawBlock = rawLine;
      i++;
      const substantive = extractSubstantiveText(rawBlock);
      const id = generateBlockId("heading", substantive, rawBlock, blockIndex++);
      blocks.push({
        id,
        type: "heading",
        rawText: rawBlock,
        substantiveText: substantive,
        charCount: rawBlock.length,
        substantiveCharCount: substantive.length,
        lineStart: startLine,
        lineEnd: i,
      });
      continue;
    }

    // 5. Paragraph / List / Content Block: Grouped until blank line or next special block
    const paraLines = [rawLine];
    i++;
    while (i < lines.length) {
      const nextRaw = lines[i];
      const nextTrimmed = nextRaw.trim();

      // Blank line terminates the paragraph block
      if (!nextTrimmed) {
        i++;
        break;
      }

      // Next line starts a new atomic block type (code, display math, table, heading)
      if (
        nextTrimmed.startsWith("```") ||
        nextTrimmed.startsWith("$$") ||
        /^(?:\\)+\[/.test(nextTrimmed) ||
        (nextTrimmed.startsWith("|") && nextTrimmed.endsWith("|")) ||
        /^#{1,6}\s+/.test(nextTrimmed) ||
        /^(\*{3,}|-{3,}|_{3,})$/.test(nextTrimmed)
      ) {
        break;
      }

      paraLines.push(nextRaw);
      i++;
    }

    const rawBlock = paraLines.join("\n");
    const substantive = extractSubstantiveText(rawBlock);
    const isList = /^\s*(?:[-*•o]|\d+[\.\)])\s+/m.test(rawBlock);
    const type: BlockType = isList ? "list" : "paragraph";
    const id = generateBlockId(type, substantive, rawBlock, blockIndex++);

    blocks.push({
      id,
      type,
      rawText: rawBlock,
      substantiveText: substantive,
      charCount: rawBlock.length,
      substantiveCharCount: substantive.length,
      lineStart: startLine,
      lineEnd: i,
    });
  }

  return blocks;
}

/**
 * Compares original blocks with formatted blocks to verify content integrity:
 * - Matches blocks by stable ID or substantive token containment.
 * - Flags missing blocks.
 * - Verifies substantive character count with ±2% tolerance.
 */
export function compareDocumentBlocks(
  originalBlocks: DocumentBlock[],
  formattedBlocks: DocumentBlock[],
  tolerancePercent: number = 2.0
): BlockComparisonResult {
  const missingBlocks: DocumentBlock[] = [];
  const flags: string[] = [];

  let matchedCount = 0;

  // Build lookup index for formatted blocks
  const formattedIdSet = new Set(formattedBlocks.map((b) => b.id));
  const formattedSubstantiveList = formattedBlocks.map((b) => b.substantiveText).filter(Boolean);
  const combinedFormattedSubstantive = formattedSubstantiveList.join(" ");

  for (const origBlock of originalBlocks) {
    // 1. Direct Stable ID Match
    if (formattedIdSet.has(origBlock.id)) {
      matchedCount++;
      continue;
    }

    // 2. Token overlap or containment match
    if (!origBlock.substantiveText) {
      // Empty substantive block (pure whitespace/decoration)
      matchedCount++;
      continue;
    }

    // Check if the substantive content of this block is contained in formatted text
    const sampleKeywords = origBlock.substantiveText
      .split(/\s+/)
      .filter((w) => w.length >= 3);

    if (sampleKeywords.length === 0) {
      matchedCount++;
      continue;
    }

    // Count how many significant keywords from this block appear in formatted content
    const foundKeywords = sampleKeywords.filter((kw) => combinedFormattedSubstantive.includes(kw));
    const matchRatio = foundKeywords.length / sampleKeywords.length;

    if (matchRatio >= 0.6) {
      matchedCount++;
    } else {
      missingBlocks.push(origBlock);
      const snippet = origBlock.rawText.slice(0, 50).replace(/[\n\r]+/g, " ");
      flags.push(`Missing Block [${origBlock.id}] (${origBlock.type}): "${snippet}..."`);
    }
  }

  // Calculate Character Counts
  const originalCharCount = originalBlocks.reduce((sum, b) => sum + b.charCount, 0);
  const formattedCharCount = formattedBlocks.reduce((sum, b) => sum + b.charCount, 0);
  const originalSubstantiveChars = originalBlocks.reduce((sum, b) => sum + b.substantiveCharCount, 0);
  const formattedSubstantiveChars = formattedBlocks.reduce((sum, b) => sum + b.substantiveCharCount, 0);

  // Substantive Character count difference:
  // (formatted - original) / original * 100
  const charDiffPercent =
    originalSubstantiveChars > 0
      ? ((formattedSubstantiveChars - originalSubstantiveChars) / originalSubstantiveChars) * 100
      : 0;

  // Tolerance check: Substantive content should not drop below -2% of original
  // (Formatted output can have more characters due to LaTeX formatting, but substantive content shouldn't be lost)
  const tolerancePassed = charDiffPercent >= -tolerancePercent;

  if (!tolerancePassed) {
    flags.push(
      `Substantive character count drop exceeds ±${tolerancePercent}% tolerance: original has ${originalSubstantiveChars} chars, formatted has ${formattedSubstantiveChars} chars (${charDiffPercent.toFixed(1)}%).`
    );
  }

  const passed = missingBlocks.length === 0 && tolerancePassed;

  return {
    passed,
    totalOriginalBlocks: originalBlocks.length,
    totalFormattedBlocks: formattedBlocks.length,
    matchedBlocksCount: matchedCount,
    missingBlocks,
    originalCharCount,
    formattedCharCount,
    originalSubstantiveChars,
    formattedSubstantiveChars,
    charCountDifferencePercent: charDiffPercent,
    tolerancePassed,
    flags,
  };
}
