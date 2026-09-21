import React, { useState } from "react";
import {
  X,
  GraduationCap,
  Table,
  Sigma,
  FileText,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  BookOpen,
  Copy,
  Check,
  Terminal,
  Sliders,
} from "lucide-react";

interface SystematicSkillsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadSample: () => void;
  activeMode: "auto" | "study_guide" | "exam_bank";
  onSelectMode: (mode: "auto" | "study_guide" | "exam_bank") => void;
}

const SYSTEM_INSTRUCTION_TEXT = `You are an expert academic mathematical editor, LaTeX typesetter, and technical document formatter.

Your task is to transform the user's raw academic notes, mathematical text, or broken equations into a clean, standard, publication-ready format.

Follow these rules strictly:

1. Preserve the original mathematical meaning, facts, formulas, examples, and section order unless the user explicitly asks for correction of content.

2. Correct broken, incomplete, or invalid LaTeX code.

3. Use standard LaTeX notation:
   - Use \\(...\\) for inline mathematics.
   - Use \\[...\\] for displayed equations.
   - Use \\frac{}{} for fractions.
   - Use \\sqrt{} for square roots.
   - Use \\sum, \\prod, \\int, \\lim, \\infty, \\leq, \\geq, \\neq, \\approx, and \\sim correctly.
   - Use \\operatorname{} for operators such as Var, Cov, rank, mode, and M.D.
   - Use \\mathbb{} for standard number sets when necessary.
   - Use \\mathsf{} or \\mathrm{} only when mathematically appropriate.
   - Use \\text{} only for explanatory words inside equations.

4. Standardize mathematical notation:
   - Use \\(\\hat{p}\\) for the sample proportion.
   - Use \\(\\bar{X}\\) for the sample mean.
   - Use \\(S^2\\) for the sample variance.
   - Use \\(\\sigma^2\\) for population variance.
   - Use \\(\\mu\\) for population mean.
   - Use \\(\\pi\\) for the population proportion.
   - Use \\(\\operatorname{Var}\\), \\(\\operatorname{Cov}\\), and \\(\\operatorname{rank}\\).
   - Use \\(A^{\\mathsf T}\\) for the transpose of a matrix.
   - Use \\(\\overset{d}{\\longrightarrow}\\) for convergence in distribution.
   - Use \\(\\sim\\) for “is distributed as” and \\(\\approx\\) for approximation.

5. Repair incorrect or inconsistent notation without changing the intended result. For example:
   - Replace a sample proportion written as p with \\(\\hat{p}\\) when the context clearly refers to a sample proportion.
   - Replace informal expressions such as Var(X) with \\(\\operatorname{Var}(X)\\).
   - Replace unclear summation notation with \\(\\sum_{i=1}^{n}\\).
   - Add missing braces in LaTeX commands such as \\frac, \\sqrt, \\Gamma, and \\chi^2.

6. Organize the output using:
   - Numbered main sections.
   - Numbered or titled subsections.
   - Clear definitions and Markdown tables where appropriate.
   - Displayed equations for important formulas.
   - Bullet points for properties.
   - Short explanatory paragraphs.

7. Use Markdown headings:
   - Main sections: # or ##.
   - Subsections: ###.
   - Do not use excessive heading levels.

8. Make every important equation readable and properly spaced. Do not place long mathematical derivations in a single paragraph.

9. Keep all equations mathematically aligned and visually consistent.

10. If an equation is ambiguous, make the smallest reasonable correction and preserve the original intention. Do not invent new assumptions. If the ambiguity affects the result, mention it briefly after the corrected material.

11. Do not provide unnecessary commentary about the editing process. Return the corrected and formatted academic content directly.

12. When the user asks for “format only” or “correct the formats only”:
   - Do not change the conceptual content.
   - Do not add new theories or examples.
   - Correct only grammar, formatting, notation, section structure, punctuation, and LaTeX.
   - Preserve the original facts and formulas as much as possible.

13. When the user asks for an explanation, provide a clear explanation after the formatted result.

14. Match the user's language. If the source is English, keep the academic content in English. If the user asks in Bengali, explain the instructions or process in Bengali.

15. Output only the final polished result unless the user asks for a comparison, explanation, or list of corrections.`;

