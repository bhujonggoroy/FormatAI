import { spawn } from "child_process";
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
 * and turns them into clean Markdown outline hierarchy.
 */
export function cleanNotebookLMTreeArtifacts(text: string): string {
  if (!text) return text;
  const lines = text.split('\n');
  const result: string[] = [];

  for (let line of lines) {
    let trimmed = line.trim();
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

    // Strip single leading pipe from start of line
    if (/^[|│]\s+/.test(trimmed)) {
      trimmed = trimmed.replace(/^[|│]\s+/, '');
    }

    result.push(trimmed);
  }

  return result.join('\n');
}

/**
 * Standardizes pseudo-math strings (like √[p(1-p)/n] or 1/√n or p̂) into standard LaTeX
 */
export function standardizeMathToLatex(text: string): string {
  if (!text) return text;
  let s = text;

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

  // Auto-wrap un-delimited fractions outside of existing $...$ blocks
  s = s.replace(/(?<!\$)\\frac\{([^{}]+)\}\{([^{}]+)\}(?!\$)/g, (m) => `$${m}$`);

  // Auto-wrap un-delimited Greek letters, accents, sub/superscripted variables outside existing $ blocks
  const parts = s.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+\$|`[^`]+`)/g);
  s = parts.map((part, idx) => {
    if (idx % 2 === 1) return part;
    let p = part;
    
    // Normal distributions e.g. Z ~ N(0,1) or Z \sim N(0,1)
    p = p.replace(/\b([A-Z])\s*(?:\\sim|~)\s*N\(([^()]+)\)/g, '$$$1 \\sim N($2)$$');

    // Subscripted variables like t_\nu, t_n, U_i outside $
    p = p.replace(/\b([tTUuXxYyZz])_([0-9a-zA-Z]|\\[a-zA-Z]+)\b/g, '$$$1_$2$$');
    p = p.replace(/\b([tTUuXxYyZz])_\{([^{}]+)\}\b/g, '$$$1_{$2}$$');

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

function cleanMathSymbols(text: string): string {
  let s = text;
  for (const [cmd, sym] of Object.entries(UNICODE_MATH_REPLACEMENTS)) {
    s = s.replaceAll(cmd, sym);
  }
  s = s.replace(/\\hat\{([a-zA-Z0-9])\}/g, "$1̂");
  s = s.replace(/\\bar\{([a-zA-Z0-9])\}/g, "$1̄");
  s = s.replace(/\\vec\{([a-zA-Z0-9])\}/g, "$1⃗");
  s = s.replace(/\\tilde\{([a-zA-Z0-9])\}/g, "$1̃");
  s = s.replace(/\\text\{([^}]+)\}/g, "$1");
  s = s.replace(/\\mathbf\{([^}]+)\}/g, "$1");
  s = s.replace(/\\mathit\{([^}]+)\}/g, "$1");
  s = s.replace(/\\,/g, " ");
  s = s.replace(/\\;/g, " ");
  s = s.replace(/\\quad/g, "   ");
  return s;
}

/**
 * Parses LaTeX math strings recursively into Docx Math objects (Fractions, Radicals, Runs)
 */
function parseLatexComponents(latex: string): any[] {
  const components: any[] = [];
  let i = 0;

  while (i < latex.length) {
    // Fraction: \frac{num}{den}
    if (latex.startsWith("\\frac{", i)) {
      let p = i + 6;
      let depth = 1;
      const numStart = p;
      while (p < latex.length && depth > 0) {
        if (latex[p] === "{") depth++;
        else if (latex[p] === "}") depth--;
        p++;
      }
      const num = latex.slice(numStart, p - 1);

      if (latex[p] === "{") {
        p++;
        depth = 1;
        const denStart = p;
        while (p < latex.length && depth > 0) {
          if (latex[p] === "{") depth++;
          else if (latex[p] === "}") depth--;
          p++;
        }
        const den = latex.slice(denStart, p - 1);

        const numComp = parseLatexComponents(num);
        const denComp = parseLatexComponents(den);

        components.push(
          new MathFraction({
            numerator: numComp.length > 0 ? numComp : [new MathRun(cleanMathSymbols(num))],
            denominator: denComp.length > 0 ? denComp : [new MathRun(cleanMathSymbols(den))],
          })
        );
        i = p;
        continue;
      }
    }

    // Radical: \sqrt{inner} or \sqrt[deg]{inner}
    if (latex.startsWith("\\sqrt", i)) {
      let p = i + 5;
      let degree = "";
      if (latex[p] === "[") {
        const closeB = latex.indexOf("]", p);
        if (closeB !== -1) {
          degree = latex.slice(p + 1, closeB);
          p = closeB + 1;
        }
      }
      if (latex[p] === "{") {
        p++;
        let depth = 1;
        const innerStart = p;
        while (p < latex.length && depth > 0) {
          if (latex[p] === "{") depth++;
          else if (latex[p] === "}") depth--;
          p++;
        }
        const inner = latex.slice(innerStart, p - 1);
        const innerComp = parseLatexComponents(inner);

        components.push(
          new MathRadical({
            children: innerComp.length > 0 ? innerComp : [new MathRun(cleanMathSymbols(inner))],
          })
        );
        i = p;
        continue;
      }
    }

    // Standard run text up to next special command
    const nextCmd = latex.slice(i + 1).search(/\\(frac|sqrt)/);
    const sliceEnd = nextCmd === -1 ? latex.length : i + 1 + nextCmd;
    const textPart = latex.slice(i, sliceEnd);
    if (textPart) {
      components.push(new MathRun(cleanMathSymbols(textPart)));
    }
    i = sliceEnd;
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
 * Parses markdown inline formatting (bold, italic, code, and LaTeX math $...$)
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

  // Match either inline math ($...$) or markdown tokens (**...**, *...*, `...`)
  const regex = /(\$[^$]+\$|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  const tokens = text.split(regex);

  for (const token of tokens) {
    if (!token) continue;

    // Inline Math: $...$
    if (token.startsWith('$') && token.endsWith('$') && token.length >= 3) {
      const mathExpr = token.slice(1, -1);

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

  // If native equation format is requested, attempt high-fidelity OMML generation via Python service
  if (equationFormat === "native") {
    try {
      const pythonDocx = await new Promise<Buffer>((resolve, reject) => {
        const proc = spawn("python3", ["generate_docx_cli.py"], {
          stdio: ["pipe", "pipe", "pipe"],
        });
        const chunks: Buffer[] = [];
        const errChunks: Buffer[] = [];

        proc.stdout.on("data", (chunk) => chunks.push(chunk));
        proc.stderr.on("data", (chunk) => errChunks.push(chunk));

        proc.on("close", (code) => {
          if (code === 0 && chunks.length > 0) {
            resolve(Buffer.concat(chunks));
          } else {
            const errStr = Buffer.concat(errChunks).toString("utf-8");
            reject(new Error(errStr || `Python CLI exited with code ${code}`));
          }
        });

        proc.on("error", (err) => reject(err));

        const payload = JSON.stringify({
          markdown: markdownText,
          title: options.title || "NotebookLM Notes",
          font: font,
          accent: `#${primaryAccent.replace("#", "")}`,
        });

        proc.stdin.write(payload);
        proc.stdin.end();
      });

      if (pythonDocx && pythonDocx.length > 0) {
        return pythonDocx;
      }
    } catch (pythonErr: any) {
      console.warn("Python OMML engine fallback to TS docx:", pythonErr.message);
    }
  }

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

    // Display Equation Block: $$ ... $$ (single-line or multi-line) or \[ ... \]
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
        const mathObj = parseLatexToDocxMath(mathExpr);
        // Format with native Word Equation tool (Paragraph with m:oMath)
        // NO Table tool: saves significant vertical space, simplifies editing, and prevents extra page printing costs
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

    if (stripped.startsWith('\\[') && stripped.endsWith('\\]') && stripped.length >= 4) {
      const mathExpr = stripped.slice(2, -2).trim();
      if (mathExpr) {
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
    // Nested Bullet List (indented with spaces)
    else if (/^\s*[-*]\s+/.test(rawLine)) {
      const indentSpaces = rawLine.match(/^(\s*)/)![0].length;
      const bulletLevel = Math.min(3, Math.floor(indentSpaces / 2));
      const itemText = stripped.replace(/^[-*]\s+/, '').trim();

      children.push(
        new Paragraph({
          bullet: { level: bulletLevel },
          spacing: { before: 30, after: 50, line: 276 },
          children: parseInlineRunsAndMath(itemText, font, 11, bodyColor, equationFormat),
        })
      );
    }
    // Numbered List (1. 2. etc.)
    else if (/^\d+\.\s+/.test(stripped)) {
      const match = stripped.match(/^\d+\.\s+/)!;
      const itemText = stripped.slice(match[0].length).trim();
      children.push(
        new Paragraph({
          spacing: { before: 30, after: 50, line: 276 },
          children: [
            new TextRun({
              text: match[0],
              bold: true,
              font: font,
              size: 22,
              color: secondaryAccent,
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
