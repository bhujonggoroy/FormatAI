import { skillRegistry } from "../src/skills/registry.ts";
import { skillOrchestrator } from "../src/skills/orchestrator.ts";

async function runSkillTests() {
  console.log("=== STARTING SKILL MODES & CONFLICT RESOLUTION TESTS ===\n");
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string) {
    total++;
    if (condition) {
      console.log(`✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${testName}`);
      process.exitCode = 1;
    }
  }

  // 1. Conflict Detection between docx-math-skill and pandoc-math-docx
  const conflictsBoth = skillRegistry.checkSkillConflicts(["docx-math-skill", "pandoc-math-docx"]);
  assert(conflictsBoth.hasConflicts === true, "Test 1: Conflict detector identifies hard conflict between docx-math-skill and pandoc-math-docx");
  assert(conflictsBoth.conflicts.length > 0, "Test 1: Conflict list includes descriptive message");

  const conflictsSingle = skillRegistry.checkSkillConflicts(["docx-math-skill", "chem-equation-skill"]);
  assert(conflictsSingle.hasConflicts === false, "Test 2: No conflicts between orthogonal skills (math + chemistry)");

  // 2. Auto Detect Mode
  skillOrchestrator.setMode("auto");
  assert(skillOrchestrator.getMode() === "auto", "Test 3: Mode set to 'auto'");

  const mathText = "Consider the sample variance $S^2 = \\frac{1}{n-1}\\sum_{i=1}^n (X_i - \\bar{X})^2$ and chemical reaction H2O -> H+ + OH-.";
  const autoResult = skillOrchestrator.orchestrate(mathText, { mode: "auto" });
  assert(autoResult.report.activeSkillIds.length > 0, "Test 4: Auto Detect activates matching skills");
  assert(Boolean(autoResult.result.mathValidation && autoResult.result.mathValidation.validationScore >= 80), "Test 5: Math Quality Gate validates auto output with high score");

  // 3. Smart Manual Mode
  skillOrchestrator.setMode("manual");
  assert(skillOrchestrator.getMode() === "manual", "Test 6: Mode set to 'manual'");

  // 4. ALL ON Mode
  skillOrchestrator.setMode("all_on");
  skillRegistry.enableAllSkills();
  assert(skillOrchestrator.getMode() === "all_on", "Test 7: Mode set to 'all_on'");

  const complexDoc = `
# Quantum Mechanics & Statistical Physics

The wave function $\\psi(x,t)$ satisfies the Schrödinger equation:
$$i\\hbar \\frac{\\partial}{\\partial t}\\psi = -\\frac{\\hbar^2}{2m} \\nabla^2 \\psi + V(x)\\psi$$

Also, population variance is denoted by $\\sigma^2$ while sample variance is $S^2$.
Chemical equilibrium:
$$2\\text{H}_2 + \\text{O}_2 \\longrightarrow 2\\text{H}_2\\text{O}$$
`;

  const allOnResult = skillOrchestrator.orchestrate(complexDoc, { mode: "all_on" });
  assert(allOnResult.report.activeSkillIds.length >= 8, "Test 8: ALL ON mode runs comprehensive multi-engine pass");
  assert(Boolean(allOnResult.result.mathValidation && allOnResult.result.mathValidation.meetsTarget === true), "Test 9: Math Quality Gate passes under ALL ON mode with Sentinel Math Lock");
  assert(!allOnResult.result.text.includes("FMT_MATH_"), "Test 10: All Sentinel Math Lock tokens cleanly restored in output");

  // Reset to auto
  skillOrchestrator.setMode("auto");
  skillRegistry.resetAllSkills();

  console.log(`\n=== SUMMARY: ${passed}/${total} TESTS PASSED ===\n`);
}

runSkillTests().catch((e) => {
  console.error("Test runner failed:", e);
  process.exit(1);
});
