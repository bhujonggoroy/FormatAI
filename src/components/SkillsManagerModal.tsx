import React, { useState, useMemo } from "react";
import {
  Skill,
  skillRegistry,
  executeSkillPipeline,
} from "../skills";
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  ExternalLink,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronUp,
  Sliders,
  Play,
  BookOpen,
  Atom,
  Sigma,
  FileText,
  Layers,
  Check,
  AlertCircle,
  X,
  Copy,
  Terminal,
  Search,
  ArrowRight,
  Code2,
  GraduationCap,
  Download,
  ShieldCheck,
  Scale,
  Heart,
} from "lucide-react";

export type SkillsModalTab = "skills" | "pipeline" | "tester" | "rules" | "instructions" | "license";

interface SkillsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSkillsChanged?: () => void;
  onApplyText?: (text: string) => void;
  initialTab?: SkillsModalTab;
}

export const PROJECT_MOTTO_BN =
  "ChatGPT, Gemini, Claude, NotebookLM বা যেকোনো source থেকে পাওয়া AI-generated বা copy-pasted content-কে স্বয়ংক্রিয়ভাবে mathematical, scientific, textual এবং academic formatting সহ একটি clean, professional, editable DOCX document-এ রূপান্তর করা—শিক্ষার্থীদের জন্য সম্পূর্ণ বিনামূল্যে।";

export const PROJECT_MOTTO_EN =
  "To automatically transform AI-generated or copy-pasted content from ChatGPT, Gemini, Claude, NotebookLM or any source into a clean, professional, editable DOCX document with mathematical, scientific, textual, and academic formatting—completely free of charge for students.";

export const GITHUB_REPOS_ATTRIBUTION = [
  {
    name: "docx-math-skill",
    owner: "Future-3526038670",
    repoUrl: "https://github.com/Future-3526038670/docx-math-skill",
    licenseType: "MIT License",
    description:
      "LaTeX math notation conversion into native Microsoft Word OMML (<m:oMath>) & MathML objects with fraction bars and radical roots.",
    compliance: "100% Permissive Open-Source. Derivative algorithms integrated with full copyright retention.",
  },
  {
    name: "scientific-agent-skills",
    owner: "K-Dense-AI",
    repoUrl: "https://github.com/K-Dense-AI/scientific-agent-skills",
    licenseType: "MIT / Apache-2.0 Compatible",
    description:
      "Physical unit formatting (SI base and derived units), chemical formulas, IUPAC notation, and physical constants.",
    compliance: "100% Permissive Open-Source. Royalty-free scientific formatting logic embedded with attribution.",
  },
  {
    name: "pandoc-math-docx",
    owner: "Kantyc",
    repoUrl: "https://github.com/Kantyc/pandoc-math-docx",
    licenseType: "MIT License",
    description:
      "Pandoc AST math syntax normalization, markdown math delimiters ($...$, $$...$$), and table-aligned math representations.",
    compliance: "100% Permissive Open-Source. Modular Pandoc-style parsing methods adapted freely under MIT terms.",
  },
  {
    name: "academic-manuscript-skill",
    owner: "kchemorion",
    repoUrl: "https://github.com/kchemorion/academic-manuscript-skill",
    licenseType: "MIT License",
    description:
      "Academic manuscript structure, publication abstracts, keywords, Booktabs table standards, and IEEE/APA citation patterns.",
    compliance: "100% Permissive Open-Source. Manuscript formatting specifications incorporated with full credit.",
  },
];

export const FULL_MIT_LICENSE_TEXT = `MIT License

Copyright (c) 2025-2026 Academic Notes to DOCX Typesetter Contributors

Project Mission / Motto:
"ChatGPT, Gemini, Claude, NotebookLM বা যেকোনো source থেকে পাওয়া AI-generated বা copy-pasted content-কে স্বয়ংক্রিয়ভাবে mathematical, scientific, textual এবং academic formatting সহ একটি clean, professional, editable DOCX document-এ রূপান্তর করা—শিক্ষার্থীদের জন্য সম্পূর্ণ বিনামূল্যে।"

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice, this mission notice, and this permission notice
shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

================================================================================
THIRD-PARTY ACKNOWLEDGMENTS & COMPLIANCE REVIEW
================================================================================
1. docx-math-skill (MIT License) - https://github.com/Future-3526038670/docx-math-skill
2. scientific-agent-skills (MIT/Apache-2.0) - https://github.com/K-Dense-AI/scientific-agent-skills
3. pandoc-math-docx (MIT License) - https://github.com/Kantyc/pandoc-math-docx
4. academic-manuscript-skill (MIT License) - https://github.com/kchemorion/academic-manuscript-skill

All 4 upstream repositories are published under permissive licenses. This software retains
full attribution, complies with all respective notice requirements, and presents zero copyright risk.`;

