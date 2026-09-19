/**
 * Instant client-side NotebookLM note cleaner and LaTeX normalizer.
 * Provides real-time preview before or in addition to Gemini AI processing.
 */

export function cleanClientSideNotebookLM(text: string): string {
  if (!text) return "";

  const lines = text.split("\n");
  const cleaned: string[] = [];

  for (const rawLine of lines) {
    let line = rawLine;

    // Detect and strip NotebookLM tree-drawing artifacts (├──, └──, │, |)
    if (/([│|├└┌┬─+\-]{2,}|[│|]\s*├──|[│|]\s*└──|[│|]\s*├─|[│|]\s*└─)/.test(line)) {
      // Calculate hierarchy level
      let indentLevel = 0;
      if (/([│|]\s*){2,}/.test(line) || /^\s{4,}/.test(line)) {
        indentLevel = 1;
      }

      // Strip pipes, tree drawing branches, and whitespace
      const content = line
        .replace(/^[│|\s+─├└┌┬\-]+/g, "")
        .replace(/^\s*[-*•]\s*/, "")
        .trim();

      if (content) {
        const prefix = indentLevel > 0 ? "    - " : "- ";
        cleaned.push(prefix + normalizeLineMath(content));
      }
      continue;
    }

    // Lines that start with single pipe or branch marker: | Title or | - Item
    if (/^[│|]\s*/.test(line) && !line.includes("|", 1)) {
      const content = line.replace(/^[│|]\s*/, "").trim();
      if (content) {
        cleaned.push(normalizeLineMath(content));
      }
      continue;
    }

    cleaned.push(normalizeLineMath(line));
  }

  return cleaned.join("\n");
}

/**
 * Normalizes equations, Greek letters, and statistical symbols in a line of text.
 * Fixes patterns like:
 * - **Parameter ($\theta$):** -> **Parameter** ($\theta$):
 * - **Statistic ($T$):** -> **Statistic** ($T$):
 * - Parameter (\theta) -> Parameter ($\theta$)
 * - population mean \mu -> population mean $\mu$
 * - population variance \sigma^2 -> population variance $\sigma^2$
 * - sample mean \bar{X} -> sample mean $\bar{X}$
 * - sample variance S^2 -> sample variance $S^2$
 * - sample proportion \hat{p} -> sample proportion $\hat{p}$
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

  // Multiplier fraction & square roots
  s = s.replace(/√\[([^[\]]+)\]/g, '\\sqrt{$1}');
  s = s.replace(/√\(([^()]+)\)/g, '\\sqrt{$1}');
  s = s.replace(/√([a-zA-Z0-9]+)/g, '\\sqrt{$1}');

  // Auto-wrap un-delimited fractions outside existing $ blocks
  s = s.replace(/(?<!\$)\\frac\{([^{}]+)\}\{([^{}]+)\}(?!\$)/g, (m) => `$${m}$`);

  // Process sections outside of existing $...$ or `...` blocks
  const parts = s.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+\$|`[^`]+`)/g);
  s = parts.map((part, idx) => {
    // Math/code blocks are at odd indices
    if (idx % 2 === 1) return part;

    let p = part;

    // Normal distributions e.g. Z ~ N(0,1) or Z \sim N(0,1)
    p = p.replace(/\b([A-Z])\s*(?:\\sim|~)\s*N\(([^()]+)\)/g, '$$$1 \\sim N($2)$$');

    // Subscripted variables like t_\nu, t_n, U_i outside $
    p = p.replace(/\b([tTUuXxYyZz])_([0-9a-zA-Z]|\\[a-zA-Z]+)\b/g, '$$$1_$2$$');
    p = p.replace(/\b([tTUuXxYyZz])_\{([^{}]+)\}\b/g, '$$$1_{$2}$$');

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
