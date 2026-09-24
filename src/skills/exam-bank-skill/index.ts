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
    "10-Step Academic Workflow: Input -> Preservation -> Year-wise -> Exam-wise -> Section/Question -> LaTeX -> Table & Matrix -> Side-note -> Quality Check -> Output",
    "Course header formatting (Course Code, Title, Credit Hours, Time Allowed)",
    "Hierarchical question numbering: Question 1 -> (a) -> (i) indentation",
    "Mark allocation brackets right-aligned: [3 Marks], [2 + 3 = 5 Marks]",
    "Choice markers ('Answer any THREE questions', 'OR' dividers)",
    "Matrix typesetting normalization using \\begin{bmatrix} ... \\end{bmatrix}",
    "Side-note and repeated-question note standardization (**Repeated Question:** ...)",
    "Preservation of year tags, examination names, and question metadata",
  ],
  rules: [
    {
      id: "exam-workflow",
      name: "10-Step Academic Workflow Execution",
      description: "Follows: Input -> Content Preservation -> Year-wise -> Exam-wise -> Section/Question -> LaTeX -> Table & Matrix -> Side-note -> Quality Check -> Output.",
      exampleInput: "2024 Final Exam Q1. Explain CLT. Repeated in 2018.",
      exampleOutput: "## 2024 Final Examination\n\n### Question 1\n\nExplain the Central Limit Theorem.\n\n**Repeated Question:** Identical question appeared in 2018 Final.",
    },
    {
      id: "exam-question-headers",
      name: "Question Number Normalization",
      description: "Standardize question headers as ### Question 1 with subparts as **(a)**, **(b)** and nested items as **(i)**, **(ii)**.",
      exampleInput: "q1. Explain CLT. a) define it. b) give formula.",
      exampleOutput: "### Question 1\n\n**(a)** Explain the Central Limit Theorem.\n\n**(b)** State the formal mathematical formula.",
    },
    {
      id: "exam-mark-brackets",
      name: "Mark Allocation Formatting",
      description: "Format point allocations into standard right-bracketed tags: [4 Marks].",
      exampleInput: "(5 pts) or 5 marks",
      exampleOutput: "[5 Marks]",
    },
    {
      id: "matrix-syntax-normalization",
      name: "Matrix Normalization",
      description: "Standardize matrices using LaTeX bmatrix syntax: \\begin{bmatrix} ... \\end{bmatrix}.",
      exampleInput: "[1 2; 3 4] or \\begin{matrix} 1 & 2 \\\\ 3 & 4 \\end{matrix}",
      exampleOutput: "\\[\n\\begin{bmatrix}\n1 & 2 \\\\\n3 & 4\n\\end{bmatrix}\n\\]",
    },
    {
      id: "side-note-standardization",
      name: "Side-Note & Repeat Standardization",
      description: "Standardize repeated-question notes and side-notes without removing or losing repeat information.",
      exampleInput: "Repeated question: see 2019 Final Q2",
      exampleOutput: "**Repeated Question:** Identical question in 2019 Final Examination Q2.",
    },
  ],
  systemPromptInstruction: `[SKILL: Academic Exam & Question Paper (exam-bank-skill)]
SYSTEM WORK FLOW:
Input Document -> Content Preservation -> Year-wise Classification -> Exam-wise Classification -> Section and Question Formatting -> LaTeX Detection and Correction -> Table and Matrix Formatting -> Side-note Standardization -> Final Quality Check -> Editable Standard Output

FORMATTING ORDER:
1. Do not solve the questions.
2. Do not change the mathematical meaning.
3. Do not remove repeated-question notes.
4. Do not invent missing information.
5. Correct only formatting, grammar, notation, and LaTeX syntax.
6. Preserve the original marks and question numbering.

TASKS:
- Preserve all original questions, marks, years, examinations, sections, and side notes.
- Arrange the content year-wise and examination-wise.
- Standardize headings, section names, question numbers, and sub-question labels.
- Correct LaTeX syntax: \\( ... \\) inline, \\[ ... \\] display, \\operatorname{rank}(A), \\operatorname{Var}(X), \\sum_{i=1}^{n}, \\chi^2_r, \\sim N(\\mu,\\sigma^2).
- Format matrices using \\begin{bmatrix} ... \\end{bmatrix}.
- Standardize tables using Markdown table format.
- Preserve all side notes and repeat information: **Repeated Question:** or **Note:**.
- Never create solutions or answer keys.
- Perform final quality check: verify numbering, LaTeX delimiters, matrix row breaks, brackets, and ensure no duplicated or missing questions.`,

  transformText: (text: string): string => {
    if (!text) return "";
    let s = text;

    // 1. Year and Examination classification normalization
    s = s.replace(/^(?:Exam(?:ination)?\s*Year\s*:?\s*|Year\s*:?\s*)(\d{4})/gim, "## Examination Year: $1\n\n");
    s = s.replace(/^(\d{4})\s*[-–]\s*(Final|Midterm|In-course|Annual)\s*(?:Exam(?:ination)?)?/gim, "## $1 $2 Examination\n\n");

    // 2. Normalize Question prefixes: Q1. -> ### Question 1
    s = s.replace(/^Q(\d+)\.?\s*/gim, "### Question $1\n\n");
    s = s.replace(/^Question\s*(\d+):?\s*/gim, "### Question $1\n\n");

    // 3. Sub-questions: a) / (a) -> **(a)**
    s = s.replace(/(?:^|\n)\s*(?:\(?([a-hA-H])\)|([a-hA-H])\.)\s+/g, "\n\n**($1$2)** ");

    // 4. Roman numerals: i) / (i) -> **(i)**
    s = s.replace(/(?:^|\n)\s*(?:\(?([ivxIVX]+)\)|([ivxIVX]+)\.)\s+/g, "\n\n**($1$2)** ");

    // 5. Standardize marks notation: (5 marks) -> [5 Marks]
    s = s.replace(/\((\d+)\s*marks?\)/gi, "[$1 Marks]");
    s = s.replace(/\((\d+)\s*pts?\)/gi, "[$1 Marks]");

    // 6. Standardize side-notes and repeated question notes
    s = s.replace(/(?:Repeated\s*question|Repeat\s*question|Repeated\s*in|Identical\s*to)\s*:?\s*(.+?)(?=\n|$)/gi, "**Repeated Question:** $1");
    s = s.replace(/(?:Side\s*note|Sidenote)\s*:?\s*(.+?)(?=\n|$)/gi, "**Side Note:** $1");

    // 7. Matrix normalization: \begin{matrix} / \begin{pmatrix} -> \begin{bmatrix}
    s = s.replace(/\\begin\{(?:matrix|pmatrix|vmatrix)\}([\s\S]*?)\\end\{(?:matrix|pmatrix|vmatrix)\}/g, "\\begin{bmatrix}$1\\end{bmatrix}");

    return s;
  },
};
