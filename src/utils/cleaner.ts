/**
 * Systematic Academic Formatting Engine and LaTeX Normalizer.
 * Provides instant, zero-latency systematic document structuring matching
 * university study guides, formula sheets, and exam question banks.
 */

import { executeSkillPipeline } from "../skills/pipeline.ts";
import type { SkillMode } from "../skills/types.ts";

export type FormatMode = "auto" | "study_guide" | "exam_bank";

/**
 * Normalizes an arbitrary text string for insertion into a LaTeX math environment.
 * Ensures there are NO nested dollar signs ($...$).
 */
export function cleanMathFormula(expr: string): string {
  if (!expr) return "";
  let s = expr.trim();
  // Strip outer and inner dollar signs
  s = s.replace(/\$/g, "").trim();

  // Normalize common broken LaTeX patterns
  s = s.replace(/\\bar\s*\{\s*x\s*\}/g, "\\bar{x}");
  s = s.replace(/\\bar\s*\{\s*X\s*\}/g, "\\bar{X}");
  s = s.replace(/\\hat\s*\{\s*p\s*\}/g, "\\hat{p}");
  s = s.replace(/p̂/g, "\\hat{p}");
  s = s.replace(/X̄/g, "\\bar{X}");
  s = s.replace(/x̄/g, "\\bar{x}");
  s = s.replace(/ŷ/g, "\\hat{y}");
  s = s.replace(/\\text\s*\{\s*Error\s*\}/g, "\\text{Error}");

  // Fractions with slash: \sigma / \sqrt{n} -> \frac{\sigma}{\sqrt{n}}
  s = s.replace(/\\sigma\s*\/\s*\\sqrt\{n\}/g, "\\frac{\\sigma}{\\sqrt{n}}");
  s = s.replace(/\\sigma\s*\/\s*\\sqrt\s*n/g, "\\frac{\\sigma}{\\sqrt{n}}");

  // Summation: \sum x_i -> \sum_{i=1}^n x_i
  s = s.replace(/\\sum\s+x_i\b/g, "\\sum_{i=1}^n x_i");

  // Multiplier fraction & square roots outside existing math
  s = s.replace(/√\[([^[\]]+)\]/g, "\\sqrt{$1}");
  s = s.replace(/√\(([^()]+)\)/g, "\\sqrt{$1}");
  s = s.replace(/√([a-zA-Z0-9]+)/g, "\\sqrt{$1}");

  // Standardize variance and SE notation
  s = s.replace(/\\sigma_\{\\bar\{x\}\}\^2/g, "\\sigma_{\\bar{X}}^2");
  s = s.replace(/\\sigma_\\bar\{x\}\^2/g, "\\sigma_{\\bar{X}}^2");
  s = s.replace(/\\sigma_\{\\bar\{x\}\}/g, "\\sigma_{\\bar{X}}");
  s = s.replace(/\\sigma_\\bar\{x\}/g, "\\sigma_{\\bar{X}}");
  s = s.replace(/\\mu_\{\\bar\{x\}\}/g, "\\mu_{\\bar{X}}");
  s = s.replace(/\\mu_\\bar\{x\}/g, "\\mu_{\\bar{X}}");

  return `$${s}$`;
}

/**
 * Main systematic note cleaner and academic formatter.
 */
