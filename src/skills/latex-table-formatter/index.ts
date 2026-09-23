import type { Skill } from "../types.ts";

/**
 * Skill 7: Academic & Scientific Table Structuring
 * Based on https://github.com/kchemorion/latex-table-formatter
 * 
 * Priority 3: Academic manuscript formatting.
 * Implements publication-quality Booktabs three-line tables (\\toprule, \\midrule, \\bottomrule),
 * alignment of numerical columns, header grouping, and table footnotes.
 */
export const latexTableFormatterSkill: Skill = {
  id: "latex-table-formatter",
  name: "Academic Booktabs Tables",
  shortName: "Publication Tables",
  version: "1.3.1",
  author: "kchemorion",
  repositoryUrl: "https://github.com/kchemorion/latex-table-formatter",
  license: "MIT License",
  role: "Enforces publication-grade Booktabs tables without vertical rules, formatting headers, numerical alignments, and table notes.",
  description:
    "Transforms raw text or Markdown tables into publication-quality academic tables adhering to Booktabs standards: thick top/bottom borders, thin mid-rule below headers, no vertical dividing lines, and clean column spacing.",
  priority: 3, // 3: Academic manuscript formatting
  category: "academic",
  enabled: true,
  isBuiltIn: true,
  features: [
    "Booktabs three-line rule structure (Top Rule 1.5pt, Mid Rule 0.5pt, Bottom Rule 1.5pt)",
    "Strict elimination of all vertical column borders (|) in tables",
    "Decimal alignment and right-alignment for numerical data",
    "Multi-column headers with grouped spanning captions",
    "Table footnotes and significance indicators (* p < .05, ** p < .01)",
    "Header repetition on multi-page Word table pagination",
  ],
  rules: [
    {
      id: "no-vertical-rules",
      name: "Zero Vertical Rules",
      description: "Academic and publication tables must never contain vertical dividing lines.",
      exampleInput: "| Col A | Col B |\n|---|---|\n| 1 | 2 |",
      exampleOutput: "Three-line Booktabs table with horizontal rules only.",
    },
    {
      id: "table-caption-placement",
      name: "Table Caption Positioning",
      description: "Table captions must always appear above the table: **Table X:** *Caption description*.",
      exampleInput: "Table 1 Descriptive Statistics",
      exampleOutput: "**Table 1:** *Descriptive Statistics of Sample Variables*",
    },
    {
      id: "table-notes",
      name: "Table Footnotes & Significance",
      description: "Standardize table notes below the bottom rule in smaller italicized text.",
      exampleInput: "Note: *p < 0.05",
      exampleOutput: "*Note:* *p* < .05, **p* < .01.",
    },
  ],
  systemPromptInstruction: `[SKILL: Academic Booktabs Tables (latex-table-formatter)]
- Tables must follow the Booktabs three-line style: top border, middle border below header row, bottom border.
- Never use vertical dividing lines in academic tables.
- Position Table titles ABOVE the table in the format: **Table X:** *Description*.
- Place explanatory notes and significance markers directly below the table: *Note.* *p* < .05.
- Align numbers to the right or on the decimal point.`,

  transformText: (text: string): string => {
    if (!text) return "";
    let s = text;

    // Clean up malformed markdown table rows with uneven spacing
    const lines = s.split("\n");
    const cleanedLines = lines.map((line) => {
      if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
        // Ensure consistent spacing inside pipe cells
        return line
          .split("|")
          .map((cell, idx, arr) => {
            if (idx === 0 || idx === arr.length - 1) return "";
            return " " + cell.trim() + " ";
          })
          .join("|");
      }
      return line;
    });

    return cleanedLines.join("\n");
  },

  transformDocxOptions: (options: Record<string, any> = {}): Record<string, any> => {
    return {
      ...options,
      tableBorders: "booktabs", // signals docxService to use publication three-line borders
      tableHeaderRepeat: true,
      tableAlignment: "center",
    };
  },
};
