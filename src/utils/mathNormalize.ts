/**
 * Pure string normalizers shared by the browser preview cleaner and the server exporters.
 */

export const UNICODE_MATH_REPLACEMENTS: Record<string, string> = {
  '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\Gamma': 'Γ',
  '\\delta': 'δ', '\\Delta': 'Δ', '\\epsilon': 'ε', '\\varepsilon': 'ε',
  '\\zeta': 'ζ', '\\eta': 'η', '\\theta': 'θ', '\\Theta': 'Θ',
  '\\iota': 'ι', '\\kappa': 'κ', '\\lambda': 'λ', '\\Lambda': 'Λ',
  '\\mu': 'μ', '\\nu': 'ν', '\\xi': 'ξ', '\\Xi': 'Ξ',
  '\\pi': 'π', '\\Pi': 'Π', '\\rho': 'ρ', '\\sigma': 'σ',
  '\\Sigma': 'Σ', '\\tau': 'τ', '\\upsilon': 'υ', '\\phi': 'φ',
  '\\Phi': 'Φ', '\\chi': 'χ', '\\psi': 'ψ', '\\Psi': 'Ψ',
  '\\omega': 'ω', '\\Omega': 'Ω',
  
  '\\times': '×', '\\div': '÷', '\\pm': '±', '\\mp': '∓',
  '\\cdot': '·', '\\circ': '°', '\\bullet': '•',
  '\\leq': '≤', '\\le': '≤', '\\geq': '≥', '\\ge': '≥',
  '\\neq': '≠', '\\ne': '≠', '\\approx': '≈', '\\equiv': '≡',
  '\\propto': '∝', '\\sim': '∼',
  '\\infty': '∞', '\\partial': '∂', '\\nabla': '∇',
  '\\sum': '∑', '\\prod': '∏', '\\int': '∫', '\\iint': '∬', '\\iiint': '∭',
  '\\oint': '∮', '\\sqrt': '√',
  '\\in': '∈', '\\notin': '∉', '\\subset': '⊂', '\\subseteq': '⊆',
  '\\supset': '⊃', '\\supseteq': '⊇', '\\cup': '∪', '\\cap': '∩',
  '\\forall': '∀', '\\exists': '∃', '\\neg': '¬',
  '\\rightarrow': '→', '\\leftarrow': '←', '\\Rightarrow': '⇒', '\\Leftarrow': '⇐',
  '\\leftrightarrow': '↔', '\\Leftrightarrow': '⇔',
};

const SUPERSCRIPTS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  'n': 'ⁿ', 'i': 'ⁱ', 'x': 'ˣ', 'y': 'ʸ', 'z': 'ᶻ', 't': 'ᵗ'
};

const SUBSCRIPTS: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ', 'k': 'ₖ',
  'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ', 'p': 'ₚ', 'r': 'ᵣ',
  's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ', 'v': 'ᵥ', 'x': 'ₓ'
};

/**
 * Eliminates tree-diagram characters from Google NotebookLM (e.g. | | ├──, └──)
 * and normalizes lists, display math, and inline math into clean Markdown outline hierarchy.
 */
