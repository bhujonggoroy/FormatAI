import assert from "node:assert";
import {
  parseDocumentBlocks,
  findBrokenFragmentsInBlock,
  collectFailedFragments,
  replaceFragmentInBlock,
  assertFragmentSurgicallyReplaced,
  replaceFragmentInDocument,
  type DocumentBlock,
  type BrokenFragment,
} from "../src/utils/blockIntegrity.ts";

console.log("=== START TEST: Fragment-Level Detection & Surgical Repair ===");

// --------------------------------------------------------------------------------
// Test 1: Fine-grained detection isolates exact broken fragment inside a paragraph
// --------------------------------------------------------------------------------
console.log("\nTest 1: Fine-grained detection inside a paragraph with good surrounding text...");

const introText = "In statistical inference, the sample mean is an unbiased estimator of the population mean. The formula for the test statistic is ";
const brokenFormula = "$$ \\frac{1}{2 $$";
const conclusionText = " and we reject the null hypothesis at the 5% significance level when the critical value is exceeded.";

const fullParagraphText = `${introText}${brokenFormula}${conclusionText}`;

const testDoc = `### Section A: Hypothesis Testing

${fullParagraphText}

- Important note: This procedure applies to large samples only.`;

const blocks = parseDocumentBlocks(testDoc);
assert.strictEqual(blocks.length, 3, "Document should parse into 3 atomic blocks");

const paragraphBlock = blocks[1];
assert.strictEqual(paragraphBlock.type, "paragraph", "Block 1 should be a paragraph");
assert.strictEqual(paragraphBlock.rawText, fullParagraphText, "Block rawText must match input paragraph");

const fragments = findBrokenFragmentsInBlock(paragraphBlock);
assert.strictEqual(fragments.length, 1, "Should isolate exactly 1 broken fragment");

const frag = fragments[0];
console.log("Detected fragment:", {
  id: frag.id,
  blockId: frag.blockId,
  startOffset: frag.startOffset,
  endOffset: frag.endOffset,
  brokenText: frag.brokenText,
  reason: frag.reason,
  category: frag.category,
});

assert.strictEqual(frag.startOffset, introText.length, "startOffset must exactly equal intro text length");
assert.strictEqual(frag.endOffset, introText.length + brokenFormula.length, "endOffset must exactly cover broken formula");
assert.strictEqual(frag.brokenText, brokenFormula, "brokenText must match the broken formula exactly");
assert.strictEqual(paragraphBlock.rawText.slice(frag.startOffset, frag.endOffset), brokenFormula, "Slice at offsets must yield broken formula");

console.log("✓ Test 1 Passed: Fine-grained detection pinpointed exact character span of broken formula.");

// --------------------------------------------------------------------------------
// Test 2: Surgical fragment replacement and byte-for-byte outer immutability
// --------------------------------------------------------------------------------
console.log("\nTest 2: Surgical fragment replacement and boundary immutability check...");

const repairedFormula = "$$ \\frac{1}{2} $$";

const updatedRawText = replaceFragmentInBlock(
  paragraphBlock.rawText,
  frag.startOffset,
  frag.endOffset,
  repairedFormula
);

// Verify before-and-after slices
const textBeforeOriginal = paragraphBlock.rawText.slice(0, frag.startOffset);
const textBeforeUpdated = updatedRawText.slice(0, frag.startOffset);
assert.strictEqual(textBeforeUpdated, textBeforeOriginal, "Text BEFORE fragment must be 100% byte-for-byte identical");
assert.strictEqual(textBeforeUpdated, introText, "Text before must exactly match the original intro text");

const textAfterOriginal = paragraphBlock.rawText.slice(frag.endOffset);
const textAfterUpdated = updatedRawText.slice(frag.startOffset + repairedFormula.length);
assert.strictEqual(textAfterUpdated, textAfterOriginal, "Text AFTER fragment must be 100% byte-for-byte identical");
assert.strictEqual(textAfterUpdated, conclusionText, "Text after must exactly match the original conclusion text");

// Verify surgical assertion helper
const isSurgical = assertFragmentSurgicallyReplaced(
  paragraphBlock.rawText,
  updatedRawText,
  frag.startOffset,
  frag.endOffset,
  repairedFormula
);
assert.ok(isSurgical, "assertFragmentSurgicallyReplaced must return true");

// Verify that the replacement was inserted properly
assert.strictEqual(
  updatedRawText,
  `${introText}${repairedFormula}${conclusionText}`,
  "Full updated paragraph must contain repaired formula with intact surroundings"
);

console.log("✓ Test 2 Passed: Content outside [startOffset, endOffset] is 100% byte-for-byte untouched.");

// --------------------------------------------------------------------------------
// Test 3: Document-level fragment replacement preserves all other blocks
// --------------------------------------------------------------------------------
console.log("\nTest 3: Document-level fragment replacement preserves other blocks...");

const updatedDoc = replaceFragmentInDocument(
  testDoc,
  paragraphBlock.id,
  frag.startOffset,
  frag.endOffset,
  repairedFormula
);

const updatedBlocks = parseDocumentBlocks(updatedDoc);
assert.strictEqual(updatedBlocks.length, 3, "Updated doc must still have 3 blocks");

// Block 0 (heading) untouched
assert.strictEqual(updatedBlocks[0].rawText, blocks[0].rawText, "Heading block must be 100% untouched");

// Block 1 (paragraph) has only formula repaired
assert.strictEqual(updatedBlocks[1].rawText, updatedRawText, "Target paragraph must have only formula repaired");

// Block 2 (list item) untouched
assert.strictEqual(updatedBlocks[2].rawText, blocks[2].rawText, "List item block must be 100% untouched");

// No more failed fragments in the repaired document
const { fragments: remainingFrags } = collectFailedFragments(updatedBlocks);
assert.strictEqual(remainingFrags.length, 0, "Repaired document should have 0 failed fragments");

console.log("✓ Test 3 Passed: Document-level replacement updated only target fragment; all other blocks untouched.");

// --------------------------------------------------------------------------------
// Test 4: Detection of multiple types of broken fragments
// --------------------------------------------------------------------------------
console.log("\nTest 4: Fragment detection on unclosed delimiters, tree artifacts, and unwrapped math...");

const multiErrorDoc = `The first formula is $$ \\alpha + \\beta and missing closing delimiter.

├── Tree artifact line to clean

Here is unwrapped math \\frac{x}{y} in the middle of a sentence without delimiters.`;

const multiBlocks = parseDocumentBlocks(multiErrorDoc);
const { fragments: multiFrags, failedBlockIds } = collectFailedFragments(multiBlocks);

assert.strictEqual(multiFrags.length, 3, "Should detect all 3 broken fragments across blocks");
assert.strictEqual(failedBlockIds.length, 3, "Should flag 3 blocks");

const categories = multiFrags.map((f) => f.category);
assert.ok(categories.includes("unbalanced_delimiters"), "Must detect unbalanced delimiters");
assert.ok(categories.includes("tree_artifact"), "Must detect tree artifact fragment");
assert.ok(categories.includes("raw_math_unwrapped"), "Must detect unwrapped LaTeX fragment");

console.log("✓ Test 4 Passed: All fragment categories correctly detected and isolated with character offsets.");

console.log("\n=== ALL FRAGMENT-LEVEL DETECTION & SURGICAL REPAIR TESTS PASSED ===");
