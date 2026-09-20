import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Packer,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  convertInchesToTwip,
  ShadingType,
  AlignmentType,
  Math as DocxMath,
  MathRun,
  MathFraction,
  MathRadical,
  MathSum,
  MathSuperScript,
  MathSubScript,
  MathSubSuperScript,
  MathRoundBrackets,
  MathSquareBrackets,
} from "docx";

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
  s = s.replace(/(?:\\)+\[\s*([\s\S]*?)\s*(?:(?:\\)+(?:quad|qquad|,|;|!)\s*)*(?:\\)+\]/g, (_, math) => {
    const cleaned = math.trim().replace(/(?:\\)+(?:quad|qquad|,|;|!)\s*$/g, "").trim();
    return `\n\n$$\n${cleaned}\n$$\n\n`;
  });

  // 2. Normalize bracketed inline math: \( ... \) or \\( ... \\)
  s = s.replace(/(?:\\)+\(\s*([^\n]*?)\s*(?:(?:\\)+(?:quad|qquad|,|;|!)\s*)*(?:\\)+\)/g, (_, math) => {
    const cleaned = math.trim().replace(/(?:\\)+(?:quad|qquad|,|;|!)\s*$/g, "").trim();
    return `$${cleaned}$`;
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

  // Auto-wrap un-delimited fractions, Greek letters, accents ONLY outside existing $ blocks
  const parts = s.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+\$|`[^`]+`)/g);
  s = parts.map((part, idx) => {
    // Odd index is inside an existing math block or code block - DO NOT TOUCH
    if (idx % 2 === 1) return part;
    let p = part;

    // Normal distributions e.g. Z ~ N(0,1) or Z \sim N(0,1)
    p = p.replace(/\b([A-Z])\s*(?:\\sim|~)\s*N\(([^()]+)\)/g, '$$$1 \\sim N($2)$$');

    // Subscripted variables like t_\nu, t_n, U_i outside $
    p = p.replace(/\b([tTUuXxYyZz])_([0-9a-zA-Z]|\\[a-zA-Z]+)\b/g, '$$$1_$2$$');
    p = p.replace(/\b([tTUuXxYyZz])_\{([^{}]+)\}\b/g, '$$$1_{$2}$$');

    // Auto-wrap un-delimited fractions outside of existing $...$ blocks
    p = p.replace(/(?<!\$)\\frac\{([^{}]+)\}\{([^{}]+)\}(?!\$)/g, (m) => `$${m}$`);

    // Greek letters with optional subscripts/superscripts (e.g. \chi^2_\nu, \chi^2_{n_i}, \sigma_1^2, \theta)
    p = p.replace(
      /\\(theta|mu|sigma|alpha|beta|gamma|delta|epsilon|zeta|eta|iota|kappa|lambda|nu|xi|pi|rho|tau|upsilon|phi|chi|psi|omega|Theta|Sigma|Delta|Lambda|Phi|Psi|Omega)(?:\^\{[^{}]+\}|\^[0-9a-zA-Z]+)?(?:_\{[^{}]+\}|_[0-9a-zA-Z\\]+)?(?:\^\{[^{}]+\}|\^[0-9a-zA-Z]+)?\b/g,
      (m) => `$${m}$`
    );

    // LaTeX accents: \bar{X}, \hat{p}
    p = p.replace(/\\(bar|hat|tilde|vec)\{([^{}]+)\}/g, (m) => `$${m}$`);

    // Common statistical square variables: S^2, s^2
    p = p.replace(/\b([Ss])\^2\b/g, (m) => `$${m}$`);

    // Clean up unnecessary whitespace before punctuation
    p = p.replace(/\s+([,.;:?)\]])/g, '$1');
    return p;
  }).join('');

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

export interface DocxOptions {
  title?: string;
  fontFamily?: string;
  accentColor?: string; // hex without #
  equationFormat?: 'native' | 'latex' | 'unicode';
}

const STRUCTURAL_COMMANDS = new Set([
  "\\frac",
  "\\sqrt",
  "\\sum",
  "\\prod",
  "\\int",
  "\\left",
  "\\right",
]);

function cleanMathSymbols(text: string): string {
  let s = text;
  // Accents with braces
  s = s.replace(/\\hat\{([a-zA-Z0-9])\}/g, "$1̂");
  s = s.replace(/\\bar\{([a-zA-Z0-9])\}/g, "$1̄");
  s = s.replace(/\\vec\{([a-zA-Z0-9])\}/g, "$1⃗");
  s = s.replace(/\\tilde\{([a-zA-Z0-9])\}/g, "$1̃");
  s = s.replace(/\\dot\{([a-zA-Z0-9])\}/g, "$1̇");
  // Accents with space or bare variable
  s = s.replace(/\\bar\s+([a-zA-Z0-9])/g, "$1̄");
  s = s.replace(/\\hat\s+([a-zA-Z0-9])/g, "$1̂");

  // Replace Greek and math symbols excluding structural formulas
  for (const [cmd, sym] of Object.entries(UNICODE_MATH_REPLACEMENTS)) {
    if (!STRUCTURAL_COMMANDS.has(cmd)) {
      s = s.replaceAll(cmd, sym);
    }
  }

  s = s.replace(/\\text\{([^}]+)\}/g, "$1");
  s = s.replace(/\\mathbf\{([^}]+)\}/g, "$1");
  s = s.replace(/\\mathit\{([^}]+)\}/g, "$1");
  s = s.replace(/\\,/g, " ");
  s = s.replace(/\\;/g, " ");
  s = s.replace(/\\!/g, "");
  s = s.replace(/\\quad/g, "  ");
  s = s.replace(/\\qquad/g, "    ");
  return s;
}

/**
 * Parses LaTeX math strings recursively into native Word Docx Math objects
 * Supports fractions, radicals, summations, integrals, products, round/square brackets,
 * subscripts, superscripts, combined sub-superscripts, and Greek/statistical variables.
 */
function parseLatexComponents(latex: string): any[] {
  const cleaned = cleanMathSymbols(latex.trim());
  const components: any[] = [];
  let i = 0;

  function readGroup(startIdx: number): { content: string; nextIdx: number } {
    if (startIdx >= cleaned.length) return { content: "", nextIdx: startIdx };
    if (cleaned[startIdx] === "{") {
      let p = startIdx + 1;
      let depth = 1;
      const start = p;
      while (p < cleaned.length && depth > 0) {
        if (cleaned[p] === "{") depth++;
        else if (cleaned[p] === "}") depth--;
        p++;
      }
      return { content: cleaned.slice(start, p - 1), nextIdx: p };
    }
    return { content: cleaned[startIdx] || "", nextIdx: startIdx + 1 };
  }

  while (i < cleaned.length) {
    // Skip extra whitespace or push as spaced run if inside equation
    if (cleaned[i] === " " || cleaned[i] === "\t") {
      let ws = "";
      while (i < cleaned.length && (cleaned[i] === " " || cleaned[i] === "\t")) {
        ws += cleaned[i];
        i++;
      }
      components.push(new MathRun(ws));
      continue;
    }

    // Fraction: \frac{num}{den}
    if (cleaned.startsWith("\\frac", i)) {
      let p = i + 5;
      while (p < cleaned.length && /\s/.test(cleaned[p])) p++;
      const numRes = readGroup(p);
      p = numRes.nextIdx;
      while (p < cleaned.length && /\s/.test(cleaned[p])) p++;
      const denRes = readGroup(p);
      i = denRes.nextIdx;

      const numComp = parseLatexComponents(numRes.content);
      const denComp = parseLatexComponents(denRes.content);
      components.push(
        new MathFraction({
          numerator: numComp.length > 0 ? numComp : [new MathRun(numRes.content)],
          denominator: denComp.length > 0 ? denComp : [new MathRun(denRes.content)],
        })
      );
      continue;
    }

    // Radical: \sqrt{inner} or \sqrt[deg]{inner}
    if (cleaned.startsWith("\\sqrt", i)) {
      let p = i + 5;
      while (p < cleaned.length && /\s/.test(cleaned[p])) p++;
      if (cleaned[p] === "[") {
        const closeB = cleaned.indexOf("]", p);
        if (closeB !== -1) p = closeB + 1;
      }
      while (p < cleaned.length && /\s/.test(cleaned[p])) p++;
      const innerRes = readGroup(p);
      i = innerRes.nextIdx;
      const innerComp = parseLatexComponents(innerRes.content);
      components.push(
        new MathRadical({
          children: innerComp.length > 0 ? innerComp : [new MathRun(innerRes.content)],
        })
      );
      continue;
    }

    // Summation / Product / Integral: \sum or \prod or \int
    if (cleaned.startsWith("\\sum", i) || cleaned.startsWith("\\prod", i) || cleaned.startsWith("\\int", i)) {
      let p = i + (cleaned.startsWith("\\sum", i) ? 4 : (cleaned.startsWith("\\prod", i) ? 5 : 4));
      let subContent = "";
      let supContent = "";

      for (let k = 0; k < 2; k++) {
        while (p < cleaned.length && /\s/.test(cleaned[p])) p++;
        if (cleaned[p] === "_") {
          p++;
          while (p < cleaned.length && /\s/.test(cleaned[p])) p++;
          const subRes = readGroup(p);
          subContent = subRes.content;
          p = subRes.nextIdx;
        } else if (cleaned[p] === "^") {
          p++;
          while (p < cleaned.length && /\s/.test(cleaned[p])) p++;
          const supRes = readGroup(p);
          supContent = supRes.content;
          p = supRes.nextIdx;
        }
      }

      i = p;
      const subComp = subContent ? parseLatexComponents(subContent) : [];
      const supComp = supContent ? parseLatexComponents(supContent) : [];
      components.push(
        new MathSum({
          subScript: subComp.length > 0 ? subComp : (subContent ? [new MathRun(subContent)] : undefined),
          superScript: supComp.length > 0 ? supComp : (supContent ? [new MathRun(supContent)] : undefined),
          children: [],
        })
      );
      continue;
    }

    // Left/Right brackets: \left( ... \right) or ( ... )
    if (cleaned.startsWith("\\left(", i) || cleaned.startsWith("(", i)) {
      const isCmd = cleaned.startsWith("\\left(", i);
      let p = i + (isCmd ? 6 : 1);
      let depth = 1;
      const start = p;
      while (p < cleaned.length && depth > 0) {
        if (isCmd) {
          if (cleaned.startsWith("\\left(", p)) { depth++; p += 6; }
          else if (cleaned.startsWith("\\right)", p)) { depth--; p += 7; }
          else { p++; }
        } else {
          if (cleaned[p] === "(") { depth++; p++; }
          else if (cleaned[p] === ")") { depth--; p++; }
          else { p++; }
        }
      }
      const inner = cleaned.slice(start, p - (isCmd ? 7 : 1));
      const innerComp = parseLatexComponents(inner);
      const bracketObj = new MathRoundBrackets({
        children: innerComp.length > 0 ? innerComp : [new MathRun(inner)],
      });

      // Check for attached superscript/subscript e.g. (...) ^ 2
      let afterP = p;
      while (afterP < cleaned.length && /\s/.test(cleaned[afterP])) afterP++;
      if (afterP < cleaned.length && cleaned[afterP] === "^") {
        afterP++;
        while (afterP < cleaned.length && /\s/.test(cleaned[afterP])) afterP++;
        const supRes = readGroup(afterP);
        afterP = supRes.nextIdx;
        const supComp = parseLatexComponents(supRes.content);
        components.push(
          new MathSuperScript({
            children: [bracketObj],
            superScript: supComp.length > 0 ? supComp : [new MathRun(supRes.content)],
          })
        );
        i = afterP;
        continue;
      }

      components.push(bracketObj);
      i = p;
      continue;
    }

    // Left/Right square brackets: \left[ ... \right] or [ ... ]
    if (cleaned.startsWith("\\left[", i) || cleaned.startsWith("[", i)) {
      const isCmd = cleaned.startsWith("\\left[", i);
      let p = i + (isCmd ? 6 : 1);
      let depth = 1;
      const start = p;
      while (p < cleaned.length && depth > 0) {
        if (isCmd) {
          if (cleaned.startsWith("\\left[", p)) { depth++; p += 6; }
          else if (cleaned.startsWith("\\right]", p)) { depth--; p += 7; }
          else { p++; }
        } else {
          if (cleaned[p] === "[") { depth++; p++; }
          else if (cleaned[p] === "]") { depth--; p++; }
          else { p++; }
        }
      }
      const inner = cleaned.slice(start, p - (isCmd ? 7 : 1));
      const innerComp = parseLatexComponents(inner);
      const bracketObj = new MathSquareBrackets({
        children: innerComp.length > 0 ? innerComp : [new MathRun(inner)],
      });

      // Check for attached superscript
      let afterP = p;
      while (afterP < cleaned.length && /\s/.test(cleaned[afterP])) afterP++;
      if (afterP < cleaned.length && cleaned[afterP] === "^") {
        afterP++;
        while (afterP < cleaned.length && /\s/.test(cleaned[afterP])) afterP++;
        const supRes = readGroup(afterP);
        afterP = supRes.nextIdx;
        const supComp = parseLatexComponents(supRes.content);
        components.push(
          new MathSuperScript({
            children: [bracketObj],
            superScript: supComp.length > 0 ? supComp : [new MathRun(supRes.content)],
          })
        );
        i = afterP;
        continue;
      }

      components.push(bracketObj);
      i = p;
      continue;
    }

    // Subscript / Superscript on single base identifier (e.g. S^2, X_i, \chi^2_\nu, \sigma_1^2, p̂, X̄)
    const baseMatch = cleaned.slice(i).match(/^([a-zA-Z0-9α-ωΑ-Ω][\u0300-\u036f]?)/);
    if (baseMatch) {
      const baseStr = baseMatch[1];
      let p = i + baseStr.length;

      let subContent = "";
      let supContent = "";

      for (let k = 0; k < 2; k++) {
        if (p < cleaned.length && cleaned[p] === "_") {
          p++;
          const subRes = readGroup(p);
          subContent = subRes.content;
          p = subRes.nextIdx;
        } else if (p < cleaned.length && cleaned[p] === "^") {
          p++;
          const supRes = readGroup(p);
          supContent = supRes.content;
          p = supRes.nextIdx;
        }
      }

      if (subContent && supContent) {
        const subComp = parseLatexComponents(subContent);
        const supComp = parseLatexComponents(supContent);
        components.push(
          new MathSubSuperScript({
            children: [new MathRun(baseStr)],
            subScript: subComp.length > 0 ? subComp : [new MathRun(subContent)],
            superScript: supComp.length > 0 ? supComp : [new MathRun(supContent)],
          })
        );
        i = p;
        continue;
      } else if (subContent) {
        const subComp = parseLatexComponents(subContent);
        components.push(
          new MathSubScript({
            children: [new MathRun(baseStr)],
            subScript: subComp.length > 0 ? subComp : [new MathRun(subContent)],
          })
        );
        i = p;
        continue;
      } else if (supContent) {
        const supComp = parseLatexComponents(supContent);
        components.push(
          new MathSuperScript({
            children: [new MathRun(baseStr)],
            superScript: supComp.length > 0 ? supComp : [new MathRun(supContent)],
          })
        );
        i = p;
        continue;
      }
    }

    // Default: one character or symbol run
    components.push(new MathRun(cleaned[i]));
    i++;
  }

  return components;
}

/**
 * Converts a LaTeX formula into native Microsoft Word Office Math (<m:oMath>)
 */
export function parseLatexToDocxMath(latex: string): DocxMath {
  const components = parseLatexComponents(latex.trim());
  return new DocxMath({
    children: components.length > 0 ? components : [new MathRun(cleanMathSymbols(latex))]
  });
}

/**
 * Parses markdown inline formatting (bold, italic, code, and LaTeX math $...$ or \(...\))
 * into mixed TextRun and native DocxMath objects.
 */
export function parseInlineRunsAndMath(
  text: string,
  fontName = "Times New Roman",
  baseSizePt = 11,
  baseColor = "2D3748",
  equationFormat = "native",
  parentFormatting: { bold?: boolean; italics?: boolean } = {}
): (TextRun | DocxMath)[] {
  const elements: (TextRun | DocxMath)[] = [];

  // Match inline math ($...$ or \(...\)), bold (**...**), italic (*...*), or code (`...`)
  const regex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+\$|(?:\\)+\([^\n]+?(?:\\)+\)|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  const tokens = text.split(regex);

  for (const token of tokens) {
    if (!token) continue;

    // Inline Math: $...$ or \(...\)
    const isDollarMath = token.startsWith('$') && token.endsWith('$') && token.length >= 3 && !token.startsWith('$$');
    const parenMathMatch = token.match(/^(?:\\)+\(\s*([\s\S]*?)\s*(?:(?:\\)+(?:quad|qquad|,|;|!)\s*)*(?:\\)+\)$/);

    if (isDollarMath || parenMathMatch) {
      const mathExpr = isDollarMath ? token.slice(1, -1) : parenMathMatch![1].trim();

      if (equationFormat === "native") {
        try {
          elements.push(parseLatexToDocxMath(mathExpr));
        } catch {
          // Fallback to Cambria Math TextRun
          elements.push(
            new TextRun({
              text: cleanMathSymbols(mathExpr),
              font: "Cambria Math",
              size: baseSizePt * 2,
              color: "1A365D",
            })
          );
        }
      } else if (equationFormat === "latex") {
        elements.push(
          new TextRun({
            text: `$${mathExpr}$`,
            font: "Cambria Math",
            size: baseSizePt * 2,
            color: "1A365D",
          })
        );
      } else {
        // Unicode
        elements.push(
          new TextRun({
            text: sanitizeMathToUnicode(mathExpr),
            font: "Cambria Math",
            size: baseSizePt * 2,
            color: "1A365D",
          })
        );
      }
      continue;
    }

    // Bold: **...**
    if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
      const inner = token.slice(2, -2);
      if (inner.includes('$') || inner.includes('*') || inner.includes('`')) {
        const subElements = parseInlineRunsAndMath(
          inner,
          fontName,
          baseSizePt,
          baseColor,
          equationFormat,
          { ...parentFormatting, bold: true }
        );
        elements.push(...subElements);
      } else {
        elements.push(
          new TextRun({
            text: inner,
            bold: true,
            italics: parentFormatting.italics,
            font: fontName,
            size: baseSizePt * 2,
            color: baseColor,
          })
        );
      }
      continue;
    }

    // Italic: *...*
    if (token.startsWith('*') && token.endsWith('*') && token.length >= 2) {
      const inner = token.slice(1, -1);
      if (inner.includes('$') || inner.includes('**') || inner.includes('`')) {
        const subElements = parseInlineRunsAndMath(
          inner,
          fontName,
          baseSizePt,
          baseColor,
          equationFormat,
          { ...parentFormatting, italics: true }
        );
        elements.push(...subElements);
      } else {
        elements.push(
          new TextRun({
            text: inner,
            bold: parentFormatting.bold,
            italics: true,
            font: fontName,
            size: baseSizePt * 2,
            color: baseColor,
          })
        );
      }
      continue;
    }

    // Inline Code: `...`
    if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
      elements.push(
        new TextRun({
          text: token.slice(1, -1),
          font: "Consolas",
          size: (baseSizePt - 1) * 2,
          color: "C53030",
        })
      );
      continue;
    }

    // Plain text
    elements.push(
      new TextRun({
        text: token,
        bold: parentFormatting.bold,
        italics: parentFormatting.italics,
        font: fontName,
        size: baseSizePt * 2,
        color: baseColor,
      })
    );
  }

  return elements.length > 0
    ? elements
    : [new TextRun({ text, font: fontName, size: baseSizePt * 2, color: baseColor })];
}

