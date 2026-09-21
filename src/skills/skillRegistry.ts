import { Skill, SkillPriority } from "./types";
import { mathDocxSkill } from "./math-docx";
import { scientificDocxSkill } from "./scientific-docx";
import { pandocMathDocxSkill } from "./pandoc-math-docx";
import { academicManuscriptSkill } from "./academic-manuscript";

export const BUILT_IN_SKILLS: Skill[] = [
  mathDocxSkill,
  scientificDocxSkill,
  pandocMathDocxSkill,
  academicManuscriptSkill,
];

const STORAGE_KEY = "notebooklm_docx_active_skills_v1";

export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();

  constructor() {
    this.initialize();
  }

  private initialize() {
    // 1. Load built-in skills
    for (const skill of BUILT_IN_SKILLS) {
      this.skills.set(skill.id, { ...skill });
    }

    // 2. Load overrides from localStorage if running in browser
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
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
                // Custom imported skill
                this.skills.set(item.id, item);
              }
            }
          }
        }
      } catch (err) {
        console.warn("Failed to load skills from localStorage:", err);
      }
    }
  }

  private persist() {
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
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (err) {
        console.warn("Failed to persist skills to localStorage:", err);
      }
    }
  }

  /**
   * Returns all registered skills sorted strictly by priority order:
   * 1. Mathematical/Equation processing
   * 2. Scientific formatting
   * 3. Academic manuscript formatting
   * 4. General text formatting
   */
  public getAllSkills(): Skill[] {
    return Array.from(this.skills.values()).sort((a, b) => a.priority - b.priority);
  }

  /**
   * Returns only enabled skills in strict priority order.
   */
  public getEnabledSkills(): Skill[] {
    return this.getAllSkills().filter((s) => s.enabled);
  }

  /**
   * Returns IDs of all enabled skills in strict priority order.
   */
  public getEnabledSkillIds(): string[] {
    return this.getEnabledSkills().map((s) => s.id);
  }

  public getSkill(id: string): Skill | undefined {
    return this.skills.get(id);
  }

  /**
   * Toggles or sets the enabled status of a skill.
   */
  public toggleSkill(id: string, enabled?: boolean): boolean {
    const skill = this.skills.get(id);
    if (!skill) return false;
    skill.enabled = enabled !== undefined ? enabled : !skill.enabled;
    this.persist();
    return skill.enabled;
  }

  /**
   * Removes a skill (or disables it if built-in).
   */
  public removeSkill(id: string): boolean {
    const skill = this.skills.get(id);
    if (!skill) return false;
    if (skill.isBuiltIn) {
      skill.enabled = false;
    } else {
      this.skills.delete(id);
    }
    this.persist();
    return true;
  }

  /**
   * Re-imports or resets a skill to its original default repository configuration.
   */
  public resetSkill(id: string): boolean {
    const original = BUILT_IN_SKILLS.find((s) => s.id === id);
    if (original) {
      this.skills.set(id, { ...original });
      this.persist();
      return true;
    }
    return false;
  }

  /**
   * Resets all skills to their original default states (all enabled).
   */
  public resetAllSkills(): void {
    this.skills.clear();
    for (const skill of BUILT_IN_SKILLS) {
      this.skills.set(skill.id, { ...skill, enabled: true });
    }
    this.persist();
  }

  /**
   * Adds or updates a custom skill.
   */
  public addOrUpdateSkill(skill: Skill): void {
    this.skills.set(skill.id, skill);
    this.persist();
  }
}

export const skillRegistry = new SkillRegistry();
