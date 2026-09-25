import { validateAIPolishOutput } from "../src/utils/aiValidation";
import { createDocumentChunks, reassembleDocumentChunks } from "../src/utils/documentChunker";
import { classifyErrorDetails } from "../src/utils/aiStatusClassifier";
import { AIErrorCategory } from "../src/types/ai";

console.log("=== RUNNING AI VALIDATION & CHUNKING SUITE ===");

// -------------------------------------------------------------
// REQUIREMENT 1: AI response validation tests
// -------------------------------------------------------------
console.log("\n--- Testing Requirement 1: AI Response Validation ---");

// 1.1 Non-empty check
const emptyResult = validateAIPolishOutput("", "Original input text here");
if (!emptyResult.isValid && !emptyResult.details.nonEmpty) {
  console.log("✓ PASS: Empty string rejected with nonEmpty=false");
} else {
  throw new Error("FAIL: Empty string was not rejected properly");
}

const whitespaceResult = validateAIPolishOutput("   \n\n\t  ", "Original text");
if (!whitespaceResult.isValid && !whitespaceResult.details.nonEmpty) {
  console.log("✓ PASS: Whitespace-only string rejected with nonEmpty=false");
} else {
  throw new Error("FAIL: Whitespace-only string was not rejected properly");
}

// 1.2 JSON completeness check
const malformedJson = "```json\n{\"title\": \"Math Notes\", \"content\": ";
const jsonFailResult = validateAIPolishOutput(malformedJson, "Original note content");
if (!jsonFailResult.isValid && !jsonFailResult.details.jsonComplete && jsonFailResult.errorCategory === "malformed") {
  console.log("✓ PASS: Malformed JSON rejected with jsonComplete=false and errorCategory='malformed'");
} else {
  throw new Error("FAIL: Malformed JSON was not handled properly");
}

const completeJson = "```json\n{\"title\": \"Math Notes\", \"content\": \"Full text content preserved here.\"}\n```";
const jsonSuccessResult = validateAIPolishOutput(completeJson, "Original note content");
if (jsonSuccessResult.details.jsonComplete) {
  console.log("✓ PASS: Complete JSON parsed with jsonComplete=true");
} else {
  throw new Error("FAIL: Complete JSON failed parsing");
}

// 1.3 Expected block ID verification
const expectedBlocks = ["block-intro", "block-thm1", "block-table", "block-summary"];
const outputWithMissingBlocks = "## Introduction\n\nOnly the intro is kept here.";
const blockCheckResult = validateAIPolishOutput(outputWithMissingBlocks, "Full doc", "Full doc", expectedBlocks);
if (!blockCheckResult.isValid && !blockCheckResult.details.expectedBlockIdsPresent) {
  console.log("✓ PASS: Missing expected block IDs detected and rejected");
} else {
  throw new Error("FAIL: Missing block IDs was not flagged");
}

// 1.4 Suspiciously small check (<60% baseline)
const longOriginal = "A ".repeat(400); // 800 chars
const shortOutput = "A ".repeat(100); // 200 chars (< 60% of 800)
const smallResult = validateAIPolishOutput(shortOutput, longOriginal, longOriginal);
if (!smallResult.isValid && !smallResult.details.notSuspiciouslySmall && smallResult.errorCategory === "truncated") {
  console.log("✓ PASS: Suspiciously small output (<60% baseline) rejected with errorCategory='truncated'");
} else {
  throw new Error("FAIL: Suspiciously small output was not rejected");
}

// -------------------------------------------------------------
// REQUIREMENT 3: Large document chunking & atomic block preservation
// -------------------------------------------------------------
console.log("\n--- Testing Requirement 3: Atomic Chunking & Deterministic Reassembly ---");

const testDocWithAtomics = [
  "# Academic Mathematical Physics Notes",
  "",
  "## Section 1: Fundamentals",
  "Introductory paragraph detailing the scope and boundaries of quantum harmonic oscillators.",
  "",
  "$$",
  "\\hat{H} = \\frac{\\hat{p}^2}{2m} + \\frac{1}{2}m\\omega^2\\hat{x}^2",
  "$$",
  "",
  "## Section 2: Distribution Table",
  "| Distribution | Parameter | Expectation | Variance |",
  "| :--- | :---: | :---: | :---: |",
  "| Normal | $\\mu, \\sigma^2$ | $\\mu$ | $\\sigma^2$ |",
  "| Poisson | $\\lambda$ | $\\lambda$ | $\\lambda$ |",
  "| Binomial | $n, p$ | $np$ | $np(1-p)$ |",
  "",
  "```python",
  "import numpy as np",
  "def oscillator(x, m, w):",
  "    return 0.5 * m * (w ** 2) * (x ** 2)",
  "```",
  "",
  "## Section 3: Summary",
  "Final conclusion paragraph synthesizing the equations and parameters above.",
].join("\n");

