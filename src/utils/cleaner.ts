/**
 * Instant client-side NotebookLM note cleaner and LaTeX normalizer.
 * Provides real-time preview before or in addition to multi-provider AI processing.
 * Handles real-world NotebookLM exports, including:
 * - Systematic Study Guides & Formula Sheets (Tables, Centered Math, Section Hierarchy)
 * - Exam Question Banks & Problem Sets
 * - Display equations: \[ ... \], \\[ ... \\], $$ ... $$
 * - Inline equations: \( ... \), \\( ... \\), $ ... $
 * - Trailing spacing artifacts (\quad, \qquad, \;, \,, \!) before closing delimiters
 * - Unicode bullets (•, ⁃, ◦, ▪, ▫, –, —) and multi-space asterisks (*   )
 * - All heading levels (H1 to H6)
 * - Tree diagram branches (| | ├──, └──, │)
 */

export function cleanClientSideNotebookLM(text: string, formatMode: "auto" | "study_guide" | "exam_bank" = "auto"): string {
  if (!text) return "";

  let s = text;

  // 0. Strip footnote/citation brackets such as [১৫], [২০, ২১], [৮০], [15], etc.
  s = s.replace(/\[[০-৯0-9,\s–-]+\]/g, '');

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

  // 3. Normalize statistical hypotheses
  s = s.replace(/\bH[o0]:\s*beta\s*=\s*0\b/gi, '$H_0: \\beta = 0$');
  s = s.replace(/\bH[o0]:\s*(?:p|rho)\s*=\s*0\b/gi, '$H_0: \\rho = 0$');
  s = s.replace(/\bH[o0]:\s*mu\s*=\s*([0-9.]+)\b/gi, '$H_0: \\mu = $1$');

  // 4. Normalize unicode bullets and list items
  s = s.replace(/^([ \t]*)[•⁃◦▪▫–—]\s+/gm, "$1- ");
  s = s.replace(/^([ \t]*)\*\s{2,}/gm, "$1- ");

  // 5. Systematically detect and convert formula blocks, definitions, and headings
  const lines = s.split("\n");
  const processedLines: string[] = [];

  let inDisplayMath = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Track $$ display math blocks to never touch math interiors
    if (trimmed.startsWith("$$")) {
      if (trimmed.endsWith("$$") && trimmed.length >= 4) {
        processedLines.push(rawLine);
        continue;
      }
      inDisplayMath = !inDisplayMath;
      processedLines.push(rawLine);
      continue;
    }

    if (inDisplayMath) {
      processedLines.push(rawLine);
      continue;
    }

    // Top Document Title formatting (e.g. STT251 Sampling Distributions: A to Z Comprehensive Study Guide & Formula Sheet)
    if (i === 0 && /^([A-Z]{2,5}\s*\d{2,4})\s*(.*?):\s*(.+)$/i.test(trimmed)) {
      const match = trimmed.match(/^([A-Z]{2,5}\s*\d{2,4})\s*(.*?):\s*(.+)$/i);
      if (match) {
        processedLines.push(`# ${match[1].trim()}: ${match[2].trim()}`);
        processedLines.push(`## ${match[3].trim()}`);
        continue;
      }
    }

    // Major Section Heading (e.g. 1. Introduction and Sampling Distribution Fundamentals or 2. Central Limit Theorem (CLT))
    const majorSecMatch = trimmed.match(/^(\d+)\.\s+([A-Za-z].*)$/);
    if (majorSecMatch && !trimmed.startsWith("#") && trimmed.length < 80 && !trimmed.includes("?") && !trimmed.includes(":")) {
      processedLines.push(`## ${majorSecMatch[1]}. ${majorSecMatch[2].trim()}`);
      continue;
    }

    // Subsection Heading (e.g. 1.1 Definition of Sampling Distribution, 1.2 Key Components, 2.1 Historical Context)
    const subSecMatch = trimmed.match(/^(\d+\.\d+)\s+([A-Za-z].*)$/);
    if (subSecMatch && !trimmed.startsWith("#") && trimmed.length < 80) {
      processedLines.push(`### ${subSecMatch[1]} ${subSecMatch[2].trim()}`);
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
        if (/^\d+(\.\d+)+\s+/.test(content)) {
          processedLines.push(`### ${content}`);
        } else {
          const prefix = indentLevel > 0 ? "    - " : "- ";
          processedLines.push(prefix + normalizeLineMath(content));
        }
      }
      continue;
    }

    // Lines starting with single pipe: | Title or | - Item
    if (/^[│|]\s*/.test(rawLine) && !rawLine.includes("|", 1)) {
      const content = rawLine.replace(/^[│|]\s*/, "").trim();
      if (content) {
        processedLines.push(normalizeLineMath(content));
      }
      continue;
    }

    processedLines.push(normalizeLineMath(rawLine));
  }

  // 6. Systematic Multi-line Table & Pattern Detection
  const cleaned: string[] = [];
  let idx = 0;

  while (idx < processedLines.length) {
    const curLine = processedLines[idx];
    const curTrimmed = curLine.trim();

    // Pattern A: Definition Glossary Block (e.g. Population (N): ..., Sample (n): ..., Statistic: ...)
    // If 3 or more consecutive lines match "Term: Definition", convert into a clean Markdown table!
    if (isDefinitionLine(curTrimmed)) {
      const defRows: { term: string; def: string }[] = [];
      let lookahead = idx;
      while (lookahead < processedLines.length && (isDefinitionLine(processedLines[lookahead].trim()) || !processedLines[lookahead].trim())) {
        const lineStr = processedLines[lookahead].trim();
        if (lineStr) {
          const parsed = parseDefinitionLine(lineStr);
          if (parsed) defRows.push(parsed);
        }
        lookahead++;
      }

      if (defRows.length >= 3) {
        cleaned.push("| Term | Definition |");
        cleaned.push("| :--- | :--- |");
        for (const row of defRows) {
          cleaned.push(`| ${row.term} | ${row.def} |`);
        }
        cleaned.push("");
        idx = lookahead;
        continue;
      }
    }

    // Pattern B: Distribution Classification Table (e.g. Student's t-distribution: ..., Chi-Square: ..., Fisher's F: ...)
    if (isDistributionLine(curTrimmed)) {
      const distRows: { name: string; symbol: string; use: string }[] = [];
      let lookahead = idx;
      while (lookahead < processedLines.length && (isDistributionLine(processedLines[lookahead].trim()) || !processedLines[lookahead].trim())) {
        const lineStr = processedLines[lookahead].trim();
        if (lineStr) {
          const parsed = parseDistributionLine(lineStr);
          if (parsed) distRows.push(parsed);
        }
        lookahead++;
      }

      if (distRows.length >= 2) {
        cleaned.push("| Distribution | Symbol | Main Use |");
        cleaned.push("| :--- | :---: | :--- |");
        for (const row of distRows) {
          cleaned.push(`| ${row.name} | ${row.symbol} | ${row.use} |`);
        }
        cleaned.push("");
        idx = lookahead;
        continue;
      }
    }

    // Pattern C: Summary Formula Sheet or Statistic / SE Table
    if (/^Concept$/i.test(curTrimmed) && idx + 1 < processedLines.length && /^Formula$/i.test(processedLines[idx + 1].trim())) {
      cleaned.push("| Concept | Formula |");
      cleaned.push("| :--- | :--- |");
      idx += 2;
      while (idx < processedLines.length) {
        const conceptLine = processedLines[idx].trim();
        if (!conceptLine || conceptLine.startsWith("#") || conceptLine.startsWith("##")) break;
        idx++;
        while (idx < processedLines.length && !processedLines[idx].trim()) idx++;
        if (idx >= processedLines.length) break;
        const formulaLine = processedLines[idx].trim();
        if (formulaLine.startsWith("#")) {
          idx--; // Rewind
          break;
        }
        const mathFmt = formulaLine.startsWith("$") ? formulaLine : `$${formulaLine}$`;
        cleaned.push(`| ${conceptLine} | ${mathFmt} |`);
        idx++;
      }
      cleaned.push("");
      continue;
    }

    if (/^Statistic$/i.test(curTrimmed) && idx + 1 < processedLines.length && /^Standard Error Formula/i.test(processedLines[idx + 1].trim())) {
      cleaned.push("| Statistic | Standard Error Formula for a Large or Infinite Population |");
      cleaned.push("| :--- | :--- |");
      idx += 2;
      while (idx < processedLines.length) {
        const statLine = processedLines[idx].trim();
        if (!statLine || statLine.startsWith("#")) break;
        idx++;
        while (idx < processedLines.length && !processedLines[idx].trim()) idx++;
        if (idx >= processedLines.length) break;
        const formulaLine = processedLines[idx].trim();
        if (formulaLine.startsWith("#")) {
          idx--;
          break;
        }
        const mathFmt = formulaLine.startsWith("$") ? formulaLine : `$${formulaLine}$`;
        cleaned.push(`| ${statLine} | ${mathFmt} |`);
        idx++;
      }
      cleaned.push("");
      continue;
    }

    // Pattern D: Standalone Mathematical Formulas on their own line
    // e.g. SE(\bar{x}) = ..., nP > 15, n(1-P) > 15, \bar{X} \sim N(...), etc.
    if (isStandaloneMathLine(curTrimmed) && !curTrimmed.startsWith("$$") && !curTrimmed.startsWith("|") && !curTrimmed.startsWith("#")) {
      const cleanMath = curTrimmed.replace(/^\$+|\$+$/g, '').trim();
      cleaned.push(`\n$$\n${cleanMath}\n$$\n`);
      idx++;
      continue;
    }

    // Pattern E: Main Applications with bold title
    // e.g. Generalization: Rules can be laid down... -> • **Generalization:** Rules can be laid down...
    const appMatch = curTrimmed.match(/^([A-Za-z\s]{3,30}):\s+([A-Z].*)$/);
    if (
      appMatch &&
      !curTrimmed.startsWith("#") &&
      !curTrimmed.startsWith("-") &&
      !curTrimmed.startsWith("•") &&
      !isDefinitionLine(curTrimmed) &&
      /generalization|risk calculation|confidence interval|hypothesis testing|interval probability/i.test(appMatch[1])
    ) {
      cleaned.push(`• **${appMatch[1].trim()}:** ${appMatch[2].trim()}`);
      idx++;
      continue;
    }

    cleaned.push(curLine);
    idx++;
  }

  return cleaned.join("\n");
}

