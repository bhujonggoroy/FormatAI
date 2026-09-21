import React, { useState } from "react";
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
} from "lucide-react";

interface SkillsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSkillsChanged?: () => void;
}

export const SkillsManagerModal: React.FC<SkillsManagerModalProps> = ({
  isOpen,
  onClose,
  onSkillsChanged,
}) => {
  const [skills, setSkills] = useState<Skill[]>(() => skillRegistry.getAllSkills());
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>("math-docx");
  const [activeTab, setActiveTab] = useState<"skills" | "pipeline" | "tester">("skills");
  
  // Interactive Tester state
  const [testInput, setTestInput] = useState<string>(
    `Velocity = 3.0e8 m/s^2\nConcentration = 1.5 x 10^-4 mol/L\nMass = 25.4 +/- 0.05 g of H2O and CO2\nVar(X) = E[X^2] - (E[X])^2\n\\[ x = \\frac12 \\cdot \\sqrt[3]{n} \\]\nTable 1 Summary of measurements\n| Sample | Mass | Mean |\n|---|---|---|\n| A | 12.4 | 10.2 |`
  );
  const [testOutput, setTestOutput] = useState<string>("");
  const [testLogs, setTestLogs] = useState<string[]>([]);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  if (!isOpen) return null;

  const refreshState = (notification?: string) => {
    setSkills(skillRegistry.getAllSkills());
    if (onSkillsChanged) onSkillsChanged();
    if (notification) {
      setStatusNotification(notification);
      setTimeout(() => setStatusNotification(null), 3500);
    }
  };

  const handleToggle = (id: string) => {
    const newState = skillRegistry.toggleSkill(id);
    const skill = skillRegistry.getSkill(id);
    refreshState(`${skill?.name || id} ${newState ? "enabled" : "disabled"}`);
  };

  const handleReset = (id: string) => {
    skillRegistry.resetSkill(id);
    const skill = skillRegistry.getSkill(id);
    refreshState(`Reset ${skill?.name || id} to repository defaults`);
  };

  const handleRemove = (id: string) => {
    skillRegistry.removeSkill(id);
    const skill = skillRegistry.getSkill(id);
    refreshState(`Disabled ${skill?.name || id}`);
  };

  const handleResetAll = () => {
    skillRegistry.resetAllSkills();
    refreshState("All skills reset to original defaults");
  };

  const runTester = () => {
    const enabledIds = skills.filter((s) => s.enabled).map((s) => s.id);
    const result = executeSkillPipeline(testInput, enabledIds);
    setTestOutput(result.text);
    setTestLogs(
      result.appliedTransformations.map(
        (t) => `[Applied] ${t.skillName}: ${t.summary}`
      )
    );
  };

  const getPriorityBadge = (priority: number) => {
    switch (priority) {
      case 1:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Sigma className="w-3 h-3 text-blue-600" /> Priority 1: Math Equation
          </span>
        );
      case 2:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Atom className="w-3 h-3 text-emerald-600" /> Priority 2: Scientific
          </span>
        );
      case 3:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <BookOpen className="w-3 h-3 text-purple-600" /> Priority 3: Academic Manuscript
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200">
            <FileText className="w-3 h-3 text-slate-600" /> Priority 4: General Text
          </span>
        );
    }
  };

  const activeCount = skills.filter((s) => s.enabled).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Modular Skills Architecture
                </h2>
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {activeCount} of {skills.length} Active
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                GitHub Skill integrations with strict 4-tier execution priority
              </p>
            </div>
          </div>

          <button
            id="close-skills-modal-btn"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Toast */}
        {statusNotification && (
          <div className="bg-emerald-600 text-white text-xs px-4 py-2 flex items-center justify-between transition-all">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>{statusNotification}</span>
            </div>
          </div>
        )}

        {/* Priority Notice Banner */}
        <div className="bg-indigo-50/70 border-b border-indigo-100 px-6 py-2.5 flex items-center justify-between text-xs text-indigo-900">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              <strong>Strict Priority Sequence:</strong> 1. Mathematical / Word OMML → 2. Scientific Notation → 3. Academic Manuscript → 4. General Text
            </span>
          </div>
          <button
            onClick={handleResetAll}
            className="text-indigo-700 hover:text-indigo-900 font-medium underline flex items-center gap-1 shrink-0 ml-2"
          >
            <RefreshCw className="w-3 h-3" /> Reset All
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 bg-slate-50/50">
          <button
            onClick={() => setActiveTab("skills")}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "skills"
                ? "border-indigo-600 text-indigo-600 bg-white"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Installed Skills ({skills.length})
          </button>
          <button
            onClick={() => setActiveTab("pipeline")}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "pipeline"
                ? "border-indigo-600 text-indigo-600 bg-white"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" /> Execution Hierarchy
          </button>
          <button
            onClick={() => {
              setActiveTab("tester");
              runTester();
            }}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "tester"
                ? "border-indigo-600 text-indigo-600 bg-white"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Play className="w-3.5 h-3.5" /> Interactive Tester
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === "skills" && (
            <div className="space-y-4">
              {skills.map((skill) => {
                const isExpanded = expandedSkillId === skill.id;
                return (
                  <div
                    key={skill.id}
                    className={`rounded-xl border transition-all ${
                      skill.enabled
                        ? "bg-white border-slate-200 shadow-xs"
                        : "bg-slate-50 border-slate-200/80 opacity-70"
                    }`}
                  >
                    {/* Header Row */}
                    <div className="p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleToggle(skill.id)}
                          className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                            skill.enabled ? "bg-emerald-600" : "bg-slate-300"
                          }`}
                          title={skill.enabled ? "Disable skill" : "Enable skill"}
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

                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={skill.repositoryUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title={`View source repository (${skill.author})`}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleReset(skill.id)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Re-import / Reset to repository defaults"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(skill.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Remove / Disable skill"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedSkillId(isExpanded ? null : skill.id)
                          }
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                          title={isExpanded ? "Collapse details" : "Expand details"}
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div className="p-3 bg-white rounded-lg border border-slate-200">
                            <span className="font-semibold text-slate-800 block mb-1">
                              Repository & Author:
                            </span>
                            <div className="flex items-center gap-1.5 text-indigo-600">
                              <ExternalLink className="w-3.5 h-3.5" />
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
                              Author: {skill.author} | Category: {skill.category}
                            </span>
                          </div>

                          <div className="p-3 bg-white rounded-lg border border-slate-200">
                            <span className="font-semibold text-slate-800 block mb-1">
                              Priority Level & Execution Slot:
                            </span>
                            <p className="text-slate-600">
                              <strong>Slot {skill.priority}:</strong> Evaluated{" "}
                              {skill.priority === 1
                                ? "first for core equation translation"
                                : skill.priority === 2
                                ? "second for scientific units & chemistry"
                                : "third for manuscript structure"}
                              .
                            </p>
                          </div>
                        </div>

                        {/* Features List */}
                        <div>
                          <span className="text-xs font-semibold text-slate-800 block mb-1.5">
                            Key Features & Capabilities:
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {skill.features.map((feature, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2 text-xs text-slate-600 bg-white px-2.5 py-1.5 rounded-md border border-slate-200/80"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>{feature}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Rules with Examples */}
                        <div>
                          <span className="text-xs font-semibold text-slate-800 block mb-1.5">
                            Formatting Rules & Transformations:
                          </span>
                          <div className="space-y-2">
                            {skill.rules.map((rule) => (
                              <div
                                key={rule.id}
                                className="p-3 bg-white rounded-lg border border-slate-200 text-xs space-y-1"
                              >
                                <div className="font-semibold text-slate-900">
                                  {rule.name}
                                </div>
                                <div className="text-slate-600">
                                  {rule.description}
                                </div>
                                {rule.exampleInput && (
                                  <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px] bg-slate-50 p-2 rounded border border-slate-200/60">
                                    <div>
                                      <span className="text-slate-400 font-sans block text-[10px] uppercase font-bold">
                                        Input:
                                      </span>
                                      <span className="text-rose-700">
                                        {rule.exampleInput}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 font-sans block text-[10px] uppercase font-bold">
                                        Output:
                                      </span>
                                      <span className="text-emerald-700">
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
              })}
            </div>
          )}

          {activeTab === "pipeline" && (
            <div className="space-y-6">
              <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-900">
                <h4 className="font-bold text-sm mb-1 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-indigo-600" /> Multi-Skill Execution Order
                </h4>
                <p>
                  When converting NotebookLM notes into DOCX, skills are chained strictly according to your defined priorities. Lower numbers execute earlier to prevent syntax corruption.
                </p>
              </div>

              <div className="relative pl-6 border-l-2 border-indigo-200 space-y-8 my-4">
                {/* Stage 1 */}
                <div className="relative">
                  <div className="absolute -left-[31px] top-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold ring-4 ring-white">
                    1
                  </div>
                  <div>
                    <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">
                      Priority 1: Mathematical & Word Equation Processing
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                      OMML Native Equations & Pandoc Delimiters
                    </h4>
                    <p className="text-xs text-slate-600 mt-1">
                      Converts LaTeX formulas into native Microsoft Word Office Math Markup (<code className="text-blue-700 bg-blue-50 px-1 py-0.5 rounded">&lt;m:oMath&gt;</code>) using stacked fractions, roots, summations, and matrices. Ensures formulas remain 100% editable in Word.
                    </p>
                    <div className="flex gap-2 mt-2">
                      <span className="text-xs bg-slate-100 px-2.5 py-1 rounded-md text-slate-700 font-medium">
                        math-docx
                      </span>
                      <span className="text-xs bg-slate-100 px-2.5 py-1 rounded-md text-slate-700 font-medium">
                        pandoc-math-docx
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stage 2 */}
                <div className="relative">
                  <div className="absolute -left-[31px] top-0 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold ring-4 ring-white">
                    2
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                      Priority 2: Scientific Formatting
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                      Exponential Notation, SI Units & Chemical Formulas
                    </h4>
                    <p className="text-xs text-slate-600 mt-1">
                      Recognizes scientific exponential notation (1.5 × 10⁻⁴), stoichiometric chemical subscripts (H₂O, CO₂), compound SI measurement units (m/s², mol/L), and experimental measurement tolerances (±).
                    </p>
                    <div className="flex gap-2 mt-2">
                      <span className="text-xs bg-slate-100 px-2.5 py-1 rounded-md text-slate-700 font-medium">
                        scientific-docx
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stage 3 */}
                <div className="relative">
                  <div className="absolute -left-[31px] top-0 w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold ring-4 ring-white">
                    3
                  </div>
                  <div>
                    <span className="text-xs font-bold text-purple-800 uppercase tracking-wider">
                      Priority 3: Academic Manuscript Formatting
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                      IMRAD Structure, Citations & Booktabs Tables
                    </h4>
                    <p className="text-xs text-slate-600 mt-1">
                      Enforces numbered academic headings, APA/IEEE citations, table/figure captions, and three-line Booktabs tables with heavy top/bottom rules and borderless vertical columns.
                    </p>
                    <div className="flex gap-2 mt-2">
                      <span className="text-xs bg-slate-100 px-2.5 py-1 rounded-md text-slate-700 font-medium">
                        academic-manuscript
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stage 4 */}
                <div className="relative">
                  <div className="absolute -left-[31px] top-0 w-6 h-6 rounded-full bg-slate-600 text-white flex items-center justify-center text-xs font-bold ring-4 ring-white">
                    4
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Priority 4: General Text Formatting
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                      Typographic Hierarchy & Final Word Assembly
                    </h4>
                    <p className="text-xs text-slate-600 mt-1">
                      Applies custom font families (Times New Roman, Georgia, Calibri), 1.0-inch academic margins, primary navy accent colors, headers, and footer page counts.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "tester" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  Test your active skills pipeline with custom or sample text:
                </span>
                <button
                  type="button"
                  onClick={runTester}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" /> Execute Pipeline
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">
                    Raw Input (Math, Units, Chemical formulas, Citations):
                  </label>
                  <textarea
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    rows={10}
                    className="w-full font-mono text-xs p-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">
                    Pipeline Transformed Output:
                  </label>
                  <textarea
                    value={testOutput}
                    readOnly
                    rows={10}
                    className="w-full font-mono text-xs p-3 rounded-lg border border-slate-300 bg-slate-50 text-slate-800"
                  />
                </div>
              </div>

              {testLogs.length > 0 && (
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-900">
                  <span className="font-bold block mb-1">Transformations Applied:</span>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {testLogs.map((log, i) => (
                      <li key={i}>{log}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {activeCount} active skills will be applied during preview & DOCX download.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
