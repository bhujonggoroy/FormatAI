import {
  Skill,
  SkillMode,
  SkillCategory,
  OrchestrationReport,
  SkillPipelineResult,
} from "./types";
import { skillRegistry, ALL_12_SKILLS } from "./registry";
import {
  executeMathPipeline,
  unlockMathExpressions,
  MathPipelineExecution,
} from "./mathPipeline";

/**
 * Skill Orchestrator
 * Coordinates the 12 document, mathematical, and scientific skills across:
 * - AUTO DETECT mode
 * - SMART MANUAL mode
 * - ALL ON mode
 * 
 * Enforces the 6-stage Math Pipeline (Detector -> Normalizer -> Classifier -> Engine -> Validator -> Lock)
 * to guarantee that mathematical formulas are never silently degraded or corrupted.
 */
const SKILL_MODE_STORAGE_KEY = "format_ai_skill_orchestrator_mode_v2";

export class SkillOrchestrator {
  private currentMode: SkillMode = "auto";

  constructor() {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const saved = window.localStorage.getItem(SKILL_MODE_STORAGE_KEY);
        if (saved === "auto" || saved === "manual" || saved === "all_on") {
          this.currentMode = saved;
        }
      } catch (err) {
        console.warn("FormatAI: Failed to load skill orchestrator mode from localStorage:", err);
      }
    }
  }

  public setMode(mode: SkillMode): void {
    this.currentMode = mode;
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem(SKILL_MODE_STORAGE_KEY, mode);
      } catch (err) {
        console.warn("FormatAI: Failed to save skill orchestrator mode to localStorage:", err);
      }
    }
  }

  public getMode(): SkillMode {
    return this.currentMode;
  }

  /**
   * Analyzes document text to detect categories and select optimal skills for AUTO DETECT mode.
   */
  public analyzeContentForAutoDetect(text: string): {
    selectedSkillIds: string[];
    detectedCategories: SkillCategory[];
    signals: string[];
  } {
    if (!text || text.trim().length === 0) {
      return {
        selectedSkillIds: ["markdown-cleaner-typography-skill"],
        detectedCategories: ["general"],
        signals: ["Empty document; default typography cleaner active"],
      };
    }

    const selectedIds = new Set<string>();
    const detectedCategories = new Set<SkillCategory>();
    const signals: string[] = [];

    // Always include typography and document hygiene
    selectedIds.add("markdown-cleaner-typography-skill");
    detectedCategories.add("general");

    // 1. Check for Mathematics
    const hasLatex =
      /\$|\\\(|\\\[|\\begin\{(equation|align|matrix|cases)/.test(text) ||
      /\\(frac|sqrt|sum|prod|int|lim|infty)/.test(text);
    if (hasLatex) {
      selectedIds.add("math-docx");
      selectedIds.add("pandoc-math-docx");
      detectedCategories.add("mathematics");
      detectedCategories.add("pandoc");
      signals.push("Detected LaTeX mathematical equations and delimiters");
    }

    // 2. Check for Statistical / Probability Notation
    const hasStats =
      /\b(Var|Cov|Corr|rank|mode)\b/i.test(text) ||
      /\b(p̂|X̄|x̄|s\^2|sigma\^2|mu|sampling distribution|hypothesis|H0|H1)\b/i.test(text) ||
      /\\(hat\{p\}|bar\{X\}|sigma|mu|operatorname\{Var\})/.test(text);
    if (hasStats) {
      selectedIds.add("stat-notation-docx");
      detectedCategories.add("mathematics");
      signals.push("Detected statistical estimators, parameters, or hypothesis testing");
    }

    // 3. Check for Chemistry & Reactions
    const hasChem =
      /\b(H2O|CO2|H2SO4|NaCl|CaCO3|C6H12O6|NaOH|HCl)\b/.test(text) ||
      /\\(rightarrow|rightleftharpoons|ce\{)/.test(text) ||
      /\b(mol\/L|kJ\/mol|aqueous|\(aq\)|\(s\)|\(l\)|\(g\))\b/.test(text);
    if (hasChem) {
      selectedIds.add("chem-equation-skill");
      detectedCategories.add("scientific");
      signals.push("Detected chemical formulas, stoichiometry, or reaction arrows");
    }

    // 4. Check for Scientific Measurement Units & Notation
    const hasScientific =
      /\b(m\/s\^?2|kg\/m\^?3|kJ|MPa|kPa|GHz|MHz|kHz|μm|nm)\b/.test(text) ||
      /\d+\s*[x×]\s*10\^[-+]?\d+/.test(text) ||
      /\b[0-9.]+\s*e[-+]?\d+\b/i.test(text) ||
      /[±\+\/-]\s*\d+(\.\d+)?\b/.test(text);
    if (hasScientific) {
      selectedIds.add("scientific-docx");
      detectedCategories.add("scientific");
      signals.push("Detected SI units, exponential notation, or measurement uncertainties");
    }

    // 5. Check for Tables
    const hasTables =
      /\|.*\|/.test(text) && /\|[-:\s|]+\|/.test(text);
    if (hasTables) {
      selectedIds.add("latex-table-formatter");
      detectedCategories.add("academic");
      signals.push("Detected table structures (Booktabs formatting engaged)");
    }

    // 6. Check for Academic Manuscript structure
    const hasManuscript =
      /\b(Abstract|Keywords|Introduction|Methodology|Results|Discussion|References)\b/i.test(text) ||
      /^#+\s*(\d+\.?\s*)?(Introduction|Background|Methods|Results)/im.test(text);
    if (hasManuscript) {
      selectedIds.add("academic-manuscript");
      detectedCategories.add("academic");
      signals.push("Detected academic manuscript sections and IMRAD organization");
    }

    // 7. Check for Citations
    const hasCitations =
      /\[\d+(?:[,\s–-]\s*\d+)*\]/.test(text) ||
      /\([A-Z][a-z]+(?: et al\.)?, \d{4}\)/.test(text) ||
      /\bReferences\b/i.test(text);
    if (hasCitations) {
      selectedIds.add("citation-referencing-skill");
      detectedCategories.add("academic");
      signals.push("Detected academic citations or reference lists");
    }

    // 8. Check for Exam / Question Paper structure
    const hasExam =
      /\b(Question\s*\d+|Q\d+\.|Course Code|Marks|Time Allowed)\b/i.test(text) ||
      /\[\d+\s*marks?\]/i.test(text);
    if (hasExam) {
      selectedIds.add("exam-bank-skill");
      detectedCategories.add("academic");
      signals.push("Detected university exam paper structure or question bank");
    }

    // 9. Check for Figure / Table Captions
    const hasCaptions =
      /\b(Figure\s*\d+|Fig\.\s*\d+|Table\s*\d+):/i.test(text) ||
      /\b(see\s+(Figure|Table|Equation)\s*\d+)\b/i.test(text);
    if (hasCaptions) {
      selectedIds.add("figure-caption-crossref-skill");
      detectedCategories.add("academic");
      signals.push("Detected scientific figure/table captions or cross-references");
    }

    // 10. Check for Algorithms / Pseudocode
    const hasAlgorithms =
      /\b(Algorithm\s*\d+|Pseudocode|Input:|Output:|Require:|Ensure:)\b/i.test(text) ||
      /\b(O\(n\)|O\(log n\)|\mathcal{O}\(|Q\.E\.D\.)\b/.test(text);
    if (hasAlgorithms) {
      selectedIds.add("algorithmic-pseudocode-skill");
      detectedCategories.add("general");
      signals.push("Detected algorithm pseudocode, Big-O complexity, or proof blocks");
    }

    return {
      selectedSkillIds: Array.from(selectedIds),
      detectedCategories: Array.from(detectedCategories),
      signals,
    };
  }

  /**
   * Resolves the active skills list based on mode and optional explicit skillIds.
   */
  public resolveActiveSkills(
    text: string,
    modeOverride?: SkillMode,
    skillIdsOverride?: string[]
  ): {
    skills: Skill[];
    mode: SkillMode;
    detectedCategories: SkillCategory[];
    signals: string[];
  } {
    const effectiveMode = modeOverride || this.currentMode;

    if (skillIdsOverride && skillIdsOverride.length > 0) {
      const explicitSkills = skillRegistry
        .getAllSkills()
        .filter((s) => skillIdsOverride.includes(s.id));
      const categories = Array.from(new Set(explicitSkills.map((s) => s.category)));
      return {
        skills: explicitSkills,
        mode: effectiveMode === "auto" ? "manual" : effectiveMode,
        detectedCategories: categories,
        signals: [`Explicit skills selection: ${explicitSkills.length} skills active.`],
      };
    }

    if (effectiveMode === "all_on") {
      const allSkills = skillRegistry.getAllSkills();
      return {
        skills: allSkills,
        mode: "all_on",
        detectedCategories: ["mathematics", "scientific", "academic", "pandoc", "general"],
        signals: ["ALL ON mode active: All 12 skills engaged under sequential priority control."],
      };
    }

    if (effectiveMode === "manual") {
      const manualEnabled = skillRegistry.getEnabledSkills();
      const categories = Array.from(new Set(manualEnabled.map((s) => s.category)));
      return {
        skills: manualEnabled,
        mode: "manual",
        detectedCategories: categories,
        signals: [`SMART MANUAL mode: ${manualEnabled.length} of 12 skills enabled by user.`],
      };
    }

    // Default: AUTO DETECT
    const analysis = this.analyzeContentForAutoDetect(text);
    const selectedSkills = skillRegistry
      .getAllSkills()
      .filter((s) => analysis.selectedSkillIds.includes(s.id));

    return {
      skills: selectedSkills,
      mode: "auto",
      detectedCategories: analysis.detectedCategories,
      signals: analysis.signals,
    };
  }

  /**
   * Main Orchestration Execution:
   * 1. Detect & Select active skills according to Mode
   * 2. Run 6-stage Math Pipeline to validate and LOCK all mathematical/scientific expressions
   * 3. Sequentially apply active skills in strict priority order (1 -> 2 -> 3 -> 4)
   * 4. UNLOCK the validated math expressions back into the document
   * 5. Verify quality gate target (95% target, no silent downgrades)
   */
  public orchestrate(
    text: string,
    options: {
      mode?: SkillMode;
      skillIds?: string[];
      customDocxOptions?: Record<string, any>;
    } = {}
  ): {
    result: SkillPipelineResult;
    report: OrchestrationReport;
  } {
    const startTime = Date.now();
    const appliedSteps: { stage: string; skillId?: string; description: string; timeMs?: number }[] = [];
    const warnings: string[] = [];

    if (!text || text.trim().length === 0) {
      return {
        result: {
          text: "",
          executedSkillIds: [],
          appliedTransformations: [],
          mode: options.mode || this.currentMode,
        },
        report: {
          mode: options.mode || this.currentMode,
          inputLength: 0,
          outputLength: 0,
          activeSkillIds: [],
          detectedCategories: [],
          mathValidation: {
            totalEquations: 0,
            validEquations: 0,
            validationScore: 100,
            meetsTarget: true,
            syntaxErrors: [],
            warnings: [],
            hasDegradedMath: false,
          },
          appliedSteps: [],
          warnings: [],
          safetyVerified: true,
        },
      };
    }

    // Step 1: Resolve Active Skills based on Mode
    const { skills: activeSkills, mode, detectedCategories, signals } = this.resolveActiveSkills(
      text,
      options.mode,
      options.skillIds
    );

    appliedSteps.push({
      stage: "Routing & Discovery",
      description: `Resolved ${activeSkills.length} skills in ${mode.toUpperCase()} mode. Signals: ${signals.join("; ")}`,
      timeMs: Date.now() - startTime,
    });

    // Step 2: Math Pipeline Execution (Detector -> Normalizer -> Classifier -> Engine -> Validator -> Lock)
    const mathStart = Date.now();
    const mathExecution: MathPipelineExecution = executeMathPipeline(text);

    appliedSteps.push({
      stage: "Math Pipeline",
      description: `Processed ${mathExecution.entities.length} math entities with validation score ${mathExecution.validation.validationScore}%. Math Lock tokens applied.`,
      timeMs: Date.now() - mathStart,
    });

    if (!mathExecution.validation.meetsTarget) {
      warnings.push(
        `Math validation score (${mathExecution.validation.validationScore}%) is below 95% threshold. Please review flagged equations.`
      );
    }

    // Step 3: Sequential Skill Transformation on Math-Locked Text
    // Priority order: 1 (Math rules) -> 2 (Scientific rules) -> 3 (Academic rules) -> 4 (General/Typography rules)
    const orderedSkills = [...activeSkills].sort((a, b) => a.priority - b.priority);
    let workingText = mathExecution.processedText;
    const executedSkillIds: string[] = [];
    const appliedTransformations: { skillId: string; skillName: string; summary: string }[] = [];

    for (const skill of orderedSkills) {
      if (typeof skill.transformText === "function") {
        const stageStart = Date.now();
        const beforeText = workingText;
        const afterText = skill.transformText(workingText);

        executedSkillIds.push(skill.id);

        if (afterText !== beforeText) {
          workingText = afterText;
          appliedTransformations.push({
            skillId: skill.id,
            skillName: skill.name,
            summary: `Applied priority ${skill.priority} rules (${skill.shortName})`,
          });

          appliedSteps.push({
            stage: `Priority ${skill.priority}: ${skill.shortName}`,
            skillId: skill.id,
            description: `Applied ${skill.name} rules to document structure`,
            timeMs: Date.now() - stageStart,
          });
        }
      }
    }

    // Step 4: Unlock Validated Mathematical Expressions
    const unlockStart = Date.now();
    const restoredText = unlockMathExpressions(workingText, mathExecution.lockMap);

    appliedSteps.push({
      stage: "Math Unlock & Synthesis",
      description: `Restored ${mathExecution.lockMap.size} locked equations into document without corruption.`,
      timeMs: Date.now() - unlockStart,
    });

    // Step 5: Verify Non-Degradation
    // Ensure that all originally detected equations are present in the final output
    let degradationDetected = false;
    for (const entity of mathExecution.entities) {
      if (!restoredText.includes(entity.normalizedText) && !restoredText.includes(entity.originalText)) {
        degradationDetected = true;
        warnings.push(`Potential math degradation warning: Equation ${entity.id} was altered unexpectedly.`);
      }
    }

    const finalValidation = {
      ...mathExecution.validation,
      hasDegradedMath: degradationDetected,
    };

    const report: OrchestrationReport = {
      mode,
      inputLength: text.length,
      outputLength: restoredText.length,
      activeSkillIds: executedSkillIds,
      detectedCategories,
      mathValidation: finalValidation,
      appliedSteps,
      warnings,
      safetyVerified: !degradationDetected,
    };

    return {
      result: {
        text: restoredText,
        executedSkillIds,
        appliedTransformations,
        mathValidation: finalValidation,
        mode,
      },
      report,
    };
  }

  /**
   * Combines system prompt instructions from enabled skills in priority order.
   */
  public getCombinedSystemPrompt(
    mode?: SkillMode,
    customText?: string,
    enabledSkillIds?: string[]
  ): string {
    const { skills } = this.resolveActiveSkills(customText || "", mode, enabledSkillIds);
    const ordered = [...skills].sort((a, b) => a.priority - b.priority);

    const sections = ordered.map(
      (skill) =>
        `### [Priority ${skill.priority}] ${skill.name} (${skill.shortName})\n${skill.systemPromptInstruction}`
    );

    return sections.join("\n\n");
  }
}

export const skillOrchestrator = new SkillOrchestrator();
