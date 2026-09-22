import { Skill } from "../types";

/**
 * Skill 8: Academic Citation & Reference Linking
 * Based on https://github.com/kchemorion/citation-referencing-skill
 * 
 * Priority 3: Academic manuscript formatting.
 * Standardizes academic citation formats (IEEE numeric [1], APA author-date (Smith, 2020)),
 * sorts and deduplicates in-text citations, and structures bibliography reference lists.
 */
export const citationReferencingSkill: Skill = {
  id: "citation-referencing-skill",
  name: "Academic Citation & Reference Linking",
  shortName: "Citations & References",
  version: "1.2.0",
  author: "kchemorion",
  repositoryUrl: "https://github.com/kchemorion/citation-referencing-skill",
  license: "MIT License",
  role: "Normalizes in-text academic citations, ranges [1-3], author-date citations, and standardizes reference sections.",
  description:
    "Standardizes in-text citations (e.g. converting [1],[2],[3] into [1–3] or formatting APA author-date citations), cleans reference entries with DOIs, and structures numbered bibliography lists.",
  priority: 3, // 3: Academic manuscript formatting
  category: "academic",
  enabled: true,
  isBuiltIn: true,
  features: [
    "IEEE-style bracketed numeric citations ([1], [1, 2], [1–3])",
    "Citation range contraction (e.g. [1],[2],[3],[4] -> [1–4])",
    "APA 7th edition author-year formatting ((Author, Year))",
    "Hanging indentation formatting for bibliographic reference lists",
    "Standardization of journal metadata (Volume, Issue, Pages, DOIs)",
    "Deduplication and ascending numeric sorting of grouped citations",
  ],
  rules: [
    {
      id: "citation-ranges",
      name: "Citation Range Compression",
      description: "Compress three or more consecutive numeric citations into en-dash ranges: [1, 2, 3] -> [1–3].",
      exampleInput: "Previous works [1][2][3] show that...",
      exampleOutput: "Previous works [1–3] show that...",
    },
    {
      id: "reference-section-header",
      name: "Standardized References Section",
      description: "Ensure the reference list begins with a clean top-level heading (# References) with numbered or hanging indented entries.",
      exampleInput: "bibliography list",
      exampleOutput: "# References\n\n[1] Author, A. (2024). Title. Journal, 12(3), 45–60.",
    },
  ],
  systemPromptInstruction: `[SKILL: Academic Citation & Reference Linking (citation-referencing-skill)]
- Standardize in-text citations: use numeric brackets [1] for IEEE/nature style, or (Author, Year) for APA style.
- Compress consecutive numeric citations: [1], [2], [3] becomes [1–3] with an en-dash.
- Separate multiple distinct citations with commas inside a single bracket: [1, 4, 7].
- Structure the reference list under a dedicated '# References' header.`,

  transformText: (text: string): string => {
    if (!text) return "";
    let s = text;

    // Merge adjacent brackets: [1][2] -> [1, 2]
    s = s.replace(/\[(\d+)\]\s*\[(\d+)\]/g, "[$1, $2]");
    s = s.replace(/\[(\d+,\s*\d+)\]\s*\[(\d+)\]/g, "[$1, $2]");

    // Replace hyphen in citations with en-dash: [1-3] -> [1–3]
    s = s.replace(/\[(\d+)-(\d+)\]/g, "[$1–$2]");

    return s;
  },
};