export const SystematicSkillsModal: React.FC<SystematicSkillsModalProps> = ({
  isOpen,
  onClose,
  onLoadSample,
  activeMode,
  onSelectMode,
}) => {
  const [activeTab, setActiveTab] = useState<"skills" | "instructions" | "api">("skills");
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);
  const [copiedUserPrompt, setCopiedUserPrompt] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleCopyInstruction = () => {
    navigator.clipboard.writeText(SYSTEM_INSTRUCTION_TEXT);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleCopyUserPrompt = () => {
    const sampleText = `Task: Format only.

Please correct the following mathematical notes:
- Fix broken LaTeX.
- Standardize mathematical notation.
- Use proper headings and displayed equations.
- Preserve the original meaning.
- Do not add new explanations or change the formulas.

Text:
[Paste your notes here]`;
    navigator.clipboard.writeText(sampleText);
    setCopiedUserPrompt(true);
    setTimeout(() => setCopiedUserPrompt(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="skill-modal-title"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h2 id="skill-modal-title" className="text-base font-bold text-white flex items-center gap-2">
                Systematic Academic Formatting Skills
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 font-medium">
                  PDF Standard (Pages 5–11)
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Transforms unstructured NotebookLM notes into publication-ready academic documents and Word files.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Professional Segmented Tab Navigation */}
        <div className="bg-slate-50 border-b border-slate-200/90 px-4 sm:px-6 py-2.5">
          <div className="bg-slate-200/70 p-1 rounded-xl flex items-center gap-1 overflow-x-auto shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab("skills")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === "skills"
                  ? "bg-white text-blue-950 shadow-xs border border-slate-200/90"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <BookOpen className={`w-3.5 h-3.5 ${activeTab === "skills" ? "text-blue-600" : "text-slate-500"}`} />
              <span>Formatting Skills & Presets</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === "skills" ? "bg-blue-100 text-blue-800" : "bg-slate-200 text-slate-600"
              }`}>
                Presets
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("instructions")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === "instructions"
                  ? "bg-white text-indigo-950 shadow-xs border border-slate-200/90"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <Sliders className={`w-3.5 h-3.5 ${activeTab === "instructions" ? "text-indigo-600" : "text-slate-500"}`} />
              <span>AI Studio System Instruction</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === "instructions" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
              }`}>
                15 Rules
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("api")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === "api"
                  ? "bg-white text-amber-950 shadow-xs border border-slate-200/90"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <Terminal className={`w-3.5 h-3.5 ${activeTab === "api" ? "text-amber-600" : "text-slate-500"}`} />
              <span>API & Code Snippets</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === "api" ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-600"
              }`}>
                Python / cURL
              </span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700 flex-1">
          {activeTab === "skills" && (
            <>
              {/* Active Mode Selector */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Select Active Formatting Skill Preset
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => onSelectMode("study_guide")}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      activeMode === "study_guide"
                        ? "border-blue-600 bg-blue-50/70 text-blue-950 ring-2 ring-blue-500/20"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold text-xs mb-1">
                      <GraduationCap className="w-4 h-4 text-blue-600" />
                      Academic Study Guide
                    </div>
                    <p className="text-[11px] text-slate-600 line-clamp-2">
                      Numbered sections, automatic term tables, 14-row formula sheet, centered display math ($$).
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectMode("exam_bank")}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      activeMode === "exam_bank"
                        ? "border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-2 ring-indigo-500/20"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold text-xs mb-1">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      Exam Question Bank
                    </div>
                    <p className="text-[11px] text-slate-600 line-clamp-2">
                      Course headers, Question numbers (1., a., b.), data arrays, and repeated year tags.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectMode("auto")}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      activeMode === "auto"
                        ? "border-emerald-600 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-500/20"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold text-xs mb-1">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      Auto-Detect Structure
                    </div>
                    <p className="text-[11px] text-slate-600 line-clamp-2">
                      Automatically detects whether input is a study guide, formula sheet, or exam bank.
                    </p>
                  </button>
                </div>
              </div>

              {/* Rule Breakdown Grid */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-slate-600" />
                  Core Systematic Formatting Skills
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* Skill 1: Hierarchical Structure */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="flex items-center gap-2 font-semibold text-xs text-slate-900">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                      1. Title & Section Hierarchy
                    </div>
                    <p className="text-xs text-slate-600">
                      Normalizes course headers into <code className="text-blue-700 bg-blue-50 px-1 py-0.5 rounded"># Course: Title</code>,
                      subtitles into <code className="text-blue-700 bg-blue-50 px-1 py-0.5 rounded">## Subtitle</code>,
                      and strict numbered sections (<code className="text-slate-800 font-mono">## 1.</code>, <code className="text-slate-800 font-mono">### 1.1</code>).
                    </p>
                  </div>

                  {/* Skill 2: Table Structuring */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="flex items-center gap-2 font-semibold text-xs text-slate-900">
                      <Table className="w-4 h-4 text-blue-600 shrink-0" />
                      2. Automatic Markdown Tables
                    </div>
                    <p className="text-xs text-slate-600">
                      Detects definitions and formulas and structures them into clean tables:
                      <span className="block font-mono text-[11px] text-slate-700 mt-1">
                        • Glossary: | Term | Definition |<br />
                        • Formulas: | Concept | Formula |<br />
                        • Distributions: | Distribution | Symbol | Main Use |
                      </span>
                    </p>
                  </div>

                  {/* Skill 3: Mathematical Typesetting */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="flex items-center gap-2 font-semibold text-xs text-slate-900">
                      <Sigma className="w-4 h-4 text-blue-600 shrink-0" />
                      3. Display Equations & Delimiters
                    </div>
                    <p className="text-xs text-slate-600">
                      Centers major formulas as display math blocks (<code className="text-purple-700 font-mono">$$ ... $$</code>).
                      Resolves broken line wraps inside fractions and strictly eliminates invalid nested dollar signs.
                    </p>
                  </div>

                  {/* Skill 4: Typography & Clean Formatting */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="flex items-center gap-2 font-semibold text-xs text-slate-900">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                      4. Academic Typography & Punctuation
                    </div>
                    <p className="text-xs text-slate-600">
                      Applies typographic en-dashes (<code className="text-slate-800 font-mono">A–Z</code>),
                      italicizes statistical variables ($n$, $N$, $\mu$, $\sigma$, $P$, $\bar&#123;x&#125;$, $\hat&#123;p&#125;$),
                      and formats inference applications with bold lead-in titles (<code className="text-slate-800 font-mono">• **Generalization:** ...</code>).
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Action banner */}
              <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 p-4 rounded-xl border border-blue-200/80 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Experience the Systematic Transformation
                  </div>
                  <div className="text-xs text-slate-600">
                    Load the raw STT251 Sampling Distributions note and watch the engine structure it into Pages 5–11 format.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onLoadSample();
                    onClose();
                  }}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  Load STT251 Sample
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}

          {activeTab === "instructions" && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-emerald-950">
                      Google AI Studio Run Settings এ কীভাবে যোগ করবে:
                    </p>
                    <ol className="list-decimal list-inside space-y-0.5 text-emerald-900">
                      <li>Google AI Studio খুলে তোমার project বা prompt নির্বাচন করো।</li>
                      <li>ডান পাশে <strong>Run settings</strong> খুলে <strong>System Instructions</strong> ফিল্ডে যাও।</li>
                      <li>নিচের prompt-টি সম্পূর্ণ কপি করে সেখানে paste করো।</li>
                      <li>Recommended: <strong>Temperature</strong> মান <code className="bg-emerald-100 px-1 py-0.5 rounded font-mono">0.2</code> নির্বাচন করো।</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Academic Mathematical Editor System Instruction (15 Rules)
                </span>
                <button
                  type="button"
                  onClick={handleCopyInstruction}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  {copiedPrompt ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy System Instruction
                    </>
                  )}
                </button>
              </div>

              <div className="relative">
                <pre className="p-4 bg-slate-900 text-slate-100 text-xs font-mono rounded-xl border border-slate-800 overflow-x-auto max-h-[340px] whitespace-pre-wrap leading-relaxed">
                  {SYSTEM_INSTRUCTION_TEXT}
                </pre>
              </div>

              {/* User Prompt Example */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    User Prompt Example (প্রতিবার run করার জন্য):
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyUserPrompt}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                  >
                    {copiedUserPrompt ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    Copy Prompt
                  </button>
                </div>
                <pre className="p-3 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-700 whitespace-pre-wrap">
{`Task: Format only.

