import assert from "node:assert";
import {
  ACADEMIC_SYSTEM_WORKFLOW,
  FORMATTING_ORDER_COMMANDS,
  RECOMMENDED_ACADEMIC_SYSTEM_PROMPT,
} from "../src/shared/academicWorkflow.ts";
import {
  cleanClientSideNotebookLM,
  normalizeMatrixSyntax,
} from "../src/utils/cleaner.ts";
import { validateAcademicDocument } from "../src/server/academicPrompt.ts";

console.log("--- START TEST: Academic System Workflow & Formatting Rules ---");

// 1. Verify 10-Step Workflow
assert.strictEqual(ACADEMIC_SYSTEM_WORKFLOW.length, 10, "Workflow must have exactly 10 steps");
assert.strictEqual(ACADEMIC_SYSTEM_WORKFLOW[0], "Input Document");
assert.strictEqual(ACADEMIC_SYSTEM_WORKFLOW[1], "Content Preservation");
assert.strictEqual(ACADEMIC_SYSTEM_WORKFLOW[2], "Year-wise Classification");
assert.strictEqual(ACADEMIC_SYSTEM_WORKFLOW[3], "Exam-wise Classification");
assert.strictEqual(ACADEMIC_SYSTEM_WORKFLOW[4], "Section and Question Formatting");
assert.strictEqual(ACADEMIC_SYSTEM_WORKFLOW[5], "LaTeX Detection and Correction");
assert.strictEqual(ACADEMIC_SYSTEM_WORKFLOW[6], "Table and Matrix Formatting");
assert.strictEqual(ACADEMIC_SYSTEM_WORKFLOW[7], "Side-note Standardization");
assert.strictEqual(ACADEMIC_SYSTEM_WORKFLOW[8], "Final Quality Check");
assert.strictEqual(ACADEMIC_SYSTEM_WORKFLOW[9], "Editable Standard Output");
console.log("✓ 10-Step Academic System Workflow verified");

// 2. Verify Formatting Orders / Commands
assert.strictEqual(FORMATTING_ORDER_COMMANDS.length, 6, "Must have 6 formatting commands");
assert.ok(FORMATTING_ORDER_COMMANDS.includes("Do not solve the questions."));
assert.ok(FORMATTING_ORDER_COMMANDS.includes("Do not change the mathematical meaning."));
assert.ok(FORMATTING_ORDER_COMMANDS.includes("Do not remove repeated-question notes."));
assert.ok(FORMATTING_ORDER_COMMANDS.includes("Do not invent missing information."));
assert.ok(FORMATTING_ORDER_COMMANDS.includes("Correct only formatting, grammar, notation, and LaTeX syntax."));
assert.ok(FORMATTING_ORDER_COMMANDS.includes("Preserve the original marks and question numbering."));
console.log("✓ Formatting Order Commands verified");

// 3. Verify Recommended System Prompt
assert.ok(RECOMMENDED_ACADEMIC_SYSTEM_PROMPT.includes("You are an academic document formatting assistant."));
assert.ok(RECOMMENDED_ACADEMIC_SYSTEM_PROMPT.includes("\\begin{bmatrix}"));
assert.ok(RECOMMENDED_ACADEMIC_SYSTEM_PROMPT.includes("\\operatorname{rank}(A)"));
assert.ok(RECOMMENDED_ACADEMIC_SYSTEM_PROMPT.includes("\\operatorname{Var}(X)"));
assert.ok(RECOMMENDED_ACADEMIC_SYSTEM_PROMPT.includes("\\chi^2_r"));
assert.ok(RECOMMENDED_ACADEMIC_SYSTEM_PROMPT.includes("\\sim N(\\mu,\\sigma^2)"));
console.log("✓ Recommended System Prompt verified");

// 4. Verify Matrix Normalization
const rawMatrixInput = "A = [ 1 2 3 ; 4 5 6 ; 7 8 9 ]";
const normalizedMatrix = normalizeMatrixSyntax(rawMatrixInput);
assert.ok(normalizedMatrix.includes("\\begin{bmatrix}"), "Must convert to bmatrix");
assert.ok(normalizedMatrix.includes("1 & 2 & 3"), "Must separate columns with &");
assert.ok(normalizedMatrix.includes("\\\\"), "Must break rows with \\\\");
assert.ok(normalizedMatrix.includes("\\end{bmatrix}"), "Must close with \\end{bmatrix}");
console.log("✓ Matrix normalization verified");

// 5. Verify Exam Bank Workflow Execution
const rawExamInput = `Course Code: MAT301: Linear Algebra
2025-Final Examination
Section A: Linear Systems
Q1. (a) Define rank(A). [3 marks]
(b) Given matrix: [1 2; 3 4] compute inverse. [5 pts]
Repeated question: Appeared in 2018 Final Q1.
`;

const cleaned = cleanClientSideNotebookLM(rawExamInput, "exam_bank");
assert.ok(cleaned.includes("## 2025 Final Examination"), "Year-wise and Exam-wise classification heading");
assert.ok(cleaned.includes("### Section A: Linear Systems"), "Section classification");
assert.ok(cleaned.includes("### Question 1"), "Standardized question header");
assert.ok(cleaned.includes("[3 Marks]"), "Normalized marks brackets");
assert.ok(cleaned.includes("[5 Marks]"), "Normalized pts to marks");
assert.ok(cleaned.includes("\\operatorname{rank}(A)"), "Normalized rank operator");
assert.ok(cleaned.includes("\\begin{bmatrix}"), "Normalized matrix to bmatrix");
assert.ok(cleaned.includes("**Repeated Question:**"), "Preserved repeated-question note");
console.log("✓ Exam Bank Workflow execution verified");

// 6. Verify Academic Document Validation
const validDoc = `# Mathematics Exam Bank
## 2025 Final Examination
### Question 1
Compute the matrix:
\\[
\\begin{bmatrix}
1 & 2 \\\\
3 & 4
\\end{bmatrix}
\\]
**Repeated Question:** See 2020 Final.
`;
const reportValid = validateAcademicDocument(validDoc);
assert.strictEqual(reportValid.needsCleanup, false, "Valid document must pass quality validation");

const brokenMatrixDoc = `### Question 1\n\\begin{bmatrix} 1 & 2 \\\\ 3 & 4\n`;
const reportBroken = validateAcademicDocument(brokenMatrixDoc);
assert.strictEqual(reportBroken.needsCleanup, true, "Broken matrix must be caught");
assert.ok(reportBroken.reasons.some(r => r.includes("bmatrix")), "Must report unclosed bmatrix");
console.log("✓ Quality validation rules verified");

console.log("--- ALL ACADEMIC WORKFLOW TESTS PASSED ---");
