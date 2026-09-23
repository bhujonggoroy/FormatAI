/**
 * Document Filename Generation & Sanitization Engine
 *
 * Extracts the first meaningful title from the current document content,
 * removes invalid filesystem characters (\ / : * ? " < > |),
 * replaces spaces with underscores, and truncates the string to 30 characters
 * to ensure safe, consistent filename generation across all export types.
 */

/**
 * Extracts the candidate title string from the current document content.
 * Follows title priority:
 * 1. Markdown headings (# Heading, ## Heading, etc.) or bold heading (**Heading**).
 * 2. First non-empty line (ignoring horizontal rules, code fences, math block delimiters).
 * 3. Leading meaningful phrase (up to 7 words or before formula).
 */
export function extractRawCandidate(content: string): string {
  if (!content || typeof content !== "string") return "";

  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  // Priority 1: First meaningful document title/heading (# Heading, **Heading**)
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      const candidate = headingMatch[1].trim();
      if (candidate) return candidate;
    }

    const boldMatch = trimmed.match(/^\*\*([^*]{2,100})\*\*[:\s]*$/);
    if (boldMatch) {
      const candidate = boldMatch[1].trim();
      if (candidate) return candidate;
    }
  }

  // Priority 2: First meaningful non-empty line
  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;

    // Skip horizontal dividers, markdown fences, pure math display tags
    if (/^[-*_]{3,}$/.test(line) || line.startsWith("```")) continue;
    if (/^(\$\$|\\\[)/.test(line)) continue;

    // Strip leading list bullet or numbering: 1. , - , * , > , •
    line = line.replace(/^(?:[-*+•⁃◦▪▫–—]|o|\d+[\.\)])\s+/, "");
    line = line.replace(/^>\s+/, "");

    // Strip markdown formatting symbols (*, _, `, ~)
    line = line.replace(/[*_`~#]+/g, " ").trim();

    if (!line) continue;

    // Priority 3: Leading meaningful phrase (cut before formulas, max 7 words)
    const mathCut = line.search(/[\$=+\\/]|\b[a-zA-Z]\([a-zA-Z]/);
    if (mathCut > 8) {
      line = line.slice(0, mathCut).trim();
    }

    const words = line.split(/\s+/).slice(0, 7).join(" ");
    return words;
  }

  return "";
}

/**
 * Cleans a candidate string into a safe, underscore-separated filename base
 * truncated to 30 characters.
 */
export function cleanFilename(raw: string, defaultName = "FormatAI_Document"): string {
  if (!raw || typeof raw !== "string") return defaultName;

  let s = raw.normalize("NFC").trim();

  // Remove LaTeX expressions: \(...\), \[...\], $$...$$, $...$, \frac...
  s = s.replace(/(?:\\)+\([^\n]*?(?:\\)+\)/g, " ");
  s = s.replace(/(?:\\)+\[[\s\S]*?(?:\\)+\]/g, " ");
  s = s.replace(/\$\$[\s\S]*?\$\$/g, " ");
  s = s.replace(/\$[^$\n]+\$/g, " ");
  s = s.replace(/\\(?:frac|sqrt|sum|prod|int|lim|infty|partial|operatorname|mathbf|mathrm|text)\b/g, " ");
  s = s.replace(/\\([a-zA-Z]+)/g, " ");

  // Remove invalid filename characters: \ / : * ? " < > |
  s = s.replace(/[\\/:*?"<>|]/g, " ");

  // Remove unnecessary punctuation: brackets, commas, semicolons, exclamation, ampersand, quotes, etc.
  s = s.replace(/[()[\]{}.,;!&@#$%^+=~`'"]/g, " ");

  // Replace spaces and sequences of unallowed chars with single underscore
  // Preserves Unicode letters (\p{L}), marks (\p{M} for Bengali vowels/kar/hasant), and numbers (\p{N})
  s = s.replace(/[^\p{L}\p{M}\p{N}]+/gu, "_");

  // Remove duplicate underscores
  s = s.replace(/_+/g, "_");

  // Remove leading and trailing underscores
  s = s.replace(/^_+|_+$/g, "");

  // Remove duplicate file extensions from the end (e.g. _docx, _pdf, _tex, _md, _txt)
  s = s.replace(/_(docx|pdf|tex|md|txt)$/i, "");

  // Truncate to 30 characters to ensure safe, consistent filename generation
  const MAX_FILENAME_LENGTH = 30;
  if (s.length > MAX_FILENAME_LENGTH) {
    s = s.slice(0, MAX_FILENAME_LENGTH).replace(/_+$/, "");
  }

  return s || defaultName;
}

/**
 * Generates an automatic filename from the CURRENT document content.
 * Extracts the first meaningful title, removes invalid characters (\ / : * ? " < > |),
 * replaces spaces with underscores, and truncates to 30 characters.
 *
 * @param content Current document content text or markdown
 * @param format Optional format extension (e.g. 'docx', 'pdf')
 * @returns Safe filename (e.g. 'STT251_Statistics.docx')
 */
export function generateFilenameFromContent(content: string, format?: string): string {
  const rawCandidate = extractRawCandidate(content);
  const cleaned = cleanFilename(rawCandidate, "FormatAI_Document");
  const base = cleaned || "FormatAI_Document";

  if (format) {
    const cleanExt = format.replace(/^\./, "").toLowerCase();
    return `${base}.${cleanExt}`;
  }
  return base;
}

/**
 * Returns a human-readable title for UI display in the header from the content.
 */
export function getDisplayTitleFromContent(content: string): string {
  const raw = extractRawCandidate(content);
  if (!raw) return "FormatAI Document";

  let s = raw.normalize("NFC").trim();
  s = s.replace(/^#{1,6}\s+/, "");
  s = s.replace(/[*_`~]+/g, "");
  s = s.replace(/(?:\\)+\([^\n]*?(?:\\)+\)/g, "");
  s = s.replace(/\$[^$\n]+\$/g, "");
  s = s.replace(/\\([a-zA-Z]+)/g, "");
  s = s.replace(/\s+/g, " ").trim();

  if (s.length > 50) {
    s = s.slice(0, 50).trim() + "...";
  }

  return s || "FormatAI Document";
}

// Backwards-compatible aliases
export const sanitizeFilenameBase = cleanFilename;
export const sanitizeToUnderscoreString = cleanFilename;
export const extractFirstHeadingOrLine = extractRawCandidate;
export function isSampleOrReference(_raw: string): boolean {
  return false;
}
