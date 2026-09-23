import type { SkillPipelineResult, SkillMode } from "./types.ts";
import { skillRegistry } from "./registry.ts";
import { skillOrchestrator } from "./orchestrator.ts";

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
      mode: mode || skillOrchestrator.getMode(),
    };
  }

  const effectiveMode = mode || skillOrchestrator.getMode();

  // If manual mode is active, pass the enabled skill IDs
  if (effectiveMode === "manual") {
    const ids = enabledSkillIds && enabledSkillIds.length > 0
      ? enabledSkillIds
      : skillRegistry.getEnabledSkillIds();
    const { result } = skillOrchestrator.orchestrate(text, {
      mode: "manual",
      skillIds: ids,
    });
    return result;
  }

  // If ALL ON mode is active, orchestrate all 12 skills
  if (effectiveMode === "all_on") {
    const { result } = skillOrchestrator.orchestrate(text, {
      mode: "all_on",
    });
    return result;
  }

  // Default: AUTO DETECT mode
  const { result } = skillOrchestrator.orchestrate(text, {
    mode: "auto",
  });
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
  const effectiveMode = mode || skillOrchestrator.getMode();

  if (effectiveMode === "manual" && enabledSkillIds && enabledSkillIds.length > 0) {
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

  return skillOrchestrator.getCombinedSystemPrompt(effectiveMode, text, enabledSkillIds);
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