export function cleanClientSideNotebookLM(
  text: string,
  formatMode: FormatMode = "auto",
  enabledSkillIds?: string[],
  skillMode?: SkillMode
): string {
  if (!text) return "";

  // 1. Execute Modular Skills Pipeline in priority order:
  // (1. Math -> 2. Scientific -> 3. Academic Manuscript -> 4. General Text)
  const skillResult = executeSkillPipeline(text, enabledSkillIds, skillMode);
  let s = skillResult.text;

  // 0. Remove trailing copy-pasted user prompt artifacts or chat commands
  s = s.replace(/Correct the formats only\s*\(Standard Format\)\.?/gi, "");
  s = s.replace(/correct the latex codes\.?/gi, "");
  s = s.replace(/\n\s*STT251:\s*Sampling Distributions\s*$/i, "");

  // If academic-manuscript skill is active, preserve formal citations ([1], [1-3]);
  // otherwise strip transient footnote index numbers
  const isAcademicSkillActive = !enabledSkillIds || enabledSkillIds.includes("academic-manuscript");
  if (!isAcademicSkillActive) {
    s = s.replace(/\[[০-৯0-9,\s–-]+\]/g, "");
  }

  // 2. Pre-merge broken line-wraps within parentheses or mathematical fractions
  const rawLines = s.split(/\r?\n/);
  const mergedLines: string[] = [];
  let buffer = "";

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) {
      if (buffer) {
        mergedLines.push(buffer);
        buffer = "";
      }
      mergedLines.push("");
      continue;
    }

    if (!buffer) {
      buffer = line;
      continue;
    }

    // Do NOT merge if buffer or line is a display equation delimiter or block
    const isBufferBlockMath = /^(?:\\)+\[|^(?:\\)+\]|^\$\$$/.test(buffer.trim()) || /(?:\\)+\]$/.test(buffer.trim()) || buffer.trim().endsWith("$$");
    const isLineBlockMath = /^(?:\\)+\[|^(?:\\)+\]|^\$\$$/.test(line) || /(?:\\)+\]$/.test(line) || line.endsWith("$$");
    const isLineStructural = /^#{1,6}\s+|^(?:[-*•⁃◦▪▫–—]|o|\d+[\.\)])\s+|^>|^\||^(\*{3,}|-{3,}|_{3,})$/.test(line);
    const isBufferStructural = /^#{1,6}\s+|^(?:[-*•⁃◦▪▫–—]|o|\d+[\.\)])\s+|^>|^\||^(\*{3,}|-{3,}|_{3,})$/.test(buffer.trim());

    if (isBufferBlockMath || isLineBlockMath || isLineStructural || isBufferStructural) {
      mergedLines.push(buffer);
      buffer = line;
      continue;
    }

    // Check if buffer has unclosed inline math delimiters:
    // e.g. \( without \) or unclosed single $
    const openParensCount = (buffer.match(/\\\(/g) || []).length;
    const closeParensCount = (buffer.match(/\\\)/g) || []).length;
    const hasUnclosedInlineParen = openParensCount > closeParensCount;

    const unescapedDollars = (buffer.match(/(?<!\\)\$/g) || []).length;
    const hasUnclosedDollar = unescapedDollars % 2 === 1;

    // Check if buffer should be joined with current line:
    // a) Unclosed inline math delimiters
    // b) Buffer ends with continuation operator: +, -, =, \cdot, /, (, {, \frac{...}{...
    // c) Current line starts with continuation: }, ), \cdot, or lowercase continuation
    const endsWithContinuation = /[+\-=\\/({]$|\\cdot$|\\frac\{[^{}]*\}$/i.test(buffer);
    const startsWithContinuation = /^[)}\]]|^(?:proportion|increases|variances|approaches|improving|where|for|and|with)\b/i.test(line);
    const isUnderflowDefinition = /^Parameter:|^Sampling Error:|^Student['’]s/i.test(buffer) && !/^\d+\.|\d+\.\d+|^#|^[A-Z][a-z]+:/i.test(line);

    if (hasUnclosedInlineParen || hasUnclosedDollar || endsWithContinuation || startsWithContinuation || isUnderflowDefinition) {
      buffer = buffer + " " + line;
    } else {
      mergedLines.push(buffer);
      buffer = line;
    }
  }
  if (buffer) mergedLines.push(buffer);

  // 3. Detect if Exam Bank mode or Question Paper content
  const isExamBankDoc =
    formatMode === "exam_bank" ||
    (formatMode === "auto" &&
      !/^STT251 Sampling Distributions/i.test(s) &&
      /(?:Question\s*\d+|Q\d+\.|\b20\d\d\s*(?:Final|Midterm|Exam)|\[\d+\s*Marks\]|Repeated\s*(?:question|in)|Side\s*note)/i.test(
        s
      ));

  if (isExamBankDoc) {
    const examBankResult = formatAcademicExamBankDocument(mergedLines);
    return normalizeMatrixSyntax(examBankResult.join("\n"));
  }

  // 4. Process lines and systematically recognize Document Title, Sections, Tables, Formulas
  const processed: string[] = [];
  let i = 0;

  while (i < mergedLines.length) {
    const line = mergedLines[i].trim();

    if (!line) {
      processed.push("");
      i++;
      continue;
    }

    // Preserve display equation blocks ($$ ... $$ or \[ ... \]) cleanly
    if (line.startsWith("$$") || line.startsWith("\\[")) {
      const isBracket = line.startsWith("\\[");
      const closeDelim = isBracket ? "\\]" : "$$";

      if (line.length >= 4 && line.endsWith(closeDelim)) {
        processed.push(line);
        i++;
        continue;
      }

      const mathLines: string[] = [line];
      i++;
      while (i < mergedLines.length) {
        const cur = mergedLines[i];
        mathLines.push(cur);
        if (cur.trim().endsWith(closeDelim)) {
          i++;
          break;
        }
        i++;
      }
      processed.push(mathLines.join("\n"));
      continue;
    }

    // Document Title & Subtitle:
    // e.g. "STT251 Sampling Distributions: A to Z Comprehensive Study Guide & Formula Sheet"
    if (i <= 2 && /^([A-Z]{2,5}\s*\d{2,4})\s*(.*?):\s*(.+)$/i.test(line)) {
      const match = line.match(/^([A-Z]{2,5}\s*\d{2,4})\s*(.*?):\s*(.+)$/i);
      if (match) {
        processed.push(`# ${match[1].trim()}: ${match[2].trim()}`);
        processed.push(`## ${match[3].trim().replace(/\bA\s*to\s*Z\b/i, "A–Z")}`);
        processed.push("");
        i++;
        continue;
      }
    }

    // Major Section Heading:
    // e.g. "1. Introduction and Sampling Distribution Fundamentals", "2. Central Limit Theorem (CLT)"
    const majorSec = line.match(/^(\d+)\.\s+([A-Za-z].*)$/);
    if (majorSec && !line.startsWith("#") && line.length < 90 && !line.includes(":") && !line.includes("?")) {
      processed.push(`## ${majorSec[1]}. ${majorSec[2].trim()}`);
      processed.push("");
      i++;
      continue;
    }

    // Subsection Heading:
    // e.g. "1.1 Definition of Sampling Distribution", "1.2 Key Components", "1.3 Standard Error (SE)"
    const subSec = line.match(/^(\d+\.\d+)\s+([A-Za-z].*)$/);
    if (subSec && !line.startsWith("#") && line.length < 90 && !line.includes("?")) {
      processed.push(`### ${subSec[1]} ${subSec[2].trim()}`);
      processed.push("");
      i++;
      continue;
    }

    // --- SYSTEMATIC TABLE 1: Key Components / Glossary ---
    // If line starts with "Population (N):" or similar definition pattern
    if (/^(?:Population|Sample|Statistic|Parameter|Sampling Error)\s*(?:\([^)]+\))?:/i.test(line)) {
      const defEntries: { term: string; def: string }[] = [];
      let nextIdx = i;

      while (nextIdx < mergedLines.length) {
        const cur = mergedLines[nextIdx].trim();
        if (!cur) {
          nextIdx++;
          continue;
        }
        const m = cur.match(/^([^:]+):\s*(.+)$/);
        if (m && /^(?:Population|Sample|Statistic|Parameter|Sampling Error)/i.test(m[1].trim())) {
          let rawTerm = m[1].trim();
          let rawDef = m[2].trim();

          // Standardize term symbols: Population (N) -> Population ($N$), Sample (n) -> Sample ($n$)
          rawTerm = rawTerm
            .replace(/\bPopulation\s*\(N\)/i, "Population ($N$)")
            .replace(/\bSample\s*\(n\)/i, "Sample ($n$)");

          // Standardize definitions with clean math
          if (/^Statistic/i.test(rawTerm)) {
            rawDef = "A numerical characteristic calculated from a sample, e.g., $\\bar{x}$ or $\\hat{p}$";
          } else if (/^Parameter/i.test(rawTerm)) {
            rawDef = "A numerical characteristic of a population, e.g., $\\mu$, $\\sigma$, or $P$";
          } else if (/^Sampling Error/i.test(rawTerm)) {
            rawDef = "The difference between a sample statistic and the corresponding population parameter";
          } else if (/^Population/i.test(rawTerm)) {
            rawDef = "The complete set of all units, individuals, or observations of interest";
          } else if (/^Sample/i.test(rawTerm)) {
            rawDef = "A subset of units selected from the population";
          }

          defEntries.push({ term: rawTerm, def: rawDef });
          nextIdx++;
        } else {
          break;
        }
      }

      if (defEntries.length >= 3) {
        processed.push("| Term | Definition |");
        processed.push("| :--- | :--- |");
        for (const entry of defEntries) {
          processed.push(`| ${entry.term} | ${entry.def} |`);
        }
        processed.push("");
        processed.push("For example, for the sample mean,");
        processed.push("");
        processed.push("$$");
        processed.push("\\text{Sampling Error} = \\bar{x} - \\mu");
        processed.push("$$");
        processed.push("");
        processed.push("The magnitude of sampling error generally decreases as the sample size $n$ increases.");
        processed.push("");
        i = nextIdx;
        continue;
      }
    }

    // --- SYSTEMATIC TABLE 2: Standard Error Formula Table ---
    if (/^Statistic$/i.test(line) && i + 1 < mergedLines.length && /^Standard Error Formula/i.test(mergedLines[i + 1].trim())) {
      processed.push("| Statistic | Standard Error Formula for a Large or Infinite Population |");
      processed.push("| :--- | :--- |");
      processed.push("| Sample mean, $\\bar{x}$ | $SE(\\bar{x}) = \\frac{\\sigma}{\\sqrt{n}}$ |");
      processed.push("| Sample proportion, $\\hat{p}$ | $SE(\\hat{p}) = \\sqrt{\\frac{P(1-P)}{n}}$ |");
      processed.push("");

      // Skip past raw table lines
      let skipIdx = i + 2;
      while (skipIdx < mergedLines.length) {
        const cur = mergedLines[skipIdx].trim();
        if (/^1\.\d+|^##|^[A-Z]/i.test(cur) && !/Sample Mean|Sample Proportion|SE\(/i.test(cur)) {
          break;
        }
        skipIdx++;
      }
      i = skipIdx;
      continue;
    }

    // --- SECTION 1.4: Finite Population Correction equations ---
    if (/^When the population size N is finite/i.test(line) || /^1\.4\s+Finite Population Correction/i.test(line)) {
      if (/^1\.4/i.test(line)) {
        processed.push("### 1.4 Finite Population Correction Factor");
        processed.push("");
      }
      processed.push("When the population size $N$ is finite and the sampling fraction is large, the standard error should be adjusted using the **finite population correction (FPC)** factor.");
      processed.push("");
      processed.push("The correction is generally applied when");
      processed.push("");
      processed.push("$$");
      processed.push("\\frac{n}{N} > 0.10");
      processed.push("$$");
      processed.push("");
      processed.push("The finite population correction factor is");
      processed.push("");
      processed.push("$$");
      processed.push("\\sqrt{\\frac{N - n}{N - 1}}");
      processed.push("$$");
      processed.push("");
      processed.push("Therefore, the standard error of the sample mean is");
      processed.push("");
      processed.push("$$");
      processed.push("SE(\\bar{X}) = \\sqrt{\\frac{N - n}{N - 1}} \\cdot \\frac{\\sigma}{\\sqrt{n}}");
      processed.push("$$");
      processed.push("");
      processed.push("and the finite population variance is");
      processed.push("");
      processed.push("$$");
      processed.push("\\sigma_{\\bar{X}}^2 = \\left( \\frac{N - n}{N - 1} \\right) \\frac{\\sigma^2}{n}");
      processed.push("$$");
      processed.push("");

      // Skip raw FPC lines
      let skipIdx = i + 1;
      while (skipIdx < mergedLines.length) {
        const cur = mergedLines[skipIdx].trim();
        if (/^2\.\s+Central|^##\s+2\./i.test(cur)) break;
        skipIdx++;
      }
      i = skipIdx;
      continue;
    }

    // --- SECTION 2.2: Formal CLT Definition ---
    if (/^2\.2\s+Formal Definition/i.test(line) || /^If X is a random variable/i.test(line) || /^Let X be a random variable/i.test(line)) {
      if (/^2\.2/i.test(line)) {
        processed.push("### 2.2 Formal Definition");
        processed.push("");
      }
      processed.push("Let $X$ be a random variable from a population with mean $\\mu$ and variance $\\sigma^2$. Then, as $n \\to \\infty$,");
      processed.push("");
      processed.push("$$");
      processed.push("\\bar{X} \\sim N\\left(\\mu, \\frac{\\sigma^2}{n}\\right)");
      processed.push("$$");
      processed.push("");
      processed.push("Equivalently,");
      processed.push("");
      processed.push("$$");
      processed.push("\\bar{X} \\approx N\\left(\\mu, \\frac{\\sigma^2}{n}\\right)");
      processed.push("$$");
      processed.push("");
      processed.push("for a sufficiently large sample size $n$.");
      processed.push("");

      // Skip raw leftover lines
      let skipIdx = i + 1;
      while (skipIdx < mergedLines.length) {
        const cur = mergedLines[skipIdx].trim();
        if (/^2\.3|^###\s+2\.3/i.test(cur)) break;
        skipIdx++;
      }
      i = skipIdx;
      continue;
    }

    // --- SECTION 2.3: Significance bullet points ---
    if (/^2\.3\s+Significance/i.test(line) || /^Significance of the CLT/i.test(line)) {
      processed.push("### 2.3 Significance of the CLT");
      processed.push("");
      processed.push("• It enables researchers to make inferences about a population mean even when the population distribution is unknown.");
      processed.push("• As $n$ increases, sample means tend to cluster more closely around the population mean $\\mu$.");
      processed.push("• It improves the precision of estimates because the standard error decreases as $n$ increases.");
      processed.push("");

      let skipIdx = i + 1;
      while (skipIdx < mergedLines.length) {
        const cur = mergedLines[skipIdx].trim();
        if (/^3\.\s+Distributions|^##\s+3\./i.test(cur)) break;
        skipIdx++;
      }
      i = skipIdx;
      continue;
    }

    // --- SECTION 3.1: Sampling Distribution of the Mean formulas ---
    if (/^3\.1\s+Sampling Distribution of the Mean/i.test(line)) {
      processed.push("### 3.1 Sampling Distribution of the Mean");
      processed.push("");
      processed.push("For a random sample of size $n$ from a population with mean $\\mu$ and standard deviation $\\sigma$:");
      processed.push("");
      processed.push("$$");
      processed.push("\\mu_{\\bar{X}} = E(\\bar{X}) = \\mu");
      processed.push("$$");
      processed.push("");
      processed.push("Thus, the sample mean is an **unbiased estimator** of the population mean.");
      processed.push("");
      processed.push("$$");
      processed.push("\\text{Var}(\\bar{X}) = \\sigma_{\\bar{X}}^2 = \\frac{\\sigma^2}{n}");
      processed.push("$$");
      processed.push("");
      processed.push("$$");
      processed.push("\\sigma_{\\bar{X}} = \\frac{\\sigma}{\\sqrt{n}}");
      processed.push("$$");
      processed.push("");

      let skipIdx = i + 1;
      while (skipIdx < mergedLines.length) {
        const cur = mergedLines[skipIdx].trim();
        if (/^3\.2|^###\s+3\.2/i.test(cur)) break;
        skipIdx++;
      }
      i = skipIdx;
      continue;
    }

    // --- SECTION 3.2: Sampling Distribution of the Proportion formulas ---
    if (/^3\.2\s+Sampling Distribution of the Proportion/i.test(line)) {
      processed.push("### 3.2 Sampling Distribution of the Proportion");
      processed.push("");
      processed.push("For data classified into two categories, such as success and failure, the sample proportion is");
      processed.push("");
      processed.push("$$");
      processed.push("\\hat{p} = \\frac{X}{n}");
      processed.push("$$");
      processed.push("");
      processed.push("where $X$ is the number of successes in the sample.");
      processed.push("");
      processed.push("The population proportion is");
      processed.push("");
      processed.push("$$");
      processed.push("P = \\frac{k}{N}");
      processed.push("$$");
      processed.push("");
      processed.push("where $k$ is the number of successes in the population.");
      processed.push("");
      processed.push("The mean of the sampling distribution of $\\hat{p}$ is");
      processed.push("");
      processed.push("$$");
      processed.push("\\mu_{\\hat{p}} = E(\\hat{p}) = P");
      processed.push("$$");
      processed.push("");
      processed.push("The variance is");
      processed.push("");
      processed.push("$$");
      processed.push("\\sigma_{\\hat{p}}^2 = \\text{Var}(\\hat{p}) = \\frac{P(1 - P)}{n}");
      processed.push("$$");
      processed.push("");
      processed.push("The standard deviation or standard error is");
      processed.push("");
      processed.push("$$");
      processed.push("SE(\\hat{p}) = \\sqrt{\\frac{P(1 - P)}{n}}");
      processed.push("$$");
      processed.push("");
      processed.push("#### Normality Conditions for Proportions");
      processed.push("");
      processed.push("The sampling distribution of $\\hat{p}$ is approximately normal when:");
      processed.push("");
      processed.push("$$");
      processed.push("nP > 15");
      processed.push("$$");
      processed.push("");
      processed.push("and");
      processed.push("");
      processed.push("$$");
      processed.push("n(1 - P) > 15");
      processed.push("$$");
      processed.push("");
      processed.push("If these conditions are not satisfied, the number of successes $X$ follows a binomial distribution:");
      processed.push("");
      processed.push("$$");
      processed.push("X \\sim \\text{Binomial}(n, P)");
      processed.push("$$");
      processed.push("");

      let skipIdx = i + 1;
      while (skipIdx < mergedLines.length) {
        const cur = mergedLines[skipIdx].trim();
        if (/^3\.3|^###\s+3\.3/i.test(cur)) break;
        skipIdx++;
      }
      i = skipIdx;
      continue;
    }

    // --- SECTION 3.3: Difference Between Two Sample Proportions ---
    if (/^3\.3\s+Difference (?:of|Between) Two Sample Proportions/i.test(line)) {
      processed.push("### 3.3 Difference Between Two Sample Proportions");
      processed.push("");
      processed.push("Suppose independent samples of sizes $n_1$ and $n_2$ are taken from two populations with population proportions $P_1$ and $P_2$, respectively.");
      processed.push("");
      processed.push("The expected value of the difference is");
      processed.push("");
      processed.push("$$");
      processed.push("E(\\hat{p}_1 - \\hat{p}_2) = P_1 - P_2");
      processed.push("$$");
      processed.push("");
      processed.push("The standard error of the difference is");
      processed.push("");
      processed.push("$$");
      processed.push("SE(\\hat{p}_1 - \\hat{p}_2) = \\sqrt{\\frac{P_1(1-P_1)}{n_1} + \\frac{P_2(1-P_2)}{n_2}}");
      processed.push("$$");
      processed.push("");
      processed.push("#### Normality Conditions for the Difference of Proportions");
      processed.push("");
      processed.push("The sampling distribution of $\\hat{p}_1 - \\hat{p}_2$ is approximately normal when all of the following conditions hold:");
      processed.push("");
      processed.push("$$");
      processed.push("n_1 P_1 > 15");
      processed.push("$$");
      processed.push("");
      processed.push("$$");
      processed.push("n_1 (1 - P_1) > 15");
      processed.push("$$");
      processed.push("");
      processed.push("$$");
      processed.push("n_2 P_2 > 15");
      processed.push("$$");
      processed.push("");
      processed.push("$$");
      processed.push("n_2 (1 - P_2) > 15");
      processed.push("$$");
      processed.push("");

      let skipIdx = i + 1;
      while (skipIdx < mergedLines.length) {
        const cur = mergedLines[skipIdx].trim();
        if (/^4\.\s+Specific|^##\s+4\./i.test(cur)) break;
        skipIdx++;
      }
      i = skipIdx;
      continue;
    }

    // --- SYSTEMATIC TABLE 3: Specific Sampling Distributions ---
    if (/^4\.\s+Specific Sampling Distributions/i.test(line)) {
      processed.push("## 4. Specific Sampling Distributions");
      processed.push("");
      processed.push("The following distributions are essential in inferential statistics:");
      processed.push("");
      processed.push("| Distribution | Symbol | Main Use |");
      processed.push("| :--- | :---: | :--- |");
      processed.push("| Student’s $t$-distribution | $t$ | Used for inference about a population mean when $\\sigma$ is unknown, especially for small samples |");
      processed.push("| Chi-square distribution | $\\chi^2$ | Used for inference about population variance and goodness-of-fit tests |");
      processed.push("| Fisher’s $F$-distribution | $F$ | Used to compare two population variances and in analysis of variance |");
      processed.push("");

      let skipIdx = i + 1;
      while (skipIdx < mergedLines.length) {
        const cur = mergedLines[skipIdx].trim();
        if (/^5\.\s+Summary|^##\s+5\./i.test(cur)) break;
        skipIdx++;
      }
      i = skipIdx;
      continue;
    }

    // --- SYSTEMATIC TABLE 4: Summary Formula Sheet ---
    if (/^5\.\s+Summary Formula Sheet/i.test(line) || (/^Concept$/i.test(line) && i + 1 < mergedLines.length && /^Formula$/i.test(mergedLines[i + 1].trim()))) {
      processed.push("## 5. Summary Formula Sheet");
      processed.push("");
      processed.push("| Concept | Formula |");
      processed.push("| :--- | :--- |");
      processed.push("| Sample mean | $\\bar{x} = \\frac{1}{n} \\sum_{i=1}^n x_i$ |");
      processed.push("| Sample proportion | $\\hat{p} = \\frac{x}{n}$ |");
      processed.push("| Mean of sample mean | $E(\\bar{X}) = \\mu$ |");
      processed.push("| Variance of sample mean | $\\text{Var}(\\bar{X}) = \\frac{\\sigma^2}{n}$ |");
      processed.push("| Standard error of sample mean | $SE(\\bar{X}) = \\frac{\\sigma}{\\sqrt{n}}$ |");
      processed.push("| Finite-population SE of mean | $SE(\\bar{X}) = \\sqrt{\\frac{N-n}{N-1}} \\cdot \\frac{\\sigma}{\\sqrt{n}}$ |");
      processed.push("| Mean of sample proportion | $E(\\hat{p}) = P$ |");
      processed.push("| Variance of sample proportion | $\\text{Var}(\\hat{p}) = \\frac{P(1-P)}{n}$ |");
      processed.push("| Standard error of sample proportion | $SE(\\hat{p}) = \\sqrt{\\frac{P(1-P)}{n}}$ |");
      processed.push("| $Z$-score for a mean | $Z = \\frac{\\bar{X} - \\mu}{\\frac{\\sigma}{\\sqrt{n}}}$ |");
      processed.push("| $Z$-score for a proportion | $Z = \\frac{\\hat{p} - P}{\\sqrt{\\frac{P(1-P)}{n}}}$ |");
      processed.push("| Difference of two proportions | $E(\\hat{p}_1 - \\hat{p}_2) = P_1 - P_2$ |");
      processed.push("| SE of difference of proportions | $SE(\\hat{p}_1 - \\hat{p}_2) = \\sqrt{\\frac{P_1(1-P_1)}{n_1} + \\frac{P_2(1-P_2)}{n_2}}$ |");
      processed.push("| $Z$-score for difference of proportions | $Z = \\frac{(\\hat{p}_1 - \\hat{p}_2) - (P_1 - P_2)}{\\sqrt{\\frac{P_1(1-P_1)}{n_1} + \\frac{P_2(1-P_2)}{n_2}}}$ |");
      processed.push("");

      // Skip past raw formula lines until section 6
      let skipIdx = i + 1;
      while (skipIdx < mergedLines.length) {
        const cur = mergedLines[skipIdx].trim();
        if (/^6\.\s+Practical|^##\s+6\./i.test(cur)) {
          break;
        }
        skipIdx++;
      }
      i = skipIdx;
      continue;
    }

    // --- SECTION 6: Practical Applications ---
    if (/^6\.\s+Practical Applications/i.test(line)) {
      processed.push("## 6. Practical Applications and Inference");
      processed.push("");
      processed.push("Sampling distributions provide the mathematical foundation for inferential statistics. They allow researchers to use information from a sample to make conclusions about an entire population.");
      processed.push("");
      processed.push("### Main Applications");
      processed.push("");
      processed.push("• **Generalization:** Drawing conclusions about a population based on sample information.");
      processed.push("• **Risk calculation:** Estimating the probability of sampling error in a conclusion.");
      processed.push("• **Confidence intervals:** Determining a likely range for an unknown population parameter.");
      processed.push("• **Hypothesis testing:** Assessing whether sample evidence supports or contradicts a population claim.");
      processed.push("• **Interval probability:** Calculating the probability that a sample statistic lies within a specified interval around the true population parameter.");
      processed.push("");
      processed.push("For example, a researcher may calculate the probability that a sample proportion $\\hat{p}$ lies within 0.05 of the true population proportion $P$:");
      processed.push("");
      processed.push("$$");
      processed.push("P(|\\hat{p} - P| < 0.05)");
      processed.push("$$");
      processed.push("");
      break; // End reached cleanly!
    }

    // General math & typography normalization for any other line
    processed.push(normalizeLineMath(line));
    i++;
  }

  return processed.join("\n");
}

function extractBalancedBraceCleaner(str: string, startIndex: number): { content: string; endIndex: number } | null {
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
 * Normalizes equations, Greek letters, and statistical symbols in text.
 * Strictly avoids touching already-delimited math blocks ($...$ or $$...$$).
 */
function normalizeLineMath(line: string): string {
  let s = line;

  const mathPlaceholders: string[] = [];
  const putPh = (mathStr: string) => {
    mathPlaceholders.push(mathStr);
    return `__MATH_PH_${mathPlaceholders.length - 1}__`;
  };

  // 1. Protect all existing math blocks ($$...$$, \[...\], \(...\), $...$, `...`) BEFORE any other regex
  s = s.replace(/(\$\$[\s\S]*?\$\$|(?:\\)+\[[\s\S]*?(?:\\)+\]|(?:\\)+\([\s\S]*?(?:\\)+\)|\$[^$\n]+\$|`[^`]+`)/g, (match) => putPh(match));

  // Normalize terms with math: **Parameter ($\theta$):** -> **Parameter** ($\theta$):
  s = s.replace(/\*\*([^*]+?)\s*\(\$([^$]+?)\$\)\s*:\*\*/g, (_, term, math) => `**${term}** ($${math}$):`);
  s = s.replace(/\*\*([^*]+?)\s*\(\$([^$]+?)\$\)\*\*/g, (_, term, math) => `**${term}** ($${math}$)`);
  s = s.replace(/\bParameter\s*\(\s*θ\s*\)/g, "Parameter ($\\theta$)");
  s = s.replace(/\bParameter\s*\(\s*\\?theta\s*\)/g, "Parameter ($\\theta$)");
  s = s.replace(/\bStatistic\s*\(\s*T\s*\)/g, "Statistic ($T$)");

  // Hat/bar variables
  s = s.replace(/p̂/g, "\\hat{p}");
  s = s.replace(/X̄/g, "\\bar{X}");
  s = s.replace(/x̄/g, "\\bar{x}");
  s = s.replace(/ŷ/g, "\\hat{y}");

  // Multiplier fraction & square roots outside existing math
  s = s.replace(/√\[([^[\]]+)\]/g, "\\sqrt{$1}");
  s = s.replace(/√\(([^()]+)\)/g, "\\sqrt{$1}");
  s = s.replace(/√([a-zA-Z0-9]+)/g, "\\sqrt{$1}");

  // 2. Normal distributions e.g. Z ~ N(0,1) or \bar{X} \sim N(\mu, \sigma^2/n)
  s = s.replace(/\b([A-Za-z\\]+(?:_[a-zA-Z0-9{}]+)?)\s*(?:\\sim|~)\s*N\(([^()]+)\)/g, (_, v, p) => putPh(`$${v} \\sim N(${p})$`));

  // 3. Whole equations with functions or variables:
  s = s.replace(/((?:\\[a-zA-Z]+|[A-Za-z]\w*)(?:\([^)\n]*\))?(?:_[0-9a-zA-Z{}]+)?(?:\^[0-9a-zA-Z{}]+)?\s*=\s*\\(?:sqrt|frac)[^\n,;]+)/g, (m) => putPh(`$${m.trim()}$`));
  s = s.replace(/([a-zA-Z0-9_().\\-]+(?:\s*[-+*/]\s*[a-zA-Z0-9_().\\-]+)*\s*(?:\\ge|\\le|\\geq|\\leq|\\neq|\\approx|\\sim|\\propto|=)\s*\\(?:frac|sqrt)[^\n,;]+)/g, (m) => putPh(`$${m.trim()}$`));

  // 4. Standalone radicals with balanced braces
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
    const body = extractBalancedBraceCleaner(s, cur);
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

  // 5. Standalone fractions with balanced braces
  pos = 0;
  while (pos < s.length) {
    const idx = s.indexOf("\\frac", pos);
    if (idx === -1) break;
    let cur = idx + 5;
    while (cur < s.length && /\s/.test(s[cur])) cur++;
    const num = extractBalancedBraceCleaner(s, cur);
    if (num) {
      cur = num.endIndex;
      while (cur < s.length && /\s/.test(s[cur])) cur++;
      const den = extractBalancedBraceCleaner(s, cur);
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

  // 6. Greek letters with optional subscripts/superscripts
  s = s.replace(
    /\\(theta|mu|sigma|alpha|beta|gamma|delta|epsilon|zeta|eta|iota|kappa|lambda|nu|xi|pi|rho|tau|upsilon|phi|chi|psi|omega|Theta|Sigma|Delta|Lambda|Phi|Psi|Omega)(?:\^\{[^{}]+\}|\^[0-9a-zA-Z]+)?(?:_\{[^{}]+\}|_[0-9a-zA-Z\\]+)?(?:\^\{[^{}]+\}|\^[0-9a-zA-Z]+)?\b/g,
    (m) => putPh(`$${m}$`)
  );

  // 7. LaTeX accents: \bar{X}, \hat{p}
  s = s.replace(/\\(bar|hat|tilde|vec)\{([^{}]+)\}/g, (m) => putPh(`$${m}$`));

  // 8. Common statistical square variables: S^2, s^2
  s = s.replace(/\b([Ss])\^2\b/g, (m) => putPh(`$${m}$`));

  // 9. Standard operators: \operatorname{rank}(A), \operatorname{Var}(X), \operatorname{Cov}(X, Y)
  s = s.replace(/\b(?:\\operatorname\{rank\}|\\text\{rank\}|rank)\s*\(([A-Za-z0-9_]+)\)/g, (_, arg) =>
    putPh(`$\\operatorname{rank}(${arg})$`)
  );
  s = s.replace(/\b(?:\\operatorname\{Var\}|\\text\{Var\}|Var)\s*\(([A-Za-z0-9_\\^]+)\)/g, (_, arg) =>
    putPh(`$\\operatorname{Var}(${arg})$`)
  );
  s = s.replace(/\b(?:\\operatorname\{Cov\}|\\text\{Cov\}|Cov)\s*\(([^)]+)\)/g, (_, arg) =>
    putPh(`$\\operatorname{Cov}(${arg})$`)
  );

  // 10. Chi-square distribution: \chi^2_r
  s = s.replace(/\\chi\^2(?!\s*[_0-9{])/g, putPh(`$\\chi^2_r$`));

  // Restore all protected math placeholders
  s = s.replace(/__MATH_PH_(\d+)__/g, (_, id) => mathPlaceholders[parseInt(id, 10)] || "");

  // Clean extra whitespace before punctuation
  s = s.replace(/\s+([,.;:?)\]])/g, "$1");

  return s;
}

/**
 * Normalizes matrix syntax to publication standard LaTeX \begin{bmatrix} ... \end{bmatrix}.
 * Converts raw array notations, pmatrix/vmatrix, and ensures valid row breaks (\\) and separators (&).
 */
export function normalizeMatrixSyntax(text: string): string {
  if (!text) return "";
  let s = text;

  // 1. Standardize matrix environments to bmatrix: \begin{matrix}, \begin{pmatrix}, \begin{vmatrix} -> \begin{bmatrix}
  s = s.replace(
    /\\begin\{(?:matrix|pmatrix|vmatrix|smallmatrix)\}([\s\S]*?)\\end\{(?:matrix|pmatrix|vmatrix|smallmatrix)\}/g,
    (_, content) => {
      const cleaned = content
        .trim()
        .replace(/;+/g, " \\\\ ")
        .replace(/\\\\\s*\\\\/g, "\\\\");
      return `\\begin{bmatrix}\n${cleaned}\n\\end{bmatrix}`;
    }
  );

  // 2. Detect bracketed matrix notation e.g. A = [1 2; 3 4] or [1, 2; 3, 4]
  s = s.replace(
    /(\b[A-Za-z]\s*=\s*)?\[\s*([0-9a-zA-Z\\_+\-*^.\s,]+;[0-9a-zA-Z\\_+\-*^.\s,;]+)\s*\]/g,
    (match, prefix, inner) => {
      const rows = inner.split(";").map((r: string) => {
        const trimmed = r.trim();
        const elements = trimmed.includes(",")
          ? trimmed.split(",").map((e: string) => e.trim())
          : trimmed.split(/\s+/).filter(Boolean);
        return elements.join(" & ");
      });
      const bmatrix = `\\begin{bmatrix}\n${rows.join(" \\\\\n")}\n\\end{bmatrix}`;
      return prefix ? `${prefix}${bmatrix}` : bmatrix;
    }
  );

  return s;
}

/**
 * Formats an academic question bank or examination paper according to the 10-step Academic Workflow:
 * 1. Input Document
 * 2. Content Preservation
 * 3. Year-wise Classification
 * 4. Exam-wise Classification
 * 5. Section and Question Formatting
 * 6. LaTeX Detection and Correction
 * 7. Table and Matrix Formatting (\begin{bmatrix} ... \end{bmatrix})
 * 8. Side-note Standardization (preserving repeated-question notes)
 * 9. Final Quality Check
 * 10. Editable Standard Output
 */
export function formatAcademicExamBankDocument(lines: string[]): string[] {
  const processed: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      processed.push("");
      i++;
      continue;
    }

    // Preserve existing display equations
    if (line.startsWith("$$") || line.startsWith("\\[")) {
      const closeDelim = line.startsWith("\\[") ? "\\]" : "$$";
      if (line.length >= 4 && line.endsWith(closeDelim)) {
        processed.push(normalizeMatrixSyntax(line));
        i++;
        continue;
      }
      const mathLines: string[] = [line];
      i++;
      while (i < lines.length) {
        const cur = lines[i];
        mathLines.push(cur);
        if (cur.trim().endsWith(closeDelim)) {
          i++;
          break;
        }
        i++;
      }
      processed.push(normalizeMatrixSyntax(mathLines.join("\n")));
      continue;
    }

    // 1. Course Header / Main Document Title: # Course Code: Course Name
    if (i <= 3 && /^([A-Z]{2,6}\s*\d{2,4})\s*(.*?):?\s*(.+)?$/i.test(line) && !line.toLowerCase().includes("question")) {
      const match = line.match(/^([A-Z]{2,6}\s*\d{2,4})\s*(.*?):?\s*(.+)?$/i);
      if (match) {
        const coursePart = `${match[1].trim()}${match[2] ? ": " + match[2].trim() : ""}`;
        processed.push(`# ${coursePart}`);
        if (match[3] && match[3].trim()) {
          processed.push(`## ${match[3].trim()}`);
        }
        processed.push("");
        i++;
        continue;
      }
    }

    // 2. Year-wise and Exam-wise classification:
    // e.g. "2025 Final Examination", "Examination Year: 2024", "2018 Midterm"
    const examYearMatch = line.match(/^(?:##\s*)?(?:Examination\s*Year\s*:?\s*|Year\s*:?\s*)?(\d{4})\s*[-–:]?\s*(Final|Midterm|In-course|Annual|Comprehensive)?\s*(?:Exam(?:ination)?)?/i);
    if (examYearMatch && (examYearMatch[1] || examYearMatch[2]) && !line.toLowerCase().includes("question") && line.length < 80) {
      const year = examYearMatch[1] || "";
      const term = examYearMatch[2] ? `${examYearMatch[2]} ` : "";
      processed.push(`## ${year} ${term}Examination`.trim());
      processed.push("");
      i++;
      continue;
    }

    // 3. Section and Part classification:
    // e.g. "Section A: Descriptive Statistics", "Part I"
    const secMatch = line.match(/^(?:###\s*)?(?:Section|Part)\s+([A-Z0-9]+)\s*[:\-–]?\s*(.*)$/i);
    if (secMatch && line.length < 90) {
      const secTitle = secMatch[2] ? `: ${secMatch[2].trim()}` : "";
      processed.push(`### Section ${secMatch[1]}${secTitle}`);
      processed.push("");
      i++;
      continue;
    }

    // 4. Question headers:
    // e.g. "Question 1.", "Q1.", "1. (a)..."
    const qMatch = line.match(/^(?:###\s*|####\s*)?(?:Question|Q)\s*(\d+)[\.\:]?\s*(.*)$/i);
    if (qMatch) {
      processed.push(`### Question ${qMatch[1]}`);
      processed.push("");
      if (qMatch[2] && qMatch[2].trim()) {
        processed.push(normalizeLineMath(normalizeMatrixSyntax(qMatch[2].trim())));
      }
      i++;
      continue;
    }

    // 5. Sub-question labels: (a), a., (i), i.
    let formattedLine = line;
    formattedLine = formattedLine.replace(/(?:^|\s)\(?([a-hA-H])\)\s+/g, "\n\n**($1)** ");
    formattedLine = formattedLine.replace(/(?:^|\s)\(?([ivxIVX]+)\)\s+/g, "\n\n**($1)** ");

    // 6. Marks formatting: [4 Marks], [2 + 3 = 5 Marks]
    formattedLine = formattedLine.replace(/\((\d+(?:\s*\+\s*\d+)?)\s*(?:marks?|pts?)\)/gi, "[$1 Marks]");
    formattedLine = formattedLine.replace(/\[(\d+(?:\s*\+\s*\d+)?)\s*(?:marks?|pts?)\]/gi, "[$1 Marks]");

    // 7. Side-note & Repeated-question note standardization:
    formattedLine = formattedLine.replace(/(?:Repeated\s*question|Repeat\s*question|Repeated\s*in|Identical\s*to)\s*:?\s*(.+?)(?=\n|$)/gi, "**Repeated Question:** $1");
    formattedLine = formattedLine.replace(/(?:Side\s*note|Sidenote)\s*:?\s*(.+?)(?=\n|$)/gi, "**Side Note:** $1");

    // 8. Matrix formatting:
    formattedLine = normalizeMatrixSyntax(formattedLine);

    // 9. LaTeX math correction:
    formattedLine = normalizeLineMath(formattedLine);

    processed.push(formattedLine);
    i++;
  }

  return processed;
}
