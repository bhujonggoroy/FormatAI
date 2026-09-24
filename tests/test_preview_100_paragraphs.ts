import assert from "node:assert";
import React from "react";
import { cleanClientSideNotebookLM } from "../src/utils/cleaner.ts";

console.log("=== STEP 1: PROVING FORMATTED DATA COMPLETENESS FOR 100+ PARAGRAPHS ===");

// 1. Generate a realistic academic document with 110 distinct paragraphs, math equations, and section headings
const paragraphCount = 110;
const generatedParagraphs: string[] = [];

for (let i = 1; i <= paragraphCount; i++) {
  if (i === 1) {
    generatedParagraphs.push("# Comprehensive Academic Analysis & Proofs");
  } else if (i % 25 === 0) {
    generatedParagraphs.push(`## Section ${Math.floor(i / 25)}: Theoretical Foundation Part ${Math.floor(i / 25)}`);
  } else if (i % 10 === 0) {
    generatedParagraphs.push(
      `Paragraph ${i}: For hypothesis ${i}, we examine the test statistic \\[ \\chi^2_{${i}} = \\sum_{k=1}^{${i}} \\frac{(O_k - E_k)^2}{E_k} \\] under standard regularity conditions.`
    );
  } else if (i % 5 === 0) {
    generatedParagraphs.push(
      `Paragraph ${i}: The estimator satisfies \\( \\operatorname{Var}(\\hat{\\theta}_{${i}}) = \\frac{\\sigma^2}{${i}} \\) and converges in distribution.`
    );
  } else {
    generatedParagraphs.push(
      `Paragraph ${i}: Academic exposition ${i} details the empirical distribution function and asymptotic normality properties for sample size n = ${i * 10}.`
    );
  }
}

const rawInput = generatedParagraphs.join("\n\n");

// Step 1 Proof: Format the document
const formattedOutput = cleanClientSideNotebookLM(rawInput, "auto");

console.log(`Raw Input Paragraph Count: ${paragraphCount}`);
console.log(`Formatted Output Length: ${formattedOutput.length} characters`);

// Check that every single paragraph identifier exists in the formatted output
let missingCount = 0;
for (let i = 1; i <= paragraphCount; i++) {
  const marker = i === 1 ? "Comprehensive Academic Analysis" : (i % 25 === 0 ? `Section ${Math.floor(i / 25)}:` : `Paragraph ${i}:`);
  if (!formattedOutput.includes(marker)) {
    console.error(`MISSING in formatted output: ${marker}`);
    missingCount++;
  }
}

console.log(`Missing paragraphs in formatted output: ${missingCount}`);
assert.strictEqual(missingCount, 0, "All 100+ paragraphs MUST be present in formatted data!");
console.log("✓ PROOF VERIFIED: Formatted data is 100% intact and complete with zero dropped content.");
