import type { Skill } from "../types.ts";

/**
 * Skill 4: Academic/Scientific Manuscript
 * Based on https://github.com/kchemorion/academic-manuscript-skill
 * 
 * Priority 3: Academic manuscript formatting.
 * Enforces publication-ready academic manuscript structure, Booktabs table formatting,
 * formal citation styles (APA/IEEE), figure/table captions, abstract/keywords styling,
 * and academic typography.
 */
export const academicManuscriptSkill: Skill = {
  id: "academic-manuscript",
  name: "Academic/Scientific Manuscript",
  shortName: "Academic Manuscript",
  version: "1.1.2",
  author: "kchemorion",
  repositoryUrl: "https://github.com/kchemorion/academic-manuscript-skill",
  description:
    "Structures academic and scientific manuscripts adhering to journal submission guidelines (APA/IEEE). Formats titles, abstracts, keywords, IMRAD sections, Booktabs-style three-line tables without vertical borders, formal citations, and captions.",
  priority: 3, // 3: Academic manuscript formatting
  category: "academic",
  enabled: true,
  isBuiltIn: true,
  features: [
    "Standard IMRAD section numbering (1. Introduction, 2. Methods, etc.)",
    "Booktabs three-line academic tables (top/bottom thick rules, no vertical borders)",
    "Formal citation standardization ([1], [1, 2], [1-3] and Author-Year)",
    "Standardized Figure and Table caption formatting",
    "Abstract and Keywords block formatting with indented presentation",
    "Academic page margins (1.0 inch / 1440 twip) and readable line spacing",
    "Running header and page numbering ('Page X of Y')",
  ],
  rules: [
    {
      id: "imrad-structure",
      name: "IMRAD Section Organization",
      description: "Organize content into numbered academic sections: # 1. Introduction, # 2. Materials & Methods, # 3. Results, # 4. Discussion, # 5. Conclusion, # References.",
      exampleInput: "Introduction section, followed by methods and results",
      exampleOutput: "# 1. Introduction\n\n## 1.1 Background\n...",
    },
    {
      id: "booktabs-tables",
      name: "Academic Booktabs Tables",
      description: "Format all tables with publication-quality three-line rules (thick top rule, header separator line, thick bottom rule) and zero vertical lines.",
      exampleInput: "| Variable | Mean | Std Dev |\n|---|---|---|\n| Score | 84.5 | 6.2 |",
      exampleOutput: "Publication table with top rule, thin header line, bottom rule, no vertical bars.",
    },
    {
      id: "formal-citations",
      name: "Academic Citation & Reference Linking",
      description: "Preserve in-text academic citations such as [1], [2], [1-3] or (Author, Year) and maintain a clean References bibliography.",
      exampleInput: "Previous studies [1, 2] demonstrated significant improvements.",
      exampleOutput: "Previous studies [1, 2] demonstrated significant improvements, linked to References.",
    },
    {
      id: "caption-formatting",
      name: "Figure & Table Captions",
      description: "Place Table captions above tables (**Table 1:** *Description*) and Figure captions below figures (**Figure 1:** *Caption*).",
      exampleInput: "Table 1 Summary of participants",
      exampleOutput: "**Table 1:** *Summary of demographic and baseline characteristics.*",
    },
  ],
  systemPromptInstruction: `[SKILL: Academic/Scientific Manuscript (academic-manuscript-skill)]
- Structure the document with numbered academic sections: e.g. # 1. Introduction, ## 1.1 Context, # 2. Methodology, # 3. Results, # 4. Discussion, # 5. Conclusion, # References.
- Include an Abstract and Keywords block when appropriate:
  > **Abstract:** Concise summary of objective, methods, key findings, and conclusions.
  > **Keywords:** Term 1, Term 2, Term 3 (3-6 keywords).
- Format all Markdown tables cleanly. Follow academic Booktabs guidelines: clean headers, numeric column center/right alignment, no unnecessary vertical dividers.
- Format Table captions above the table: **Table N:** *Descriptive Title*.
- Format Figure captions below the figure: **Figure N:** *Descriptive Legend*.
- Retain formal citations: [1], [2, 3], or (Author et al., Year). Do NOT remove legitimate academic citations.
- List all cited works under a dedicated '# References' section at the end of the manuscript.`,

  transformText: (text: string): string => {
    if (!text) return "";
    let s = text;

    // Standardize Table caption prefix: Table 1: -> **Table 1:** *...*
    s = s.replace(/^(?:Table\s+(\d+)[:\s]+)(.*?)$/gm, "**Table $1:** *$2*");

    // Standardize Figure caption prefix: Figure 1: -> **Figure 1:** *...*
    s = s.replace(/^(?:Figure\s+(\d+)[:\s]+)(.*?)$/gm, "**Figure $1:** *$2*");

    // Standardize Abstract block
    s = s.replace(/^Abstract:?\s*(.*)$/gim, "> **Abstract:** $1");

    // Standardize Keywords block
    s = s.replace(/^Keywords:?\s*(.*)$/gim, "> **Keywords:** $1");

    // Ensure References header is formatted cleanly
    s = s.replace(/^(?:#{1,3}\s*)?References:?$/gim, "# References");

    return s;
  },

  transformDocxOptions: (options: Record<string, any>): Record<string, any> => {
    return {
      ...options,
      tableStyle: "booktabs", // signals Booktabs border rendering
      lineSpacing: 276, // 1.15 line spacing
    };
  },
};
