import type { Skill } from "../types.ts";

/**
 * Skill 11: CS Algorithms, Pseudocode & Proofs
 * Based on https://github.com/Academic-Skills-Hub/algorithmic-pseudocode-skill
 * 
 * Priority 4: General text & computer science formatting.
 * Typesets algorithms, pseudocode environments, control structures, complexity notations,
 * and mathematical theorem/lemma/proof blocks.
 */
export const algorithmicPseudocodeSkill: Skill = {
  id: "algorithmic-pseudocode-skill",
  name: "CS Algorithms, Pseudocode & Proofs",
  shortName: "Algorithms & Pseudocode",
  version: "1.1.0",
  author: "Academic-Skills-Hub",
  repositoryUrl: "https://github.com/Academic-Skills-Hub/algorithmic-pseudocode-skill",
  license: "MIT License",
  role: "Formats computer science algorithms, pseudocode indentation, asymptotic complexity notations O(n log n), and formal proof blocks.",
  description:
    "Typesets computer science algorithms and pseudocode with bold keywords (Require, Ensure, while, for, return), indented execution blocks, asymptotic Big-O complexities ($\\mathcal{O}(n \\log n)$, $\\Omega(n)$), and formal Theorem/Proof formatting with Q.E.D. symbols ($\\blacksquare$).",
  priority: 4, // 4: General text / computer science formatting
  category: "general",
  enabled: true,
  isBuiltIn: true,
  features: [
    "Algorithm environment formatting (Algorithm 1: Name, Input/Require, Output/Ensure)",
    "Indented pseudocode execution steps with bold keywords (if, then, else, while, for)",
    "Asymptotic Big-O complexity notation ($\\mathcal{O}(n)$, $\\Omega(1)$, $\\Theta(n^2)$)",
    "Theorem, Lemma, Corollary, and Definition labeled blocks",
    "Formal Proof block formatting ending with Q.E.D. symbol ($\\blacksquare$ or $\\square$)",
  ],
  rules: [
    {
      id: "big-o-notation",
      name: "Asymptotic Notation Normalization",
      description: "Format informal O(n) or O(log n) into standard LaTeX calligraphic asymptotic notation: $\\mathcal{O}(n)$, $\\mathcal{O}(n \\log n)$.",
      exampleInput: "Time complexity is O(n log n)",
      exampleOutput: "Time complexity is $\\mathcal{O}(n \\log n)$",
    },
    {
      id: "theorem-proof-blocks",
      name: "Theorem & Proof Blocks",
      description: "Format formal theorems (**Theorem 1:** *Statement*) and proofs starting with *Proof.* and concluding with $\\blacksquare$.",
      exampleInput: "Theorem 1. ... Proof. ... QED",
      exampleOutput: "**Theorem 1:** *Statement.*\n\n*Proof.* Detailed derivation. $\\blacksquare$",
    },
  ],
  systemPromptInstruction: `[SKILL: CS Algorithms, Pseudocode & Proofs (algorithmic-pseudocode-skill)]
- Use $\\mathcal{O}(\\cdot)$ for Big-O notation, $\\Omega(\\cdot)$ for lower bound, and $\\Theta(\\cdot)$ for tight bound.
- Typeset pseudocode with bold control keywords: **Input:**, **Output:**, **for**, **while**, **if**, **return**.
- Format theorems and lemmas as: **Theorem X:** *Statement of theorem*.
- Conclude formal mathematical proofs with the Q.E.D. symbol $\\blacksquare$.`,

  transformText: (text: string): string => {
    if (!text) return "";
    let s = text;

    // Convert informal O(...) to \mathcal{O}(...) when outside math delimiters
    s = s.replace(/\bO\(1\)/g, "$\\mathcal{O}(1)$");
    s = s.replace(/\bO\(n\)/g, "$\\mathcal{O}(n)$");
    s = s.replace(/\bO\(n\^2\)/g, "$\\mathcal{O}(n^2)$");
    s = s.replace(/\bO\(log n\)/g, "$\\mathcal{O}(\\log n)$");
    s = s.replace(/\bO\(n log n\)/g, "$\\mathcal{O}(n \\log n)$");

    // Replace informal QED with black square
    s = s.replace(/\bQ\.?E\.?D\.?\b/g, "$\\blacksquare$");

    return s;
  },
};
