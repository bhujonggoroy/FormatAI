import { Skill } from "../types";

/**
 * Skill 5: Statistical & Probability Typesetting
 * Based on https://github.com/Future-3526038670/stat-notation-docx
 * 
 * Priority 1: Mathematical/Equation processing.
 * Enforces rigorous statistical typesetting standards for sample statistics,
 * population parameters, hypothesis testing, estimators, distributions, and probability operators.
 */
export const statNotationSkill: Skill = {
  id: "stat-notation-docx",
  name: "Statistical & Probability Typesetting",
  shortName: "Statistical Notation",
  version: "1.2.0",
  author: "Future-3526038670",
  repositoryUrl: "https://github.com/Future-3526038670/stat-notation-docx",
  license: "MIT License",
  role: "Enforces strict mathematical statistics notation including sample vs population distinction, statistical operators, distribution symbols, and estimators.",
  description:
    "Standardizes academic statistical and probability notation: separates sample estimators (X̄, p̂, S²) from population parameters (μ, π, σ²), typesets operators (Var, Cov, rank), formats distributions (X ~ N(μ, σ²)), and aligns hypothesis tests.",
  priority: 1, // 1: Mathematical/Equation processing
  category: "mathematics",
  enabled: true,
  isBuiltIn: true,
  features: [
    "Sample vs population notation distinction (X̄ vs μ, p̂ vs π, S² vs σ²)",
    "Standardized operators (\\operatorname{Var}, \\operatorname{Cov}, \\operatorname{Corr}, \\operatorname{rank}, \\operatorname{mode})",
    "Probability distribution notation ($X \\sim \\mathcal{N}(\\mu, \\sigma^2)$, $t_\\nu$, $\\chi^2_k$, $F_{d_1, d_2}$)",
    "Convergence in distribution (\\overset{d}{\\longrightarrow}) and in probability (\\overset{p}{\\longrightarrow})",
    "Hypothesis testing blocks (H₀ vs H₁ / H_a with equality constraints)",
    "Confidence intervals and critical value notation ($z_{\\alpha/2}$, $t_{\\alpha/2, n-1}$)",
  ],
  rules: [
    {
      id: "stat-sample-estimators",
      name: "Sample Estimators vs Population Parameters",
      description: "Replace informal p with \\hat{p}, X with \\bar{X}, and s^2 with S^2 when describing sample statistics; preserve \\mu, \\pi, \\sigma^2 for populations.",
      exampleInput: "p = x/n; s^2 = 1/(n-1) sum(x - x_bar)^2",
      exampleOutput: "$\\hat{p} = \\frac{x}{n}$; $S^2 = \\frac{1}{n-1}\\sum_{i=1}^n (X_i - \\bar{X})^2$",
    },
    {
      id: "stat-operators",
      name: "Statistical Operator Functions",
      description: "Format statistical operators using \\operatorname{} so they render in upright Roman font with proper mathematical spacing.",
      exampleInput: "Var(X), Cov(X,Y), Corr(X,Y), rank(A)",
      exampleOutput: "\\operatorname{Var}(X), \\operatorname{Cov}(X,Y), \\operatorname{Corr}(X,Y), \\operatorname{rank}(A)",
    },
    {
      id: "stat-distributions",
      name: "Standard Distribution Symbolism",
      description: "Use \\sim for 'distributed as', \\mathcal{N} for normal distribution, and properly subscript degrees of freedom.",
      exampleInput: "X ~ N(mu, sigma^2), Y ~ t(n-1), Z ~ chisq(k)",
      exampleOutput: "$X \\sim \\mathcal{N}(\\mu, \\sigma^2)$, $Y \\sim t_{n-1}$, $Z \\sim \\chi^2_k$",
    },
    {
      id: "stat-hypotheses",
      name: "Hypothesis Testing Formatting",
      description: "Format null and alternative hypotheses as aligned blocks: $H_0: \\theta = \\theta_0$ vs $H_1: \\theta \\neq \\theta_0$.",
      exampleInput: "H0: mu = 50 vs H1: mu > 50",
      exampleOutput: "$H_0: \\mu = 50$ vs $H_1: \\mu > 50$",
    },
  ],
  systemPromptInstruction: `[SKILL: Statistical & Probability Typesetting (stat-notation-docx)]
- Use \\hat{p} for sample proportion, \\bar{X} for sample mean, S^2 for sample variance, S for sample standard deviation.
- Use \\pi for population proportion, \\mu for population mean, \\sigma^2 for population variance, \\sigma for population standard deviation.
- Use \\operatorname{Var}(X), \\operatorname{Cov}(X, Y), \\operatorname{Corr}(X, Y), \\operatorname{rank}(A), \\operatorname{mode}(X), \\operatorname{M.D.}(X).
- Use \\sim for 'distributed as' (e.g., $X \\sim \\mathcal{N}(\\mu, \\sigma^2)$).
- Use \\overset{d}{\\longrightarrow} for convergence in distribution, \\overset{p}{\\longrightarrow} for convergence in probability.
- Format hypotheses as $H_0: \\mu = \\mu_0$ and $H_1: \\mu \\neq \\mu_0$ (or $H_a$).`,

  transformText: (text: string): string => {
    if (!text) return "";
    let s = text;

    // Convert informal statistical operators
    s = s.replace(/\bVar\s*\(([^()]+)\)/g, "\\operatorname{Var}($1)");
    s = s.replace(/\bCov\s*\(([^()]+)\)/g, "\\operatorname{Cov}($1)");
    s = s.replace(/\bCorr\s*\(([^()]+)\)/g, "\\operatorname{Corr}($1)");
    s = s.replace(/\brank\s*\(([^()]+)\)/g, "\\operatorname{rank}($1)");
    s = s.replace(/\bmode\s*\(([^()]+)\)/g, "\\operatorname{mode}($1)");
    s = s.replace(/\bM\.D\.\s*\(([^()]+)\)/g, "\\operatorname{M.D.}($1)");

    // Normalize unicode statistical characters
    s = s.replace(/p̂/g, "\\hat{p}");
    s = s.replace(/X̄/g, "\\bar{X}");
    s = s.replace(/x̄/g, "\\bar{x}");
    s = s.replace(/Ȳ/g, "\\bar{Y}");
    s = s.replace(/ȳ/g, "\\bar{y}");
    s = s.replace(/μ̂/g, "\\hat{\\mu}");
    s = s.replace(/σ̂/g, "\\hat{\\sigma}");

    // Standardize normal distribution notation: N(mu, sigma^2) -> \mathcal{N}(\mu, \sigma^2)
    s = s.replace(/~ ?N\(([^()]+)\)/g, "\\sim \\mathcal{N}($1)");
    s = s.replace(/~ ?chisq\((\w+)\)/gi, "\\sim \\chi^2_{$1}");

    // Standardize hypothesis testing notation: H0: -> H_0:, H1: -> H_1:, Ha: -> H_a:
    s = s.replace(/\bH0\s*:/g, "H_0:");
    s = s.replace(/\bH1\s*:/g, "H_1:");
    s = s.replace(/\bHa\s*:/g, "H_a:");

    return s;
  },
};