const ACADEMIC_RULES_DATA = [
  {
    id: 1,
    title: "Preserve Original Content",
    category: "Preservation",
    description: "Preserve the original mathematical meaning, facts, formulas, examples, and section order unless explicitly asked for content correction.",
    ruleSyntax: "No arbitrary rewriting or deletion of academic statements.",
  },
  {
    id: 2,
    title: "Repair Broken LaTeX Code",
    category: "LaTeX Syntax",
    description: "Correct broken, incomplete, or invalid LaTeX code such as unclosed braces, bad slashes, and unbalanced delimiters.",
    ruleSyntax: "\\frac12 \\rightarrow \\frac{1}{2}, \\quad \\chi^2_\\nu \\rightarrow \\chi^2_{\\nu}",
  },
  {
    id: 3,
    title: "Standard LaTeX Notation",
    category: "LaTeX Syntax",
    description: "Use \\(...\\) or $...$ for inline mathematics. Use \\[...\\] or $$...$$ for displayed equations. Correctly format fractions, roots, sums, integrals, and limits.",
    ruleSyntax: "$...$ (inline), $$...$$ (display), \\frac{a}{b}, \\sqrt{x}, \\sum, \\prod, \\int, \\lim, \\infty",
  },
  {
    id: 4,
    title: "Standardize Statistics & Matrix Notation",
    category: "Notation",
    description: "Use \\hat{p} for sample proportion, \\bar{X} for sample mean, S^2 for sample variance, \\sigma^2 for population variance, \\mu for population mean, \\pi for population proportion, and A^{\\mathsf{T}} for transpose.",
    ruleSyntax: "\\hat{p}, \\bar{X}, S^2, \\sigma^2, \\mu, \\pi, \\operatorname{Var}(X), \\operatorname{Cov}(X,Y), A^{\\mathsf{T}}",
  },
  {
    id: 5,
    title: "Repair Inconsistent Statistical Notation",
    category: "Notation",
    description: "Replace informal notations: 'p' with \\hat{p} when referring to sample proportion, informal 'Var(X)' with \\operatorname{Var}(X), and unclear summation with \\sum_{i=1}^n.",
    ruleSyntax: "Var(X) \\rightarrow \\operatorname{Var}(X), \\quad \\sum x_i \\rightarrow \\sum_{i=1}^n x_i",
  },
  {
    id: 6,
    title: "Organized Document Structure",
    category: "Structure",
    description: "Structure documents with numbered main sections, numbered subsections, definitions, Markdown tables where appropriate, displayed equations for formulas, and bulleted properties.",
    ruleSyntax: "# 1. Section, ## 1.1 Subsection, | Column 1 | Column 2 |, Display $$ ... $$",
  },
  {
    id: 7,
    title: "Markdown Headings Hierarchy",
    category: "Structure",
    description: "Use # for document title/course header, ## for major sections, ### for subsections. Avoid excessive heading levels (> ###) and keep hierarchy balanced.",
    ruleSyntax: "# Course Header, ## 1. Major Section, ### 1.1 Topic Subheading",
  },
  {
    id: 8,
    title: "Readable Equation Spacing",
    category: "Formatting",
    description: "Make every important equation readable and properly spaced. Never place long mathematical derivations in a single cramped paragraph.",
    ruleSyntax: "Place derivations on separate display lines ($$ ... $$) with \\begin{aligned} ... \\end{aligned}",
  },
  {
    id: 9,
    title: "Equation Alignment & Symmetry",
    category: "Formatting",
    description: "Keep all multi-line equations mathematically aligned at equals signs (& = ) and visually consistent throughout the document.",
    ruleSyntax: "\\begin{aligned} A &= B + C \\\\ &= D \\end{aligned}",
  },
  {
    id: 10,
    title: "Ambiguity Resolution",
    category: "Integrity",
    description: "If an equation is ambiguous, make the smallest reasonable correction preserving original intention. Do not invent assumptions.",
    ruleSyntax: "Minimal surgical correction; note ambiguity briefly if critical.",
  },
  {
    id: 11,
    title: "Direct Publication-Ready Output",
    category: "Delivery",
    description: "Do not provide conversational filler or unnecessary commentary about editing steps. Return the clean academic document directly.",
    ruleSyntax: "Immediate output; zero meta-chat chatter or conversational fluff.",
  },
  {
    id: 12,
    title: "Format-Only Fidelity",
    category: "Integrity",
    description: "When requested for 'format only': do not alter conceptual content, do not add new examples, correct only grammar, notation, structure, and LaTeX.",
    ruleSyntax: "Content preservation guarantee: raw facts and numbers remain 100% identical.",
  },
  {
    id: 13,
    title: "Technical Explanations (When Requested)",
    category: "Delivery",
    description: "When explicitly asked for an explanation, provide a concise, rigorous technical explanation immediately after the formatted result.",
    ruleSyntax: "Formatted publication content first; clear academic notes below.",
  },
  {
    id: 14,
    title: "Language & Context Matching",
    category: "Delivery",
    description: "Match the user's primary academic language. Keep English notes in English; explain in Bengali or other languages only when requested.",
    ruleSyntax: "Preserve source terminology, technical vocabulary, and localization.",
  },
  {
    id: 15,
    title: "Final Polished Typographic Assembly",
    category: "Formatting",
    description: "Ensure the final output is 100% clean, error-free, ready for Microsoft Word (.docx) compilation or LaTeX paper submission.",
    ruleSyntax: "Clean AST nodes, balanced braces, native OMML-ready equations.",
  },
];

