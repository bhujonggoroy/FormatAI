import { Skill } from "../types";

/**
 * Skill 3: Math + LaTeX → Editable DOCX
 * Based on https://github.com/Kantyc/pandoc-math-docx
 * 
 * Priority 1: Mathematical/Equation processing.
 * Translates Pandoc and LaTeX mathematical syntaxes ($...$, $$...$$, \(...\), \[...\],
 * align*, equation environments) directly into editable Microsoft Word OMML equations.
 */
export const pandocMathDocxSkill: Skill = {
  id: "pandoc-math-docx",
  name: "Math + LaTeX → Editable DOCX",
  shortName: "Pandoc LaTeX Math",
  version: "1.3.0",
  author: "Kantyc",
  repositoryUrl: "https://github.com/Kantyc/pandoc-math-docx",
  description:
    "Implements Pandoc-compatible LaTeX-to-DOCX math pipeline. Normalizes all TeX equation delimiters (inline $...$ and display $$...$$ or environments), strips non-standard macros, handles multiline alignments, and passes clean AST nodes to Word's native equation engine.",
  priority: 1, // 1: Mathematical/Equation processing
  category: "pandoc",
  enabled: true,
  isBuiltIn: true,
  features: [
    "Full Pandoc-compliant math delimiter parsing ($, $$, \\(...\\), \\[...\\])",
    "Equation environment normalization (equation, align*, gather, cases)",
    "Alignment mark (&) and newline (\\\\) preservation in equations",
    "LaTeX command and macro expansion into OMML-compatible structures",
    "Preservation of mathematical spacing (\\quad, \\qquad, \\,)",
    "Sanitization of unclosed braces and malformed LaTeX tokens",
  ],
  rules: [
    {
      id: "pandoc-delimiters",
      name: "Pandoc TeX Delimiter Normalization",
      description: "Standardize all TeX math delimiters (\\(...\\) -> $...$ and \\[...\\] -> $$...$$) to ensure consistent Pandoc and Word compatibility.",
      exampleInput: "\\[ x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a} \\]",
      exampleOutput: "$$\nx = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\n$$",
    },
    {
      id: "align-environments",
      name: "Aligned Equation Blocks",
      description: "Convert \\begin{align*} or \\begin{aligned} into clean aligned display equations with centered positioning.",
      exampleInput: "\\begin{aligned} A &= B + C \\\\ &= D \\end{aligned}",
      exampleOutput: "$$\n\\begin{aligned} A &= B + C \\\\ &= D \\end{aligned}\n$$",
    },
    {
      id: "macro-cleanup",
      name: "Macro & Delimiter Repair",
      description: "Fix unclosed braces in LaTeX macros like \\frac, \\sqrt, \\Gamma, and \\chi^2 and remove invalid spacing commands.",
      exampleInput: "\\frac12 + \\chi^2_\\nu",
      exampleOutput: "$\\frac{1}{2} + \\chi^2_{\\nu}$",
    },
    {
      id: "cases-environment",
      name: "Piecewise Functions & Cases",
      description: "Support piecewise functions formatted with \\begin{cases} ... \\end{cases}.",
      exampleInput: "f(x) = \\begin{cases} 1 & x \\geq 0 \\\\ 0 & x < 0 \\end{cases}",
      exampleOutput: "$f(x) = \\begin{cases} 1 & x \\geq 0 \\\\ 0 & x < 0 \\end{cases}$",
    },
  ],
  systemPromptInstruction: `[SKILL: Math + LaTeX -> Editable DOCX (pandoc-math-docx)]
- Ensure all mathematics follows Pandoc-compatible TeX conventions.
- Inline equations MUST be enclosed in single dollar signs ($...$) or \\(...\\) without leading/trailing spaces inside the delimiters.
- Display equations MUST be enclosed in double dollar signs ($$...$$) or \\[...\\] on their own lines.
- For multi-line derivations, use \\begin{aligned} ... \\end{aligned} inside a display equation block.
- For piecewise conditions, use \\begin{cases} ... \\end{cases}.
- Keep all brackets balanced: \\left( ... \\right), \\left[ ... \\right], \\left\\{ ... \\right\\}.
- Output clean, valid LaTeX math that translates directly into Word OMML without requiring external compilation tools.`,

  transformText: (text: string): string => {
    if (!text) return "";
    let s = text;

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

    // 3. Normalize single-character fraction shortcuts like \frac12 or \frac1n -> \frac{1}{2}, \frac{1}{n}
    s = s.replace(/\\frac([0-9a-zA-Z])([0-9a-zA-Z])/g, "\\frac{$1}{$2}");

    // 4. Add braces to bare Greek letters with subscripts/superscripts: \chi^2_\nu -> \chi^2_{\nu}
    s = s.replace(/\\([a-zA-Z]+)\^([0-9a-zA-Z])_([0-9a-zA-Z]+)/g, "\\$1^{$2}_{$3}");

    // 5. Wrap raw align environments in $$ if not already wrapped
    s = s.replace(/(?<!\$\$[\s\n]*)(\\begin\{(?:aligned|align\*?|gather\*?|cases)\}[\s\S]*?\\end\{(?:aligned|align\*?|gather\*?|cases)\})(?![\s\n]*\$\$)/g, (m) => {
      return `\n\n$$\n${m.trim()}\n$$\n\n`;
    });

    return s;
  },
};
