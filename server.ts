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
import { validateAIPolishOutput, formatValidationFeedback } from "./src/utils/aiValidation.ts";
import { aiRequestManager } from "./src/server/ai/AIRequestManager.ts";
import {
  skillRegistry,
  getCombinedSkillPromptInstructions,
  executeSkillPipeline,
} from "./src/skills/index.ts";

const PORT = 3000;

export function createServerApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: "10mb" }));

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

  // Test provider connection with a request-scoped key (stateless; does NOT save key)
  app.post("/api/ai/providers/:id/test", async (req, res) => {
    try {
      const { id } = req.params;
      const { apiKey, model, customEndpoint, accountId } = req.body || {};
      const result = await aiRequestManager.testProviderScoped(
        id,
        apiKey,
        model,
        customEndpoint,
        accountId
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
  }

  const ACADEMIC_MATH_SYSTEM_INSTRUCTION = `You are an expert academic mathematical editor, LaTeX typesetter, and technical document formatter.

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

    // 1. Establish the authoritative FormatAI Baseline Document.
    // The existing FormatAI Result is the baseline for AI Polish.
    // If not passed from client's current verified preview state, compute it natively.
    const baselineDoc = baselineMarkdown && baselineMarkdown.trim()
      ? baselineMarkdown.trim()
      : cleanClientSideNotebookLM(rawText, formatMode, enabledSkillIds);

    // Direct No AI / FormatAI request — instant deterministic formatting without external AI calls
    if (
      aiConfig?.activeProviderId === "formatai" ||
      aiConfig?.activeProviderId === "local" ||
      (aiConfig as any)?.mode === "no_ai" ||
      (aiConfig as any)?.mode === "formatai"
    ) {
      return {
        cleanedMarkdown: baselineDoc,
        providerId: "formatai",
        providerName: "FormatAI (Deterministic Academic Typesetter)",
        model: "standard-academic-engine",
        validationFailed: false,
        validationErrors: [],
        validationScore: 100,
        discardedAiOutput: false,
        fallbackCount: 0,
        fallbackChain: [],
      };
    }

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

      let cleaned = (aiResponse.text || "").trim();
      if (cleaned.startsWith("```markdown")) {
        cleaned = cleaned.slice(11).trim();
      } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.slice(3).trim();
      }
      if (cleaned.endsWith("```")) {
        cleaned = cleaned.slice(0, -3).trim();
      }

      // Post-process temporary candidate
      const candidate = standardizeMathToLatex(cleanNotebookLMTreeArtifacts(cleaned));

      // Quality-Gate Validation on candidate against baseline
      let validation = validateAIPolishOutput(candidate, rawText, baselineDoc);

      // Section 19 & 20: Controlled AI Retry if validation failed (Max 1 retry)
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

          let retryCleaned = (retryResponse.text || "").trim();
          if (retryCleaned.startsWith("```markdown")) {
            retryCleaned = retryCleaned.slice(11).trim();
          } else if (retryCleaned.startsWith("```")) {
            retryCleaned = retryCleaned.slice(3).trim();
          }
          if (retryCleaned.endsWith("```")) {
            retryCleaned = retryCleaned.slice(0, -3).trim();
          }

          const retryCandidate = standardizeMathToLatex(cleanNotebookLMTreeArtifacts(retryCleaned));
          const retryValidation = validateAIPolishOutput(retryCandidate, rawText, baselineDoc);

          if (retryValidation.isValid) {
            console.log("Controlled AI repair retry SUCCEEDED! Committing validated candidate.");
            return {
              cleanedMarkdown: retryCandidate,
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
            console.warn("Controlled AI repair retry STILL failed validation:", retryValidation.errors);
            validation = retryValidation;
          }
        } catch (retryErr: any) {
          console.warn("Error during controlled AI repair retry:", retryErr.message);
        }

        // Both attempts failed: Discard AI Output & Preserve FormatAI Baseline Result
        console.warn("AI Polish output FAILED validation after retry. Preserving FormatAI Baseline Result:", validation.errors);
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
          fallbackCount: Math.max(0, aiResponse.fallbackChain.length - 1),
          fallbackChain: aiResponse.fallbackChain,
        };
      }

      // Candidate passed validation on first try -> Atomic Commit
      return {
        cleanedMarkdown: candidate,
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
      console.warn("AIRequestManager error, preserving FormatAI Baseline Result:", err.message);
      // Fallback gracefully to baseline FormatAI result if all providers fail
      return {
        cleanedMarkdown: baselineDoc,
        providerId: "local",
        providerName: "FormatAI Native Engine (Safe Fallback)",
        model: "deterministic-v2",
        validationFailed: false,
        validationErrors: [],
        validationScore: 100,
        discardedAiOutput: false,
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
        fallback_count: result.fallbackCount,
        fallback_chain: result.fallbackChain,
      });
    } catch (err: any) {
      console.error("Preview error:", err);
      res.status(500).json({
        error: err.message || "Failed to process notes.",
        fallback_chain: err.fallbackChain || [],
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