/**
 * Builds a professionally formatted Word (.docx) document from Markdown notes
 */
export async function buildDocxFromMarkdown(
  markdownText: string,
  options: DocxOptions = {}
): Promise<Buffer> {
  const font = options.fontFamily || "Times New Roman";
  const primaryAccent = options.accentColor || "1A365D"; // Navy default
  const secondaryAccent = "2B6CB0"; // Steel blue
  const bodyColor = "2D3748";
  const equationFormat = options.equationFormat || "native";

  // Pre-clean NotebookLM tree artifacts & standardize pseudo-math
  const cleanedMarkdown = standardizeMathToLatex(cleanNotebookLMTreeArtifacts(markdownText));

  const lines = cleanedMarkdown.split('\n');
  const children: (Paragraph | Table)[] = [];

  let inCodeBlock = false;
  let codeLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trimEnd();

    // Code block handling
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        const codeContent = codeLines.join('\n');
        const codeTable = new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
            left: { style: BorderStyle.SINGLE, size: 14, color: primaryAccent },
            right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  shading: {
                    type: ShadingType.CLEAR,
                    fill: "F8FAFC",
                  },
                  margins: {
                    top: convertInchesToTwip(0.1),
                    bottom: convertInchesToTwip(0.1),
                    left: convertInchesToTwip(0.15),
                    right: convertInchesToTwip(0.15),
                  },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: codeContent,
                          font: "Consolas",
                          size: 19,
                          color: "1E293B",
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        });
        children.push(codeTable);
        children.push(new Paragraph({ spacing: { after: 120 } }));
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      continue;
    }

    const stripped = line.trim();
    if (!stripped) continue;

    // Display Equation Block: $$ ... $$ (single-line or multi-line) or \[ ... \] / \\[ ... \\]
    if (stripped.startsWith('$$')) {
      let mathExpr = '';
      if (stripped.endsWith('$$') && stripped.length >= 4) {
        mathExpr = stripped.slice(2, -2).trim();
      } else {
        // Multi-line $$ equation block
        const mathLines: string[] = [];
        const first = stripped.slice(2).trim();
        if (first) mathLines.push(first);
        i++;
        while (i < lines.length) {
          const nextTrimmed = lines[i].trim();
          if (nextTrimmed.endsWith('$$')) {
            const endPart = nextTrimmed.slice(0, -2).trim();
            if (endPart) mathLines.push(endPart);
            break;
          }
          mathLines.push(lines[i]);
          i++;
        }
        mathExpr = mathLines.join(' ').trim();
      }

      if (mathExpr) {
        // Strip trailing spacing commands if any
        mathExpr = mathExpr.replace(/(?:\\)+(?:quad|qquad|,|;|!)\s*$/g, "").trim();
        const mathObj = parseLatexToDocxMath(mathExpr);
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 80, after: 80, line: 240 },
            children: [mathObj],
          })
        );
      }
      continue;
    }

    // Bracketed display math: \[ ... \] or \\[ ... \\]
    if (/^(?:\\)+\[/.test(stripped)) {
      let mathExpr = '';
      if (/(?:\\)+\]$/.test(stripped)) {
        mathExpr = stripped.replace(/^(?:\\)+\[/, '').replace(/(?:\\)+\]$/, '').trim();
      } else {
        const mathLines: string[] = [];
        mathLines.push(stripped.replace(/^(?:\\)+\[/, '').trim());
        i++;
        while (i < lines.length) {
          const nextTrimmed = lines[i].trim();
          if (/(?:\\)+\]$/.test(nextTrimmed)) {
            const endPart = nextTrimmed.replace(/(?:\\)+\]$/, '').trim();
            if (endPart) mathLines.push(endPart);
            break;
          }
          mathLines.push(lines[i]);
          i++;
        }
        mathExpr = mathLines.join(' ').trim();
      }

      if (mathExpr) {
        mathExpr = mathExpr.replace(/(?:\\)+(?:quad|qquad|,|;|!)\s*$/g, "").trim();
        const mathObj = parseLatexToDocxMath(mathExpr);
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 80, after: 80, line: 240 },
            children: [mathObj],
          })
        );
      }
      continue;
    }

    // Markdown Table detection: | col1 | col2 | ... |
    if (stripped.startsWith('|') && stripped.endsWith('|') && stripped.length > 2) {
      const tableLines: string[] = [];
      while (i < lines.length) {
        const cur = lines[i].trim();
        if (cur.startsWith('|') && cur.endsWith('|')) {
          tableLines.push(cur);
          i++;
        } else {
          break;
        }
      }
      i--; // Step back for loop increment

      const dataRows = tableLines.filter((row) => !/^\|[-:\s|]+\|$/.test(row));
      if (dataRows.length > 0) {
        const parsedRows = dataRows.map((row) =>
          row
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim())
        );

        const docxRows: TableRow[] = parsedRows.map((cells, rowIdx) => {
          const isHeader = rowIdx === 0;
          return new TableRow({
            children: cells.map((cellText) => {
              const isNumeric =
                /^[\d.,\s/%+-]+$/.test(cellText) ||
                /^(?:Variable|Income|Expenditure|Speed|GPA|Hour|ID|Year|x\d*|y\d*|Height|Weight|Age)$/i.test(cellText);

              return new TableCell({
                shading: isHeader
                  ? {
                      type: ShadingType.CLEAR,
                      fill: "F1F5F9",
                    }
                  : undefined,
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
                  bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
                  left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
                  right: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
                },
                margins: {
                  top: convertInchesToTwip(0.06),
                  bottom: convertInchesToTwip(0.06),
                  left: convertInchesToTwip(0.08),
                  right: convertInchesToTwip(0.08),
                },
                children: [
                  new Paragraph({
                    alignment: isNumeric ? AlignmentType.CENTER : AlignmentType.LEFT,
                    spacing: { before: 20, after: 20, line: 240 },
                    children: parseInlineRunsAndMath(
                      cellText,
                      font,
                      isHeader ? 10.5 : 10,
                      isHeader ? "0F172A" : "1E293B",
                      equationFormat,
                      { bold: isHeader }
                    ),
                  }),
                ],
              });
            }),
          });
        });

        const docxTable = new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          alignment: AlignmentType.CENTER,
          borders: {
            top: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
            bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
            left: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
            right: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
            insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
          },
          rows: docxRows,
        });

        children.push(docxTable);
        children.push(new Paragraph({ spacing: { after: 120 } }));
        continue;
      }
    }

    // Horizontal divider (--- or ***)
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(stripped)) {
      children.push(
        new Paragraph({
          spacing: { before: 100, after: 100 },
          border: {
            bottom: {
              style: BorderStyle.SINGLE,
              size: 6,
              color: "CBD5E1",
            },
          },
        })
      );
      continue;
    }

    // 4-digit Year Header (e.g. 2019, 2025)
    if (/^\d{4}$/.test(stripped)) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 40 },
          children: [
            new TextRun({
              text: stripped,
              bold: true,
              font: font,
              size: 28,
              color: primaryAccent,
            }),
          ],
        })
      );
      continue;
    }

    // Exam Title (e.g. Final Examination, Midterm Examination)
    if (/^(?:\*{0,2})(?:Final|Midterm|Mid-Semester)\s+Examination(?:\*{0,2})$/i.test(stripped)) {
      const cleanExam = stripped.replace(/^\*+|\*+$/g, '').trim();
      children.push(
        new Paragraph({
          spacing: { before: 40, after: 120 },
          children: [
            new TextRun({
              text: cleanExam,
              bold: true,
              italics: true,
              font: font,
              size: 24,
              color: "334155",
            }),
          ],
        })
      );
      continue;
    }

    // Section Header (e.g. Section A: Descriptive Statistics... or **Section A:**)
    // Clean academic heading without black table boxing
    if (/^(?:#{1,3}\s*)?(?:\*{0,2})Section\s+([A-Z]):?\s*(.*?)(?:\*{0,2})$/i.test(stripped)) {
      const match = stripped.match(/^(?:#{1,3}\s*)?(?:\*{0,2})Section\s+([A-Z]):?\s*(.*?)(?:\*{0,2})$/i)!;
      const sectionLetter = match[1].toUpperCase();
      const sectionDesc = match[2].trim().replace(/^[:\s-]+/, '').replace(/^\*+|\*+$/g, '');
      const fullSectionTitle = `Section ${sectionLetter}:${sectionDesc ? " " + sectionDesc : ""}`;

      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 260, after: 80 },
          children: parseInlineRunsAndMath(fullSectionTitle, font, 13, primaryAccent, equationFormat, { bold: true }),
        })
      );
      continue;
    }

    // Topic Header (e.g. Topic 1: ... or #### Topic 1: ...)
    if (/^(?:#{2,4}\s*)?(?:\*{0,2})(Topic\s+\d+:?\s*.*?)(?:\*{0,2})$/i.test(stripped)) {
      const topicText = stripped.replace(/^#{2,4}\s*/, '').replace(/^\*+|\*+$/g, '').trim();
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_4,
          spacing: { before: 180, after: 60 },
          children: parseInlineRunsAndMath(topicText, font, 11.5, "1E293B", equationFormat, { bold: true }),
        })
      );
      continue;
    }

    // Pure Data Array: Centered comma-separated sequence of numbers
    if (/^(\s*\d+(?:\.\d+)?(?:,\s*|\s+)){3,}\d+(?:\.\d+)?(?:,\s*)?$/.test(stripped)) {
      const tokens = stripped.replace(/,/g, ' ').trim().split(/\s+/);
      const formattedData = tokens.join(', ') + (i + 1 < lines.length && /^(\s*\d+(?:\.\d+)?(?:,\s*|\s+)){3,}/.test(lines[i + 1].trim()) ? ',' : '');
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 40, after: 40, line: 260 },
          children: [
            new TextRun({
              text: formattedData,
              font: font,
              size: 21,
              color: "1E293B",
            }),
          ],
        })
      );
      continue;
    }

    // Sub-questions & Lettered list items: e.g. a. Arithmetic mean... or i. E(y)... or (i) Draw...
    const subMatch = stripped.match(/^\s*(?:[-*•o]\s+)?(?:\*{0,2})([a-z]\.|\([a-z]\)|[a-z]\)|\(i{1,3}\)|[i-v]+\.|\([0-9]+\))\s*(.*)$/i);
    if (subMatch) {
      const prefix = subMatch[1].replace(/^\(/, '').replace(/\)$/, '.');
      const subContent = subMatch[2].replace(/^\*+|\*+$/g, '').trim();

      children.push(
        new Paragraph({
          indent: { left: convertInchesToTwip(0.35), hanging: convertInchesToTwip(0.2) },
          spacing: { before: 24, after: 36, line: 260 },
          children: [
            new TextRun({
              text: prefix + " ",
              bold: true,
              font: font,
              size: 22,
              color: "0F172A",
            }),
            ...parseInlineRunsAndMath(subContent, font, 11, bodyColor, equationFormat),
          ],
        })
      );
      continue;
    }

    // Metadata and Side notes (Frequency: ..., Side note: ...)
    const metaMatch = stripped.match(/^(?:\s*[-*•o]\s+)?(?:\*{0,2})(\(?Side note:|\(?Note:|Frequency:)\s*(.*?)(?:\*{0,2})$/i);
    if (metaMatch) {
      const label = metaMatch[1];
      const noteContent = metaMatch[2].replace(/^\*+|\*+$/g, '').trim();
      const isSideNote = /side note|note/i.test(label);

      children.push(
        new Paragraph({
          indent: { left: convertInchesToTwip(0.35) },
          spacing: { before: 20, after: 40, line: 240 },
          children: [
            new TextRun({
              text: `${label} `,
              font: font,
              size: 19,
              color: "64748B",
              italics: isSideNote,
              bold: !isSideNote,
            }),
            ...parseInlineRunsAndMath(noteContent, font, 9.5, "64748B", equationFormat, { italics: isSideNote }),
          ],
        })
      );
      continue;
    }

    // Heading 1 (# ...)
    if (stripped.startsWith('# ')) {
      const headingText = stripped.slice(2).trim();
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 360, after: 140 },
          children: parseInlineRunsAndMath(headingText, font, 19, primaryAccent, equationFormat, { bold: true }),
        })
      );
    }
    // Heading 2 (## ...)
    else if (stripped.startsWith('## ')) {
      const headingText = stripped.slice(3).trim();
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 280, after: 100 },
          children: parseInlineRunsAndMath(headingText, font, 14, secondaryAccent, equationFormat, { bold: true }),
        })
      );
    }
    // Heading 3 (### ...)
    else if (stripped.startsWith('### ')) {
      const headingText = stripped.slice(4).trim();
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 220, after: 80 },
          children: parseInlineRunsAndMath(headingText, font, 12, "334155", equationFormat, { bold: true }),
        })
      );
    }
    // Heading 4 (#### ...)
    else if (stripped.startsWith('#### ')) {
      const headingText = stripped.slice(5).trim();
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_4,
          spacing: { before: 180, after: 60 },
          children: parseInlineRunsAndMath(headingText, font, 11.5, "334155", equationFormat, { bold: true }),
        })
      );
    }
    // Heading 5 (##### ...)
    else if (stripped.startsWith('##### ')) {
      const headingText = stripped.slice(6).trim();
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_5,
          spacing: { before: 140, after: 50 },
          children: parseInlineRunsAndMath(headingText, font, 11, "475569", equationFormat, { bold: true }),
        })
      );
    }
    // Heading 6 (###### ...)
    else if (stripped.startsWith('###### ')) {
      const headingText = stripped.slice(7).trim();
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_6,
          spacing: { before: 120, after: 40 },
          children: parseInlineRunsAndMath(headingText, font, 10.5, "64748B", equationFormat, { bold: true }),
        })
      );
    }
    // Bullet List (- or * or unicode bullet • ⁃ ◦ ▪ ▫ – — or open circle o)
    else if (/^\s*(?:[-*•⁃◦▪▫–—]|\bo\b)\s+/.test(rawLine) || /^\s*o\s{1,}/.test(rawLine)) {
      const indentSpaces = (rawLine.match(/^(\s*)/)?.[0].length) || 0;
      const bulletLevel = Math.min(3, Math.floor(indentSpaces / 2));
      const itemText = stripped.replace(/^(?:[-*•⁃◦▪▫–—]|o)\s+/, '').trim();

      children.push(
        new Paragraph({
          bullet: { level: bulletLevel },
          spacing: { before: 24, after: 36, line: 260 },
          children: parseInlineRunsAndMath(itemText, font, 11, bodyColor, equationFormat),
        })
      );
    }
    // Numbered List (1. 2. or 1) 2) etc.)
    else if (/^\s*\d+[\.\)]\s+/.test(stripped)) {
      const match = stripped.match(/^\s*(\d+[\.\)])\s*(.*)$/)!;
      const numPrefix = match[1];
      const itemText = match[2].trim();
      children.push(
        new Paragraph({
          indent: { left: convertInchesToTwip(0.25), hanging: convertInchesToTwip(0.25) },
          spacing: { before: 50, after: 40, line: 276 },
          children: [
            new TextRun({
              text: numPrefix + " ",
              bold: true,
              font: font,
              size: 22,
              color: primaryAccent,
            }),
            ...parseInlineRunsAndMath(itemText, font, 11, bodyColor, equationFormat),
          ],
        })
      );
    }
    // Blockquote or Callout (> ...) - formatted as native paragraph with left border (NO Table)
    else if (stripped.startsWith('> ')) {
      const quoteText = stripped.slice(2).trim();
      children.push(
        new Paragraph({
          indent: { left: convertInchesToTwip(0.2) },
          border: {
            left: {
              color: primaryAccent,
              space: 10,
              style: BorderStyle.SINGLE,
              size: 18,
            },
          },
          spacing: { before: 40, after: 60, line: 276 },
          children: parseInlineRunsAndMath(quoteText, font, 10.5, "1E293B", equationFormat),
        })
      );
    }
    // Standard Paragraph
    else {
      children.push(
        new Paragraph({
          spacing: { before: 30, after: 110, line: 288 },
          children: parseInlineRunsAndMath(stripped, font, 11, bodyColor, equationFormat),
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1.0),
              bottom: convertInchesToTwip(1.0),
              left: convertInchesToTwip(1.0),
              right: convertInchesToTwip(1.0),
            },
          },
        },
        children: children.length > 0 ? children : [new Paragraph({ text: "Empty document." })],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
