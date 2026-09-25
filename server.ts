import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import http from "node:http";
import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import {
  cleanNotebookLMTreeArtifacts,
  standardizeMathToLatex,
  sanitizeMathToUnicode,
  buildDocxFromMarkdown
} from "./src/server/docxService.ts";
import {
  validateExportFormat,
  getSafeFilenameBase,
  generateFilenameFromContent,
  generateLaTeXDocument,
  generateMarkdownDocument,
  generatePlainTextDocument,
  generatePdfBuffer,
  type ExportFormat
} from "./src/server/exportService.ts";
import { cleanClientSideNotebookLM } from "./src/utils/cleaner.ts";
import { validateAIPolishOutput, formatValidationFeedback, type AIErrorCategory } from "./src/utils/aiValidation.ts";
import { createDocumentChunks, reassembleDocumentChunks } from "./src/utils/documentChunker.ts";
import {
  parseDocumentBlocks,
  detectBlockFormattingIssue,
  extractSubstantiveText,
  type DocumentBlock,
} from "./src/utils/blockIntegrity.ts";
import { logPipelineDebug } from "./src/utils/debugLogger.ts";
import { classifyErrorDetails } from "./src/utils/aiStatusClassifier.ts";
import { NO_IMPROVEMENT_MESSAGE, computeDocumentDiff } from "./src/utils/diffUtils.ts";
import { aiRequestManager } from "./src/server/ai/AIRequestManager.ts";
import {
  skillRegistry,
  getCombinedSkillPromptInstructions,
  executeSkillPipeline,
} from "./src/skills/index.ts";
import {
  ACADEMIC_SYSTEM_WORKFLOW,
  FORMATTING_ORDER_COMMANDS,
  RECOMMENDED_ACADEMIC_SYSTEM_PROMPT,
} from "./src/server/academicPrompt.ts";

const PORT = 3000;

