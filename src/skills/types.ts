export type SkillPriority = 1 | 2 | 3 | 4;

export type SkillCategory = "mathematics" | "scientific" | "academic" | "pandoc" | "general";

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
  description: string;
  priority: SkillPriority; // 1: Math, 2: Scientific, 3: Academic, 4: Text
  category: SkillCategory;
  enabled: boolean;
  isBuiltIn: boolean;
  features: string[];
  rules: SkillRule[];
  systemPromptInstruction: string;
  transformText?: (text: string, options?: Record<string, any>) => string;
  transformDocxOptions?: (options: Record<string, any>) => Record<string, any>;
}

export interface SkillPipelineResult {
  text: string;
  executedSkillIds: string[];
  appliedTransformations: { skillId: string; skillName: string; summary: string }[];
}
