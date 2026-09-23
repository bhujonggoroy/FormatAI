/**
 * Centralized Academic Math Delimiter Normalizer.
 *
 * Normalizes all LaTeX math delimiters:
 * - Single- or multi-backslash display math: \[ ... \] or \\[ ... \\] -> $$ ... $$
 * - Single- or multi-backslash inline math: \( ... \) or \\( ... \\) -> $ ... $
 *
 * Features:
 * - Full placeholder protection: preserves existing $...$, $$...$$, and code blocks (```...```, `...`)
 * - Balanced brace tracking: ensures nested commands like \sqrt{\frac{a}{b}} are never truncated
 * - Distinguishes \left[ / \right] and \left( / \right) from standalone \[ and \( delimiters
 * - Strips redundant trailing LaTeX spacing artifacts (\quad, \qquad, \;, \!)
 */

/**
 * Finds closing LaTeX bracket/parenthesis delimiter while respecting nested braces {}.
 */
function findClosingDelimiter(
  text: string,
  contentStartIndex: number,
  expectedCloseChar: "]" | ")"
): { content: string; endIndex: number } | null {
  let braceDepth = 0;
  let i = contentStartIndex;

  while (i < text.length) {
    const ch = text[i];

    if (ch === "{") {
      braceDepth++;
      i++;
      continue;
    }
    if (ch === "}") {
      if (braceDepth > 0) braceDepth--;
      i++;
      continue;
    }

    // Delimiters can only close at root brace level (braceDepth === 0)
    if (braceDepth === 0) {
      // Check for backslash closing delimiter: \[ ... \] or \( ... \)
      // Single or multiple backslashes: e.g. \] or \\]
      // Ensure it is not preceded by letters (avoiding \right] or \right))
      if (ch === "\\" && (i === 0 || !/[a-zA-Z0-9]/.test(text[i - 1]))) {
        let p = i;
        while (p < text.length && text[p] === "\\") p++;
        if (p < text.length && text[p] === expectedCloseChar) {
          const rawContent = text.slice(contentStartIndex, i);
          return { content: rawContent, endIndex: p + 1 };
        }
      }
    }

    i++;
  }

  return null;
}

/**
 * Master math delimiter normalizer.
 * Central single source of truth for converting LaTeX delimiters into standard Markdown math.
 */
export function normalizeMathDelimiters(text: string): string {
  if (!text) return text;

  const placeholders: string[] = [];
  const putPh = (str: string): string => {
    placeholders.push(str);
    return `__DELIM_NORM_PH_${placeholders.length - 1}__`;
  };

  // 1. Protect code blocks: ```...``` and `...`
  let s = text.replace(/(```[\s\S]*?```|`[^`\n]+`)/g, (m) => putPh(m));

  // 2. Protect existing display math ($$ ... $$)
  s = s.replace(/(\$\$[\s\S]*?\$\$)/g, (m) => putPh(m));

  // 3. Protect existing inline math ($ ... $) - avoiding pure currency e.g. $50 or $10.99
  s = s.replace(/(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/g, (match, inner) => {
    if (/^\s*\d+(\.\d{1,2})?\s*$/.test(inner)) {
      return match; // Keep currency as-is
    }
    return putPh(match);
  });

  // 4. Convert display math: \[ ... \] or \\[ ... \\] -> $$ ... $$
  let pos = 0;
  while (pos < s.length) {
    const slashIdx = s.indexOf("\\", pos);
    if (slashIdx === -1) break;

    // Count consecutive backslashes
    let p = slashIdx;
    while (p < s.length && s[p] === "\\") p++;

    if (p < s.length && s[p] === "[") {
      const contentStart = p + 1;
      const match = findClosingDelimiter(s, contentStart, "]");
      if (match) {
        const cleaned = match.content
          .trim()
          .replace(/(?:\\)+(?:quad|qquad|,|;|!)\s*$/g, "")
          .trim();
        const displayMath = `\n\n$$\n${cleaned}\n$$\n\n`;
        const ph = putPh(displayMath);
        s = s.slice(0, slashIdx) + ph + s.slice(match.endIndex);
        pos = slashIdx + ph.length;
        continue;
      }
    }

    pos = slashIdx + 1;
  }

  // 5. Convert inline math: \( ... \) or \\( ... \\) -> $ ... $
  pos = 0;
  while (pos < s.length) {
    const slashIdx = s.indexOf("\\", pos);
    if (slashIdx === -1) break;

    // Count consecutive backslashes
    let p = slashIdx;
    while (p < s.length && s[p] === "\\") p++;

    if (p < s.length && s[p] === "(") {
      const contentStart = p + 1;
      const match = findClosingDelimiter(s, contentStart, ")");
      if (match) {
        const cleaned = match.content
          .replace(/\r?\n\s*/g, " ")
          .trim()
          .replace(/(?:\\)+(?:quad|qquad|,|;|!)\s*$/g, "")
          .trim();
        const inlineMath = `$${cleaned}$`;
        const ph = putPh(inlineMath);
        s = s.slice(0, slashIdx) + ph + s.slice(match.endIndex);
        pos = slashIdx + ph.length;
        continue;
      }
    }

    pos = slashIdx + 1;
  }

  // 6. Restore all placeholders
  s = s.replace(/__DELIM_NORM_PH_(\d+)__/g, (_, id) => placeholders[parseInt(id, 10)] ?? "");

  // 7. Normalize multiple redundant blank lines around display equations
  s = s.replace(/\n{3,}\$\$/g, () => "\n\n$$");
  s = s.replace(/\$\$\n{3,}/g, () => "$$\n\n");

  return s;
}