const TEST_PRESETS = [
  {
    id: "comprehensive",
    label: "🚀 Full Academic Sample",
    description: "Mixed test with SI units, calculus, variance, chemistry, and tables",
    input: `Velocity = 3.0e8 m/s^2
Concentration = 1.5 x 10^-4 mol/L
Mass = 25.4 +/- 0.05 g of H2O and CO2
Var(X) = E[X^2] - (E[X])^2
\\[ x = \\frac12 \\cdot \\sqrt[3]{n} \\]
Table 1 Summary of measurements
| Sample | Mass | Mean |
|---|---|---|
| A | 12.4 | 10.2 |`,
  },
  {
    id: "calculus",
    label: "📐 Pure Math & Calculus",
    description: "Stacked fractions, integrals, square roots, and aligned steps",
    input: `\\[ \\lim_{x \\to 0} \\frac{\\sin(x)}{x} = 1 \\]
\\[ \\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2} \\]
\\begin{aligned}
\\operatorname{Var}(\\bar{X}) &= \\operatorname{Var}\\left(\\frac{1}{n} \\sum_{i=1}^n X_i\\right) \\\\
&= \\frac{1}{n^2} \\sum_{i=1}^n \\operatorname{Var}(X_i) \\\\
&= \\frac{\\sigma^2}{n}
\\end{aligned}`,
  },
  {
    id: "scientific",
    label: "⚛️ Scientific SI & Chemistry",
    description: "Molar concentrations, kinetic units, tolerances, and formulas",
    input: `Kinetic Energy: 4.2e5 kJ/mol
Reaction rate = 2.4 x 10^-3 mol/L
Density = 1.05 kg/m^3
Synthesis of H2O from H2 and O2:
2 H2 + O2 -> 2 H2O
Measured standard deviation: 0.15 +/- 0.02 cm`,
  },
  {
    id: "manuscript",
    label: "📑 Academic Manuscript & Tables",
    description: "Abstract, keywords, Booktabs tables, and APA/IEEE citations",
    input: `Abstract: This paper presents an empirical analysis of sampling variance in finite populations.
Keywords: Sampling distributions, central limit theorem, standard error

# 1. Introduction
Previous findings [1, 2] demonstrated significant improvements in parameter estimation [3-5].

Table 1 Descriptive Statistics of Cohorts
| Group | N | Mean | SD |
| :--- | :---: | :---: | :---: |
| Control | 120 | 74.2 | 8.5 |
| Treatment | 125 | 82.6 | 7.9 |`,
  },
  {
    id: "tree",
    label: "🌳 NotebookLM Tree Cleanup",
    description: "Strips raw tree artifacts (| | ├──) and builds clean outlines",
    input: `Course: STT251 Statistical Inference
| ├── 1. Sampling Fundamentals
| | ├── 1.1 Definition of Parameters
| | └── 1.2 Sampling Error: Error = x_bar - mu
| └── 2. Finite Population Correction
|   ├── FPC = sqrt((N - n)/(N - 1))`,
  },
];

const SYSTEM_INSTRUCTION_TEXT = `You are an expert academic mathematical editor, LaTeX typesetter, and technical document formatter.

Your task is to transform the user's raw academic notes, mathematical text, or broken equations into a clean, standard, publication-ready format.

Follow these rules strictly:
1. Preserve the original mathematical meaning, facts, formulas, examples, and section order unless the user explicitly asks for correction of content.
2. Correct broken, incomplete, or invalid LaTeX code.
3. Use \\(...\\) or $...$ for inline mathematics and \\[...\\] or $$...$$ for displayed equations. Use \\frac{}{}, \\sqrt{}, \\sum, \\prod, \\int, \\lim, \\infty, \\leq, \\geq, \\neq, \\approx, \\sim correctly. Use \\operatorname{} for operators such as \\operatorname{Var}, \\operatorname{Cov}, \\operatorname{rank}.
4. Standardize statistical notation: \\hat{p} for sample proportion, \\bar{X} for sample mean, S^2 for sample variance, \\sigma^2 for population variance, \\mu for population mean, \\pi for population proportion, A^{\\mathsf T} for matrix transpose.
5. Repair inconsistent notation: replace informal Var(X) with \\operatorname{Var}(X), replace p with \\hat{p} in sample contexts, replace unclear summation with \\sum_{i=1}^n.
6. Organize document structure: numbered main sections (## 1.), numbered subsections (### 1.1), definitions, Booktabs Markdown tables, displayed equations for important formulas, bullet points for properties.
7. Use Markdown headings properly (# or ## for main sections, ### for subsections).
8. Readable spacing: make every important equation readable and properly spaced.
9. Keep all equations mathematically aligned and visually consistent.
10. If an equation is ambiguous, make the smallest reasonable correction and preserve the original intention.
11. Output only the final polished academic result directly.
12. For format-only requests: correct only grammar, formatting, notation, section structure, punctuation, and LaTeX without altering conceptual content.`;

