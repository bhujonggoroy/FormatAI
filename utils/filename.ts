/**
 * Document Filename Generation & Sanitization Engine
 *
 * Sanitizes the first non-empty line or first heading from content
 * to generate a safe, underscore-separated string for DOCX/PDF exports.
 * Strictly avoids any sample or reference file naming conventions.
 */

const SAMPLE_OR_REFERENCE_KEYWORDS = new Set([
  "sample",
  "sample_note",
  "sample_notes",
  "sample_document",
  "sample_pdf",
  "sample_docx",
  "reference",
  "reference_note",
  "reference_notes",
  "reference_document",
  "template",
  "template_document",
  "example",
  "example_note",
  "untitled",
  "untitled_document",
  "notes",
  "academic_notes",
  "document",
  "new_document",
  "formatai_document",
  "formatai",
]);

/**
 * Checks if a string matches common sample, reference, or placeholder naming conventions.
 */
export function isSampleOrReference(raw: string): boolean {
  if (!raw || typeof raw !== "string") return true;
  const normalized = raw
    .toLowerCase()
    .trim()
    .replace(/\.[a-z0-9]+$/i, "") // strip extension if present
    .replace(/[-_\s.]+/g, "_");

  if (SAMPLE_OR_REFERENCE_KEYWORDS.has(normalized)) {
    return true;
  }

  // Check prefix or suffix patterns like sample_*, *_sample, reference_*
  if (/^sample(?:_|$)/i.test(normalized) || /(?:^|_)sample$/i.test(normalized)) {
    return true;
  }
  if (/^reference(?:_|$)/i.test(normalized) || /(?:^|_)reference$/i.test(normalized)) {
    return true;
  }
  if (/^template(?:_|$)/i.test(normalized) || /(?:^|_)template$/i.test(normalized)) {
    return true;
  }

  return false;
}

/**
 * Extracts the candidate title by finding the first explicit Markdown heading
 * (#, ##, ###) or the first meaningful non-empty line of content.
 */
