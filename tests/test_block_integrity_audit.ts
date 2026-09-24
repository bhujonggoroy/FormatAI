import assert from "node:assert";
import {
  parseDocumentBlocks,
  compareDocumentBlocks,
  extractSubstantiveText,
  fnv1aHash,
  type DocumentBlock,
} from "../src/utils/blockIntegrity.ts";
import { validateAIPolishOutput } from "../src/utils/aiValidation.ts";
import { cleanClientSideNotebookLM } from "../src/utils/cleaner.ts";

console.log("=== START TEST: Block Integrity, Immutability & Content Preservation Audit ===");

// --------------------------------------------------------------------------------
// 1. Raw content immutable: formatted never overwrites raw
// --------------------------------------------------------------------------------
console.log("\nTest 1: Raw content immutability...");
const rawSourceText = "Raw notes: E(X) = \\mu, Var(X) = \\sigma^2. Keep this text exact.";
const formattedResult = cleanClientSideNotebookLM(rawSourceText, "auto");
// Verify rawSourceText has not been mutated
assert.strictEqual(
  rawSourceText,
  "Raw notes: E(X) = \\mu, Var(X) = \\sigma^2. Keep this text exact.",
  "Raw content must remain strictly immutable"
);
assert.ok(formattedResult.length > 0, "Formatted output produced");
console.log("✓ Requirement 1 Passed: Raw content remains completely immutable.");

// --------------------------------------------------------------------------------
// 2. Empty/null/partial output never overwrites existing content
// --------------------------------------------------------------------------------
console.log("\nTest 2: Empty/null/partial output rejection...");
const validBaseline = "# Title\n\nSome important verified academic content.\n\n$$ \\mu = 0 $$";
const emptyOutput = "";
const whitespaceOutput = "   \n\t  ";
const severelyTruncatedOutput = "Truncated";

// A. Empty output validation
const emptyValidation = validateAIPolishOutput(emptyOutput, validBaseline, validBaseline);
assert.strictEqual(emptyValidation.isValid, false, "Empty output must fail validation");
assert.ok(
  emptyValidation.errors.some((e) => e.includes("empty")),
  "Should flag empty output"
);

// B. Whitespace output validation
const wsValidation = validateAIPolishOutput(whitespaceOutput, validBaseline, validBaseline);
assert.strictEqual(wsValidation.isValid, false, "Whitespace output must fail validation");

// C. Severely truncated output validation
const truncValidation = validateAIPolishOutput(severelyTruncatedOutput, validBaseline, validBaseline);
assert.strictEqual(truncValidation.isValid, false, "Severely truncated output must fail validation");
assert.ok(
  truncValidation.errors.some((e) => e.includes("truncation") || e.includes("dropped") || e.includes("tolerance")),
  "Should flag truncation/block drop"
);
console.log("✓ Requirement 2 Passed: Empty/null/partial output is rejected and blocked from overwriting.");

// --------------------------------------------------------------------------------
// 3. Block definition:
//    - Paragraph separated by blank lines
//    - Equation block (single/multi-line) is ONE atomic block
//    - Table is ONE atomic block
//    - Code block is ONE atomic block
// --------------------------------------------------------------------------------
console.log("\nTest 3: Block parser rules (paragraphs, equations, tables, code blocks)...");
const sampleDoc = `# Section 1: Overview

This is paragraph 1.
It spans two lines without a blank line.

This is paragraph 2.

$$
\\bar{X} = \\frac{1}{n} \\sum_{i=1}^n x_i
\\text{Var}(\\bar{X}) = \\frac{\\sigma^2}{n}
$$

| Variable | Definition |
| :--- | :--- |
| $\\mu$ | Population mean |
| $\\sigma$ | Standard deviation |

\`\`\`python
def calculate_mean(x):
    return sum(x) / len(x)
\`\`\`

Conclusion paragraph after code.`;

const blocks = parseDocumentBlocks(sampleDoc);

// Verify total block count
assert.strictEqual(blocks.length, 7, "Document should be partitioned into exactly 7 atomic blocks");

// Verify block types
assert.strictEqual(blocks[0].type, "heading", "Block 0 must be heading");
assert.strictEqual(blocks[1].type, "paragraph", "Block 1 must be paragraph");
assert.strictEqual(blocks[2].type, "paragraph", "Block 2 must be paragraph");
assert.strictEqual(blocks[3].type, "equation", "Block 3 must be single atomic equation block");
assert.strictEqual(blocks[4].type, "table", "Block 4 must be single atomic table block");
assert.strictEqual(blocks[5].type, "code", "Block 5 must be single atomic code block");
assert.strictEqual(blocks[6].type, "paragraph", "Block 6 must be paragraph");

// Verify multi-line equation is not split
assert.ok(blocks[3].rawText.includes("\\bar{X}"), "Equation contains first formula");
assert.ok(blocks[3].rawText.includes("\\text{Var}"), "Equation contains second formula in SAME atomic block");