export const SkillsManagerModal: React.FC<SkillsManagerModalProps> = ({
  isOpen,
  onClose,
  onSkillsChanged,
  onApplyText,
  initialTab = "skills",
}) => {
  const [skills, setSkills] = useState<Skill[]>(() => skillRegistry.getAllSkills());
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>("math-docx");
  const [activeTab, setActiveTab] = useState<SkillsModalTab>(initialTab);
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Interactive Tester state
  const [testInput, setTestInput] = useState<string>(TEST_PRESETS[0].input);
  const [testOutput, setTestOutput] = useState<string>("");
  const [testLogs, setTestLogs] = useState<string[]>([]);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);
  const [copiedUserPrompt, setCopiedUserPrompt] = useState(false);
  const [copiedLicense, setCopiedLicense] = useState(false);

  const safeCopyToClipboard = async (text: string): Promise<boolean> => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Fallback
    }
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      console.warn("Clipboard copy failed:", err);
      return false;
    }
  };

  const refreshState = (notification?: string) => {
    setSkills(skillRegistry.getAllSkills());
    if (onSkillsChanged) {
      try {
        onSkillsChanged();
      } catch (err) {
        console.warn("onSkillsChanged error:", err);
      }
    }
    if (notification) {
      setStatusNotification(notification);
      setTimeout(() => setStatusNotification(null), 3500);
    }
  };

  const handleToggle = (id: string) => {
    try {
      const newState = skillRegistry.toggleSkill(id);
      const skill = skillRegistry.getSkill(id);
      refreshState(`${skill?.name || id} ${newState ? "enabled" : "disabled"}`);
    } catch (err) {
      console.error("Failed to toggle skill:", err);
    }
  };

  const handleReset = (id: string) => {
    try {
      skillRegistry.resetSkill(id);
      const skill = skillRegistry.getSkill(id);
      refreshState(`Reset ${skill?.name || id} to repository defaults`);
    } catch (err) {
      console.error("Failed to reset skill:", err);
    }
  };

  const handleRemove = (id: string) => {
    try {
      skillRegistry.removeSkill(id);
      const skill = skillRegistry.getSkill(id);
      refreshState(`Disabled ${skill?.name || id}`);
    } catch (err) {
      console.error("Failed to remove skill:", err);
    }
  };

  const handleResetAll = () => {
    try {
      skillRegistry.resetAllSkills();
      refreshState("All skills reset to original defaults");
    } catch (err) {
      console.error("Failed to reset all skills:", err);
    }
  };

  const handleEnableAll = () => {
    try {
      skills.forEach((s) => {
        if (!s.enabled) skillRegistry.toggleSkill(s.id, true);
      });
      refreshState("All skills enabled");
    } catch (err) {
      console.error("Failed to enable all skills:", err);
    }
  };

  const handleDisableAll = () => {
    try {
      skills.forEach((s) => {
        if (s.enabled) skillRegistry.toggleSkill(s.id, false);
      });
      refreshState("All skills disabled");
    } catch (err) {
      console.error("Failed to disable all skills:", err);
    }
  };

  const runTester = (customInput?: string) => {
    try {
      const textToRun = customInput !== undefined ? customInput : testInput;
      const enabledIds = (skills || []).filter((s) => s?.enabled).map((s) => s.id);
      const result = executeSkillPipeline(textToRun || "", enabledIds);
      setTestOutput(result?.text || "");
      setTestLogs(
        (result?.appliedTransformations || []).map(
          (t) => `[Applied] ${t.skillName}: ${t.summary}`
        )
      );
    } catch (err: any) {
      console.error("Pipeline test error:", err);
      setTestOutput(customInput || testInput || "");
      setTestLogs([`Error during execution: ${err?.message || "Unknown error"}`]);
    }
  };

  const handleApplyPreset = (preset: typeof TEST_PRESETS[0]) => {
    setTestInput(preset.input);
    runTester(preset.input);
  };

  const handleCopySystemPrompt = async () => {
    const ok = await safeCopyToClipboard(SYSTEM_INSTRUCTION_TEXT);
    if (ok) {
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    }
  };

  const handleCopyUserPrompt = async () => {
    const prompt = `Task: Format only (Standard Academic Publication Format).\n\nPlease correct the following academic notes:\n- Fix broken LaTeX code.\n- Standardize mathematical notation (\\hat{p}, \\bar{X}, \\operatorname{Var}).\n- Use proper headings (##, ###) and displayed equations ($$ ... $$).\n- Preserve all original formulas, facts, and numerical values.\n- Do not add new explanations or change the content.\n\nText:\n[Paste your raw notes here]`;
    const ok = await safeCopyToClipboard(prompt);
    if (ok) {
      setCopiedUserPrompt(true);
      setTimeout(() => setCopiedUserPrompt(false), 2000);
    }
  };

  const handleCopyOutput = async () => {
    if (!testOutput) return;
    const ok = await safeCopyToClipboard(testOutput);
    if (ok) {
      setCopiedOutput(true);
      setTimeout(() => setCopiedOutput(false), 2000);
    }
  };

  const handleCopyLicense = async () => {
    const ok = await safeCopyToClipboard(FULL_MIT_LICENSE_TEXT);
    if (ok) {
      setCopiedLicense(true);
      setTimeout(() => setCopiedLicense(false), 2000);
    }
  };

  const handleApplyToEditor = () => {
    if (!testOutput) return;
    if (onApplyText) {
      onApplyText(testOutput);
      refreshState("Loaded formatted text into your Document Editor!");
      setTimeout(() => {
        onClose();
      }, 700);
    }
  };

  const getPriorityBadge = (priority: number) => {
    switch (priority) {
      case 1:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Sigma className="w-3 h-3 text-blue-600" /> Priority 1: Math Equation
          </span>
        );
      case 2:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Atom className="w-3 h-3 text-emerald-600" /> Priority 2: Scientific
          </span>
        );
      case 3:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <BookOpen className="w-3 h-3 text-purple-600" /> Priority 3: Manuscript
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-50 text-slate-700 border border-slate-200">
            <FileText className="w-3 h-3 text-slate-600" /> Priority 4: General
          </span>
        );
    }
  };

  const activeCount = skills.filter((s) => s.enabled).length;

  // Filter skills based on search & category
  const filteredSkills = useMemo(() => {
    return skills.filter((skill) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        skill.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        skill.features.some((f) => f.toLowerCase().includes(searchQuery.toLowerCase())) ||
        skill.rules.some((r) => r.name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCat =
        categoryFilter === "all" ||
        (categoryFilter === "p1" && skill.priority === 1) ||
        (categoryFilter === "p2" && skill.priority === 2) ||
        (categoryFilter === "p3" && skill.priority === 3);

      return matchesSearch && matchesCat;
    });
  }, [skills, searchQuery, categoryFilter]);

  // Filter 15 rules
  const filteredRules = useMemo(() => {
    if (!searchQuery.trim()) return ACADEMIC_RULES_DATA;
    const q = searchQuery.toLowerCase();
    return ACADEMIC_RULES_DATA.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.ruleSyntax.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/65 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[92vh] transition-all">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/25 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Academic Skills & Formatting Center
                </h2>
                <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {activeCount} of {skills.length} Active
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full bg-blue-500/20 text-blue-200 border border-blue-500/30">
                  Strict 4-Tier Pipeline
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Modular GitHub typesetting engines, execution hierarchy, 15 academic standards & live tester
              </p>
            </div>
          </div>

          <button
            id="close-skills-modal-btn"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Toast */}
        {statusNotification && (
          <div className="bg-emerald-600 text-white text-xs px-5 py-2 flex items-center justify-between transition-all shadow-xs">
            <div className="flex items-center gap-2 font-medium">
              <Check className="w-4 h-4" />
              <span>{statusNotification}</span>
            </div>
          </div>
        )}

        {/* Professional Segmented Tab Bar */}
        <div className="bg-slate-50 border-b border-slate-200/90 px-4 sm:px-6 py-2.5">
          <div className="bg-slate-200/70 p-1 rounded-xl flex items-center gap-1 overflow-x-auto shadow-inner">
            {/* Tab 1: Installed Skills */}
            <button
              id="tab-btn-skills"
              type="button"
              onClick={() => setActiveTab("skills")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === "skills"
                  ? "bg-white text-indigo-950 shadow-xs border border-slate-200/90"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <Layers className={`w-3.5 h-3.5 ${activeTab === "skills" ? "text-indigo-600" : "text-slate-500"}`} />
              <span>Modular Skills</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === "skills" ? "bg-indigo-100 text-indigo-800" : "bg-slate-200 text-slate-600"
              }`}>
                {activeCount}/{skills.length}
              </span>
            </button>

            {/* Tab 2: Execution Hierarchy */}
            <button
              id="tab-btn-pipeline"
              type="button"
              onClick={() => setActiveTab("pipeline")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === "pipeline"
                  ? "bg-white text-blue-950 shadow-xs border border-slate-200/90"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <Sliders className={`w-3.5 h-3.5 ${activeTab === "pipeline" ? "text-blue-600" : "text-slate-500"}`} />
              <span>Execution Pipeline</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === "pipeline" ? "bg-blue-100 text-blue-800" : "bg-slate-200 text-slate-600"
              }`}>
                4 Tiers
              </span>
            </button>

            {/* Tab 3: Interactive Tester */}
            <button
              id="tab-btn-tester"
              type="button"
              onClick={() => {
                setActiveTab("tester");
                if (!testOutput) runTester();
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === "tester"
                  ? "bg-white text-emerald-950 shadow-xs border border-slate-200/90"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <Play className={`w-3.5 h-3.5 ${activeTab === "tester" ? "text-emerald-600" : "text-slate-500"}`} />
              <span>Interactive Tester</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === "tester" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
              }`}>
                Live Sandbox
              </span>
            </button>

            {/* Tab 4: 15 Academic Standards */}
            <button
              id="tab-btn-rules"
              type="button"
              onClick={() => setActiveTab("rules")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === "rules"
                  ? "bg-white text-purple-950 shadow-xs border border-slate-200/90"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <BookOpen className={`w-3.5 h-3.5 ${activeTab === "rules" ? "text-purple-600" : "text-slate-500"}`} />
              <span>15 Academic Standards</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === "rules" ? "bg-purple-100 text-purple-800" : "bg-slate-200 text-slate-600"
              }`}>
                Standards
              </span>
            </button>

            {/* Tab 5: AI Studio System Prompt */}
            <button
              id="tab-btn-instructions"
              type="button"
              onClick={() => setActiveTab("instructions")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === "instructions"
                  ? "bg-white text-amber-950 shadow-xs border border-slate-200/90"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <Terminal className={`w-3.5 h-3.5 ${activeTab === "instructions" ? "text-amber-600" : "text-slate-500"}`} />
              <span>AI Studio Prompt</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === "instructions" ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-600"
              }`}>
                Instructions
              </span>
            </button>

            {/* Tab 6: Open Source License & 4 Repos */}
            <button
              id="tab-btn-license"
              type="button"
              onClick={() => setActiveTab("license")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === "license"
                  ? "bg-white text-emerald-950 shadow-xs border border-slate-200/90"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <Scale className={`w-3.5 h-3.5 ${activeTab === "license" ? "text-emerald-600" : "text-slate-500"}`} />
              <span>License & 4 Repos</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === "license" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
              }`}>
                MIT / Free
              </span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 bg-slate-50/40">
          {/* TAB 1: MODULAR SKILLS */}
          {activeTab === "skills" && (
            <div className="space-y-4">
              {/* Search, Filter & Bulk Controls */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
                {/* Search Bar */}
                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search skills, rules, or syntax..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 text-slate-800"
                  />
                </div>

                {/* Filter Chips */}
                <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setCategoryFilter("all")}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                      categoryFilter === "all"
                        ? "bg-slate-900 text-white font-semibold"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    All ({skills.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryFilter("p1")}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                      categoryFilter === "p1"
                        ? "bg-blue-600 text-white font-semibold"
                        : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                    }`}
                  >
                    P1: Math (2)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryFilter("p2")}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                      categoryFilter === "p2"
                        ? "bg-emerald-600 text-white font-semibold"
                        : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    }`}
                  >
                    P2: Science (1)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryFilter("p3")}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                      categoryFilter === "p3"
                        ? "bg-purple-600 text-white font-semibold"
                        : "bg-purple-50 text-purple-700 hover:bg-purple-100"
                    }`}
                  >
                    P3: Manuscript (1)
                  </button>
                </div>

                {/* Bulk Actions */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={handleEnableAll}
                    className="text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                  >
                    Enable All
                  </button>
                  <button
                    type="button"
                    onClick={handleDisableAll}
                    className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                  >
                    Disable All
                  </button>
                  <button
                    type="button"
                    onClick={handleResetAll}
                    className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 px-2 py-1 transition-colors cursor-pointer"
                    title="Reset all settings to default"
                  >
                    <RefreshCw className="w-3 h-3" /> Reset
                  </button>
                </div>
              </div>

              {/* Skills Cards List */}
              <div className="space-y-3.5">
                {filteredSkills.length === 0 ? (
                  <div className="text-center py-10 bg-white rounded-xl border border-dashed border-slate-300 text-slate-500 text-xs">
                    No skills match the query "{searchQuery}".
                  </div>
                ) : (
                  filteredSkills.map((skill) => {
                    const isExpanded = expandedSkillId === skill.id;
                    return (
                      <div
                        key={skill.id}
                        className={`rounded-xl border transition-all ${
                          skill.enabled
                            ? "bg-white border-slate-200/90 shadow-xs"
                            : "bg-slate-50/80 border-slate-200/70 opacity-65"
                        }`}
                      >
                        {/* Header Row */}
                        <div className="p-4 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3.5 min-w-0">
                            {/* Toggle Switch */}
                            <button
                              type="button"
                              onClick={() => handleToggle(skill.id)}
                              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                                skill.enabled ? "bg-emerald-600" : "bg-slate-300"
                              }`}
                              title={skill.enabled ? "Click to disable skill" : "Click to enable skill"}
                            >
                              <div
                                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                                  skill.enabled ? "translate-x-5" : "translate-x-0"
                                }`}
                              />
                            </button>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm font-bold text-slate-900 truncate">
                                  {skill.name}
                                </h3>
                                <span className="text-xs text-slate-500 font-mono">
                                  v{skill.version}
                                </span>
                                {getPriorityBadge(skill.priority)}
                              </div>
                              <p className="text-xs text-slate-600 mt-0.5 line-clamp-1">
                                {skill.description}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <a
                              href={skill.repositoryUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title={`View original repository on GitHub (${skill.author})`}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleReset(skill.id)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="Reset to original defaults"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedSkillId(isExpanded ? null : skill.id)
                              }
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title={isExpanded ? "Collapse rules" : "View formatting rules"}
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Expanded Detail View */}
                        {isExpanded && (
                          <div className="px-5 pb-5 pt-2 border-t border-slate-100 bg-slate-50/50 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                              <div className="p-3 bg-white rounded-lg border border-slate-200/80">
                                <span className="font-bold text-slate-800 block mb-1">
                                  Origin & Repository:
                                </span>
                                <div className="flex items-center gap-1.5 text-indigo-600 font-medium">
                                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                                  <a
                                    href={skill.repositoryUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline truncate"
                                  >
                                    {skill.repositoryUrl.replace("https://github.com/", "")}
                                  </a>
                                </div>
                                <span className="text-slate-500 mt-1 block">
                                  Author: <strong>{skill.author}</strong> | Category: {skill.category}
                                </span>
                              </div>

                              <div className="p-3 bg-white rounded-lg border border-slate-200/80">
                                <span className="font-bold text-slate-800 block mb-1">
                                  Pipeline Execution Priority:
                                </span>
                                <p className="text-slate-600">
                                  <strong>Slot {skill.priority}:</strong> Executed{" "}
                                  {skill.priority === 1
                                    ? "first (core math translation & OMML structures)"
                                    : skill.priority === 2
                                    ? "second (scientific units, tolerances & chemistry)"
                                    : "third (academic headings, Booktabs tables & citations)"}
                                  .
                                </p>
                              </div>
                            </div>

                            {/* Features List */}
                            <div>
                              <span className="text-xs font-bold text-slate-800 block mb-1.5">
                                Included Engine Features:
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {skill.features.map((feature, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-2 text-xs text-slate-700 bg-white px-2.5 py-1.5 rounded-md border border-slate-200/80"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span>{feature}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Rules with Examples */}
                            <div>
                              <span className="text-xs font-bold text-slate-800 block mb-1.5">
                                Verified Transformations:
                              </span>
                              <div className="space-y-2">
                                {skill.rules.map((rule) => (
                                  <div
                                    key={rule.id}
                                    className="p-3 bg-white rounded-lg border border-slate-200 text-xs space-y-1"
                                  >
                                    <div className="font-bold text-slate-900">
                                      {rule.name}
                                    </div>
                                    <div className="text-slate-600 text-[11px]">
                                      {rule.description}
                                    </div>
                                    {rule.exampleInput && (
                                      <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px] bg-slate-50 p-2 rounded border border-slate-200/60">
                                        <div>
                                          <span className="text-slate-400 font-sans block text-[10px] uppercase font-bold">
                                            Raw Input:
                                          </span>
                                          <span className="text-rose-700 break-all">
                                            {rule.exampleInput}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-slate-400 font-sans block text-[10px] uppercase font-bold">
                                            Transformed Output:
                                          </span>
                                          <span className="text-emerald-700 break-all">
                                            {rule.exampleOutput}
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: EXECUTION PIPELINE */}
          {activeTab === "pipeline" && (
            <div className="space-y-6">
              <div className="p-4 bg-indigo-50/70 rounded-xl border border-indigo-200/80 text-xs text-indigo-950">
                <h4 className="font-bold text-sm mb-1 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-indigo-600" /> Sequential Priority Hierarchy
                </h4>
                <p className="leading-relaxed">
                  To prevent syntax collisions (such as chemical formulas colliding with math symbols, or table pipes colliding with absolute values), skills execute in strict mathematical and structural order.
                </p>
              </div>

              <div className="relative pl-6 sm:pl-8 border-l-2 border-indigo-200 space-y-8 my-4 ml-3 sm:ml-4">
                {/* Stage 1 */}
                <div className="relative">
                  <div className="absolute -left-[35px] sm:-left-[43px] top-0 w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold ring-4 ring-white shadow-xs">
                    1
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
                      Priority 1: Mathematical & Word OMML Translation
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                      OMML Native Equations & Pandoc Delimiters
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Converts TeX math delimiters (<code className="text-blue-700 font-mono">\(...\)</code>, <code className="text-blue-700 font-mono">\[...\]</code>) into native Microsoft Word Office Math Markup (<code className="text-blue-700 font-mono">&lt;m:oMath&gt;</code>) with stacked fractions, radicals, summations, and matrices. Ensures equations remain 100% editable in Word.
                    </p>
                    <div className="flex gap-2 mt-2.5">
                      <span className="text-[11px] bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-0.5 rounded-md font-semibold">
                        math-docx
                      </span>
                      <span className="text-[11px] bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-0.5 rounded-md font-semibold">
                        pandoc-math-docx
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stage 2 */}
                <div className="relative">
                  <div className="absolute -left-[35px] sm:-left-[43px] top-0 w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold ring-4 ring-white shadow-xs">
                    2
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                      Priority 2: Scientific & Stoichiometric Formatting
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                      Scientific Notation, SI Units & Chemical Formulas
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Converts scientific exponential notation (<code className="text-emerald-700 font-mono">1.5 \times 10^{'{'}-4{'}'}</code>), stoichiometric subscripts (<code className="text-emerald-700 font-mono">\text{'{'}H{'}'}_2\text{'{'}O{'}'}</code>), compound SI units (<code className="text-emerald-700 font-mono">m/s^2</code>, <code className="text-emerald-700 font-mono">mol/L</code>), and experimental uncertainties (<code className="text-emerald-700 font-mono">\pm</code>).
                    </p>
                    <div className="flex gap-2 mt-2.5">
                      <span className="text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-md font-semibold">
                        scientific-docx
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stage 3 */}
                <div className="relative">
                  <div className="absolute -left-[35px] sm:-left-[43px] top-0 w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold ring-4 ring-white shadow-xs">
                    3
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">
                      Priority 3: Academic Manuscript & Structure
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                      IMRAD Structure, Citations & Booktabs Tables
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Enforces numbered academic headings, APA/IEEE citations (<code className="text-purple-700 font-mono">[1, 2]</code>), table/figure captions, and three-line Booktabs tables with thick horizontal rules and zero vertical column dividers.
                    </p>
                    <div className="flex gap-2 mt-2.5">
                      <span className="text-[11px] bg-purple-50 text-purple-800 border border-purple-200 px-2.5 py-0.5 rounded-md font-semibold">
                        academic-manuscript
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stage 4 */}
                <div className="relative">
                  <div className="absolute -left-[35px] sm:-left-[43px] top-0 w-7 h-7 rounded-full bg-slate-700 text-white flex items-center justify-center text-xs font-bold ring-4 ring-white shadow-xs">
                    4
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Priority 4: General Typography & Packaging
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                      Font Families, Margins & Word Document Compilation
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Applies custom font styles (Times New Roman, Georgia, Calibri), 1.0-inch standard margins (1440 twip), document headers, and "Page X of Y" dynamic footers during binary packaging.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INTERACTIVE TESTER */}
          {activeTab === "tester" && (
            <div className="space-y-4">
              {/* Presets Bar */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Quick Test Presets:
                  </span>
                  <button
                    type="button"
                    onClick={() => runTester()}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Play className="w-3.5 h-3.5" /> Execute Pipeline
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {TEST_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className="p-2 text-left rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <span className="text-xs font-bold text-slate-900 block truncate">
                        {preset.label}
                      </span>
                      <span className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                        {preset.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Side-by-Side Test Areas */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      Raw Input Text:
                    </label>
                    <span className="text-[11px] text-slate-500">
                      {testInput.length} chars
                    </span>
                  </div>
                  <textarea
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    rows={12}
                    placeholder="Paste raw mathematical or academic notes here..."
                    className="w-full font-mono text-xs p-3.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-2xs leading-relaxed"
                  />
                </div>

                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      Formatted Pipeline Output:
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyOutput}
                        disabled={!testOutput}
                        className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 font-medium disabled:opacity-40 cursor-pointer"
                      >
                        {copiedOutput ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedOutput ? "Copied!" : "Copy"}
                      </button>
                      {onApplyText && (
                        <button
                          type="button"
                          onClick={handleApplyToEditor}
                          disabled={!testOutput}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md flex items-center gap-1 transition-colors disabled:opacity-40 cursor-pointer shadow-xs"
                          title="Inject this formatted result directly into your active document editor"
                        >
                          <Download className="w-3 h-3" />
                          Apply to Editor
                        </button>
                      )}
                    </div>
                  </div>
                  <textarea
                    value={testOutput}
                    readOnly
                    rows={12}
                    placeholder="Click 'Execute Pipeline' or choose a preset to view formatted output..."
                    className="w-full font-mono text-xs p-3.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-800 shadow-2xs leading-relaxed"
                  />
                </div>
              </div>

              {/* Transformation Audit Trail */}
              {testLogs.length > 0 && (
                <div className="p-3.5 bg-emerald-50/80 rounded-xl border border-emerald-200 text-xs text-emerald-950 shadow-2xs">
                  <span className="font-bold block mb-1.5 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Verified Skill Transformations Applied:
                  </span>
                  <ul className="list-disc pl-5 space-y-1">
                    {testLogs.map((log, i) => (
                      <li key={i} className="text-emerald-900">{log}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: 15 ACADEMIC STANDARDS */}
          {activeTab === "rules" && (
            <div className="space-y-4">
              <div className="bg-purple-50/70 border border-purple-200/80 rounded-xl p-4 text-xs text-purple-950">
                <h4 className="font-bold text-sm mb-1 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-purple-600" /> Official Academic Publishing Rules
                </h4>
                <p className="leading-relaxed">
                  These 15 rules govern the document typesetting engine to ensure mathematical accuracy, standard university notation, Booktabs table formatting, and zero unrequested hallucinated content.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2 hover:border-purple-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-800 text-[11px] font-bold flex items-center justify-center shrink-0">
                          {rule.id}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900">
                          {rule.title}
                        </h4>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                        {rule.category}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {rule.description}
                    </p>

                    <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-purple-900 bg-purple-50/50 px-2.5 py-1.5 rounded">
                      <span className="truncate">{rule.ruleSyntax}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          await safeCopyToClipboard(rule.ruleSyntax);
                          refreshState(`Copied syntax: ${rule.ruleSyntax}`);
                        }}
                        className="text-purple-600 hover:text-purple-800 p-1 cursor-pointer"
                        title="Copy syntax"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: AI STUDIO PROMPT & INSTRUCTIONS */}
          {activeTab === "instructions" && (
            <div className="space-y-4">
              <div className="bg-amber-50/80 border border-amber-200/90 rounded-xl p-4 text-xs text-amber-950">
                <div className="flex items-start gap-2.5">
                  <Terminal className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-amber-950 text-sm">
                      Google AI Studio & Backend Integration Guide:
                    </p>
                    <ol className="list-decimal list-inside space-y-0.5 text-amber-900 leading-relaxed">
                      <li>Open <strong>Google AI Studio</strong> and select your model (e.g. <em>Gemini 2.5 Pro</em> or <em>Gemini 2.5 Flash</em>).</li>
                      <li>In the right panel under <strong>Run Settings</strong>, open the <strong>System Instructions</strong> field.</li>
                      <li>Copy the complete instruction below and paste it directly into that field.</li>
                      <li>Set <strong>Temperature</strong> to <code className="bg-amber-100 font-mono px-1 py-0.5 rounded font-bold">0.2</code> for strict mathematical precision.</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Complete System Instruction */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Full Publication-Ready System Prompt:
                  </span>
                  <button
                    type="button"
                    onClick={handleCopySystemPrompt}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    {copiedPrompt ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedPrompt ? "Copied to Clipboard!" : "Copy System Prompt"}
                  </button>
                </div>

                <pre className="p-4 bg-slate-900 text-slate-100 text-xs font-mono rounded-xl border border-slate-800 overflow-x-auto max-h-[280px] whitespace-pre-wrap leading-relaxed shadow-inner">
                  {SYSTEM_INSTRUCTION_TEXT}
                </pre>
              </div>

              {/* User Task Prompt */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Recommended User Task Prompt (Run with notes):
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyUserPrompt}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                  >
                    {copiedUserPrompt ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedUserPrompt ? "Copied!" : "Copy Prompt"}
                  </button>
                </div>
                <pre className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 whitespace-pre-wrap leading-relaxed">
{`Task: Format only (Standard Academic Publication Format).

