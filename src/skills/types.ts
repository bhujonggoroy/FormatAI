export type SkillPriority = 1 | 2 | 3 | 4;

export type SkillCategory =
  | "mathematics"
  | "scientific"
  | "academic"
  | "pandoc"
  | "general";

export type SkillMode = "auto" | "manual" | "all_on";

export type MathClassificationType =
  | "INLINE_MATH"
  | "DISPLAY_MATH"
  | "ALIGNED_EQUATION"
  | "MATRIX_VECTOR"
  | "PIECEWISE_CASES"
  | "STATISTICAL_FORMULA"
  | "CHEMICAL_REACTION";

export interface SkillRule {
  id: string;
  name: string;
  description: string;
  exampleInput?: string;
  exampleOutput?: string;
}

export interface Skill {
  id: string;
  name: string;
  shortName: string;
  version: string;
  author: string;
  repositoryUrl: string;
  license?: string;
  role?: string;
  description: string;
  priority: SkillPriority; // 1: Math, 2: Scientific, 3: Academic, 4: Text/General
  category: SkillCategory;
  enabled: boolean;
  isBuiltIn: boolean;
  features: string[];
  rules: SkillRule[];
  conflictsWith?: string[];
  tags?: string[];
  systemPromptInstruction: string;
  transformText?: (text: string, options?: Record<string, any>) => string;
  transformDocxOptions?: (options: Record<string, any>) => Record<string, any>;
}

export interface DetectedMathEntity {
  id: string;
  originalText: string;
  normalizedText: string;
  classification: MathClassificationType;
  isDisplay: boolean;
  startPos: number;
  endPos: number;
  isValid: boolean;
  validationIssues?: string[];
  lockToken: string;
}

export interface MathValidationResult {
  totalEquations: number;
  validEquations: number;
  validationScore: number; // percentage, e.g. 98.5
  meetsTarget: boolean; // >= 95%
  syntaxErrors: { equationId: string; raw: string; issue: string }[];
  warnings: string[];
  hasDegradedMath: boolean;
}

export interface SkillPipelineResult {
  text: string;
  executedSkillIds: string[];
  appliedTransformations: {
    skillId: string;
    skillName: string;
    summary: string;
  }[];
  mathValidation?: MathValidationResult;
  mode?: SkillMode;
}

export interface OrchestrationReport {
  mode: SkillMode;
  inputLength: number;
  outputLength: number;
  activeSkillIds: string[];
  detectedCategories: SkillCategory[];
  mathValidation: MathValidationResult;
  appliedSteps: {
    stage: string;
    skillId?: string;
    description: string;
    timeMs?: number;
  }[];
  warnings: string[];
  safetyVerified: boolean;
}
