import type { Skill, SkillCategory, SkillPriority } from "./types.ts";
import { mathDocxSkill } from "./math-docx/index.ts";
import { pandocMathDocxSkill } from "./pandoc-math-docx/index.ts";
import { statNotationSkill } from "./stat-notation-docx/index.ts";
import { scientificDocxSkill } from "./scientific-docx/index.ts";
import { chemEquationSkill } from "./chem-equation-skill/index.ts";
import { academicManuscriptSkill } from "./academic-manuscript/index.ts";
import { latexTableFormatterSkill } from "./latex-table-formatter/index.ts";
import { citationReferencingSkill } from "./citation-referencing-skill/index.ts";
import { examBankSkill } from "./exam-bank-skill/index.ts";
import { figureCaptionCrossrefSkill } from "./figure-caption-crossref-skill/index.ts";
import { algorithmicPseudocodeSkill } from "./algorithmic-pseudocode-skill/index.ts";
import { markdownCleanerTypographySkill } from "./markdown-cleaner-typography-skill/index.ts";

/**
 * The 12 Canonical Document, Math, and Scientific Skill Repositories
 */
export const ALL_12_SKILLS: Skill[] = [
  // Priority 1: Mathematical / Equation Processing
  mathDocxSkill,
  pandocMathDocxSkill,
  statNotationSkill,

  // Priority 2: Scientific & Chemical Processing
  scientificDocxSkill,
  chemEquationSkill,

  // Priority 3: Academic Manuscript, Tables, Citations, Exams, & Captions
  academicManuscriptSkill,
  latexTableFormatterSkill,
  citationReferencingSkill,
  examBankSkill,
  figureCaptionCrossrefSkill,

  // Priority 4: Computer Science Algorithms & Typography Hygiene
  algorithmicPseudocodeSkill,
  markdownCleanerTypographySkill,
];

export const SKILL_STORAGE_KEY = "format_ai_active_skills_registry_v2";

/**
 * Central Skill Registry
 * Provides thread-safe, persisted registration, retrieval, conflict checking,
 * and category filtering for all 12 skill modules.
 */
export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    // 1. Load built-in 12 skills
    for (const skill of ALL_12_SKILLS) {
      this.skills.set(skill.id, { ...skill });
    }

    // 2. Load custom toggles from localStorage in client runtime
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const saved = window.localStorage.getItem(SKILL_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              const existing = this.skills.get(item.id);
              if (existing) {
                this.skills.set(item.id, {
                  ...existing,
                  enabled: typeof item.enabled === "boolean" ? item.enabled : existing.enabled,
                });
              } else if (item.id && item.name) {
                // Custom third-party skill
                this.skills.set(item.id, item);
              }
            }
          }
        }
      } catch (err) {
        console.warn("FormatAI: Failed to load skill registry settings from localStorage:", err);
      }
    }
  }

  private persist(): void {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const data = Array.from(this.skills.values()).map((s) => ({
          id: s.id,
          enabled: s.enabled,
          isBuiltIn: s.isBuiltIn,
          name: s.name,
          priority: s.priority,
          category: s.category,
        }));
        window.localStorage.setItem(SKILL_STORAGE_KEY, JSON.stringify(data));
      } catch (err) {
        console.warn("FormatAI: Failed to persist skill registry settings:", err);
      }
    }
  }

  /**
   * Returns all 12 registered skills sorted strictly by priority (1 -> 2 -> 3 -> 4)
   */
  public getAllSkills(): Skill[] {
    return Array.from(this.skills.values()).sort((a, b) => a.priority - b.priority);
  }

  /**
   * Returns only currently enabled skills in strict priority order.
   */
  public getEnabledSkills(): Skill[] {
    return this.getAllSkills().filter((s) => s.enabled);
  }

  /**
   * Returns IDs of all enabled skills.
   */
  public getEnabledSkillIds(): string[] {
    return this.getEnabledSkills().map((s) => s.id);
  }

  /**
   * Resolves skill ID aliases (e.g. docx-math-skill or md2docx-math -> math-docx)
   */
  public resolveSkillId(id: string): string {
    if (id === "docx-math-skill" || id === "md2docx-math") return "math-docx";
    return id;
  }

  /**
   * Retrieves a specific skill by unique ID.
   */
  public getSkill(id: string): Skill | undefined {
    return this.skills.get(this.resolveSkillId(id));
  }

  /**
   * Toggles or explicitly sets enabled status of a skill.
   */
  public toggleSkill(id: string, enabled?: boolean): boolean {
    const skill = this.skills.get(this.resolveSkillId(id));
    if (!skill) return false;
    skill.enabled = enabled !== undefined ? enabled : !skill.enabled;
    this.persist();
    return skill.enabled;
  }

  /**
   * Enables all 12 skills.
   */
  public enableAllSkills(): void {
    for (const skill of this.skills.values()) {
      skill.enabled = true;
    }
    this.persist();
  }

  /**
   * Disables all skills.
   */
  public disableAllSkills(): void {
    for (const skill of this.skills.values()) {
      skill.enabled = false;
    }
    this.persist();
  }

  /**
   * Resets a single skill to default state.
   */
  public resetSkill(id: string): boolean {
    const original = ALL_12_SKILLS.find((s) => s.id === id);
    if (original) {
      this.skills.set(id, { ...original, enabled: true });
      this.persist();
      return true;
    }
    return false;
  }

  /**
   * Removes or disables a skill safely.
   */
  public removeSkill(id: string): boolean {
    const skill = this.skills.get(id);
    if (!skill) return false;
    skill.enabled = false;
    this.persist();
    return true;
  }

  /**
   * Resets all skills to default built-in configuration (all enabled).
   */
  public resetAllSkills(): void {
    this.skills.clear();
    for (const skill of ALL_12_SKILLS) {
      this.skills.set(skill.id, { ...skill, enabled: true });
    }
    this.persist();
  }

  /**
   * Checks compatibility and potential conflicts between active skills.
   */
  public checkSkillConflicts(activeSkillIds: string[]): {
    hasConflicts: boolean;
    conflicts: { skillA: string; skillB: string; reason: string }[];
  } {
    const conflicts: { skillA: string; skillB: string; reason: string }[] = [];
    const normalizedIds = activeSkillIds.map((id) => this.resolveSkillId(id));
    const activeSet = new Set(normalizedIds);
    const seenPairs = new Set<string>();

    for (const id of normalizedIds) {
      const skill = this.skills.get(id);
      if (skill && skill.conflictsWith) {
        for (const conflictingId of skill.conflictsWith) {
          const normConflicting = this.resolveSkillId(conflictingId);
          if (activeSet.has(normConflicting)) {
            const pairKey = [id, normConflicting].sort().join("::");
            if (!seenPairs.has(pairKey)) {
              seenPairs.add(pairKey);
              const conflictingSkill = this.skills.get(normConflicting);
              conflicts.push({
                skillA: skill.name,
                skillB: conflictingSkill?.name || normConflicting,
                reason: `Both skills perform competing write operations on mathematical notation (Word OMML vs Pandoc AST).`,
              });
            }
          }
        }
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
    };
  }
}

export const skillRegistry = new SkillRegistry();
