import { SkillPipelineResult, SkillMode } from "./types";
import { skillRegistry } from "./registry";
import { skillOrchestrator } from "./orchestrator";

/**
 * Executes enabled skills sequentially with the 6-stage Math Pipeline and safe orchestration.
 * 
 * Supports AUTO DETECT, SMART MANUAL, and ALL ON modes.
 */
export function executeSkillPipeline(
  text: string,
  enabledSkillIds?: string[],
  mode?: SkillMode
): SkillPipelineResult {
  if (!text) {
    return {
      text: "",
      executedSkillIds: [],
      appliedTransformations: [],
      mode: mode || "auto",
    };
  }

  // If specific skill IDs are provided, run with mode = 'manual' and those skills
  if (enabledSkillIds && enabledSkillIds.length > 0) {
    const { result } = skillOrchestrator.orchestrate(text, {
      mode: "manual",
      skillIds: enabledSkillIds,
    });
    return result;
  }

  // Otherwise delegate to skillOrchestrator with requested mode
  const { result } = skillOrchestrator.orchestrate(text, { mode });
  return result;
}

/**
 * Combines system prompt instructions from enabled skills into a unified prompt
 * ordered by priority for AI multi-provider requests.
 */
export function getCombinedSkillPromptInstructions(
  enabledSkillIds?: string[],
  mode?: SkillMode,
  text?: string
): string {
  if (enabledSkillIds && enabledSkillIds.length > 0) {
    const allEnabled = skillRegistry
      .getAllSkills()
      .filter((s) => enabledSkillIds.includes(s.id));
    const orderedSkills = [...allEnabled].sort((a, b) => a.priority - b.priority);
    const sections = orderedSkills.map(
      (skill) =>
        `### [Priority ${skill.priority}] ${skill.name} (${skill.shortName})\n${skill.systemPromptInstruction}`
    );
    return sections.join("\n\n");
  }

  return skillOrchestrator.getCombinedSystemPrompt(mode, text);
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