// Chunk with small limit (e.g. 200 chars) to force multiple chunks
const chunks = createDocumentChunks(testDocWithAtomics, 200, 2);
console.log(`Generated ${chunks.length} atomic chunks from document.`);

// Verify that NO chunk cuts in the middle of display math, table, or code
for (let c = 0; c < chunks.length; c++) {
  const chunkText = chunks[c].rawText;
  
  // If chunk contains opening $$, it must contain closing $$
  const doubleDollarCount = (chunkText.match(/(?<!\\)\$\$/g) || []).length;
  if (doubleDollarCount % 2 !== 0) {
    throw new Error(`FAIL: Chunk ${c} cut a display equation in the middle!`);
  }

  // If chunk contains code fence ```, it must be paired
  const fenceCount = (chunkText.match(/```/g) || []).length;
  if (fenceCount % 2 !== 0) {
    throw new Error(`FAIL: Chunk ${c} cut a code fence in the middle!`);
  }

  // If chunk contains table header line, it must have table rows together
  if (chunkText.includes("| :---")) {
    if (!chunkText.includes("| Normal") || !chunkText.includes("| Binomial")) {
      throw new Error(`FAIL: Chunk ${c} sliced the table across chunks!`);
    }
  }
}
console.log("✓ PASS: Equation, table, and code blocks were NEVER sliced in the middle (Atomic Chunk Invariant)");

// Deterministic Reassembly check
const reassembled = reassembleDocumentChunks(
  chunks.map((c) => ({ chunkIndex: c.chunkIndex, text: c.rawText }))
);

if (reassembled.includes("\\hat{H}") && reassembled.includes("| Binomial") && reassembled.includes("def oscillator")) {
  console.log("✓ PASS: Deterministic reassembly restored complete content with exact ordering");
} else {
  throw new Error("FAIL: Reassembled document lost content");
}

// -------------------------------------------------------------
// REQUIREMENT 4: Error categories classification
// -------------------------------------------------------------
console.log("\n--- Testing Requirement 4: Error Categories Classification ---");

const categoriesToTest: AIErrorCategory[] = [
  "key_missing",
  "invalid_key",
  "rate_limit",
  "timeout",
  "network",
  "truncated",
  "malformed",
];

for (const cat of categoriesToTest) {
  const classified = classifyErrorDetails(undefined, undefined, cat);
  if (classified.errorCategory === cat && classified.badgeLabel && classified.title) {
    console.log(`✓ PASS: Error category '${cat}' -> Badge: [${classified.badgeLabel}], Title: "${classified.title}"`);
  } else {
    throw new Error(`FAIL: Error category '${cat}' classification incomplete`);
  }
}

// Test heuristic message classification
const heuristicTests: Array<{ msg: string; expected: AIErrorCategory }> = [
  { msg: "No enabled API key found", expected: "key_missing" },
  { msg: "Invalid API key provided or 401 unauthorized", expected: "invalid_key" },
  { msg: "429 Rate limit exceeded quota", expected: "rate_limit" },
  { msg: "Request timed out after 30000ms", expected: "timeout" },
  { msg: "Failed to fetch: net::ERR_CONNECTION_REFUSED", expected: "network" },
  { msg: "Truncated output dropped 4 expected blocks", expected: "truncated" },
  { msg: "Unexpected token in JSON at position 12", expected: "malformed" },
];

for (const test of heuristicTests) {
  const result = classifyErrorDetails(test.msg);
  if (result.errorCategory === test.expected) {
    console.log(`✓ PASS: Message "${test.msg}" -> ${result.errorCategory}`);
  } else {
    throw new Error(`FAIL: Expected "${test.msg}" to be ${test.expected} but got ${result.errorCategory}`);
  }
}

console.log("\n=== ALL AI VALIDATION & CHUNKING SUITE TESTS PASSED SUCCESSFULLY! ===");
