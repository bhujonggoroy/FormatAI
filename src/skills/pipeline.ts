import { Skill, SkillPipelineResult } from "./types";
import { skillRegistry } from "./skillRegistry";

/**
 * Executes enabled skills sequentially in strict priority order:
 * 1. Mathematical / Equation processing
 * 2. Scientific formatting
 * 3. Academic manuscript formatting
 * 4. General text formatting
 */
export function executeSkillPipeline(
  text: string,
  enabledSkillIds?: string[]
): SkillPipelineResult {
  if (!text) {
    return {
      text: "",
      executedSkillIds: [],
      appliedTransformations: [],
    };
  }

  // Retrieve enabled skills (filtered by enabledSkillIds if provided)
  const allEnabled = skillRegistry.getEnabledSkills();
  const activeSkills = enabledSkillIds
    ? allEnabled.filter((s) => enabledSkillIds.includes(s.id))
    : allEnabled;

  // Strict sort by priority (1 -> 2 -> 3 -> 4)
  const orderedSkills = [...activeSkills].sort((a, b) => a.priority - b.priority);

  let currentText = text;
  const executedSkillIds: string[] = [];
  const appliedTransformations: { skillId: string; skillName: string; summary: string }[] = [];

  for (const skill of orderedSkills) {
    if (typeof skill.transformText === "function") {
      const transformed = skill.transformText(currentText);
      if (transformed !== currentText) {
        appliedTransformations.push({
          skillId: skill.id,
          skillName: skill.name,
          summary: `Applied priority ${skill.priority} rules (${skill.shortName})`,
        });
        currentText = transformed;
      }
      executedSkillIds.push(skill.id);
    }
  }

  return {
    text: currentText,
    executedSkillIds,
    appliedTransformations,
  };
}

/**
 * Combines system prompt instructions from enabled skills into a unified prompt
 * ordered by priority for AI multi-provider requests.
 */
export function getCombinedSkillPromptInstructions(enabledSkillIds?: string[]): string {
  const allEnabled = skillRegistry.getEnabledSkills();
  const activeSkills = enabledSkillIds
    ? allEnabled.filter((s) => enabledSkillIds.includes(s.id))
    : allEnabled;

  // Sort by priority
  const orderedSkills = [...activeSkills].sort((a, b) => a.priority - b.priority);

  const sections = orderedSkills.map(
    (skill) =>
      `### [Priority ${skill.priority}] ${skill.name} (${skill.shortName})\n${skill.systemPromptInstruction}`
  );

  return sections.join("\n\n");
}

/**
 * Merges DOCX styling options with active skills (e.g. academic Booktabs table formatting)
 */
export function getActiveDocxOptions(
  baseOptions: Record<string, any> = {},
  enabledSkillIds?: string[]
): Record<string, any> {
  const allEnabled = skillRegistry.getEnabledSkills();
  const activeSkills = enabledSkillIds
    ? allEnabled.filter((s) => enabledSkillIds.includes(s.id))
    : allEnabled;

  let options = { ...baseOptions };
  for (const skill of activeSkills) {
    if (typeof skill.transformDocxOptions === "function") {
      options = skill.transformDocxOptions(options);
    }
  }
  return options;
}
