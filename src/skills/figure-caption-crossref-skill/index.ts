import { Skill } from "../types";

/**
 * Skill 10: Scientific Figure/Table Captions & Cross-Referencing
 * Based on https://github.com/Academic-Skills-Hub/figure-caption-crossref-skill
 * 
 * Priority 3: Academic manuscript formatting.
 * Handles scientific figure numbering, table captions, equation labels, and cross-references.
 */
export const figureCaptionCrossrefSkill: Skill = {
  id: "figure-caption-crossref-skill",
  name: "Figure/Table Captions & Cross-References",
  shortName: "Captions & Cross-Refs",
  version: "1.1.0",
  author: "Academic-Skills-Hub",
  repositoryUrl: "https://github.com/Academic-Skills-Hub/figure-caption-crossref-skill",
  license: "MIT License",
  role: "Standardizes Figure, Table, and Equation captions, automatic numbering, and inline cross-references.",
  description:
    "Standardizes scientific figure and table captions: Table captions above (**Table 1:** *Description*), Figure captions below (**Figure 1:** *Description*), equation numbering ((1.1), (1.2)), and links inline references (see Figure 1).",
  priority: 3, // 3: Academic manuscript formatting
  category: "academic",
  enabled: true,
  isBuiltIn: true,
  features: [
    "Table caption placement above table with bold label and italic description",
    "Figure caption placement below figure with bold label and descriptive text",
    "Equation label numbering right-aligned (e.g. \\tag{1.1} or (1))",
    "Inline cross-reference capitalization ('as shown in Figure 2' and 'Table 1')",
    "Sub-figure labeling (Figure 1(a), Figure 1(b))",
  ],
  rules: [
    {
      id: "caption-standardization",
      name: "Standardized Caption Labeling",
      description: "Format all figure and table captions with bold prefixes and italic descriptions.",
      exampleInput: "fig 1: simulation results",
      exampleOutput: "**Figure 1:** *Simulation results across 1,000 iterations.*",
    },
    {
      id: "cross-ref-capitalization",
      name: "Cross-Reference Capitalization",
      description: "Ensure references to specific figures, tables, or equations are capitalized (e.g. 'see Table 2', 'in Figure 3').",
      exampleInput: "as seen in table 1 and figure 2",
      exampleOutput: "as seen in Table 1 and Figure 2",
    },
  ],
  systemPromptInstruction: `[SKILL: Figure/Table Captions & Cross-References (figure-caption-crossref-skill)]
- Format Table captions ABOVE tables: **Table X:** *Description*.
- Format Figure captions BELOW figures: **Figure X:** *Description*.
- Capitalize specific references to Figures and Tables in text: 'see Figure 1', 'reported in Table 2'.
- For numbered equations, include right-aligned equation numbers like \\tag{1} or (1).`,

  transformText: (text: string): string => {
    if (!text) return "";
    let s = text;

    // Capitalize references to specific tables and figures
    s = s.replace(/\b(see|in|from|per)\s+table\s+(\d+)/gi, "$1 Table $2");
    s = s.replace(/\b(see|in|from|per)\s+figure\s+(\d+)/gi, "$1 Figure $2");
    s = s.replace(/\b(see|in|from|per)\s+fig\.?\s+(\d+)/gi, "$1 Figure $2");
    s = s.replace(/\b(see|in|from|per)\s+equation\s+(\d+)/gi, "$1 Equation $2");
    s = s.replace(/\b(see|in|from|per)\s+eq\.?\s+(\d+)/gi, "$1 Equation $2");

    // Standardize figure caption headers
    s = s.replace(/^Fig\.?\s*(\d+):?\s*/gim, "**Figure $1:** ");
    s = s.replace(/^Figure\s*(\d+):?\s*/gim, "**Figure $1:** ");
    s = s.replace(/^Table\s*(\d+):?\s*/gim, "**Table $1:** ");

    return s;
  },
};
