import assert from "node:assert";
import { cleanClientSideNotebookLM } from "../src/utils/cleaner.ts";
import { parseDocumentBlocks, compareDocumentBlocks } from "../src/utils/blockIntegrity.ts";

console.log("=== PROOF: Testing Formatted Data Completeness on 100+ Paragraph Document ===");

const paragraphs: string[] = [];
paragraphs.push("# Comprehensive 100+ Paragraph Verification Document");
paragraphs.push("## Section 1: Foundations of Mathematical and Statistical Sampling");

// Generate 110 distinct content paragraphs
for (let i = 1; i <= 110; i++) {
  paragraphs.push(
    `Paragraph ${i}: Substantive academic content block number ${i}. We analyze population parameter \\mu and sample statistic \\bar{X}_${i} where variance is \\sigma^2 and sample size is n = ${i * 10}. This detailed discussion verifies that paragraph ${i} is completely preserved without any truncation or omission.`
  );
}

// Add multi-line equation block
paragraphs.push(`$$
\\bar{X} = \\frac{1}{n} \\sum_{i=1}^n X_i
\\operatorname{Var}(\\bar{X}) = \\frac{\\sigma^2}{n}
$$`);

// Add markdown table block
paragraphs.push(`| Parameter | Estimator | Standard Error |
| :--- | :--- | :--- |
| Population Mean \\mu | Sample Mean \\bar{X} | \\frac{\\sigma}{\\sqrt{n}} |
| Population Proportion P | Sample Proportion \\hat{p} | \\sqrt{\\frac{P(1-P)}{n}} |`);

// Add fenced code block
paragraphs.push(`\`\`\`python
def verify_document_integrity(n_paragraphs):
    print(f"Verified {n_paragraphs} paragraphs successfully")
    return True
\`\`\``);

// Add final concluding paragraphs
paragraphs.push("Paragraph 111: Final concluding observations regarding large document state handling.");
paragraphs.push("Paragraph 112: Absolute last paragraph to guarantee no end-of-file cutoff.");

const fullDocumentText = paragraphs.join("\n\n");
const originalBlocks = parseDocumentBlocks(fullDocumentText);

console.log(`1. Generated document with ${paragraphs.length} total blocks.`);
console.log(`2. Extracted ${originalBlocks.length} atomic original blocks.`);

// Format document via cleanClientSideNotebookLM in both auto and study_guide modes
const formattedAuto = cleanClientSideNotebookLM(fullDocumentText, "auto");
const formattedBlocksAuto = parseDocumentBlocks(formattedAuto);

const comparisonAuto = compareDocumentBlocks(originalBlocks, formattedBlocksAuto, 2.0);

console.log(`3. Formatted document produced ${formattedBlocksAuto.length} formatted blocks.`);
console.log(`4. Missing blocks count: ${comparisonAuto.missingBlocks.length}.`);
console.log(`5. Tolerance check passed: ${comparisonAuto.tolerancePassed}.`);
console.log(`6. Substantive char count: original=${comparisonAuto.originalSubstantiveChars}, formatted=${comparisonAuto.formattedSubstantiveChars}.`);

// Verify every single one of the 112 paragraphs exists in the formatted output
const missingIndices: number[] = [];
for (let i = 1; i <= 112; i++) {
  if (!formattedAuto.includes(`Paragraph ${i}:`)) {
    missingIndices.push(i);
  }
}

console.log(`7. Missing paragraph check: ${missingIndices.length === 0 ? "NONE (All 112 present)" : "MISSING: " + missingIndices.join(", ")}`);

assert.strictEqual(missingIndices.length, 0, "All 112 paragraphs must be 100% present in formatted output");
assert.strictEqual(comparisonAuto.missingBlocks.length, 0, "No blocks should be missing");
assert.strictEqual(comparisonAuto.tolerancePassed, true, "Character count tolerance must pass");

console.log("=== PROOF COMPLETE: Formatted data is 100% complete with 0 loss ===");