export function extractFirstHeadingOrLine(content: string): string {
  if (!content || typeof content !== "string") return "";

  const lines = content.split(/\r?\n/);

  // 1. First priority: Explicit Markdown headings (# Heading, ## Heading, ### Heading)
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      const candidate = headingMatch[1].trim();
      if (candidate && !isSampleOrReference(candidate)) {
        return candidate;
      }
    }

    // Bold title / heading pattern on its own line: **Title Here**
    const boldMatch = trimmed.match(/^\*\*([^*]{2,100})\*\*[:\s]*$/);
    if (boldMatch) {
      const candidate = boldMatch[1].trim();
      if (candidate && !isSampleOrReference(candidate)) {
        return candidate;
      }
    }
  }

  // 2. Second priority: First non-empty line of content (excluding dividers, code fences, or pure display math)
  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;

    // Skip horizontal dividers (---, ***, ___), code fences (```)
    if (/^[-*_]{3,}$/.test(line) || line.startsWith("```")) continue;

    // Skip pure display math blocks ($$...$$ or \[...\])
    if (/^(\$\$|\\\[)/.test(line)) continue;

    // Strip leading list numbers / bullet markers: 1. , - , * , > , •
    line = line.replace(/^(?:[-*+•⁃◦▪▫–—]|o|\d+[\.\)])\s+/, "");
    line = line.replace(/^>\s+/, "");

    // Strip markdown formatting symbols
    line = line.replace(/[*_`~#]+/g, " ");

    // Clean inline LaTeX expressions
    line = line.replace(/(?:\\)+\([^\n]*?(?:\\)+\)/g, " ");
    line = line.replace(/\$[^$\n]+\$/g, " ");
    line = line.replace(/\\(?:frac|sqrt|sum|prod|int|lim|infty|partial|operatorname|mathbf|mathrm|text)\b/g, " ");
    line = line.replace(/\\([a-zA-Z]+)/g, " ");

    const candidate = line.trim();
    if (candidate.length > 0 && !isSampleOrReference(candidate)) {
      return candidate;
    }
  }

  return "";
}

/**
 * Sanitizes any raw string into a safe, underscore-separated filename base.
 * Fully preserves Unicode letters (\p{L}), Unicode marks & vowel signs (\p{M})
 * such as Bengali kar/hasant, and numbers (\p{N}).
 */
export function sanitizeToUnderscoreString(raw: string, fallback = "Document"): string {
  if (!raw || typeof raw !== "string") return fallback;

  let s = raw.normalize("NFC").trim();

  // Strip Markdown markers
  s = s.replace(/[*_`~#]+/g, " ");

  // Strip LaTeX expressions
  s = s.replace(/(?:\\)+\([^\n]*?(?:\\)+\)/g, " ");
  s = s.replace(/(?:\\)+\[[\s\S]*?(?:\\)+\]/g, " ");
  s = s.replace(/\$\$[\s\S]*?\$\$/g, " ");
  s = s.replace(/\$[^$\n]+\$/g, " ");
  s = s.replace(/\\(?:frac|sqrt|sum|prod|int|lim|infty|partial|operatorname|mathbf|mathrm|text)\b/g, " ");
  s = s.replace(/\\([a-zA-Z]+)/g, " ");

  // Replace any sequence of characters that are NOT Unicode letters (\p{L}),
  // Unicode marks (\p{M} - critical for Bengali vowel diacritics and accents),
  // or numbers (\p{N}) with a single underscore.
  s = s.replace(/[^\p{L}\p{M}\p{N}]+/gu, "_");

  // Collapse consecutive underscores
  s = s.replace(/_+/g, "_");

  // Remove leading and trailing underscores
  s = s.replace(/^_+|_+$/g, "");

  // If the result matches sample or reference names, reject and use fallback
  if (!s || isSampleOrReference(s)) {
    return fallback;
  }

  // Truncate to a reasonable max length (65 characters) cleanly at an underscore if possible
  const maxLen = 65;
  if (s.length > maxLen) {
    let truncated = s.slice(0, maxLen);
    const lastUnderscore = truncated.lastIndexOf("_");
    if (lastUnderscore > 20) {
      truncated = truncated.slice(0, lastUnderscore);
    }
    s = truncated.replace(/_+$/, "");
  }

  return s || fallback;
}

// Alias for backwards compatibility
export const sanitizeFilenameBase = sanitizeToUnderscoreString;

/**
 * Generates a safe, underscore-separated filename for DOCX/PDF exports.
 * Sanitizes the first non-empty line or first heading from content.
 * Strictly avoids any sample or reference file naming conventions.
 *
 * @param content The document text or formatted markdown.
 * @param userTitleOrFormat Optional title or format extension.
 * @param format Optional format extension (e.g. 'docx', 'pdf', 'tex', 'md', 'txt').
 * @returns Safe, underscore-separated filename (with extension if format is provided).
 */
export function generateFilenameFromContent(
  content: string,
  userTitleOrFormat?: string,
  format?: string
): string {
  let cleanFormat = "";
  let userTitle = "";

  const knownFormats = new Set(["docx", "pdf", "tex", "md", "txt", "html"]);

  if (format) {
    cleanFormat = format.replace(/^\./, "").toLowerCase();
    userTitle = typeof userTitleOrFormat === "string" ? userTitleOrFormat : "";
  } else if (userTitleOrFormat) {
    const candidate = userTitleOrFormat.replace(/^\./, "").toLowerCase();
    if (knownFormats.has(candidate)) {
      cleanFormat = candidate;
    } else {
      userTitle = userTitleOrFormat;
    }
  }

  let candidate = "";

  // Only use userTitle if it's explicitly provided and NOT a sample/reference/placeholder name
  if (userTitle && !isSampleOrReference(userTitle)) {
    candidate = userTitle;
  }

  // If no valid title from userTitle, extract from the content's first heading or first line
  if (!candidate || isSampleOrReference(candidate)) {
    candidate = extractFirstHeadingOrLine(content);
  }

  const safeBase = sanitizeToUnderscoreString(candidate, "Academic_Document");

  return cleanFormat ? `${safeBase}.${cleanFormat}` : safeBase;
}