function isDefinitionLine(line: string): boolean {
  return /^(?:[-*•o]\s+)?(Population|Sample|Statistic|Parameter|Sampling Error)\s*(?:\([A-Za-z0-9\\]+\))?:\s+.+/i.test(line);
}

function parseDefinitionLine(line: string): { term: string; def: string } | null {
  const match = line.match(/^(?:[-*•o]\s+)?([^:]+):\s+(.+)$/);
  if (!match) return null;
  let term = match[1].trim();
  let def = match[2].trim();

  // Wrap symbols in term: Population (N) -> Population ($N$), Sample (n) -> Sample ($n$)
  term = term.replace(/\(([Nn]|\\mu|\\sigma|p|P|\\theta|T)\)/g, '($$$1$)');

  return { term, def };
}

function isDistributionLine(line: string): boolean {
  return /^(?:[-*•o]\s+)?(Student['’]s\s*t|Chi-Square|Fisher['’]s\s*F)[^:]*:\s+.+/i.test(line);
}

function parseDistributionLine(line: string): { name: string; symbol: string; use: string } | null {
  const match = line.match(/^(?:[-*•o]\s+)?([^:]+):\s+(.+)$/);
  if (!match) return null;
  const rawName = match[1].trim();
  const use = match[2].trim();

  let name = rawName;
  let symbol = "";

  if (/student/i.test(rawName)) {
    name = "Student’s $t$-distribution";
    symbol = "$t$";
  } else if (/chi/i.test(rawName)) {
    name = "Chi-square distribution";
    symbol = "$\\chi^2$";
  } else if (/fisher/i.test(rawName)) {
    name = "Fisher’s $F$-distribution";
    symbol = "$F$";
  }

  return { name, symbol, use };
}

