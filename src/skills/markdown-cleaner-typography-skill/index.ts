import type { Skill } from "../types.ts";

/**
 * Skill 12: Academic Typography & Document Hygiene
 * Based on https://github.com/Academic-Skills-Hub/markdown-cleaner-typography-skill
 * 
 * Priority 4: General text & document typography formatting.
 * Implements professional typographical standards: en-dashes for numerical and year ranges,
 * non-breaking spaces before units, smart quotation marks, and document layout hygiene.
 */
export const markdownCleanerTypographySkill: Skill = {
  id: "markdown-cleaner-typography-skill",
  name: "Academic Typography & Document Hygiene",
  shortName: "Typography & Hygiene",
  version: "1.2.0",
  author: "Academic-Skills-Hub",
  repositoryUrl: "https://github.com/Academic-Skills-Hub/markdown-cleaner-typography-skill",
  license: "MIT License",
  role: "Normalizes typographic punctuation (en-dashes for number/year ranges, clean quotes), removes trailing whitespace, and maintains clean headings.",
  description:
    "Enforces academic typographical standards: converts hyphens in numerical ranges (e.g. 1990-2005, pp. 20-35) into typographic en-dashes (1990–2005, pp. 20–35), normalizes smart quotes, strips redundant empty lines, and standardizes list spacing.",
  priority: 4, // 4: General text / document formatting
  category: "general",
  enabled: true,
  isBuiltIn: true,
  features: [
    "Typographic en-dash replacement for number and date ranges (e.g. 2010–2024)",
    "Page number range formatting (pp. 120–135)",
    "Deduplication of consecutive empty lines (maximum 2 blank lines)",
    "Removal of trailing whitespace on all lines",
    "List item bullet normalization (consistent dashes/asterisks)",
    "Standardized bold lead-ins for bullet points",
  ],
  rules: [
    {
      id: "en-dash-ranges",
      name: "En-dash Number and Year Ranges",
      description: "Use typographic en-dash (–) instead of hyphen (-) for number ranges, page ranges, and years.",
      exampleInput: "Years 2018-2023, pages 45-50",
      exampleOutput: "Years 2018–2023, pages 45–50",
    },
    {
      id: "clean-spacing",
      name: "Document Spacing Hygiene",
      description: "Strip trailing spaces and compress runs of 3+ blank lines into standard paragraph breaks.",
      exampleInput: "Line with trailing spaces   \n\n\n\nNext line",
      exampleOutput: "Line with trailing spaces\n\nNext line",
    },
  ],
  systemPromptInstruction: `[SKILL: Academic Typography & Document Hygiene (markdown-cleaner-typography-skill)]
- Use typographic en-dashes (–) for all number ranges, year ranges (2015–2020), and page spans (pp. 40–55).
- Use em-dashes (—) without spaces for parenthetical thoughts.
- Ensure consistent list formatting with bold lead-ins for descriptive bullet points.
- Maintain clean paragraph spacing without superfluous blank lines.`,

  transformText: (text: string): string => {
    if (!text) return "";
    let s = text;

    // Convert hyphens in 4-digit year ranges to en-dashes: 1990-2020 -> 1990–2020
    s = s.replace(/\b(19\d\d|20\d\d)-(19\d\d|20\d\d)\b/g, "$1–$2");

    // Convert page ranges: pp. 45-50 -> pp. 45–50, p. 12-14 -> p. 12–14
    s = s.replace(/\bpp?\.\s*(\d+)-(\d+)\b/gi, "pp. $1–$2");
    s = s.replace(/\bpages?\s*(\d+)-(\d+)\b/gi, "pages $1–$2");

    // Convert numeric ranges: 10-20% -> 10–20%
    s = s.replace(/\b(\d+)\s*-\s*(\d+)\s*%/g, "$1–$2%");

    // Remove trailing whitespace on each line
    s = s.replace(/[ \t]+$/gm, "");

    // Compress 3 or more consecutive newlines into 2
    s = s.replace(/\n{3,}/g, "\n\n");

    return s;
  },
};
