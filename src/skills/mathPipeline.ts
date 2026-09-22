import {
  DetectedMathEntity,
  MathClassificationType,
  MathValidationResult,
} from "./types";

/**
 * 6-Stage Academic Math Pipeline:
 * Detector → Normalizer → Classifier → Engine → Validator → Lock
 */

export interface MathPipelineExecution {
  processedText: string;
  entities: DetectedMathEntity[];
  validation: MathValidationResult;
  mathDensity: number;
  lockMap: Map<string, string>;
}

// Common recognized LaTeX math commands
const KNOWN_LATEX_COMMANDS = new Set([
  "frac", "sqrt", "sum", "prod", "int", "iint", "iiint", "oint", "lim", "infty",
  "leq", "geq", "neq", "approx", "sim", "equiv", "times", "cdot", "div", "pm", "mp",
  "alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota",
  "kappa", "lambda", "mu", "nu", "xi", "pi", "rho", "sigma", "tau", "upsilon",
  "phi", "chi", "psi", "omega", "Gamma", "Delta", "Theta", "Lambda", "Xi", "Pi",
  "Sigma", "Upsilon", "Phi", "Psi", "Omega", "partial", "nabla", "forall", "exists",
  "in", "notin", "subset", "subseteq", "supset", "supseteq", "cup", "cap", "setminus",
  "to", "rightarrow", "leftarrow", "Rightarrow", "Leftarrow", "Leftrightarrow",
  "rightleftharpoons", "mapsto", "operatorname", "mathrm", "mathbf", "mathit",
  "mathcal", "mathbb", "mathsf", "mathtt", "text", "tag", "label", "quad", "qquad",
  "left", "right", "begin", "end", "hat", "bar", "tilde", "vec", "dot", "ddot",
  "overline", "underline", "overbrace", "underbrace", "choose", "binom",
  "sin", "cos", "tan", "cot", "sec", "csc", "arcsin", "arccos", "arctan",
  "sinh", "cosh", "tanh", "exp", "ln", "log", "det", "dim", "ker", "deg",
  "min", "max", "sup", "inf", "arg", "gcd", "hom"
]);