export function cleanNotebookLMTreeArtifacts(text: string): string {
  if (!text) return text;
  let s = text;

  // 1. Normalize display equations: \[ ... \] or \\[ ... \\] (single- or multi-line)
  s = s.replace(/(?:\\)+\[\s*([\s\S]*?)\s*(?:(?:\\)+(?:quad|qquad|,|;|!|\s|newline)\s*)*(?:\\)+\]/g, (match, math) => {
    if (/(?:^|\n)#{1,6}\s+|(?:^|\n)(?:\*{3,}|-{3,}|_{3,})(?:\n|$)/.test(math)) {
      return match;
    }
    const cleaned = math.trim().replace(/(?:\\+(?:quad|qquad|,|;|!|\s|newline)|\\\\)+$/g, "").trim();
    return `\n\n$$\n${cleaned}\n$$\n\n`;
  });

  // 2. Normalize inline equations: \( ... \) or \\( ... \\)
  s = s.replace(/(?:\\)+\(\s*([\s\S]*?)\s*(?:(?:\\)+(?:quad|qquad|,|;|!|\s|newline)\s*)*(?:\\)+\)/g, (_, math) => {
    const cleaned = math.replace(/\r?\n\s*/g, " ").trim().replace(/(?:\\+(?:quad|qquad|,|;|!|\s|newline)|\\\\)+$/g, "").trim();
    return `\\(${cleaned}\\)`;
  });

  // 3. Normalize unicode bullets and list items
  s = s.replace(/^([ \t]*)[•⁃◦▪▫–—]\s+/gm, "$1- ");
  s = s.replace(/^([ \t]*)\*\s{2,}/gm, "$1- ");

  const lines = s.split('\n');
  const result: string[] = [];

  let inDisplayMath = false;

  for (let line of lines) {
    let trimmed = line.trim();

    if (trimmed.startsWith("$$")) {
      if (trimmed.endsWith("$$") && trimmed.length >= 4) {
        result.push(line);
        continue;
      }
      inDisplayMath = !inDisplayMath;
      result.push(line);
      continue;
    }

    if (inDisplayMath) {
      result.push(line);
      continue;
    }

    // Filter out standalone vertical pipes or tree lines
    if (!trimmed || trimmed === '|' || trimmed === '│') {
      continue;
    }

    // Detect tree outline prefix: | | ├── or | └── etc.
    if (/^[|│\s]*(?:├──|└──|├─|└─|\|─|\+-|\+--)/.test(trimmed)) {
      const pipeCount = (trimmed.match(/[|│]/g) || []).length;
      const stripped = trimmed.replace(/^[|│\s]*(?:├──|└──|├─|└─|\|─|\+-|\+--)\s*/, '');
      
      if (!stripped) continue;

      // If it's a section number (e.g. 2.3 Sample Size Dynamics)
      if (/^\d+(\.\d+)+\s+/.test(stripped)) {
        result.push(`### ${stripped}`);
        continue;
      }
      
      // Indent based on depth
      const indent = Math.max(0, pipeCount - 1);
      const prefix = '  '.repeat(indent) + '- ';
      result.push(prefix + stripped);
      continue;
    }

    // Strip single leading pipe from start of line ONLY if not a markdown table row
    if (/^[|│]\s+/.test(trimmed) && !trimmed.endsWith('|')) {
      trimmed = trimmed.replace(/^[|│]\s+/, '');
    }

    result.push(line);
  }

  return result.join('\n');
}

function extractBalancedBrace(str: string, startIndex: number): { content: string; endIndex: number } | null {
  if (startIndex >= str.length || str[startIndex] !== "{") return null;
  let depth = 1;
  let i = startIndex + 1;
  while (i < str.length && depth > 0) {
    if (str[i] === "{") depth++;
    else if (str[i] === "}") depth--;
    i++;
  }
  if (depth === 0) {
    return { content: str.slice(startIndex + 1, i - 1), endIndex: i };
  }
  return null;
}

/**
 * Wraps un-delimited equations and LaTeX commands outside existing math blocks
 * using balanced brace extraction to guarantee nested formulas (\sqrt{\frac{...}{...}})
 * are NEVER split into corrupted fragments.
 */