export function createServerApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: "10mb" }));

  // Academic System Workflow and Recommended Prompt API
  app.get("/api/academic-workflow", (req, res) => {
    res.json({
      workflow: ACADEMIC_SYSTEM_WORKFLOW,
      commands: FORMATTING_ORDER_COMMANDS,
      recommendedSystemPrompt: RECOMMENDED_ACADEMIC_SYSTEM_PROMPT,
    });
  });

  // PWA Manifest and Service Worker routes
  app.get("/manifest.json", (req, res) => {
    const manifestPath = path.join(process.cwd(), "public", "manifest.json");
    if (fs.existsSync(manifestPath)) {
      res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
      res.sendFile(manifestPath);
    } else {
      res.status(404).send("Manifest not found");
    }
  });

  app.get("/service-worker.js", (req, res) => {
    const swPath = path.join(process.cwd(), "public", "service-worker.js");
    if (fs.existsSync(swPath)) {
      res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      res.setHeader("Service-Worker-Allowed", "/");
      res.sendFile(swPath);
    } else {
      res.status(404).send("Service Worker not found");
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      has_gemini_key: Boolean(process.env.GEMINI_API_KEY),
      service: "FormatAI",
    });
  });

  // --- Multi-Provider AI API Manager Endpoints (Stateless & Isolated) ---

  // Get static provider metadata templates and public configuration (no user keys, no shared state)
  app.get("/api/ai/config", (req, res) => {
    try {
      res.json({
        config: aiRequestManager.getManagerConfig(),
        providers: aiRequestManager.getStaticProviderTemplates(),
        hasServerGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch AI configuration." });
    }
  });

  // Client-isolated acknowledgement for config updates (state lives in client localStorage)
  app.post("/api/ai/config", (req, res) => {
    res.json({
      success: true,
      message: "AI settings are strictly managed in local browser storage.",
    });
  });

  // Client-isolated acknowledgement for provider updates
  app.post("/api/ai/providers/:id", (req, res) => {
    res.json({
      success: true,
      message: "Provider settings are strictly managed in local browser storage.",
    });
  });

  // Client-isolated acknowledgement for adding keys
  app.post("/api/ai/providers/:id/keys", (req, res) => {
    res.json({
      success: true,
      message: "API keys are stored strictly in local browser storage.",
    });
  });

  // Client-isolated acknowledgement for toggling keys
  app.patch("/api/ai/providers/:id/keys/:keyId", (req, res) => {
    res.json({
      success: true,
      message: "Keys are stored strictly in local browser storage.",
    });
  });

  // Client-isolated acknowledgement for removing keys
  app.delete("/api/ai/providers/:id/keys/:keyId", (req, res) => {
    res.json({
      success: true,
      message: "Keys are stored strictly in local browser storage.",
    });
  });

  // Authoritative model catalog retrieval endpoint
  app.post("/api/ai/models", async (req, res) => {
    try {
      const { providerId, apiKey, customEndpoint } = req.body || {};
      if (!providerId) {
        return res.status(400).json({ success: false, error: "Missing providerId" });
      }
      const result = await aiRequestManager.fetchProviderModels(providerId, apiKey, customEndpoint);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to fetch models" });
    }
  });

  // Explicit test endpoint: testApiConnection(providerId, keyId, modelId)
  app.post("/api/ai/test", async (req, res) => {
    try {
      const { providerId, keyId, modelId, model, apiKey, customEndpoint, accountId, timeoutMs } = req.body || {};
      if (!providerId) {
        return res.status(400).json({ success: false, errorMessage: "Missing providerId" });
      }
      const targetModel = modelId || model || "";
      const result = await aiRequestManager.testApiConnection(
        providerId,
        keyId || "key_probe",
        targetModel,
        apiKey || "",
        { customEndpoint, accountId, timeoutMs }
      );
      res.json(result);
    } catch (err: any) {
      res.status(500).json({
        success: false,
        errorMessage: err.message || "Test execution failed.",
      });
    }
  });

  // Test provider connection with a request-scoped key (stateless; does NOT save key)
  app.post("/api/ai/providers/:id/test", async (req, res) => {
    try {
      const { id } = req.params;
      const { apiKey, keyId, model, modelId, customEndpoint, accountId, timeoutMs } = req.body || {};
      const targetModel = modelId || model || "";
      const result = await aiRequestManager.testApiConnection(
        id,
        keyId || "key_probe",
        targetModel,
        apiKey || "",
        { customEndpoint, accountId, timeoutMs }
      );
      res.json(result);
    } catch (err: any) {
      res.status(500).json({
        success: false,
        errorMessage: err.message || "Test execution failed.",
      });
    }
  });

  // Test active providers in request-scoped batch (stateless)
  app.post("/api/ai/test-all", async (req, res) => {
    try {
      const { providers } = req.body || {};
      const results = await aiRequestManager.testAllScoped(providers || []);
      res.json({ success: true, results });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Test all failed." });
    }
  });

  // Explicitly acknowledge saving (client persists to local storage)
  app.post("/api/ai/save", (req, res) => {
    res.json({
      success: true,
      message: "Settings are stored locally in the current browser/profile environment.",
    });
  });

  // Client-managed stats endpoint
  app.get("/api/ai/stats", (req, res) => {
    res.json({ stats: [] });
  });

  // Client-managed fallback audit logs endpoint
  app.get("/api/ai/logs", (req, res) => {
    res.json({ logs: [] });
  });

  // Client-isolated acknowledgement for provider reordering
  app.post("/api/ai/reorder", (req, res) => {
    res.json({
      success: true,
      message: "Provider priorities are stored locally in the current browser/profile environment.",
    });
  });

  // Reset to initial configuration templates
  app.post("/api/ai/reset", (req, res) => {
    res.json({
      success: true,
      config: aiRequestManager.getManagerConfig(),
      providers: aiRequestManager.getStaticProviderTemplates(),
    });
  });

  // --- Modular Skills Management Endpoints ---
  app.get("/api/skills", (req, res) => {
    try {
      res.json({ skills: skillRegistry.getAllSkills() });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to list skills." });
    }
  });

  app.post("/api/skills/toggle", (req, res) => {
    try {
      const { id, enabled } = req.body;
      if (!id) {
        return res.status(400).json({ error: "Missing skill id" });
      }
      skillRegistry.toggleSkill(id, enabled);
      res.json({ success: true, skills: skillRegistry.getAllSkills() });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to toggle skill." });
    }
  });

  app.post("/api/skills/reset", (req, res) => {
    try {
      const { id } = req.body;
      if (id) {
        skillRegistry.resetSkill(id);
      } else {
        skillRegistry.resetAllSkills();
      }
      res.json({ success: true, skills: skillRegistry.getAllSkills() });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to reset skills." });
    }
  });

  // --- Notes Cleaning using Multi-Provider AIRequestManager with Automatic Fallback ---
  interface CleanNotesResult {
    cleanedMarkdown: string;
    providerId: string;
    providerName: string;
    model: string;
    fallbackCount: number;
    fallbackChain: any[];
    validationFailed?: boolean;
    validationErrors?: string[];
    validationScore?: number;
    discardedAiOutput?: boolean;
    discardReason?: string;
    errorCategory?: AIErrorCategory;
  }

  const ACADEMIC_MATH_SYSTEM_INSTRUCTION = `You are an academic document formatting assistant, expert mathematical editor, and LaTeX typesetter.

Correct formatting only. Do not solve, summarize, reinterpret, or modify the content of the questions.

SYSTEM WORK FLOW:
Input Document
      ↓
Content Preservation
      ↓
Year-wise Classification
      ↓
Exam-wise Classification
      ↓
Section and Question Formatting
      ↓
LaTeX Detection and Correction
      ↓
Table and Matrix Formatting
      ↓
Side-note Standardization
      ↓
Final Quality Check
      ↓
Editable Standard Output

Formatting Order or Commands:
- Do not solve the questions.
- Do not change the mathematical meaning.
- Do not remove repeated-question notes.
- Do not invent missing information.
- Correct only formatting, grammar, notation, and LaTeX syntax.
- Preserve the original marks and question numbering.

Tasks & Rules:
1. Preserve all original questions, marks, years, examinations, sections, and side notes.
2. Arrange the content year-wise and examination-wise.
3. Standardize headings, section names, question numbers, and sub-question labels.
4. Correct LaTeX syntax without changing mathematical meaning.
5. Standard LaTeX Notation:
   - Use \\(...\\) for inline mathematics.
   - Use \\[...\\] for displayed equations.
   - Use \\frac{}{} for fractions.
   - Use \\sqrt{} for square roots.
   - Use \\sum, \\prod, \\int, \\lim, \\infty, \\leq, \\geq, \\neq, \\approx, and \\sim correctly.
   - Use \\operatorname{} for operators such as \\operatorname{Var}, \\operatorname{Cov}, \\operatorname{rank}, \\operatorname{mode}, and \\operatorname{M.D.}
   - Use \\mathbb{} for standard number sets when necessary.
   - Use \\mathsf{} or \\mathrm{} only when mathematically appropriate.
   - Use \\text{} only for explanatory words inside equations.
6. Standardize Mathematical Notation:
   - Use \\(\\hat{p}\\) for the sample proportion.
   - Use \\(\\bar{X}\\) for the sample mean.
   - Use \\(S^2\\) for the sample variance.
   - Use \\(\\sigma^2\\) for population variance.
   - Use \\(\\mu\\) for population mean.
   - Use \\(\\pi\\) for the population proportion.
   - Use \\(\\operatorname{Var}\\), \\(\\operatorname{Cov}\\), and \\(\\operatorname{rank}\\).
   - Use \\(A^{\\mathsf T}\\) for the transpose of a matrix.
   - Use \\(\\overset{d}{\\longrightarrow}\\) for convergence in distribution.
   - Use \\(\\chi^2_r\\) for Chi-square with degrees of freedom.
   - Use \\(\\sim N(\\mu, \\sigma^2)\\) for normal distribution.
   - Use \\(\\sum_{i=1}^{n}\\) for summation over sample size.
7. Correct Matrix Syntax:
   Use \\begin{bmatrix} ... \\end{bmatrix} for all matrices.
   Ensure proper row breaks (\\\\) and element alignment (&).
8. Standardize tables using Markdown table format.
9. Preserve all side notes and repeat information (e.g. repeated-question notes: **Repeated Question:** ...).
10. Do not create solutions or answer keys.
11. Before final output, check numbering, LaTeX delimiters, matrix row breaks, brackets, and duplicated or missing questions.
12. Return only the corrected, standard-formatted document directly.`;


  async function cleanNotesWithMultiProviderAI(
    rawText: string,
    equationFormat = "native",
    formatMode: "auto" | "study_guide" | "exam_bank" = "auto",
    enabledSkillIds?: string[],
    customPrompt?: string,
    aiConfig?: any,
    userProviders?: any[],
    baselineMarkdown?: string
  ): Promise<CleanNotesResult> {
    // 1. Execute Modular Skills Pipeline in priority order:
    // (1. Math -> 2. Scientific -> 3. Academic Manuscript -> 4. General Text)
    const skillResult = executeSkillPipeline(rawText, enabledSkillIds);
    const textAfterSkills = skillResult.text;
    const preCleaned = standardizeMathToLatex(cleanNotebookLMTreeArtifacts(textAfterSkills));

    // Combine Academic Math Instructions with specific Skill prompt instructions and user custom prompt
    const skillInstructions = getCombinedSkillPromptInstructions(enabledSkillIds);
    let combinedSystemPrompt = skillInstructions
      ? `${ACADEMIC_MATH_SYSTEM_INSTRUCTION}\n\n## MODULAR SKILLS INSTRUCTIONS (Strict Priority Order):\n${skillInstructions}`
      : ACADEMIC_MATH_SYSTEM_INSTRUCTION;

    if (customPrompt && typeof customPrompt === "string" && customPrompt.trim()) {
      combinedSystemPrompt += `\n\n## USER CUSTOM INSTRUCTIONS:\n${customPrompt.trim()}`;
    }

    const prompt = `You are an expert technical editor, academic formatter, and mathematical typesetter.
Your task is to take raw AI-generated or copy-pasted content (from ChatGPT, Gemini, Claude, NotebookLM, DeepSeek, or any lecture notes, formula sheets, lab manuals, and exam problem sets) and transform them into publication-ready, beautifully structured academic documents.

SELECTED FORMATTING MODE: "${formatMode}" (Options: auto, study_guide, exam_bank)

CRITICAL FORMATTING & DOCUMENT STANDARDS:

1. ACADEMIC STUDY GUIDES & COMPREHENSIVE FORMULA SHEETS:
   (Apply whenever content contains lecture notes, study guides, theoretical outlines, or formula sheets like STT251 Sampling Distributions):
   - Document Title & Subtitle:
     # CourseCode: Course/Topic Name
     ## Subtitle (e.g. A–Z Comprehensive Study Guide & Formula Sheet)
   - Numbered Section Hierarchy (Clean academic markdown headings, strictly NO colored box banners or tables for headers):
     ## 1. Introduction and Sampling Distribution Fundamentals
     ### 1.1 Definition of Sampling Distribution
     ### 1.2 Key Components
     ### 1.3 Standard Error (SE)
     ### 1.4 Finite Population Correction Factor
     ## 2. Central Limit Theorem (CLT)
     ### 2.1 Historical Context and Theorem
     ### 2.2 Formal Definition
     ### 2.3 Significance of the CLT
     ## 3. Distributions of the Mean and Proportion
     ### 3.1 Sampling Distribution of the Mean
     ### 3.2 Sampling Distribution of the Proportion
     ### 3.3 Difference Between Two Sample Proportions
     ## 4. Specific Sampling Distributions
     ## 5. Summary Formula Sheet
     ## 6. Practical Applications and Inference
   - Key Components & Glossary Definitions (MUST be converted to a clean 2-column Markdown Table):
     When terms and definitions are provided (e.g., Population (N): ..., Sample (n): ..., Statistic: ..., Parameter: ..., Sampling Error: ...):
     | Term | Definition |
     | :--- | :--- |
     | Population ($N$) | The complete set of all units, individuals, or observations of interest |
     | Sample ($n$) | A subset of units selected from the population |
     | Statistic | A numerical characteristic calculated from a sample, e.g., $\bar{x}$ or $\hat{p}$ |
     | Parameter | A numerical characteristic of a population, e.g., $\mu$, $\sigma$, or $P$ |
     | Sampling Error | The difference between a sample statistic and the corresponding population parameter |
   - Formula Tables & Summary Formula Sheets (MUST be converted to clean 2-column Markdown Tables):
     | Statistic | Standard Error Formula for a Large or Infinite Population |
     | :--- | :--- |
     | Sample mean, $\bar{x}$ | $SE(\bar{x}) = \frac{\sigma}{\sqrt{n}}$ |
     | Sample proportion, $\hat{p}$ | $SE(\hat{p}) = \sqrt{\frac{P(1-P)}{n}}$ |

     And for Section 5 Summary Formula Sheet:
     | Concept | Formula |
     | :--- | :--- |
     | Sample mean | $\bar{x} = \frac{1}{n} \sum_{i=1}^n x_i$ |
     | Sample proportion | $\hat{p} = \frac{x}{n}$ |
     | Mean of sample mean | $E(\bar{X}) = \mu$ |
     | Variance of sample mean | $\text{Var}(\bar{X}) = \frac{\sigma^2}{n}$ |
     | Standard error of sample mean | $SE(\bar{X}) = \frac{\sigma}{\sqrt{n}}$ |
     | Finite-population SE of mean | $SE(\bar{X}) = \sqrt{\frac{N-n}{N-1}} \cdot \frac{\sigma}{\sqrt{n}}$ |
     | Mean of sample proportion | $E(\hat{p}) = P$ |
     | Variance of sample proportion | $\text{Var}(\hat{p}) = \frac{P(1-P)}{n}$ |
     | Standard error of sample proportion | $SE(\hat{p}) = \sqrt{\frac{P(1-P)}{n}}$ |
     | $Z$-score for a mean | $Z = \frac{\bar{X} - \mu}{\frac{\sigma}{\sqrt{n}}}$ |
     | $Z$-score for a proportion | $Z = \frac{\hat{p} - P}{\sqrt{\frac{P(1-P)}{n}}}$ |
     | Difference of two proportions | $E(\hat{p}_1 - \hat{p}_2) = P_1 - P_2$ |
     | SE of difference of proportions | $SE(\hat{p}_1 - \hat{p}_2) = \sqrt{\frac{P_1(1-P_1)}{n_1} + \frac{P_2(1-P_2)}{n_2}}$ |
     | $Z$-score for difference of proportions | $Z = \frac{(\hat{p}_1 - \hat{p}_2) - (P_1 - P_2)}{\sqrt{\frac{P_1(1-P_1)}{n_1} + \frac{P_2(1-P_2)}{n_2}}}$ |
   - Distribution Classification Tables:
     | Distribution | Symbol | Main Use |
     | :--- | :---: | :--- |
     | Student’s $t$-distribution | $t$ | Used for inference about a population mean when $\sigma$ is unknown, especially for small samples |
     | Chi-square distribution | $\chi^2$ | Used for inference about population variance and goodness-of-fit tests |
     | Fisher’s $F$-distribution | $F$ | Used to compare two population variances and in analysis of variance |
   - Standalone Mathematical Equations (Centered $$ ... $$):
     All standalone definitions, variances, standard errors, limits, normality conditions, and probability intervals MUST be typeset on their own line as display math:
     $$ \text{Sampling Error} = \bar{x} - \mu $$
     $$ \frac{n}{N} > 0.10 $$
     $$ \sqrt{\frac{N - n}{N - 1}} $$
     $$ SE(\bar{X}) = \sqrt{\frac{N - n}{N - 1}} \cdot \frac{\sigma}{\sqrt{n}} $$
     $$ \bar{X} \sim N\left(\mu, \frac{\sigma^2}{n}\right) $$
     $$ \bar{X} \approx N\left(\mu, \frac{\sigma^2}{n}\right) $$
     $$ \mu_{\bar{X}} = E(\bar{X}) = \mu $$
     $$ \text{Var}(\bar{X}) = \sigma_{\bar{X}}^2 = \frac{\sigma^2}{n} $$
     $$ \sigma_{\bar{X}} = \frac{\sigma}{\sqrt{n}} $$
     $$ \hat{p} = \frac{X}{n} $$
     $$ P = \frac{k}{N} $$
     $$ \mu_{\hat{p}} = E(\hat{p}) = P $$
     $$ \sigma_{\hat{p}}^2 = \text{Var}(\hat{p}) = \frac{P(1-P)}{n} $$
     $$ SE(\hat{p}) = \sqrt{\frac{P(1-P)}{n}} $$
     $$ nP > 15 $$
     $$ n(1 - P) > 15 $$
     $$ X \sim \text{Binomial}(n, P) $$
     $$ E(\hat{p}_1 - \hat{p}_2) = P_1 - P_2 $$
     $$ SE(\hat{p}_1 - \hat{p}_2) = \sqrt{\frac{P_1(1-P_1)}{n_1} + \frac{P_2(1-P_2)}{n_2}} $$
     $$ n_1P_1 > 15 $$
     $$ n_1(1-P_1) > 15 $$
     $$ n_2P_2 > 15 $$
     $$ n_2(1-P_2) > 15 $$
     $$ P(|\hat{p} - P| < 0.05) $$
   - Applications & Characteristic Lists:
     Format as bullet points with bold lead-in titles:
     • **Generalization:** Drawing conclusions about a population based on sample information.
     • **Risk calculation:** Estimating the probability of sampling error in a conclusion.
     • **Confidence intervals:** Determining a likely range for an unknown population parameter.
     • **Hypothesis testing:** Assessing whether sample evidence supports or contradicts a population claim.
     • **Interval probability:** Calculating the probability that a sample statistic lies within a specified interval around the true population parameter.
   - LaTeX Math Normalization:
     Correct all raw LaTeX codes in text (e.g. \bar{x} -> $\bar{x}$, \mu -> $\mu$, \sigma -> $\sigma$, \pi -> $\pi$, p -> $p$, \hat{p} -> $\hat{p}$, \chi^2 -> $\chi^2$, etc.). Never leave bare backslashes in running text.

2. EXAM QUESTION BANKS & PAST PAPERS:
   (Apply whenever content contains previous year questions, problem sets, or exam sections):
   - Header: # CourseCode: Course Name, ### Topic-wise All Questions
   - Section Headings: ### Section A: Descriptive Statistics, Graphical Representation...
   - Topic / Year Headings: #### Topic 1: ... or #### 2025-Final Examination
   - Numbered questions: 1. ..., a. ..., b. ..., i. ..., ii. ...
   - Balanced observation data arrays: comma-separated, 10 values per line.
   - Frequency and Side note formatting:
     Frequency: 4 times | Years: 2025 Final; 2018 Final; 2017 Final; 2019 Midterm
     Side note: Identical structure with slight value changes repeats in 2018 Final Q1.
   - Completely strip all citation brackets like [১৫], [২০, ২১], [15], etc.

3. TREE ARTIFACT ELIMINATION:
   - Completely strip all tree-drawing characters: |, │, ├──, └──, ├─, └─, +, \`---\`.
   - Never output pipe vertical bars or branch ASCII symbols.

4. CONTENT PRESERVATION:
   - Preserve ALL original information, formulas, questions, instructions, numbers, and data values. Do NOT omit or summarize anything.

5. OUTPUT FORMAT:
   - Output ONLY the cleaned Markdown text.
   - Do NOT include conversational intros or chit-chat.
   - Do NOT wrap the entire output in a top-level \`\`\`markdown fence. Return raw Markdown directly.

RAW NOTES:
${preCleaned}`;

    // Phase 6 Pipeline Debug Tracing (Server: strictly metadata only, no keys/sensitive text)
    const rawBlocks = parseDocumentBlocks(rawText);
    logPipelineDebug(
      "raw_input",
      {
        charCount: rawText.length,
        wordCount: rawText.trim().split(/\s+/).length,
      },
      "Server"
    );

    logPipelineDebug(
      "parsed_blocks",
      {
        blockCount: rawBlocks.length,
        blockIds: rawBlocks.slice(0, 5).map((b) => b.id),
        blockTypes: rawBlocks.reduce((acc, b) => {
          acc[b.type] = (acc[b.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      },
      "Server"
    );

    // 1. Establish the authoritative FormatAI Baseline Document.
    // The existing FormatAI Result is the baseline for AI Polish.
    // If not passed from client's current verified preview state, compute it natively.
    const baselineDoc = baselineMarkdown && baselineMarkdown.trim()
      ? baselineMarkdown.trim()
      : cleanClientSideNotebookLM(rawText, formatMode, enabledSkillIds);

    const baselineBlocks = parseDocumentBlocks(baselineDoc);
    logPipelineDebug(
      "formatting_result",
      {
        charCount: baselineDoc.length,
        blockCount: baselineBlocks.length,
      },
      "Server"
    );

    // Direct No AI / FormatAI request — instant deterministic formatting without external AI calls
    if (
      aiConfig?.activeProviderId === "formatai" ||
      aiConfig?.activeProviderId === "local" ||
      (aiConfig as any)?.mode === "no_ai" ||
      (aiConfig as any)?.mode === "formatai"
    ) {
      logPipelineDebug(
        "preview_input",
        {
          charCount: baselineDoc.length,
          blockCount: baselineBlocks.length,
        },
        "Server"
      );
      return {
        cleanedMarkdown: baselineDoc,
        providerId: "formatai",
        providerName: "FormatAI (Deterministic Academic Typesetter)",
        model: "standard-academic-engine",
        validationFailed: false,
        validationErrors: [],
        validationScore: 100,
        discardedAiOutput: false,
        errorCategory: undefined,
        fallbackCount: 0,
        fallbackChain: [],
      };
    }

    // Helper: Strip markdown code fences from AI response
    const cleanAiText = (raw: string) => {
      let cleaned = (raw || "").trim();
      if (cleaned.startsWith("```markdown")) {
        cleaned = cleaned.slice(11).trim();
      } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.slice(3).trim();
      }
      if (cleaned.endsWith("```")) {
        cleaned = cleaned.slice(0, -3).trim();
      }
      return standardizeMathToLatex(cleanNotebookLMTreeArtifacts(cleaned));
    };

    // ── REQUIREMENT 3: LARGE DOCUMENT BLOCK-BOUNDARY CHUNKING ──────────────────
    // If document is large (>3500 chars or >25 atomic blocks), chunk strictly on
    // block boundaries. Equations, tables, and code blocks are NEVER sliced.
    const isLargeDoc = baselineDoc.length > 3500 || baselineBlocks.length > 25;

    if (isLargeDoc) {
      console.log(`Large document detected (${baselineDoc.length} chars, ${baselineBlocks.length} blocks). Chunking on atomic block boundaries...`);
      const chunks = createDocumentChunks(baselineDoc, 3000, 20);
      console.log(`Created ${chunks.length} atomic chunks. Equation, table, and code blocks preserved intact.`);

      const polishedChunkResults: Array<{ chunkIndex: number; text: string; expectedBlockIds: string[] }> = [];
      let hadChunkFailure = false;
      let chunkFailureReason: string | undefined;
      let chunkErrorCategory: AIErrorCategory | undefined;
      let lastProviderId = "unknown";
      let lastProviderName = "AI Provider";
      let lastModel = "default";
      let totalFallbacks = 0;
      let aggregatedChain: any[] = [];

      for (const chunk of chunks) {
        const chunkPrompt = `You are acting as the AI Polish & Quality-Enhancement Layer for FormatAI (Processing Section ${chunk.chunkIndex + 1} of ${chunk.totalChunks}).
Preserve all equations ($$...$$, \\(...\\)), tables, headers, and content intact. Fix formatting and notation without omitting anything.

Expected Block Identifiers in this section:
${chunk.expectedBlockIds.join(", ")}

---
## SECTION ${chunk.chunkIndex + 1} BASELINE TO POLISH:
${chunk.rawText}

OUTPUT FORMAT: Return raw polished Markdown directly with NO conversational filler and NO top-level \`\`\`markdown fence.`;

        let chunkCandidateText = chunk.rawText; // Default to local baseline
        try {
          const chunkAiRes = await aiRequestManager.executeRequestScoped(
            {
              prompt: chunkPrompt,
              systemPrompt: combinedSystemPrompt,
              temperature: 0.2,
              capabilities: ["text", "math", "long_context"],
            },
            aiConfig,
            userProviders
          );

          lastProviderId = chunkAiRes.providerId;
          lastProviderName = chunkAiRes.providerName;
          lastModel = chunkAiRes.model;
          if (chunkAiRes.fallbackChain) aggregatedChain = chunkAiRes.fallbackChain;
          totalFallbacks = Math.max(totalFallbacks, chunkAiRes.fallbackChain.length - 1);

          let candidate = cleanAiText(chunkAiRes.text);
          let validation = validateAIPolishOutput(candidate, chunk.rawText, chunk.rawText, chunk.expectedBlockIds);

          // REQUIREMENT 2: Fail হলে original রাখো → একবার retry → local formatting fallback → warning
          if (!validation.isValid) {
            console.warn(`Chunk ${chunk.chunkIndex + 1}/${chunk.totalChunks} failed validation. Attempting 1 controlled repair retry...`);
            try {
              const retryFeedback = formatValidationFeedback(validation);
              const retryRes = await aiRequestManager.executeRequestScoped(
                {
                  prompt: `${chunkPrompt}\n\n---\n## CRITICAL REPAIR INSTRUCTION (RETRY 1 OF 1):\n${retryFeedback}`,
                  systemPrompt: combinedSystemPrompt,
                  temperature: 0.1,
                  capabilities: ["text", "math", "long_context"],
                },
                aiConfig,
                userProviders
              );
              const retryCandidate = cleanAiText(retryRes.text);
              const retryVal = validateAIPolishOutput(retryCandidate, chunk.rawText, chunk.rawText, chunk.expectedBlockIds);

              if (retryVal.isValid) {
                candidate = retryCandidate;
                validation = retryVal;
              } else {
                hadChunkFailure = true;
                chunkFailureReason = retryVal.discardReason || "Section failed validation after repair retry.";
                chunkErrorCategory = retryVal.errorCategory || "truncated";
                candidate = chunk.rawText; // Local formatting fallback
              }
            } catch (retryErr: any) {
              hadChunkFailure = true;
              chunkFailureReason = retryErr.message;
              chunkErrorCategory = classifyErrorDetails(retryErr.message).errorCategory;
              candidate = chunk.rawText; // Local formatting fallback
            }
          }

          chunkCandidateText = validation.isValid ? candidate : chunk.rawText;
        } catch (chunkErr: any) {
          console.warn(`Chunk ${chunk.chunkIndex + 1}/${chunk.totalChunks} AI call failed, using local formatting fallback:`, chunkErr.message);
          hadChunkFailure = true;
          chunkFailureReason = chunkErr.message;
          chunkErrorCategory = classifyErrorDetails(chunkErr.message).errorCategory;
          chunkCandidateText = chunk.rawText; // Local formatting fallback
        }

        polishedChunkResults.push({
          chunkIndex: chunk.chunkIndex,
          text: chunkCandidateText,
          expectedBlockIds: chunk.expectedBlockIds,
        });
      }

      // REQUIREMENT 3: Order ঠিক রেখে deterministic ভাবে জোড়া দাও
      const reassembled = reassembleDocumentChunks(polishedChunkResults);
      console.log(`Reassembled ${chunks.length} chunks deterministically. Total length: ${reassembled.length} chars.`);

      // Validate reassembled document against original baseline
      const fullDocValidation = validateAIPolishOutput(reassembled, rawText, baselineDoc);

      logPipelineDebug(
        "validation",
        {
          isValid: fullDocValidation.isValid && !hadChunkFailure,
          validationScore: fullDocValidation.score,
          missingBlocksCount: fullDocValidation.blockComparison?.missingBlocks?.length || 0,
          charDiffPercent: fullDocValidation.blockComparison?.charCountDifferencePercent,
        },
        "Server:Chunk"
      );

      logPipelineDebug(
        "preview_input",
        {
          charCount: reassembled.length,
          blockCount: parseDocumentBlocks(reassembled).length,
        },
        "Server:Chunk"
      );

      if (hadChunkFailure || !fullDocValidation.isValid) {
        return {
          cleanedMarkdown: reassembled,
          providerId: lastProviderId,
          providerName: lastProviderName,
          model: lastModel,
          validationFailed: true,
          validationErrors: fullDocValidation.errors.length > 0 ? fullDocValidation.errors : [chunkFailureReason || "One or more document sections used safe local formatting fallback."],
          validationScore: fullDocValidation.score,
          discardedAiOutput: hadChunkFailure,
          discardReason: chunkFailureReason || fullDocValidation.discardReason || "Document section quality-gate failure (FormatAI baseline preserved).",
          errorCategory: chunkErrorCategory || fullDocValidation.errorCategory || "truncated",
          fallbackCount: totalFallbacks,
          fallbackChain: aggregatedChain,
        };
      }

      return {
        cleanedMarkdown: reassembled,
        providerId: lastProviderId,
        providerName: lastProviderName,
        model: lastModel,
        validationFailed: false,
        validationErrors: [],
        validationScore: fullDocValidation.score,
        discardedAiOutput: false,
        errorCategory: undefined,
        fallbackCount: totalFallbacks,
        fallbackChain: aggregatedChain,
      };
    }

    // ── STANDARD DOCUMENT PROCESSING (SINGLE ATOMIC CHUNK) ─────────────────────
    // AI Polish prompt integrating FormatAI Baseline Document + Original Content + Skills Context
    const aiPolishPrompt = `You are acting as the AI Polish & Quality-Enhancement Layer for FormatAI.
FormatAI Native Skills have already performed the initial formatting pass and produced the authoritative BASELINE DOCUMENT below.

YOUR CORE MANDATE:
1. "PRESERVE FIRST. IMPROVE SECOND."
2. TREAT THE FORMATAI BASELINE DOCUMENT AS YOUR FOUNDATIONAL SOURCE:
   • What FormatAI handled correctly -> KEEP EXACTLY AS IS.
   • What FormatAI could not handle -> IMPROVE with high-order academic precision.
   • Obvious formatting errors -> FIX.
   • Ambiguous structure -> RESOLVE cleanly.
   • Already correct elements -> DO NOT unnecessarily reword, reformat, or alter.
3. DO NOT REGENERATE THE DOCUMENT FROM SCRATCH:
   • Preserve all existing Markdown headings (#, ##, ###), numbered sections, and document hierarchy.
   • Preserve all existing Markdown tables, column alignments, and data rows.
   • Preserve all mathematical expressions and formulas. Standardize to rigorous KaTeX syntax (\\(...\\) inline, $$...$$ or \\[...\\] display).
   • Preserve citations, bibliography/references, bullet points, and data values.
   • Do NOT hallucinate new facts, sources, statistics, or substantive claims.
4. NO TREE ARTIFACTS:
   • Strip any tree-drawing characters (|, │, ├──, └──, ├─, └─, +, \`---\`).
5. OUTPUT FORMAT:
   • Output ONLY the polished Markdown text directly.
   • Do NOT include conversational introductions, polite remarks, or assistant commentary.
   • Do NOT wrap the entire output in a top-level \`\`\`markdown fence. Return raw Markdown directly.

SELECTED FORMATTING MODE: "${formatMode}"

---
## 1. FORMATAI BASELINE DOCUMENT (CURRENT AUTHORITATIVE STATE TO ENHANCE & PRESERVE):
${baselineDoc}

---
## 2. ORIGINAL USER CONTENT (FOR REFERENCE & FACTUAL INTEGRITY):
${preCleaned}`;

    try {
      logPipelineDebug(
        "ai_request",
        {
          providerId: aiConfig?.activeProviderId || "default",
          model: aiConfig?.activeModel || "default",
          charCount: aiPolishPrompt.length,
          blockCount: baselineBlocks.length,
        },
        "Server"
      );

      const aiResponse = await aiRequestManager.executeRequestScoped(
        {
          prompt: aiPolishPrompt,
          systemPrompt: combinedSystemPrompt,
          temperature: 0.2,
          capabilities: ["text", "math", "long_context"],
        },
        aiConfig,
        userProviders
      );

      const candidate = cleanAiText(aiResponse.text);

      logPipelineDebug(
        "ai_response",
        {
          providerId: aiResponse.providerId,
          model: aiResponse.model,
          charCount: candidate.length,
        },
        "Server"
      );

      // Quality-Gate Validation: non-empty, JSON complete, expected blocks, not suspiciously small
      let validation = validateAIPolishOutput(candidate, rawText, baselineDoc);

      logPipelineDebug(
        "validation",
        {
          isValid: validation.isValid,
          validationScore: validation.score,
          missingBlocksCount: validation.blockComparison?.missingBlocks?.length || 0,
          charDiffPercent: validation.blockComparison?.charCountDifferencePercent,
        },
        "Server"
      );

      // REQUIREMENT 2: Fail হলে: original রাখো → একবার retry → local formatting fallback → warning দেখাও
      if (!validation.isValid) {
        console.warn("AI Candidate failed validation on pass 1. Attempting 1 controlled repair retry:", validation.errors);

        try {
          const retryFeedback = formatValidationFeedback(validation);
          const retryPrompt = `${aiPolishPrompt}

---
## CRITICAL REPAIR INSTRUCTION (RETRY 1 OF 1):
${retryFeedback}`;

          const retryResponse = await aiRequestManager.executeRequestScoped(
            {
              prompt: retryPrompt,
              systemPrompt: combinedSystemPrompt,
              temperature: 0.1,
              capabilities: ["text", "math", "long_context"],
            },
            aiConfig,
            userProviders
          );

          const retryCandidate = cleanAiText(retryResponse.text);
          const retryValidation = validateAIPolishOutput(retryCandidate, rawText, baselineDoc);

          if (retryValidation.isValid) {
            console.log("Controlled AI repair retry SUCCEEDED! Committing validated candidate.");
            logPipelineDebug(
              "preview_input",
              {
                charCount: retryCandidate.length,
                blockCount: parseDocumentBlocks(retryCandidate).length,
              },
              "Server"
            );
            return {
              cleanedMarkdown: retryCandidate,
              providerId: retryResponse.providerId,
              providerName: retryResponse.providerName,
              model: retryResponse.model,
              validationFailed: false,
              validationErrors: [],
              validationScore: retryValidation.score,
              discardedAiOutput: false,
              errorCategory: undefined,
              fallbackCount: Math.max(0, retryResponse.fallbackChain.length - 1),
              fallbackChain: retryResponse.fallbackChain,
            };
          } else {
            console.warn("Controlled AI repair retry STILL failed validation:", retryValidation.errors);
            validation = retryValidation;
          }
        } catch (retryErr: any) {
          console.warn("Error during controlled AI repair retry:", retryErr.message);
        }

        // Both attempts failed: Discard AI Output & Preserve FormatAI Baseline Result (Local Formatting Fallback)
        console.warn("AI Polish output FAILED validation after retry. Preserving FormatAI Baseline Result:", validation.errors);
        logPipelineDebug(
          "preview_input",
          {
            charCount: baselineDoc.length,
            blockCount: baselineBlocks.length,
          },
          "Server"
        );
        return {
          cleanedMarkdown: baselineDoc,
          providerId: aiResponse.providerId,
          providerName: aiResponse.providerName,
          model: aiResponse.model,
          validationFailed: true,
          validationErrors: validation.errors,
          validationScore: validation.score,
          discardedAiOutput: true,
          discardReason: validation.discardReason || "AI output failed quality-gate validation.",
          errorCategory: validation.errorCategory || "malformed",
          fallbackCount: Math.max(0, aiResponse.fallbackChain.length - 1),
          fallbackChain: aiResponse.fallbackChain,
        };
      }

      // Candidate passed validation on first try -> Atomic Commit
      logPipelineDebug(
        "preview_input",
        {
          charCount: candidate.length,
          blockCount: parseDocumentBlocks(candidate).length,
        },
        "Server"
      );
      return {
        cleanedMarkdown: candidate,
        providerId: aiResponse.providerId,
        providerName: aiResponse.providerName,
        model: aiResponse.model,
        validationFailed: false,
        validationErrors: [],
        validationScore: validation.score,
        discardedAiOutput: false,
        errorCategory: undefined,
        fallbackCount: Math.max(0, aiResponse.fallbackChain.length - 1),
        fallbackChain: aiResponse.fallbackChain,
      };
    } catch (err: any) {
      console.warn("AIRequestManager error, preserving FormatAI Baseline Result:", err.message);
      const classified = classifyErrorDetails(err.message);
      logPipelineDebug(
        "preview_input",
        {
          charCount: baselineDoc.length,
          blockCount: baselineBlocks.length,
        },
        "Server"
      );
      // Fallback gracefully to baseline FormatAI result if all providers fail
      return {
        cleanedMarkdown: baselineDoc,
        providerId: "local",
        providerName: "FormatAI Native Engine (Safe Fallback)",
        model: "deterministic-v2",
        validationFailed: true,
        validationErrors: [err.message || "AI service connection failed."],
        validationScore: 100,
        discardedAiOutput: true,
        discardReason: err.message || "AI service connection failed.",
        errorCategory: classified.errorCategory,
        fallbackCount: 0,
        fallbackChain: (err as any)?.fallbackChain || [],
      };
    }
  }

  interface PolishNotesResult {
    polishedMarkdown: string;
    originalMarkdown: string;
    hasChanges: boolean;
    message: string;
    providerId: string;
    providerName: string;
    model: string;
    validationFailed: boolean;
    validationErrors: string[];
    validationScore: number;
    discardedAiOutput: boolean;
    discardReason?: string;
    errorCategory?: AIErrorCategory;
    fallbackCount: number;
    fallbackChain: any[];
  }

  /**
   * SEPARATE AI POLISH FUNCTION:
   * DOES NOT run the format pipeline (no skill pipeline, no table extraction, no structure re-generation).
   * Focuses purely on: Grammar, Clarity, Terminology, and Repetition.
   * Keeps Equations, Tables, Headings, and Lists 100% INTACT.
   * Strictly validates candidate with Phase 1 validation (validateAIPolishOutput).
   * Computes diff and returns "কোনো উন্নতি পাওয়া যায়নি" if no changes exist.
   */
  async function polishTextWithMultiProviderAI(
    textToPolish: string,
    aiConfig?: any,
    userProviders?: any[],
    customPrompt?: string
  ): Promise<PolishNotesResult> {
    const originalText = (textToPolish || "").trim();

    // 1. Direct No AI / Local check
    if (
      aiConfig?.activeProviderId === "formatai" ||
      aiConfig?.activeProviderId === "local" ||
      (aiConfig as any)?.mode === "no_ai" ||
      (aiConfig as any)?.mode === "formatai"
    ) {
      return {
        polishedMarkdown: originalText,
        originalMarkdown: originalText,
        hasChanges: false,
        message: NO_IMPROVEMENT_MESSAGE,
        providerId: "formatai",
        providerName: "FormatAI Academic Engine (No AI)",
        model: "deterministic-v2",
        validationFailed: false,
        validationErrors: [],
        validationScore: 100,
        discardedAiOutput: false,
        fallbackCount: 0,
        fallbackChain: [],
      };
    }

    // Helper: Strip markdown code fences from AI response
    const cleanAiText = (raw: string) => {
      let cleaned = (raw || "").trim();
      if (cleaned.startsWith("```markdown")) {
        cleaned = cleaned.slice(11).trim();
      } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.slice(3).trim();
      }
      if (cleaned.endsWith("```")) {
        cleaned = cleaned.slice(0, -3).trim();
      }
      return cleanNotebookLMTreeArtifacts(cleaned);
    };

    const POLISH_SYSTEM_INSTRUCTION = `You are an expert academic copy-editor, mathematical proofreader, and publication typesetter.
Your role is EXCLUSIVELY the dedicated "Polish" function.
IMPORTANT: The document has ALREADY been formatted by the academic formatting pipeline. DO NOT re-run formatting, restructure sections, or reorganize content.

YOUR SOLE EDITORIAL MANDATE (ONLY FIX THESE 4 AREAS):
1. Grammar & Spelling:
   - Correct all grammatical errors, typos, spelling mistakes, subject-verb disagreements, and verb tense inconsistencies.
   - Standardize punctuation and capitalization according to formal academic publication style.

2. Clarity & Readability:
   - Enhance readability and academic sentence flow without altering technical meaning.
   - Smooth out awkward phrasing or clunky expressions into concise, scholarly language.

3. Academic Terminology:
   - Ensure consistent, standard academic, mathematical, and statistical terminology (e.g. population parameter, sample statistic, null hypothesis, degrees of freedom).
   - Maintain uniform notation terms throughout the text.

4. Repetition Elimination:
   - Remove redundant phrases, unnecessary wordiness, and duplicate or stuttered sentences.

STRICT INTACT REQUIREMENTS (NEVER ALTER THESE):
- EQUATIONS: Keep every single equation ($$...$$, \\(...\\), \\[...\\], $...) 100% INTACT. Do NOT re-typeset, simplify, solve, or alter any mathematical symbol or expression.
- TABLES: Keep every Markdown table (| ... |) 100% INTACT. Do NOT alter columns, rows, or tabular data.
- HEADINGS: Keep every heading (#, ##, ###) and its exact title and numbering 100% INTACT.
- LISTS: Keep all bullet points (-) and numbered lists (1.) 100% INTACT.
- CODE BLOCKS: Keep all code fences (\`\`\`...\`\`\`) 100% INTACT.
- NO NEW CONTENT: Do NOT add explanations, answer keys, or new factual claims.
- PRESERVE IF NO DEFECTS: If the text already has excellent grammar, clarity, terminology, and no repetition, return the text unchanged.

OUTPUT FORMAT:
- Return ONLY the polished Markdown directly.
- Absolutely NO conversational preface, no commentary, no markdown code fence wrappers (\`\`\`markdown).`;

    let combinedSystemPrompt = POLISH_SYSTEM_INSTRUCTION;
    if (customPrompt && typeof customPrompt === "string" && customPrompt.trim()) {
      combinedSystemPrompt += `\n\n## USER CUSTOM POLISH INSTRUCTIONS:\n${customPrompt.trim()}`;
    }

    const baselineBlocks = parseDocumentBlocks(originalText);
    const isLargeDoc = originalText.length > 3500 || baselineBlocks.length > 25;

    if (isLargeDoc) {
      console.log(`[POLISH] Large document detected (${originalText.length} chars, ${baselineBlocks.length} blocks). Chunking on atomic block boundaries...`);
      const chunks = createDocumentChunks(originalText, 3000, 20);
      const polishedChunkResults: Array<{ chunkIndex: number; text: string; expectedBlockIds: string[] }> = [];
      let hadChunkFailure = false;
      let chunkFailureReason: string | undefined;
      let chunkErrorCategory: AIErrorCategory | undefined;
      let lastProviderId = "unknown";
      let lastProviderName = "AI Provider";
      let lastModel = "default";
      let totalFallbacks = 0;
      let aggregatedChain: any[] = [];

      for (const chunk of chunks) {
        const chunkPrompt = `You are executing the dedicated AI Polish Layer (Processing Section ${chunk.chunkIndex + 1} of ${chunk.totalChunks}).
TASK: Fix ONLY grammar, clarity, terminology, and repetition.
PRESERVE INTACT: All equations ($$...$$, \\(...\\)), tables, headings, and lists must remain 100% unchanged.

Expected Block Identifiers in this section:
${chunk.expectedBlockIds.join(", ")}

---
## SECTION ${chunk.chunkIndex + 1} TEXT TO POLISH:
${chunk.rawText}

OUTPUT FORMAT: Return raw polished Markdown directly with NO conversational filler.`;

        let chunkCandidateText = chunk.rawText;
        try {
          const chunkAiRes = await aiRequestManager.executeRequestScoped(
            {
              prompt: chunkPrompt,
              systemPrompt: combinedSystemPrompt,
              temperature: 0.2,
              capabilities: ["text", "math", "long_context"],
            },
            aiConfig,
            userProviders
          );

          lastProviderId = chunkAiRes.providerId;
          lastProviderName = chunkAiRes.providerName;
          lastModel = chunkAiRes.model;
          if (chunkAiRes.fallbackChain) aggregatedChain = chunkAiRes.fallbackChain;
          totalFallbacks = Math.max(totalFallbacks, chunkAiRes.fallbackChain.length - 1);

          let candidate = cleanAiText(chunkAiRes.text);
          let validation = validateAIPolishOutput(candidate, chunk.rawText, chunk.rawText, chunk.expectedBlockIds);

          if (!validation.isValid) {
            console.warn(`[POLISH] Chunk ${chunk.chunkIndex + 1}/${chunk.totalChunks} failed validation. Retrying 1 repair pass...`);
            try {
              const retryFeedback = formatValidationFeedback(validation);
              const retryRes = await aiRequestManager.executeRequestScoped(
                {
                  prompt: `${chunkPrompt}\n\n---\n## CRITICAL REPAIR INSTRUCTION (RETRY 1 OF 1):\n${retryFeedback}`,
                  systemPrompt: combinedSystemPrompt,
                  temperature: 0.1,
                  capabilities: ["text", "math", "long_context"],
                },
                aiConfig,
                userProviders
              );
              const retryCandidate = cleanAiText(retryRes.text);
              const retryVal = validateAIPolishOutput(retryCandidate, chunk.rawText, chunk.rawText, chunk.expectedBlockIds);

              if (retryVal.isValid) {
                candidate = retryCandidate;
                validation = retryVal;
              } else {
                hadChunkFailure = true;
                chunkFailureReason = retryVal.discardReason || "Section failed validation after repair retry.";
                chunkErrorCategory = retryVal.errorCategory || "truncated";
                candidate = chunk.rawText;
              }
            } catch (retryErr: any) {
              hadChunkFailure = true;
              chunkFailureReason = retryErr.message;
              chunkErrorCategory = classifyErrorDetails(retryErr.message).errorCategory;
              candidate = chunk.rawText;
            }
          }

          chunkCandidateText = validation.isValid ? candidate : chunk.rawText;
        } catch (chunkErr: any) {
          console.warn(`[POLISH] Chunk ${chunk.chunkIndex + 1} AI call failed, keeping original:`, chunkErr.message);
          hadChunkFailure = true;
          chunkFailureReason = chunkErr.message;
          chunkErrorCategory = classifyErrorDetails(chunkErr.message).errorCategory;
          chunkCandidateText = chunk.rawText;
        }

        polishedChunkResults.push({
          chunkIndex: chunk.chunkIndex,
          text: chunkCandidateText,
          expectedBlockIds: chunk.expectedBlockIds,
        });
      }

      const reassembled = reassembleDocumentChunks(polishedChunkResults);
      const fullDocValidation = validateAIPolishOutput(reassembled, originalText, originalText);
      const diffResult = computeDocumentDiff(originalText, reassembled);

      if (hadChunkFailure || !fullDocValidation.isValid) {
        return {
          polishedMarkdown: originalText,
          originalMarkdown: originalText,
          hasChanges: false,
          message: NO_IMPROVEMENT_MESSAGE,
          providerId: lastProviderId,
          providerName: lastProviderName,
          model: lastModel,
          validationFailed: true,
          validationErrors: fullDocValidation.errors.length > 0 ? fullDocValidation.errors : [chunkFailureReason || "Safe local fallback preserved."],
          validationScore: fullDocValidation.score,
          discardedAiOutput: true,
          discardReason: chunkFailureReason || fullDocValidation.discardReason || "Polish output failed quality-gate validation.",
          errorCategory: chunkErrorCategory || fullDocValidation.errorCategory || "truncated",
          fallbackCount: totalFallbacks,
          fallbackChain: aggregatedChain,
        };
      }

      return {
        polishedMarkdown: reassembled,
        originalMarkdown: originalText,
        hasChanges: diffResult.hasChanges,
        message: diffResult.hasChanges ? diffResult.message : NO_IMPROVEMENT_MESSAGE,
        providerId: lastProviderId,
        providerName: lastProviderName,
        model: lastModel,
        validationFailed: false,
        validationErrors: [],
        validationScore: fullDocValidation.score,
        discardedAiOutput: false,
        errorCategory: undefined,
        fallbackCount: totalFallbacks,
        fallbackChain: aggregatedChain,
      };
    }

    // Standard document processing (single atomic block)
    const polishPrompt = `You are executing the dedicated AI Polish Layer.
TASK: Polish ONLY grammar, clarity, terminology, and repetition.
DO NOT re-format, change layout, or alter equations, tables, headings, or lists.

---
## TEXT TO POLISH (PRESERVE EQUATIONS, TABLES, HEADINGS, AND LISTS INTACT):
${originalText}`;

    try {
      const aiResponse = await aiRequestManager.executeRequestScoped(
        {
          prompt: polishPrompt,
          systemPrompt: combinedSystemPrompt,
          temperature: 0.2,
          capabilities: ["text", "math", "long_context"],
        },
        aiConfig,
        userProviders
      );

      const candidate = cleanAiText(aiResponse.text);
      let validation = validateAIPolishOutput(candidate, originalText, originalText);

      if (!validation.isValid) {
        console.warn("[POLISH] Candidate failed validation. Attempting 1 repair retry:", validation.errors);
        try {
          const retryFeedback = formatValidationFeedback(validation);
          const retryPrompt = `${polishPrompt}\n\n---\n## CRITICAL REPAIR INSTRUCTION (RETRY 1 OF 1):\n${retryFeedback}`;

          const retryResponse = await aiRequestManager.executeRequestScoped(
            {
              prompt: retryPrompt,
              systemPrompt: combinedSystemPrompt,
              temperature: 0.1,
              capabilities: ["text", "math", "long_context"],
            },
            aiConfig,
            userProviders
          );

          const retryCandidate = cleanAiText(retryResponse.text);
          const retryValidation = validateAIPolishOutput(retryCandidate, originalText, originalText);

          if (retryValidation.isValid) {
            console.log("[POLISH] Repair retry succeeded!");
            const diffResult = computeDocumentDiff(originalText, retryCandidate);
            return {
              polishedMarkdown: retryCandidate,
              originalMarkdown: originalText,
              hasChanges: diffResult.hasChanges,
              message: diffResult.hasChanges ? diffResult.message : NO_IMPROVEMENT_MESSAGE,
              providerId: retryResponse.providerId,
              providerName: retryResponse.providerName,
              model: retryResponse.model,
              validationFailed: false,
              validationErrors: [],
              validationScore: retryValidation.score,
              discardedAiOutput: false,
              fallbackCount: Math.max(0, retryResponse.fallbackChain.length - 1),
              fallbackChain: retryResponse.fallbackChain,
            };
          } else {
            validation = retryValidation;
          }
        } catch (retryErr: any) {
          console.warn("[POLISH] Error in retry:", retryErr.message);
        }

        // Repair failed -> Discard AI output, preserve original text intact
        return {
          polishedMarkdown: originalText,
          originalMarkdown: originalText,
          hasChanges: false,
          message: NO_IMPROVEMENT_MESSAGE,
          providerId: aiResponse.providerId,
          providerName: aiResponse.providerName,
          model: aiResponse.model,
          validationFailed: true,
          validationErrors: validation.errors,
          validationScore: validation.score,
          discardedAiOutput: true,
          discardReason: validation.discardReason || "AI Polish output failed quality-gate validation.",
          errorCategory: validation.errorCategory || "malformed",
          fallbackCount: Math.max(0, aiResponse.fallbackChain.length - 1),
          fallbackChain: aiResponse.fallbackChain,
        };
      }

      const diffResult = computeDocumentDiff(originalText, candidate);
      return {
        polishedMarkdown: candidate,
        originalMarkdown: originalText,
        hasChanges: diffResult.hasChanges,
        message: diffResult.hasChanges ? diffResult.message : NO_IMPROVEMENT_MESSAGE,
        providerId: aiResponse.providerId,
        providerName: aiResponse.providerName,
        model: aiResponse.model,
        validationFailed: false,
        validationErrors: [],
        validationScore: validation.score,
        discardedAiOutput: false,
        fallbackCount: Math.max(0, aiResponse.fallbackChain.length - 1),
        fallbackChain: aiResponse.fallbackChain,
      };
    } catch (err: any) {
      console.warn("[POLISH] AIRequestManager error, preserving original text:", err.message);
      const classified = classifyErrorDetails(err.message);
      return {
        polishedMarkdown: originalText,
        originalMarkdown: originalText,
        hasChanges: false,
        message: NO_IMPROVEMENT_MESSAGE,
        providerId: "local",
        providerName: "FormatAI Native Proofreader",
        model: "safe-fallback",
        validationFailed: true,
        validationErrors: [err.message || "AI polish service failed."],
        validationScore: 100,
        discardedAiOutput: true,
        discardReason: err.message || "AI service connection failed.",
        errorCategory: classified.errorCategory,
        fallbackCount: 0,
        fallbackChain: (err as any)?.fallbackChain || [],
      };
    }
  }

  // Preview clean Markdown text without DOCX generation
  app.post("/api/preview-clean", async (req, res) => {
    try {
      const {
        text,
        baselineMarkdown,
        equationFormat = "native",
        formatMode = "auto",
        enabledSkillIds,
        customPrompt,
        aiConfig,
        userProviders,
      } = req.body;
      if (!text || typeof text !== "string" || !text.trim()) {
        return res.status(400).json({ error: "Missing or empty 'text' field in request body." });
      }

      const result = await cleanNotesWithMultiProviderAI(
        text,
        equationFormat,
        formatMode,
        enabledSkillIds,
        customPrompt,
        aiConfig,
        userProviders,
        baselineMarkdown
      );
      res.json({
        cleaned_markdown: result.cleanedMarkdown,
        provider_id: result.providerId,
        provider_name: result.providerName,
        model: result.model,
        validation_failed: Boolean(result.validationFailed),
        validation_errors: result.validationErrors || [],
        validation_score: result.validationScore ?? 100,
        discarded_ai_output: Boolean(result.discardedAiOutput),
        discard_reason: result.discardReason || null,
        error_category: result.errorCategory || null,
        fallback_count: result.fallbackCount,
        fallback_chain: result.fallbackChain,
      });
    } catch (err: any) {
      console.error("Preview error:", err);
      const classified = classifyErrorDetails(err.message, err.statusCode || 500);
      res.status(err.statusCode || 500).json({
        error: err.message || "Failed to process notes.",
        error_category: classified.errorCategory,
        fallback_chain: err.fallbackChain || [],
      });
    }
  });

  // Dedicated AI Polish Endpoint (DOES NOT rerun format pipeline; ONLY fixes grammar, clarity, terminology, repetition)
  app.post("/api/polish", async (req, res) => {
    try {
      const {
        text,
        customPrompt,
        aiConfig,
        userProviders,
      } = req.body;
      if (!text || typeof text !== "string" || !text.trim()) {
        return res.status(400).json({ error: "Missing or empty 'text' field in request body." });
      }

      const result = await polishTextWithMultiProviderAI(
        text,
        aiConfig,
        userProviders,
        customPrompt
      );

      res.json({
        polished_markdown: result.polishedMarkdown,
        original_markdown: result.originalMarkdown,
        has_changes: result.hasChanges,
        message: result.message,
        provider_id: result.providerId,
        provider_name: result.providerName,
        model: result.model,
        validation_failed: Boolean(result.validationFailed),
        validation_errors: result.validationErrors || [],
        validation_score: result.validationScore ?? 100,
        discarded_ai_output: Boolean(result.discardedAiOutput),
        discard_reason: result.discardReason || null,
        error_category: result.errorCategory || null,
        fallback_count: result.fallbackCount,
        fallback_chain: result.fallbackChain,
      });
    } catch (err: any) {
      console.error("Polish endpoint error:", err);
      const classified = classifyErrorDetails(err.message, err.statusCode || 500);
      res.status(err.statusCode || 500).json({
        error: err.message || "Failed to polish text with AI.",
        error_category: classified.errorCategory,
        fallback_chain: (err as any).fallbackChain || [],
      });
    }
  });

  // Targeted Single-Block Repair Endpoint
  // Solves: "Fix flagged only" — strictly touches only the requested failed block
  app.post("/api/repair-block", async (req, res) => {
    try {
      const {
        targetBlock,
        prevBlockText,
        nextBlockText,
        equationFormat = "native",
        aiConfig,
        userProviders,
      } = req.body;

      if (!targetBlock || typeof targetBlock.rawText !== "string" || !targetBlock.rawText.trim()) {
        return res.status(400).json({ error: "Missing or empty targetBlock in request." });
      }

      // Check if running in No AI / FormatAI mode
      if (
        aiConfig?.activeProviderId === "formatai" ||
        aiConfig?.activeProviderId === "local" ||
        aiConfig?.mode === "no_ai" ||
        aiConfig?.mode === "formatai"
      ) {
        const candidate = cleanClientSideNotebookLM(targetBlock.rawText, "auto");
        const tempBlock: DocumentBlock = {
          id: targetBlock.id,
          type: targetBlock.type,
          rawText: candidate,
          substantiveText: extractSubstantiveText(candidate),
          charCount: candidate.length,
          substantiveCharCount: extractSubstantiveText(candidate).length,
          lineStart: 1,
          lineEnd: 1,
        };
        const issue = detectBlockFormattingIssue(tempBlock);
        if (issue) {
          return res.json({
            success: false,
            error: `Local repair could not resolve: ${issue.reason}`,
            blockId: targetBlock.id,
          });
        }
        return res.json({
          success: true,
          blockId: targetBlock.id,
          repairedText: candidate,
          providerName: "FormatAI Native Typesetter",
          model: "deterministic-engine",
        });
      }

      // AI-assisted targeted block repair
      const repairPrompt = `You are an academic mathematical editor and LaTeX typesetter.
Your task is to REPAIR and format ONLY the TARGET BLOCK below.

RULES:
1. Fix all broken LaTeX math syntax, unclosed braces ({, }), unmatched delimiters ($$, \\[, \\], \\(, \\)), and incorrect notation.
2. Standardize KaTeX notation: inline \\(...\\), display \\[...\\] or $$...$$.
3. Preserve all original meaning, mathematical facts, variables, numbers, and questions. Do NOT invent new problems or solutions.
4. Output ONLY the repaired block.
5. Do NOT output conversational filler, introductions, or apologies.
6. Do NOT wrap the entire output in a top-level \`\`\`markdown fence. Return raw Markdown text directly.
7. Do NOT repeat or include the previous or next context blocks.

${prevBlockText ? `---
PREVIOUS BLOCK (FOR CONTEXT ONLY, DO NOT REPEAT):
${prevBlockText}
` : ""}
---
TARGET BLOCK TO REPAIR:
${targetBlock.rawText}

${nextBlockText ? `---
NEXT BLOCK (FOR CONTEXT ONLY, DO NOT REPEAT):
${nextBlockText}
` : ""}`;

      const systemInstruction = `You are an academic document formatting repair engine. Repair ONLY the target block. Return raw Markdown. Do not repeat context blocks. Do not add commentary.`;

      const aiRes = await aiRequestManager.executeRequestScoped(
        {
          prompt: repairPrompt,
          systemPrompt: systemInstruction,
          temperature: 0.1,
          capabilities: ["text", "math"],
        },
        aiConfig,
        userProviders
      );

      let candidate = (aiRes.text || "").trim();
      if (candidate.startsWith("```markdown")) {
        candidate = candidate.slice(11).trim();
      } else if (candidate.startsWith("```")) {
        candidate = candidate.slice(3).trim();
      }
      if (candidate.endsWith("```")) {
        candidate = candidate.slice(0, -3).trim();
      }
      candidate = standardizeMathToLatex(cleanNotebookLMTreeArtifacts(candidate));

      // Validation on single block response
      // 1. Non-empty
      if (!candidate || !candidate.trim()) {
        return res.json({
          success: false,
          error: "AI produced empty response for this block.",
          blockId: targetBlock.id,
        });
      }

      // 2. Suspiciously short check
      const origSubstantive = targetBlock.rawText.replace(/[^a-zA-Z0-9]/g, "").length;
      const candSubstantive = candidate.replace(/[^a-zA-Z0-9]/g, "").length;
      if (origSubstantive > 20 && candSubstantive < origSubstantive * 0.4) {
        return res.json({
          success: false,
          error: "AI response was suspiciously short or truncated.",
          blockId: targetBlock.id,
        });
      }

      // 3. Block syntax validation: KaTeX & Delimiter checks on repaired candidate
      const tempBlock: DocumentBlock = {
        id: targetBlock.id,
        type: targetBlock.type,
        rawText: candidate,
        substantiveText: extractSubstantiveText(candidate),
        charCount: candidate.length,
        substantiveCharCount: extractSubstantiveText(candidate).length,
        lineStart: 1,
        lineEnd: 1,
      };
      const issue = detectBlockFormattingIssue(tempBlock);
      if (issue) {
        return res.json({
          success: false,
          error: `Repaired block still has issue: ${issue.reason}`,
          blockId: targetBlock.id,
        });
      }

      // Validation passed!
      return res.json({
        success: true,
        blockId: targetBlock.id,
        repairedText: candidate,
        providerName: aiRes.providerName,
        model: aiRes.model,
      });
    } catch (err: any) {
      console.error("Block repair error:", err);
      return res.status(500).json({
        success: false,
        error: err.message || "Failed to repair block.",
      });
    }
  });

  // Main export & conversion endpoint: Supports docx, pdf, tex, md, txt
  const handleExport = async (req: express.Request, res: express.Response) => {
    try {
      const {
        text,
        cleanedMarkdown: clientCleanedMarkdown,
        title = "FormatAI Academic Document",
        font = "Times New Roman",
        accent = "1A365D",
        equationFormat = "native",
        formatMode = "auto",
        enabledSkillIds,
        customPrompt,
        aiConfig,
        userProviders,
      } = req.body || {};

      // Validate requested format (query param or body param, defaulting to 'docx')
      const rawFormat = req.query.format || (req.body && req.body.format) || "docx";
      let targetFormat: ExportFormat;
      try {
        targetFormat = validateExportFormat(rawFormat);
      } catch (formatErr: any) {
        return res.status(400).json({ error: formatErr.message || "Invalid export format. Allowed formats: docx, pdf, tex, md, txt." });
      }

      if (!text || typeof text !== "string" || !text.trim()) {
        return res.status(400).json({ error: "Please paste your notes or AI content to convert." });
      }

      console.log(`Starting export [format: ${targetFormat}] for: "${title}" (length: ${text.length} chars, eqFormat: ${equationFormat}, formatMode: ${formatMode}, hasPreview: ${Boolean(clientCleanedMarkdown)})`);
      
      // Step 1: Use the exact markdown the user previewed, or clean via Multi-Provider AIRequestManager
      let markdownToBuild = clientCleanedMarkdown;
      let providerName = "Instant Preview";
      let modelName = "verified";
      let fallbackCount = 0;

      if (!markdownToBuild || typeof markdownToBuild !== "string" || !markdownToBuild.trim()) {
        const aiResult = await cleanNotesWithMultiProviderAI(
          text,
          equationFormat,
          formatMode,
          enabledSkillIds,
          customPrompt,
          aiConfig,
          userProviders
        );
        markdownToBuild = aiResult.cleanedMarkdown;
        providerName = aiResult.providerName;
        modelName = aiResult.model;
        fallbackCount = aiResult.fallbackCount;
      }

      // Dynamically generate filename independently for every generation directly from user content
      const baseFilename = generateFilenameFromContent(text || markdownToBuild);
      const exportFilename = `${baseFilename}.${targetFormat}`;
      const encodedFilename = encodeURIComponent(exportFilename);
      const asciiFallback = exportFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const contentDispositionHeader = `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedFilename}`;

      // Common AI telemetry headers
      res.setHeader("x-ai-provider", providerName);
      res.setHeader("x-ai-model", modelName);
      res.setHeader("x-ai-fallback-count", String(fallbackCount));

      // Handle each supported format
      switch (targetFormat) {
        case "docx": {
          // Build DOCX buffer with native Word Math & typography (Preserved Original)
          const docxBuffer = await buildDocxFromMarkdown(markdownToBuild, {
            title,
            fontFamily: font,
            accentColor: accent.replace('#', ''),
            equationFormat: equationFormat as any,
            enabledSkillIds,
          });

          res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
          res.setHeader("Content-Disposition", contentDispositionHeader);
          res.setHeader("Content-Length", docxBuffer.length);
          return res.end(docxBuffer);
        }

        case "pdf": {
          // Generate PDF with PDFKit
          const pdfBuffer = await generatePdfBuffer(markdownToBuild, {
            title,
            fontFamily: font,
            accentColor: accent,
          });

          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Disposition", contentDispositionHeader);
          res.setHeader("Content-Length", pdfBuffer.length);
          return res.end(pdfBuffer);
        }

        case "tex": {
          // Generate LaTeX document (.tex)
          const texContent = generateLaTeXDocument(markdownToBuild, title);
          const texBuffer = Buffer.from(texContent, "utf-8");

          res.setHeader("Content-Type", "text/x-tex; charset=utf-8");
          res.setHeader("Content-Disposition", contentDispositionHeader);
          res.setHeader("Content-Length", texBuffer.length);
          return res.end(texBuffer);
        }

        case "md": {
          // Generate clean Markdown (.md)
          const mdContent = generateMarkdownDocument(markdownToBuild, title);
          const mdBuffer = Buffer.from(mdContent, "utf-8");

          res.setHeader("Content-Type", "text/markdown; charset=utf-8");
          res.setHeader("Content-Disposition", contentDispositionHeader);
          res.setHeader("Content-Length", mdBuffer.length);
          return res.end(mdBuffer);
        }

        case "txt": {
          // Generate Plain Text (.txt)
          const txtContent = generatePlainTextDocument(markdownToBuild, title);
          const txtBuffer = Buffer.from(txtContent, "utf-8");

          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.setHeader("Content-Disposition", contentDispositionHeader);
          res.setHeader("Content-Length", txtBuffer.length);
          return res.end(txtBuffer);
        }

        default:
          return res.status(400).json({ error: "Unsupported export format." });
      }
    } catch (err: any) {
      console.error("Export error:", err);
      res.status(500).json({ error: err.message || "Failed to export document." });
    }
  };

  app.post("/convert", handleExport);
  app.post("/api/convert", handleExport);
  app.post("/export", handleExport);
  app.post("/api/export", handleExport);

  // Endpoint to fetch project files for inspector
  app.get("/api/project-files", (req, res) => {
    try {
      const readSafe = (fileName: string) => {
        const p = path.join(process.cwd(), fileName);
        return fs.existsSync(p) ? fs.readFileSync(p, "utf-8") : "";
      };

      res.json({
        "package.json": readSafe("package.json"),
        "README.md": readSafe("README.md"),
      });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to read project files." });
    }
  });

  return app;
}

export const app = createServerApp();

export async function startStandaloneServer() {
  const httpServer = http.createServer(app);

  // Vite middleware for development vs static build for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`FormatAI Server running on http://0.0.0.0:${PORT}`);
  });
  return httpServer;
}

// Only start standalone server when NOT running under Vercel serverless runtime
if (!process.env.VERCEL) {
  startStandaloneServer().catch((err) => {
    console.error("Failed to start server:", err);
  });
}

export default app;
