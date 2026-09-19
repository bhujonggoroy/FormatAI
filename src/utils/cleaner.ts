/**
 * Instant client-side NotebookLM note cleaner and LaTeX normalizer.
 * Provides real-time preview before or in addition to multi-provider AI processing.
 * Handles real-world NotebookLM exports, including:
 * - Display equations: \[ ... \], \\[ ... \\], $$ ... $$
 * - Inline equations: \( ... \), \\( ... \\), $ ... $
 * - Trailing spacing artifacts (\quad, \qquad, \;, \,, \!) before closing delimiters
 * - Unicode bullets (•, ⁃, ◦, ▪, ▫, –, —) and multi-space asterisks (*   )
 * - All heading levels (H1 to H6)
 * - Tree diagram branches (| | ├──, └──, │)
 */

export function cleanClientSideNotebookLM(text: string): string {
  if (!text) return "";

  let s = text;

  // 1. Normalize display equations: \[ ... \] or \\[ ... \\] (single-line or multi-line)
  // Strip trailing \quad, \qquad, \;, \,, etc. right before closing delimiter
  s = s.replace(/(?:\\)+\[\s*([\s\S]*?)\s*(?:(?:\\)+(?:quad|qquad|,|;|!)\s*)*(?:\\)+\]/g, (_, math) => {
    const cleaned = math.trim().replace(/(?:\\)+(?:quad|qquad|,|;|!)\s*$/g, "").trim();
    return `\n\n$$\n${cleaned}\n$$\n\n`;
  });

  // 2. Normalize inline equations: \( ... \) or \\( ... \\)
  s = s.replace(/(?:\\)+\(\s*([^\n]*?)\s*(?:(?:\\)+(?:quad|qquad|,|;|!)\s*)*(?:\\)+\)/g, (_, math) => {
    const cleaned = math.trim().replace(/(?:\\)+(?:quad|qquad|,|;|!)\s*$/g, "").trim();
    return `$${cleaned}$`;
  });

  // 3. Normalize unicode bullets and list items
  s = s.replace(/^([ \t]*)[•⁃◦▪▫–—]\s+/gm, "$1- ");
  s = s.replace(/^([ \t]*)\*\s{2,}/gm, "$1- ");

  const lines = s.split("\n");
  const cleaned: string[] = [];

  let inDisplayMath = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Track $$ display math blocks to never touch math interiors
    if (trimmed.startsWith("$$")) {
      if (trimmed.endsWith("$$") && trimmed.length >= 4) {
        cleaned.push(rawLine);
        continue;
      }
      inDisplayMath = !inDisplayMath;
      cleaned.push(rawLine);
      continue;
    }

    if (inDisplayMath) {
      cleaned.push(rawLine);
      continue;
    }

    // Detect and strip NotebookLM tree-drawing artifacts (├──, └──, │, |)
    if (/([│|├└┌┬─+\-]{2,}|[│|]\s*├──|[│|]\s*└──|[│|]\s*├─|[│|]\s*└─)/.test(rawLine)) {
      let indentLevel = 0;
      if (/([│|]\s*){2,}/.test(rawLine) || /^\s{4,}/.test(rawLine)) {
        indentLevel = 1;
      }

      const content = rawLine
        .replace(/^[│|\s+─├└┌┬\-]+/g, "")
        .replace(/^\s*[-*•⁃◦▪▫–—]\s*/, "")
        .trim();

      if (content) {
        // If section number, promote to Heading 3
        if (/^\d+(\.\d+)+\s+/.test(content)) {
          cleaned.push(`### ${content}`);
        } else {
          const prefix = indentLevel > 0 ? "    - " : "- ";
          cleaned.push(prefix + normalizeLineMath(content));
        }
      }
      continue;
    }

    // Lines starting with single pipe or branch marker: | Title or | - Item
    if (/^[│|]\s*/.test(rawLine) && !rawLine.includes("|", 1)) {
      const content = rawLine.replace(/^[│|]\s*/, "").trim();
      if (content) {
        cleaned.push(normalizeLineMath(content));
      }
      continue;
    }

    cleaned.push(normalizeLineMath(rawLine));
  }

  return cleaned.join("\n");
}