Please correct the following mathematical notes:
- Fix broken LaTeX.
- Standardize mathematical notation.
- Use proper headings and displayed equations.
- Preserve the original meaning.
- Do not add new explanations or change the formulas.

Text:
[Paste your raw notes here]`}
                </pre>
              </div>
            </div>
          )}

          {activeTab === "api" && (
            <div className="space-y-4">
              <div className="text-xs text-slate-600">
                If you are calling the <strong>Google GenAI SDK (v0.1+)</strong> directly in Python or Node.js, pass the system instruction in <code className="text-blue-700 bg-blue-50 px-1 py-0.5 rounded font-mono">types.GenerateContentConfig</code> with temperature 0.2:
              </div>

              <div className="relative">
                <pre className="p-4 bg-slate-900 text-emerald-300 text-xs font-mono rounded-xl border border-slate-800 overflow-x-auto leading-relaxed">
{`from google import genai
from google.genai import types

client = genai.Client(api_key="YOUR_API_KEY")

system_instruction = """
You are an expert academic mathematical editor and LaTeX typesetter.
Correct formatting, repair LaTeX, standardize notation, and preserve
the original mathematical meaning. When the user says format only,
do not change the content.
"""

response = client.models.generateContent(
    model="gemini-3.6-flash",
    contents="""
Task: Format only.

Text:
The sample mean has variance sigma^2/n ...
""",
    config=types.GenerateContentConfig(
        system_instruction=system_instruction,
        temperature=0.2
    )
)

print(response.text)`}
                </pre>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
                <div className="font-bold">Active in this Applet:</div>
                <div>
                  This application’s multi-provider AI backend (including Gemini 2.5 Flash, Gemini 2.0 Flash, and Gemini 2.5 Pro) automatically applies these exact 15 system instructions with temperature = 0.2 on every clean & convert request.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Persistent in <code className="font-mono text-slate-700">AGENTS.md</code> & <code className="font-mono text-slate-700">GEMINI.md</code>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