function isStandaloneMathLine(line: string): boolean {
  // Matches pure equations: SE(\bar{x}) = ..., nP > 15, Z = \frac{...}{...}, etc.
  if (/^(?:SE|Var|E|P)\s*\(.*?\)\s*=\s*.+/i.test(line)) return true;
  if (/^n_?[12]?\s*\(?1?\s*-\s*P_?[12]?\)?\s*>\s*\d+$/i.test(line)) return true;
  if (/^n_?[12]?P_?[12]?\s*>\s*\d+$/i.test(line)) return true;
  if (/^Z\s*=\s*.+/i.test(line)) return true;
  if (/^X\s*\\sim\s*.+/i.test(line)) return true;
  if (/^\\bar\{X\}\s*\\sim\s*.+/i.test(line)) return true;
  if (/^\\bar\{X\}\s*\\approx\s*.+/i.test(line)) return true;
  if (/^\\mu_\\bar\{x\}\s*=\s*.+/i.test(line)) return true;
  if (/^\\sigma_\\bar\{x\}\^2\s*=\s*.+/i.test(line)) return true;
  if (/^\\sigma_\\bar\{x\}\s*=\s*.+/i.test(line)) return true;
  if (/^P\s*\(\|.*?\)\s*$/i.test(line)) return true;
  return false;
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