function wrapAllUnwrappedMathSafely(text: string): string {
  if (!text) return text;

  const mathPlaceholders: string[] = [];
  const putPh = (mathStr: string) => {
    mathPlaceholders.push(mathStr);
    return `__MATH_PH_${mathPlaceholders.length - 1}__`;
  };

  // 1. Protect existing math blocks ($$...$$, \[...\], \(...\), $...$, `...`)
  let s = text.replace(/(\$\$[\s\S]+?\$\$|(?:\\)+\[[\s\S]*?(?:\\)+\]|(?:\\)+\([\s\S]*?(?:\\)+\)|\$[^$\n]+\$|`[^`]+`)/g, (match) => putPh(match));

  // 2. Normal distributions e.g. Z ~ N(0,1) or \bar{X} \sim N(\mu, \sigma^2/n)
  s = s.replace(/\b([A-Za-z\\]+(?:_[a-zA-Z0-9{}]+)?)\s*(?:\\sim|~)\s*N\(([^()]+)\)/g, (_, v, p) => putPh(`$${v} \\sim N(${p})$`));

  // 3. Whole equations with functions or variables:
  // e.g. SE(p_1 - p_2) = \sqrt{...}, Z = \frac{...}{...}, \sigma_{\bar{X}}^2 = ...
  s = s.replace(/((?:\\[a-zA-Z]+|[A-Za-z]\w*)(?:\([^)\n]*\))?(?:_[0-9a-zA-Z{}]+)?(?:\^[0-9a-zA-Z{}]+)?\s*=\s*\\(?:sqrt|frac)[^\n,;]+)/g, (m) => putPh(`$${m.trim()}$`));
  s = s.replace(/([a-zA-Z0-9_().\\-]+(?:\s*[-+*/]\s*[a-zA-Z0-9_().\\-]+)*\s*(?:\\ge|\\le|\\geq|\\leq|\\neq|\\approx|\\sim|\\propto|=)\s*\\(?:frac|sqrt)[^\n,;]+)/g, (m) => putPh(`$${m.trim()}$`));

  // 4. Standalone radicals: \sqrt{...} with balanced braces
  let pos = 0;
  while (pos < s.length) {
    const idx = s.indexOf("\\sqrt", pos);
    if (idx === -1) break;
    let cur = idx + 5;
    while (cur < s.length && /\s/.test(s[cur])) cur++;
    if (s[cur] === "[") {
      const closeB = s.indexOf("]", cur);
      if (closeB !== -1) cur = closeB + 1;
    }
    while (cur < s.length && /\s/.test(s[cur])) cur++;
    const body = extractBalancedBrace(s, cur);
    if (body) {
      let extraEnd = body.endIndex;
      const tail = s.slice(body.endIndex);
      const matchExtra = tail.match(/^\s*(?:\\cdot|\\times|\*)\s*(?:\\frac\{[^{}]+\}\{[^{}]+\}|\\?[a-zA-Z0-9_/]+)/);
      if (matchExtra) {
        extraEnd = body.endIndex + matchExtra[0].length;
      }
      const formula = s.slice(idx, extraEnd);
      const ph = putPh(`$${formula}$`);
      s = s.slice(0, idx) + ph + s.slice(extraEnd);
      pos = idx + ph.length;
      continue;
    }
    pos = idx + 5;
  }

  // 5. Standalone fractions: \frac{num}{den} with balanced braces
  pos = 0;
  while (pos < s.length) {
    const idx = s.indexOf("\\frac", pos);
    if (idx === -1) break;
    let cur = idx + 5;
    while (cur < s.length && /\s/.test(s[cur])) cur++;
    const num = extractBalancedBrace(s, cur);
    if (num) {
      cur = num.endIndex;
      while (cur < s.length && /\s/.test(s[cur])) cur++;
      const den = extractBalancedBrace(s, cur);
      if (den) {
        const fullFrac = s.slice(idx, den.endIndex);
        const ph = putPh(`$${fullFrac}$`);
        s = s.slice(0, idx) + ph + s.slice(den.endIndex);
        pos = idx + ph.length;
        continue;
      }
    }
    pos = idx + 5;
  }

  // 6. Subscripted variables like t_\nu, t_n, U_i outside $
  s = s.replace(/\b([tTUuXxYyZz])_([0-9a-zA-Z]|\\[a-zA-Z]+)\b/g, (_, v, sub) => putPh(`$${v}_${sub}$`));
  s = s.replace(/\b([tTUuXxYyZz])_\{([^{}]+)\}\b/g, (_, v, sub) => putPh(`$${v}_{${sub}}$`));

  // 7. Greek letters with optional subscripts/superscripts
  s = s.replace(
    /\\(theta|mu|sigma|alpha|beta|gamma|delta|epsilon|zeta|eta|iota|kappa|lambda|nu|xi|pi|rho|tau|upsilon|phi|chi|psi|omega|Theta|Sigma|Delta|Lambda|Phi|Psi|Omega)(?:\^\{[^{}]+\}|\^[0-9a-zA-Z]+)?(?:_\{[^{}]+\}|_[0-9a-zA-Z\\]+)?(?:\^\{[^{}]+\}|\^[0-9a-zA-Z]+)?\b/g,
    (m) => putPh(`$${m}$`)
  );

  // 8. LaTeX accents: \bar{X}, \hat{p}, \tilde{X}
  s = s.replace(/\\(bar|hat|tilde|vec)\{([^{}]+)\}/g, (m) => putPh(`$${m}$`));

  // 9. Common statistical variance variables: S^2, s^2
  s = s.replace(/\b([Ss])\^2\b/g, (m) => putPh(`$${m}$`));

  // Restore all protected math placeholders
  s = s.replace(/__MATH_PH_(\d+)__/g, (_, id) => mathPlaceholders[parseInt(id, 10)] || "");
  return s;
}

/**
 * Standardizes pseudo-math strings into standard LaTeX.
 * First normalizes any bracketed equations (\[ ... \] or \( ... \)) into standard $$ or $,
 * and strictly isolates existing math blocks ($$...$$ and $...$) so they are never corrupted.
 */
export function standardizeMathToLatex(text: string): string {
  if (!text) return text;
  let s = text;

  // 0. Strip footnote/citation brackets such as [১৫], [২০, ২১], [৮০], [15], etc.
  s = s.replace(/\[[০-৯0-9,\s–-]+\]/g, '');

  // 1. Normalize bracketed display math: \[ ... \] or \\[ ... \\]
  s = s.replace(/(?:\\)+\[\s*([\s\S]*?)\s*(?:(?:\\)+(?:quad|qquad|,|;|!|\s|newline)\s*)*(?:\\)+\]/g, (match, math) => {
    if (/(?:^|\n)#{1,6}\s+|(?:^|\n)(?:\*{3,}|-{3,}|_{3,})(?:\n|$)/.test(math)) {
      return match;
    }
    const cleaned = math.trim().replace(/(?:\\+(?:quad|qquad|,|;|!|\s|newline)|\\\\)+$/g, "").trim();
    return `\n\n$$\n${cleaned}\n$$\n\n`;
  });

  // 2. Normalize bracketed inline math: \( ... \) or \\( ... \\)
  s = s.replace(/(?:\\)+\(\s*([\s\S]*?)\s*(?:(?:\\)+(?:quad|qquad|,|;|!|\s|newline)\s*)*(?:\\)+\)/g, (_, math) => {
    const cleaned = math.replace(/\r?\n\s*/g, " ").trim().replace(/(?:\\+(?:quad|qquad|,|;|!|\s|newline)|\\\\)+$/g, "").trim();
    return `\\(${cleaned}\\)`;
  });

  // 3. Normalize bullet styles
  s = s.replace(/^([ \t]*)[•⁃◦▪▫–—]\s+/gm, "$1- ");
  s = s.replace(/^([ \t]*)\*\s{2,}/gm, "$1- ");

  // Normalize statistical hypotheses like Ho: beta = 0 or H0: p=0
  s = s.replace(/\bH[o0]:\s*beta\s*=\s*0\b/gi, '$H_0: \\beta = 0$');
  s = s.replace(/\bH[o0]:\s*(?:p|rho)\s*=\s*0\b/gi, '$H_0: \\rho = 0$');
  s = s.replace(/\bH[o0]:\s*mu\s*=\s*([0-9.]+)\b/gi, '$H_0: \\mu = $1$');

  // Hat variables: p̂ -> \hat{p}
  s = s.replace(/p̂/g, '\\hat{p}');
  s = s.replace(/X̄/g, '\\bar{X}');
  s = s.replace(/ŷ/g, '\\hat{y}');

  // Convert radical bracketed expressions: √[(...)] or √[...] into \sqrt{...}
  s = s.replace(/√\[([^[\]]+)\]/g, '\\sqrt{$1}');
  s = s.replace(/√\(([^()]+)\)/g, '\\sqrt{$1}');
  s = s.replace(/√([a-zA-Z0-9]+)/g, '\\sqrt{$1}');

  // Square roots with fraction inside: \sqrt{a / b}
  s = s.replace(/\\sqrt\{([^{}]+)\s*\/\s*([^{}]+)\}/g, '\\sqrt{\\frac{$1}{$2}}');

  // Multiplier fraction: (N - n) / (N - 1)
  s = s.replace(/\((N\s*-\s*n)\)\s*\/\s*\((N\s*-\s*1)\)/g, '\\frac{N - n}{N - 1}');

  // 1 / \sqrt{n} -> \frac{1}{\sqrt{n}}
  s = s.replace(/1\s*\/\s*\\sqrt\{n\}/g, '\\frac{1}{\\sqrt{n}}');
  s = s.replace(/1\s*\/\s*√n/g, '\\frac{1}{\\sqrt{n}}');

  // σ₁² -> \sigma_1^2
  s = s.replace(/σ₁²/g, '\\sigma_1^2');
  s = s.replace(/σ₂²/g, '\\sigma_2^2');
  s = s.replace(/n₁/g, 'n_1');
  s = s.replace(/n₂/g, 'n_2');
  s = s.replace(/p₁/g, 'p_1');
  s = s.replace(/p₂/g, 'p_2');
  s = s.replace(/q₁/g, 'q_1');
  s = s.replace(/q₂/g, 'q_2');

  // Normalize terms with math: **Parameter ($\theta$):** -> **Parameter** ($\theta$):
  s = s.replace(/\*\*([^*]+?)\s*\(\$([^$]+?)\$\)\s*:\*\*/g, (_, term, math) => `**${term}** ($${math}$):`);
  s = s.replace(/\*\*([^*]+?)\s*\(\$([^$]+?)\$\)\*\*/g, (_, term, math) => `**${term}** ($${math}$)`);
  s = s.replace(/\bParameter\s*\(\s*θ\s*\)/g, 'Parameter ($\\theta$)');
  s = s.replace(/\bParameter\s*\(\s*\\?theta\s*\)/g, 'Parameter ($\\theta$)');
  s = s.replace(/\bStatistic\s*\(\s*T\s*\)/g, 'Statistic ($T$)');

  // Safely wrap all un-delimited math using balanced brace parsing
  s = wrapAllUnwrappedMathSafely(s);

  return s;
}

export function sanitizeMathToUnicode(text: string): string {
  if (!text) return text;
  let result = text;

  for (const [latex, unicode] of Object.entries(UNICODE_MATH_REPLACEMENTS)) {
    result = result.replaceAll(latex + ' ', unicode + ' ');
    result = result.replaceAll(latex, unicode);
  }

  // Fractions: \frac{a}{b} -> (a)/(b)
  result = result.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)');
  
  // Square root: \sqrt{x} -> √(x)
  result = result.replace(/\\sqrt\{([^{}]+)\}/g, '√($1)');
  result = result.replace(/\\sqrt\[([^{}]+)\]\{([^{}]+)\}/g, '^$1√($2)');

  // Superscripts
  result = result.replace(/\^\{([a-zA-Z0-9+\-=()]+)\}/g, (_, chars) => {
    let conv = '';
    for (const c of chars) {
      conv += SUPERSCRIPTS[c] || c;
    }
    return conv;
  });
  result = result.replace(/\^([0-9])/g, (_, d) => SUPERSCRIPTS[d] || d);

  // Subscripts
  result = result.replace(/_\{([a-zA-Z0-9+\-=()]+)\}/g, (_, chars) => {
    let conv = '';
    for (const c of chars) {
      conv += SUBSCRIPTS[c] || c;
    }
    return conv;
  });
  result = result.replace(/_([0-9])/g, (_, d) => SUBSCRIPTS[d] || d);

  // Dollar signs
  result = result.replace(/\$\$([^$]+)\$\$/g, '$1');
  result = result.replace(/\$([^$]+)\$/g, '$1');

  // Math formatting wrappers
  result = result.replace(/\\text\{([^{}]+)\}/g, '$1');
  result = result.replace(/\\mathbf\{([^{}]+)\}/g, '$1');
  result = result.replace(/\\mathit\{([^{}]+)\}/g, '$1');

  return result;
}
