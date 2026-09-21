import { Skill } from "../types";

/**
 * Skill 1: Math → Native Word Equation
 * Based on https://github.com/Future-3526038670/docx-math-skill
 * 
 * Priority 1: Mathematical/Equation processing.
 * Transforms mathematical expressions into native Word Office Math (OMML),
 * ensuring equations are fully editable Word objects, never static images.
 */
export const mathDocxSkill: Skill = {
  id: "math-docx",
  name: "Math → Native Word Equation",
  shortName: "Word OMML Math",
  version: "1.2.0",
  author: "Future-3526038670",
  repositoryUrl: "https://github.com/Future-3526038670/docx-math-skill",
  description:
    "Converts LaTeX equations and mathematical expressions into native Microsoft Word Office Math (OMML) objects using docx-js. All equations remain fully editable in Word without raster images or degraded approximations.",
  priority: 1, // 1: Mathematical/Equation processing
  category: "mathematics",
  enabled: true,
  isBuiltIn: true,
  features: [
    "Native OMML Word equation generation (never images)",
    "Stacked vertical fractions (MathFraction) and nth radicals (MathRadical)",
    "Summations (MathSum), integrals, products, and limits with bounds",
    "Nested subscript and superscript combinations (MathSubSuperScript)",
    "Matrix and array parsing (matrix, pmatrix, bmatrix)",
    "Standardized statistical operators (Var, Cov, rank, mode, M.D.)",
    "Preserves Greek symbols and mathematical constants",
  ],
  rules: [
    {
      id: "omml-native",
      name: "Native OMML Conversion",
      description: "Convert all LaTeX formulas ($...$ and $$...$$) into native Word Office Math structures (<m:oMath>).",
      exampleInput: "$\\frac{1}{\\sqrt{2\\pi\\sigma^2}}$",
      exampleOutput: "Native editable Word fraction with radical denominator in OMML",
    },
    {
      id: "operator-standardization",
      name: "Standard Operator Typesetting",
      description: "Standardize informal functions like Var(X) and Cov(X,Y) into \\operatorname{Var}(X) and \\operatorname{Cov}(X,Y).",
      exampleInput: "Var(X) = E[X^2] - (E[X])^2",
      exampleOutput: "$\\operatorname{Var}(X) = E[X^2] - (E[X])^2$",
    },
    {
      id: "matrix-support",
      name: "Matrix & Vector Environments",
      description: "Format LaTeX matrix environments into structured bracketed mathematical rows.",
      exampleInput: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}",
      exampleOutput: "Structured matrix with native Word brackets",
    },
    {
      id: "statistical-notation",
      name: "Standard Statistics Notation",
      description: "Ensure sample mean \\bar{X}, sample proportion \\hat{p}, sample variance S^2, and population variance \\sigma^2 are correctly marked.",
      exampleInput: "p^ = x / n; s^2 = sum(x - x_bar)^2 / (n - 1)",
      exampleOutput: "$\\hat{p} = \\frac{x}{n}$; $S^2 = \\frac{\\sum (X_i - \\bar{X})^2}{n - 1}$",
    },
  ],
  systemPromptInstruction: `[SKILL: Math -> Native Word Equation (docx-math-skill)]
- All mathematical expressions MUST be expressed in standard LaTeX notation: inline as \\(...\\) or $...$, display as \\[...\\] or $$...$$.
- Never output equations as images, raw ASCII approximations (like 'sqrt(...)'), or pseudo-code.
- Use \\frac{numerator}{denominator} for all vertical stacked fractions.
- Use \\sqrt{...} or \\sqrt[n]{...} for radicals.
- Use \\sum_{i=1}^n, \\prod_{i=1}^n, \\int_{a}^b, \\lim_{x \\to \\infty} for operators with limits.
- Use \\operatorname{Var}, \\operatorname{Cov}, \\operatorname{rank}, \\operatorname{mode}, \\operatorname{M.D.} for operators.
- Use \\bar{X} for sample mean, \\hat{p} for sample proportion, S^2 for sample variance, \\sigma^2 for population variance, \\mu for population mean.
- Support LaTeX matrices using \\begin{pmatrix} ... \\end{pmatrix} or \\begin{bmatrix} ... \\end{bmatrix}.`,

  transformText: (text: string): string => {
    if (!text) return "";
    let s = text;

    // Normalize hat notation: p̂ -> \hat{p}, ŷ -> \hat{y}
    s = s.replace(/p̂/g, "\\hat{p}");
    s = s.replace(/X̄/g, "\\bar{X}");
    s = s.replace(/x̄/g, "\\bar{x}");
    s = s.replace(/ŷ/g, "\\hat{y}");

    // Convert informal statistical operators: Var(...) -> \operatorname{Var}(...)
    s = s.replace(/\bVar\(([^()]+)\)/g, "\\operatorname{Var}($1)");
    s = s.replace(/\bCov\(([^()]+)\)/g, "\\operatorname{Cov}($1)");
    s = s.replace(/\brank\(([^()]+)\)/g, "\\operatorname{rank}($1)");
    s = s.replace(/\bmode\(([^()]+)\)/g, "\\operatorname{mode}($1)");

    // Convert informal fractions: \sigma / \sqrt{n} -> \frac{\sigma}{\sqrt{n}}
    s = s.replace(/\\sigma\s*\/\s*\\sqrt\{n\}/g, "\\frac{\\sigma}{\\sqrt{n}}");
    s = s.replace(/\\sigma\s*\/\s*√n/g, "\\frac{\\sigma}{\\sqrt{n}}");

    // Standardize variance of sample mean
    s = s.replace(/\\sigma_\{?\\bar\{?[xX]\}?\}?\^2/g, "\\sigma_{\\bar{X}}^2");
    s = s.replace(/\\mu_\{?\\bar\{?[xX]\}?\}?/g, "\\mu_{\\bar{X}}");
    s = s.replace(/\\sigma_\{?\\bar\{?[xX]\}?\}?/g, "\\sigma_{\\bar{X}}");

    return s;
  },
};