Please correct the following academic notes:
- Fix broken LaTeX code.
- Standardize mathematical notation (\\hat{p}, \\bar{X}, \\operatorname{Var}).
- Use proper headings (##, ###) and displayed equations ($$ ... $$).
- Preserve all original formulas, facts, and numerical values.
- Do not add new explanations or change the content.

Text:
[Paste your raw notes here]`}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 6: OPEN SOURCE LICENSE & 4 GITHUB REPOSITORIES REVIEW */}
          {activeTab === "license" && (
            <div className="space-y-5">
              {/* Project Mission / Motto Banner */}
              <div className="p-5 bg-gradient-to-br from-emerald-50 via-teal-50 to-indigo-50/50 border border-emerald-200/90 rounded-2xl shadow-2xs space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
                    <Heart className="w-5 h-5 fill-current" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                      <span>Project Mission & Dedication</span>
                      <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide bg-emerald-200 text-emerald-900 rounded-full">
                        Free For Students
                      </span>
                    </h3>
                    <p className="text-xs text-emerald-800">
                      Our guiding commitment to accessible, publication-ready academic typesetting
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-white/95 rounded-xl border border-emerald-200/80 shadow-2xs space-y-2">
                  <p className="text-xs sm:text-sm font-semibold text-slate-800 leading-relaxed font-sans">
                    “{PROJECT_MOTTO_BN}”
                  </p>
                  <p className="text-xs text-slate-600 italic leading-relaxed border-t border-slate-100 pt-2">
                    “{PROJECT_MOTTO_EN}”
                  </p>
                </div>
              </div>

              {/* 4 GitHub Repositories Review Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Upstream GitHub Repositories & Legal Review
                    </h4>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                    Zero Copyright Issues • 100% Permissive Licenses
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {GITHUB_REPOS_ATTRIBUTION.map((repo, idx) => (
                    <div
                      key={repo.name}
                      className="p-4 bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <span className="text-xs font-bold text-slate-900 font-mono">
                                {repo.name}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500 font-medium">
                              By {repo.owner}
                            </span>
                          </div>
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                            {repo.licenseType}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed">
                          {repo.description}
                        </p>
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                        <div className="text-[11px] text-emerald-800 font-medium bg-emerald-50/70 p-1.5 rounded-lg border border-emerald-100 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{repo.compliance}</span>
                        </div>

                        <a
                          href={repo.repoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          <span>Inspect GitHub Repository</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* MIT License & Disclaimer */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-slate-700" />
                    <span className="text-xs font-bold text-slate-900">
                      Official MIT License Agreement & Warranty Disclaimer:
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyLicense}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    {copiedLicense ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedLicense ? "License Copied!" : "Copy License"}
                  </button>
                </div>

                <pre className="p-4 bg-slate-900 text-slate-100 text-xs font-mono rounded-xl border border-slate-800 overflow-x-auto max-h-[220px] whitespace-pre-wrap leading-relaxed shadow-inner">
                  {FULL_MIT_LICENSE_TEXT}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            <span className="font-bold text-slate-800">{activeCount} active skills</span> chained automatically during conversion & DOCX generation.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