// Stage 1: Detector
export function detectMathEntities(text: string): DetectedMathEntity[] {
  if (!text) return [];

  const entities: DetectedMathEntity[] = [];
  let entityCounter = 0;

  // 1. Display math blocks: $$ ... $$
  const displayRegex = /\$\$([\s\S]*?)\$\$/g;
  let match: RegExpExecArray | null;

  while ((match = displayRegex.exec(text)) !== null) {
    const rawContent = match[1];
    const fullMatch = match[0];
    const id = `eq_display_${++entityCounter}`;
    entities.push({
      id,
      originalText: fullMatch,
      normalizedText: fullMatch,
      classification: "DISPLAY_MATH",
      isDisplay: true,
      startPos: match.index,
      endPos: match.index + fullMatch.length,
      isValid: true,
      lockToken: `%%MATH_LOCK_DISPLAY_${id}%%`,
    });
  }

  // 2. LaTeX display blocks: \[ ... \]
  const texDisplayRegex = /\\\[([\s\S]*?)\\\]/g;
  while ((match = texDisplayRegex.exec(text)) !== null) {
    const rawContent = match[1];
    const fullMatch = match[0];
    // Check if not already matched
    const isOverlapping = entities.some(
      (e) => match!.index >= e.startPos && match!.index < e.endPos
    );
    if (!isOverlapping) {
      const id = `eq_display_${++entityCounter}`;
      entities.push({
        id,
        originalText: fullMatch,
        normalizedText: `$$\n${rawContent.trim()}\n$$`,
        classification: "DISPLAY_MATH",
        isDisplay: true,
        startPos: match.index,
        endPos: match.index + fullMatch.length,
        isValid: true,
        lockToken: `%%MATH_LOCK_DISPLAY_${id}%%`,
      });
    }
  }

  // 3. Environment blocks: \begin{equation|align*|aligned|pmatrix|matrix|cases} ... \end{...}
  const envRegex = /\\begin\{(equation\*?|align\*?|aligned|gather\*?|pmatrix|bmatrix|vmatrix|matrix|cases)\}([\s\S]*?)\\end\{\1\}/g;
  while ((match = envRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const isOverlapping = entities.some(
      (e) => match!.index >= e.startPos && match!.index < e.endPos
    );
    if (!isOverlapping) {
      const id = `eq_env_${++entityCounter}`;
      entities.push({
        id,
        originalText: fullMatch,
        normalizedText: `$$\n${fullMatch.trim()}\n$$`,
        classification: "ALIGNED_EQUATION",
        isDisplay: true,
        startPos: match.index,
        endPos: match.index + fullMatch.length,
        isValid: true,
        lockToken: `%%MATH_LOCK_DISPLAY_${id}%%`,
      });
    }
  }

  // 4. Inline math: $...$ (avoiding double $$ and currency symbols like $50)
  const inlineRegex = /(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/g;
  while ((match = inlineRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const rawInner = match[1];
    const isOverlapping = entities.some(
      (e) => match!.index >= e.startPos && match!.index < e.endPos
    );
    // Discard pure numeric values like $100 or $5.99 which are currencies
    const isCurrency = /^\s*\d+(\.\d{1,2})?\s*$/.test(rawInner);

    if (!isOverlapping && !isCurrency && rawInner.trim().length > 0) {
      const id = `eq_inline_${++entityCounter}`;
      entities.push({
        id,
        originalText: fullMatch,
        normalizedText: fullMatch,
        classification: "INLINE_MATH",
        isDisplay: false,
        startPos: match.index,
        endPos: match.index + fullMatch.length,
        isValid: true,
        lockToken: `%%MATH_LOCK_INLINE_${id}%%`,
      });
    }
  }

  // 5. TeX inline math: \( ... \)
  const texInlineRegex = /\\\(([\s\S]*?)\\\)/g;
  while ((match = texInlineRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const rawInner = match[1];
    const isOverlapping = entities.some(
      (e) => match!.index >= e.startPos && match!.index < e.endPos
    );
    if (!isOverlapping && rawInner.trim().length > 0) {
      const id = `eq_inline_${++entityCounter}`;
      entities.push({
        id,
        originalText: fullMatch,
        normalizedText: `$${rawInner.trim()}$`,
        classification: "INLINE_MATH",
        isDisplay: false,
        startPos: match.index,
        endPos: match.index + fullMatch.length,
        isValid: true,
        lockToken: `%%MATH_LOCK_INLINE_${id}%%`,
      });
    }
  }

  // Sort entities by their position in the text
  return entities.sort((a, b) => a.startPos - b.startPos);
}

// Stage 2: Normalizer
export function normalizeMathEntity(entity: DetectedMathEntity): DetectedMathEntity {
  let inner = entity.originalText;

  // Extract raw inner expression without delimiters
  if (inner.startsWith("$$") && inner.endsWith("$$")) {
    inner = inner.slice(2, -2).trim();
  } else if (inner.startsWith("\\[") && inner.endsWith("\\]")) {
    inner = inner.slice(2, -2).trim();
  } else if (inner.startsWith("\\(") && inner.endsWith("\\)")) {
    inner = inner.slice(2, -2).trim();
  } else if (inner.startsWith("$") && inner.endsWith("$")) {
    inner = inner.slice(1, -1).trim();
  }

  // 1. Fix broken line-breaks inside commands: \frac{\n numerator}{\n denominator}
  inner = inner.replace(/\\frac\s*\{\s*([^{}]+?)\s*\}\s*\{\s*([^{}]+?)\s*\}/g, "\\frac{$1}{$2}");

  // 2. Fix missing braces on simple fractions: \frac12 -> \frac{1}{2}, \frac1{n} -> \frac{1}{n}
  inner = inner.replace(/\\frac\s*([0-9a-zA-Z])\s*\{/g, "\\frac{$1}{");
  inner = inner.replace(/\\frac\s*([0-9a-zA-Z])([0-9a-zA-Z])/g, "\\frac{$1}{$2}");

  // 3. Fix missing braces on square roots: \sqrt n -> \sqrt{n}
  inner = inner.replace(/\\sqrt\s+([0-9a-zA-Z])\b/g, "\\sqrt{$1}");

  // 4. Fix missing braces on Greek superscripts: \chi^2_1 -> \chi^2_{1}
  inner = inner.replace(/\\chi\^2_([0-9a-zA-Z])/g, "\\chi^2_{$1}");

  // 5. Standardize statistical operators
  inner = inner.replace(/\bVar\s*\(([^()]+)\)/g, "\\operatorname{Var}($1)");
  inner = inner.replace(/\bCov\s*\(([^()]+)\)/g, "\\operatorname{Cov}($1)");
  inner = inner.replace(/\brank\s*\(([^()]+)\)/g, "\\operatorname{rank}($1)");
  inner = inner.replace(/\bmode\s*\(([^()]+)\)/g, "\\operatorname{mode}($1)");

  // 6. Fix Unicode accents inside math
  inner = inner.replace(/p̂/g, "\\hat{p}");
  inner = inner.replace(/X̄/g, "\\bar{X}");
  inner = inner.replace(/x̄/g, "\\bar{x}");
  inner = inner.replace(/μ̂/g, "\\hat{\\mu}");
  inner = inner.replace(/σ̂/g, "\\hat{\\sigma}");

  // 7. Clean excessive internal spaces
  inner = inner.replace(/\s+/g, " ");

  // Re-wrap with standard delimiters
  const normalizedText = entity.isDisplay ? `$$\n${inner}\n$$` : `$${inner}$`;

  return {
    ...entity,
    normalizedText,
  };
}

// Stage 3: Classifier
export function classifyMathEntity(entity: DetectedMathEntity): MathClassificationType {
  const content = entity.normalizedText;

  if (/\\begin\{(pmatrix|bmatrix|vmatrix|matrix)\}/.test(content)) {
    return "MATRIX_VECTOR";
  }
  if (/\\begin\{cases\}/.test(content)) {
    return "PIECEWISE_CASES";
  }
  if (/\\begin\{(align\*?|aligned|gather\*?)\}/.test(content) || /\\\\/.test(content)) {
    return "ALIGNED_EQUATION";
  }
  if (
    /\\operatorname\{(Var|Cov|Corr|rank)\}/.test(content) ||
    /\\(bar\{X\}|hat\{p\}|sigma|mu|sim|mathcal\{N\})/.test(content) ||
    /H_[01a]/.test(content)
  ) {
    return "STATISTICAL_FORMULA";
  }
  if (/(\\rightarrow|\\rightleftharpoons|\\ce\{|\b(H_2O|CO_2|NaCl|CaCO_3)\b)/.test(content)) {
    return "CHEMICAL_REACTION";
  }
  if (entity.isDisplay) {
    return "DISPLAY_MATH";
  }
  return "INLINE_MATH";
}

// Stage 4: Engine Formatting (OMML/Word Optimization)
export function engineFormatMath(entity: DetectedMathEntity): DetectedMathEntity {
  let formatted = entity.normalizedText;

  // Ensure matrices have correct spacing and no trailing newlines
  if (entity.classification === "MATRIX_VECTOR") {
    formatted = formatted.replace(/\s*\\\\\s*\\end\{/g, " \\end{");
  }

  // Ensure display math equations are clean
  if (entity.isDisplay) {
    formatted = formatted.trim();
  }

  return {
    ...entity,
    normalizedText: formatted,
  };
}

// Stage 5: Validator (Quality Gate: 95% Target + Zero Silent Math Downgrades)
export function validateMathEntity(entity: DetectedMathEntity): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const text = entity.normalizedText;

  // 1. Check brace balance
  let braceCount = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{" && (i === 0 || text[i - 1] !== "\\")) braceCount++;
    if (text[i] === "}" && (i === 0 || text[i - 1] !== "\\")) braceCount--;
    if (braceCount < 0) {
      issues.push("Premature closing brace '}' without opening brace.");
      break;
    }
  }
  if (braceCount > 0) {
    issues.push(`Unclosed curly brace '{' (${braceCount} remaining).`);
  }

  // 2. Check parenthesis balance
  let parenCount = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "(" && (i === 0 || text[i - 1] !== "\\")) parenCount++;
    if (text[i] === ")" && (i === 0 || text[i - 1] !== "\\")) parenCount--;
  }
  if (parenCount !== 0) {
    issues.push("Unbalanced parentheses inside mathematical formula.");
  }

  // 3. Check environment matching: \begin{X} matched with \end{X}
  const begins = (text.match(/\\begin\{([^}]+)\}/g) || []).map((m) =>
    m.replace(/\\begin\{([^}]+)\}/, "$1")
  );
  const ends = (text.match(/\\end\{([^}]+)\}/g) || []).map((m) =>
    m.replace(/\\end\{([^}]+)\}/, "$1")
  );

  if (begins.length !== ends.length) {
    issues.push(
      `Mismatched LaTeX environments: ${begins.length} \\begin vs ${ends.length} \\end.`
    );
  } else {
    for (let i = 0; i < begins.length; i++) {
      if (!ends.includes(begins[i])) {
        issues.push(`Unclosed environment \\begin{${begins[i]}}.`);
      }
    }
  }

  // 4. Verify no non-trivial equations degraded to empty strings or plain text
  if (text.replace(/[\$\s]/g, "").length === 0) {
    issues.push("Empty equation block detected.");
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

// Stage 6: Lock and Unlock
export function lockMathExpressions(
  text: string,
  entities: DetectedMathEntity[]
): { lockedText: string; lockMap: Map<string, string> } {
  let lockedText = text;
  const lockMap = new Map<string, string>();

  // Process in reverse order so string replacement doesn't shift earlier character indices
  const reversed = [...entities].sort((a, b) => b.startPos - a.startPos);

  for (const entity of reversed) {
    lockMap.set(entity.lockToken, entity.normalizedText);
    lockedText =
      lockedText.substring(0, entity.startPos) +
      entity.lockToken +
      lockedText.substring(entity.endPos);
  }

  return { lockedText, lockMap };
}

export function unlockMathExpressions(
  text: string,
  lockMap: Map<string, string>
): string {
  let result = text;
  lockMap.forEach((originalMath, token) => {
    // Replace all instances of the token
    result = result.split(token).join(originalMath);
  });
  return result;
}

/**
 * Executes the complete 6-stage Math Pipeline
 */
export function executeMathPipeline(text: string): MathPipelineExecution {
  if (!text) {
    return {
      processedText: "",
      entities: [],
      validation: {
        totalEquations: 0,
        validEquations: 0,
        validationScore: 100,
        meetsTarget: true,
        syntaxErrors: [],
        warnings: [],
        hasDegradedMath: false,
      },
      mathDensity: 0,
      lockMap: new Map(),
    };
  }

  // 1. Detect
  const detected = detectMathEntities(text);

  // Calculate math density
  const totalLength = text.length;
  const mathChars = detected.reduce((acc, e) => acc + (e.endPos - e.startPos), 0);
  const mathDensity = totalLength > 0 ? mathChars / totalLength : 0;

  // 2. Normalize, Classify, Engine Format, and Validate
  const processedEntities: DetectedMathEntity[] = detected.map((entity) => {
    const normalized = normalizeMathEntity(entity);
    const classification = classifyMathEntity(normalized);
    const engineFormatted = engineFormatMath({ ...normalized, classification });
    const validation = validateMathEntity(engineFormatted);

    return {
      ...engineFormatted,
      isValid: validation.isValid,
      validationIssues: validation.issues,
    };
  });

  // Calculate quality gate validation metrics
  const total = processedEntities.length;
  const valid = processedEntities.filter((e) => e.isValid).length;
  const score = total > 0 ? (valid / total) * 100 : 100;
  const syntaxErrors: { equationId: string; raw: string; issue: string }[] = [];

  processedEntities.forEach((e) => {
    if (!e.isValid && e.validationIssues) {
      e.validationIssues.forEach((issue) => {
        syntaxErrors.push({
          equationId: e.id,
          raw: e.originalText,
          issue,
        });
      });
    }
  });

  const validationResult: MathValidationResult = {
    totalEquations: total,
    validEquations: valid,
    validationScore: parseFloat(score.toFixed(1)),
    meetsTarget: score >= 95.0,
    syntaxErrors,
    warnings:
      score < 95.0
        ? [`Math validation score (${score.toFixed(1)}%) is below 95% target. Review flagged syntax errors.`]
        : [],
    hasDegradedMath: false,
  };

  // 6. Lock
  const { lockedText, lockMap } = lockMathExpressions(text, processedEntities);

  return {
    processedText: lockedText,
    entities: processedEntities,
    validation: validationResult,
    mathDensity,
    lockMap,
  };
}