/**
 * Normalizes equations, Greek letters, and statistical symbols in text.
 * Strictly avoids touching already-delimited math blocks ($...$ or $$...$$).
 */
function normalizeLineMath(line: string): string {
  let s = line;

  // Normalize terms with math: **Parameter ($\theta$):** -> **Parameter** ($\theta$):
  s = s.replace(/\*\*([^*]+?)\s*\(\$([^$]+?)\$\)\s*:\*\*/g, (_, term, math) => `**${term}** ($${math}$):`);
  s = s.replace(/\*\*([^*]+?)\s*\(\$([^$]+?)\$\)\*\*/g, (_, term, math) => `**${term}** ($${math}$)`);
  s = s.replace(/\bParameter\s*\(\s*θ\s*\)/g, 'Parameter ($\\theta$)');
  s = s.replace(/\bParameter\s*\(\s*\\?theta\s*\)/g, 'Parameter ($\\theta$)');
  s = s.replace(/\bStatistic\s*\(\s*T\s*\)/g, 'Statistic ($T$)');

  // Hat/bar variables
  s = s.replace(/p̂/g, '\\hat{p}');
  s = s.replace(/X̄/g, '\\bar{X}');
  s = s.replace(/ŷ/g, '\\hat{y}');

  // Multiplier fraction & square roots outside existing math
  s = s.replace(/√\[([^[\]]+)\]/g, '\\sqrt{$1}');
  s = s.replace(/√\(([^()]+)\)/g, '\\sqrt{$1}');
  s = s.replace(/√([a-zA-Z0-9]+)/g, '\\sqrt{$1}');

  // Process sections strictly outside of existing $...$, $$...$$, or `...` blocks
  const parts = s.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+\$|`[^`]+`)/g);
  s = parts.map((part, idx) => {
    // Math/code blocks are at odd indices - DO NOT MODIFY
    if (idx % 2 === 1) return part;

    let p = part;

    // Normal distributions e.g. Z ~ N(0,1) or Z \sim N(0,1)
    p = p.replace(/\b([A-Z])\s*(?:\\sim|~)\s*N\(([^()]+)\)/g, '$$$1 \\sim N($2)$$');

    // Subscripted variables like t_\nu, t_n, U_i outside $
    p = p.replace(/\b([tTUuXxYyZz])_([0-9a-zA-Z]|\\[a-zA-Z]+)\b/g, '$$$1_$2$$');
    p = p.replace(/\b([tTUuXxYyZz])_\{([^{}]+)\}\b/g, '$$$1_{$2}$$');

    // Auto-wrap un-delimited fractions outside existing $ blocks
    p = p.replace(/(?<!\$)\\frac\{([^{}]+)\}\{([^{}]+)\}(?!\$)/g, (m) => `$${m}$`);

    // Auto-wrap Greek letters with sub/superscripts: \theta, \mu, \sigma_1^2, \chi^2_\nu, etc.
    p = p.replace(
      /\\(theta|mu|sigma|alpha|beta|gamma|delta|epsilon|zeta|eta|iota|kappa|lambda|nu|xi|pi|rho|tau|upsilon|phi|chi|psi|omega|Theta|Sigma|Delta|Lambda|Phi|Psi|Omega)(?:\^\{[^{}]+\}|\^[0-9a-zA-Z]+)?(?:_\{[^{}]+\}|_[0-9a-zA-Z\\]+)?(?:\^\{[^{}]+\}|\^[0-9a-zA-Z]+)?\b/g,
      (m) => `$${m}$`
    );

    // Auto-wrap LaTeX accents: \bar{X}, \hat{p}
    p = p.replace(/\\(bar|hat|tilde|vec)\{([^{}]+)\}/g, (m) => `$${m}$`);

    // Auto-wrap common statistical square variables: S^2, s^2
    p = p.replace(/\b([Ss])\^2\b/g, (m) => `$${m}$`);

    // Clean extra whitespace before commas, periods, or brackets
    p = p.replace(/\s+([,.;:?)\]])/g, '$1');

    return p;
  }).join('');

  return s;
}