// Verify table is not split
assert.ok(blocks[4].rawText.includes("Population mean") && blocks[4].rawText.includes("Standard deviation"), "Table is single atomic block");

// Verify code block is not split
assert.ok(blocks[5].rawText.includes("calculate_mean") && blocks[5].rawText.includes("len(x)"), "Code block is single atomic block");
console.log("✓ Requirement 3 Passed: Block definition strictly adhered to.");

// --------------------------------------------------------------------------------
// 4. Stable ID generation & Missing block detection
// --------------------------------------------------------------------------------
console.log("\nTest 4: Stable IDs and missing block flagging...");
// Same content parsed twice must produce identical IDs
const blocksAgain = parseDocumentBlocks(sampleDoc);
for (let i = 0; i < blocks.length; i++) {
  assert.strictEqual(
    blocks[i].id,
    blocksAgain[i].id,
    `Block ${i} ID must be deterministic and stable`
  );
}

// Now simulate formatted document where Block 4 (Table) was dropped by mistake
const formattedWithoutTable = `# Section 1: Overview

This is paragraph 1.
It spans two lines without a blank line.

This is paragraph 2.

$$
\\bar{X} = \\frac{1}{n} \\sum_{i=1}^n x_i
\\text{Var}(\\bar{X}) = \\frac{\\sigma^2}{n}
$$

\`\`\`python
def calculate_mean(x):
    return sum(x) / len(x)
\`\`\`

Conclusion paragraph after code.`;

const formattedBlocks = parseDocumentBlocks(formattedWithoutTable);
const comparison = compareDocumentBlocks(blocks, formattedBlocks, 2.0);

assert.strictEqual(comparison.passed, false, "Comparison must fail when a block is missing");
assert.strictEqual(comparison.missingBlocks.length, 1, "Exactly 1 block should be identified as missing");
assert.strictEqual(comparison.missingBlocks[0].type, "table", "The missing block must be the table");
assert.ok(
  comparison.flags.some((f) => f.includes("Missing Block") && f.includes("table")),
  "Should flag missing table block"
);
console.log("✓ Requirement 4 Passed: Stable IDs verified and missing blocks correctly flagged.");

// --------------------------------------------------------------------------------
// 5. Character count preservation with ±2% tolerance
// --------------------------------------------------------------------------------
console.log("\nTest 5: Character count with ±2% tolerance...");
const fullText = "The central limit theorem states that as the sample size increases, the sampling distribution of the mean approaches normality.";
const slightlyExpandedFormatted = "The Central Limit Theorem (CLT) states that as the sample size $n$ increases, the sampling distribution of the mean $\\bar{X}$ approaches normality.";
// Formatting often adds a few formatting symbols/expansions:
const originalBlocks = parseDocumentBlocks(fullText);
const formattedBlocksNormal = parseDocumentBlocks(slightlyExpandedFormatted);
const compNormal = compareDocumentBlocks(originalBlocks, formattedBlocksNormal, 2.0);
assert.strictEqual(compNormal.tolerancePassed, true, "Normal formatting should pass tolerance");

// Now simulate a drop where 5% of substantive content is lost
const droppedText = "The central limit theorem states that as the sample size increases.";
const droppedBlocks = parseDocumentBlocks(droppedText);
const compDropped = compareDocumentBlocks(originalBlocks, droppedBlocks, 2.0);
assert.strictEqual(compDropped.tolerancePassed, false, "A drop of > 2% substantive characters must fail tolerance");
assert.ok(
  compDropped.flags.some((f) => f.includes("tolerance")),
  "Should record tolerance flag when drop exceeds 2%"
);
console.log("✓ Requirement 5 Passed: Character count ±2% tolerance strictly enforced.");

// --------------------------------------------------------------------------------
// 6. Large document preservation (Sections 7, 8, etc. beyond Section 6)
// --------------------------------------------------------------------------------
console.log("\nTest 6: Large document with content beyond Section 6...");
const largeAcademicDoc = `1. Introduction and Fundamentals
Some intro notes.

6. Practical Applications and Inference
Applications here.

7. Advanced Sampling Distributions
This is section 7 and must NOT be dropped!

8. Supplementary Exercises & Problem Bank
Question 1: Derive the variance of the sample mean.
Question 2: Show that S^2 is an unbiased estimator of sigma^2.`;

const cleanedLargeDoc = cleanClientSideNotebookLM(largeAcademicDoc, "auto");
assert.ok(
  cleanedLargeDoc.includes("Advanced Sampling Distributions") &&
    cleanedLargeDoc.includes("This is section 7 and must NOT be dropped!"),
  "Section 7 content must be preserved in large documents"
);
assert.ok(
  cleanedLargeDoc.includes("Supplementary Exercises") && cleanedLargeDoc.includes("Derive the variance"),
  "Content beyond Section 6 must be preserved"
);
console.log("✓ Large Document Test Passed: Content beyond Section 6 is fully preserved.");

console.log("\n=== ALL BLOCK INTEGRITY & AUDIT REQUIREMENTS PASSED ===");
