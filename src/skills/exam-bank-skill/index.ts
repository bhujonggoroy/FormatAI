import type { Skill } from "../types.ts";

/**
 * Skill 9: Academic Exam & Question Paper Formatting
 * Based on https://github.com/Academic-Skills-Hub/exam-bank-skill
 * 
 * Priority 3: Academic manuscript formatting.
 * Formats formal university examination question papers, question banks,
 * part lettering (a, b, c), sub-part numbering (i, ii, iii), mark allocations,
 * and exam metadata headers.
 */
export const examBankSkill: Skill = {
  id: "exam-bank-skill",
  name: "Academic Exam & Question Paper",
  shortName: "Exam Question Bank",
  version: "1.2.0",
  author: "Academic-Skills-Hub",
  repositoryUrl: "https://github.com/Academic-Skills-Hub/exam-bank-skill",
  license: "MIT License",
  role: "Structures university examination question papers, question banks, sub-parts, point brackets [5 marks], and rubric arrays.",
  description:
    "Structures academic examinations and problem sets: formats institutional course headers (Course Code, Title, Term), sequential question numbering (Question 1, 1(a), 1(b)(i)), right-aligned mark allocations, and data array formatting.",
  priority: 3, // 3: Academic manuscript formatting
  category: "academic",
  enabled: true,
  isBuiltIn: true,
  features: [
    "Course header formatting (Course Code, Title, Credit Hours, Time Allowed)",
    "Hierarchical question numbering: Question 1 -> (a) -> (i) indentation",
    "Mark allocation brackets right-aligned: [3 marks], [2 + 3 = 5 Marks]",
    "Choice markers ('Answer any THREE questions', 'OR' dividers)",
    "Exam data set presentation in clean centered arrays",
    "Preservation of year tags and question metadata",
  ],
  rules: [
    {
      id: "exam-question-headers",
      name: "Question Number Normalization",
      description: "Standardize question headers as **Question 1.** or ### Question 1 with subparts as **(a)**, **(b)**.",
      exampleInput: "q1. Explain CLT. a) define it. b) give formula.",
      exampleOutput: "### Question 1\n\n**(a)** Explain the Central Limit Theorem.\n**(b)** State the formal mathematical formula.",
    },
    {
      id: "exam-mark-brackets",
      name: "Mark Allocation Formatting",
      description: "Format point allocations into standard right-bracketed tags: [4 Marks].",
      exampleInput: "(5 pts) or 5 marks",
      exampleOutput: "[5 Marks]",
    },
  ],
  systemPromptInstruction: `[SKILL: Academic Exam & Question Paper (exam-bank-skill)]
- Format the exam title block: Course Code, Course Title, Examination Term, Full Marks.
- Format main questions as: ### Question 1, ### Question 2.
- Format sub-questions as bold letters: **(a)**, **(b)**, **(c)**.
- Format nested items as Roman numerals: **(i)**, **(ii)**, **(iii)**.
- Place mark allocations at the end of each question in square brackets: [4 Marks] or [2 + 3 = 5 Marks].
- Use centered data rows for raw observation sets.`,

  transformText: (text: string): string => {
    if (!text) return "";
    let s = text;

    // Normalize Question prefixes: Q1. -> Question 1.
    s = s.replace(/^Q(\d+)\.?\s*/gim, "### Question $1\n\n");
    s = s.replace(/^Question\s*(\d+):?\s*/gim, "### Question $1\n\n");

    // Standardize marks notation: (5 marks) -> [5 Marks]
    s = s.replace(/\((\d+)\s*marks?\)/gi, "[$1 Marks]");
    s = s.replace(/\((\d+)\s*pts?\)/gi, "[$1 Marks]");

    return s;
  },
};
