import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import {
  cleanNotebookLMTreeArtifacts,
  standardizeMathToLatex,
  sanitizeMathToUnicode,
  buildDocxFromMarkdown
} from "./src/server/docxService.ts";
import { aiRequestManager } from "./src/server/ai/AIRequestManager.ts";

const currentFile = typeof __filename !== "undefined" ? __filename : (import.meta.url ? fileURLToPath(import.meta.url) : path.join(process.cwd(), "server.ts"));
const currentDir = typeof __dirname !== "undefined" ? __dirname : path.dirname(currentFile);

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    const providers = aiRequestManager.getClientProviders();
    const readyProviders = providers.filter((p) => p.enabled && p.activeKeyCount > 0);
    res.json({
      status: "ok",
      has_gemini_key: Boolean(process.env.GEMINI_API_KEY),
      ready_providers_count: readyProviders.length,
      ready_providers: readyProviders.map((p) => p.name),
      service: "NotebookLM to DOCX Converter",
    });
  });

  // --- Multi-Provider AI API Manager Endpoints ---

  // Get sanitized config and provider statuses (keys are masked for security)
  app.get("/api/ai/config", (req, res) => {
    try {
      res.json({
        config: aiRequestManager.getManagerConfig(),
        providers: aiRequestManager.getClientProviders(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch AI configuration." });
    }
  });

  // Update manager global settings (mode, active config, free-only, fallback switches)
  app.post("/api/ai/config", (req, res) => {
    try {
      const {
        mode,
        activeProviderId,
        activeModel,
        activeKeyId,
        enableFallback,
        freeOnlyMode,
        billingMode,
        enableModelFallback,
        defaultTimeoutMs,
      } = req.body;

      aiRequestManager.updateManagerConfig({
        ...(mode && { mode }),
        ...(activeProviderId !== undefined && { activeProviderId }),
        ...(activeModel !== undefined && { activeModel }),
        ...(activeKeyId !== undefined && { activeKeyId }),
        ...(enableFallback !== undefined && { enableFallback: Boolean(enableFallback) }),
        ...(freeOnlyMode !== undefined && { freeOnlyMode: Boolean(freeOnlyMode) }),
        ...(billingMode !== undefined && { billingMode }),
        ...(enableModelFallback !== undefined && { enableModelFallback: Boolean(enableModelFallback) }),
        ...(defaultTimeoutMs && { defaultTimeoutMs: Number(defaultTimeoutMs) }),
      });

      res.json({
        success: true,
        config: aiRequestManager.getManagerConfig(),
        providers: aiRequestManager.getClientProviders(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to update AI settings." });
    }
  });

  // Update specific provider properties (enabled, selectedModel, priority, etc.)
  app.post("/api/ai/providers/:id", (req, res) => {
    try {
      const { id } = req.params;
      aiRequestManager.updateProvider(id, req.body);
      res.json({
        success: true,
        providers: aiRequestManager.getClientProviders(),
        config: aiRequestManager.getManagerConfig(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to update provider." });
    }
  });

  // Securely add a new API key to a provider (defaults to enabled: false)
  app.post("/api/ai/providers/:id/keys", (req, res) => {
    try {
      const { id } = req.params;
      const { apiKey, name } = req.body;
      if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
        return res.status(400).json({ error: "API key cannot be empty." });
      }

      const result = aiRequestManager.addApiKey(id, apiKey, name);
      res.json({
        success: true,
        providerId: id,
        keyId: result.keyId,
        maskedKey: result.masked,
        enabled: result.enabled,
        providers: aiRequestManager.getClientProviders(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to add API key." });
    }
  });

  // Toggle individual key ON / OFF
  app.patch("/api/ai/providers/:id/keys/:keyId", (req, res) => {
    try {
      const { id, keyId } = req.params;
      const { enabled } = req.body;
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ error: "enabled field must be a boolean." });
      }
      aiRequestManager.toggleApiKey(id, keyId, enabled);
      res.json({
        success: true,
        providers: aiRequestManager.getClientProviders(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to toggle key." });
    }
  });

  // Remove an API key by keyId or numeric index
  app.delete("/api/ai/providers/:id/keys/:keyId", (req, res) => {
    try {
      const { id, keyId } = req.params;
      aiRequestManager.removeApiKey(id, keyId);
      res.json({
        success: true,
        providerId: id,
        providers: aiRequestManager.getClientProviders(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to remove API key." });
    }
  });

  // Test provider connection and measure latency
  app.post("/api/ai/providers/:id/test", async (req, res) => {
    try {
      const { id } = req.params;
      const { keyId, model } = req.body || {};
      const result = await aiRequestManager.testProvider(id, keyId, model);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({
        success: false,
        errorMessage: err.message || "Test execution failed.",
      });
    }
  });

  // Test all configured active providers
  app.post("/api/ai/test-all", async (req, res) => {
    try {
      const results = await aiRequestManager.testAllProviders();
      res.json({ success: true, results });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Test all failed." });
    }
  });

  // Explicitly persist settings to disk
  app.post("/api/ai/save", (req, res) => {
    try {
      const saved = aiRequestManager.saveSettings();
      res.json({ success: saved, message: saved ? "Settings saved successfully." : "Settings saved in memory." });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to save settings." });
    }
  });

  // Fetch usage stats
  app.get("/api/ai/stats", (req, res) => {
    try {
      res.json({ stats: aiRequestManager.getStats() });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch stats." });
    }
  });

  // Fetch fallback audit logs
  app.get("/api/ai/logs", (req, res) => {
    try {
      res.json({ logs: aiRequestManager.getRecentLogs() });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch logs." });
    }
  });

  // Reorder provider priorities
  app.post("/api/ai/reorder", (req, res) => {
    try {
      const { order } = req.body;
      if (!Array.isArray(order)) {
        return res.status(400).json({ error: "Order must be an array of provider IDs." });
      }
      aiRequestManager.reorderProviders(order);
      res.json({
        success: true,
        providers: aiRequestManager.getClientProviders(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to reorder providers." });
    }
  });

  // Reset to initial configuration
  app.post("/api/ai/reset", (req, res) => {
    try {
      aiRequestManager.resetToDefaults();
      res.json({
        success: true,
        config: aiRequestManager.getManagerConfig(),
        providers: aiRequestManager.getClientProviders(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to reset AI settings." });
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
  }

  async function cleanNotesWithMultiProviderAI(
    rawText: string,
    equationFormat = "native",
    formatMode: "auto" | "study_guide" | "exam_bank" = "auto"
  ): Promise<CleanNotesResult> {
    const preCleaned = standardizeMathToLatex(cleanNotebookLMTreeArtifacts(rawText));

    const prompt = `You are an expert technical editor, academic formatter, and mathematical typesetter.
Your task is to take raw study notes, comprehensive formula sheets, exam question banks, lab manuals, and statistical problem sets copied from Google NotebookLM (which often contain messy tree-drawing pipes, broken LaTeX, unformatted math symbols, truncated equations, Bengali citations, and raw unformatted data blocks) and transform them into publication-ready, beautifully structured academic documents.

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

    try {
      const aiResponse = await aiRequestManager.execute({
        prompt,
        capabilities: ["text", "math", "long_context"],
      });

      let cleaned = (aiResponse.text || "").trim();
      if (cleaned.startsWith("```markdown")) {
        cleaned = cleaned.slice(11).trim();
      } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.slice(3).trim();
      }
      if (cleaned.endsWith("```")) {
        cleaned = cleaned.slice(0, -3).trim();
      }

      // Post-process to guarantee zero tree pipe characters and valid math
      const finalized = standardizeMathToLatex(cleanNotebookLMTreeArtifacts(cleaned));

      return {
        cleanedMarkdown: finalized,
        providerId: aiResponse.providerId,
        providerName: aiResponse.providerName,
        model: aiResponse.model,
        fallbackCount: Math.max(0, aiResponse.fallbackChain.length - 1),
        fallbackChain: aiResponse.fallbackChain,
      };
    } catch (err: any) {
      console.warn("AIRequestManager fallback to local normalizer:", err.message);
      // Fallback gracefully to algorithmic cleaner if all providers fail
      const fallbackCleaned = standardizeMathToLatex(cleanNotebookLMTreeArtifacts(rawText));
      return {
        cleanedMarkdown: fallbackCleaned,
        providerId: "local",
        providerName: "Algorithmic Cleaner (Offline Fallback)",
        model: "rule-based-v2",
        fallbackCount: 0,
        fallbackChain: (err as any)?.fallbackChain || [],
      };
    }
  }

  // Preview clean Markdown text without DOCX generation
  app.post("/api/preview-clean", async (req, res) => {
    try {
      const { text, equationFormat = "native", formatMode = "auto" } = req.body;
      if (!text || typeof text !== "string" || !text.trim()) {
        return res.status(400).json({ error: "Missing or empty 'text' field in request body." });
      }

      const result = await cleanNotesWithMultiProviderAI(text, equationFormat, formatMode);
      res.json({
        cleaned_markdown: result.cleanedMarkdown,
        provider_id: result.providerId,
        provider_name: result.providerName,
        model: result.model,
        fallback_count: result.fallbackCount,
        fallback_chain: result.fallbackChain,
      });
    } catch (err: any) {
      console.error("Preview error:", err);
      res.status(500).json({ error: err.message || "Failed to process notes." });
    }
  });

  // Main conversion endpoint: Returns binary DOCX file
  const handleConvert = async (req: express.Request, res: express.Response) => {
    try {
      const {
        text,
        cleanedMarkdown: clientCleanedMarkdown,
        title = "NotebookLM Notes",
        font = "Times New Roman",
        accent = "1A365D",
        equationFormat = "native",
        formatMode = "auto"
      } = req.body;

      if (!text || typeof text !== "string" || !text.trim()) {
        return res.status(400).json({ error: "Please paste your NotebookLM notes to convert." });
      }

      console.log(`Starting conversion for: "${title}" (length: ${text.length} chars, eqFormat: ${equationFormat}, formatMode: ${formatMode}, hasPreview: ${Boolean(clientCleanedMarkdown)})`);
      
      // Step 1: Use the exact markdown the user previewed, or clean via Multi-Provider AIRequestManager
      let markdownToBuild = clientCleanedMarkdown;
      let providerName = "Instant Preview";
      let modelName = "verified";
      let fallbackCount = 0;

      if (!markdownToBuild || typeof markdownToBuild !== "string" || !markdownToBuild.trim()) {
        const aiResult = await cleanNotesWithMultiProviderAI(text, equationFormat, formatMode);
        markdownToBuild = aiResult.cleanedMarkdown;
        providerName = aiResult.providerName;
        modelName = aiResult.model;
        fallbackCount = aiResult.fallbackCount;
      }

      // Step 2: Build DOCX buffer with native Word Math & typography
      const docxBuffer = await buildDocxFromMarkdown(markdownToBuild, {
        title,
        fontFamily: font,
        accentColor: accent.replace('#', ''),
        equationFormat: equationFormat as any,
      });

      // Step 3: Stream download
      const safeFilename = (title || "notebooklm_notes")
        .toLowerCase()
        .replace(/[^a-z0-9_\-]/g, "_") + ".docx";

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
      res.setHeader("Content-Length", docxBuffer.length);
      res.setHeader("x-ai-provider", providerName);
      res.setHeader("x-ai-model", modelName);
      res.setHeader("x-ai-fallback-count", String(fallbackCount));
      res.end(docxBuffer);
    } catch (err: any) {
      console.error("Conversion error:", err);
      res.status(500).json({ error: err.message || "Failed to convert document." });
    }
  };

  app.post("/convert", handleConvert);
  app.post("/api/convert", handleConvert);

  // Endpoint to fetch Python deployment bundle files for the in-app code inspector
  app.get("/api/project-files", (req, res) => {
    try {
      const readSafe = (fileName: string) => {
        const p = path.join(process.cwd(), fileName);
        return fs.existsSync(p) ? fs.readFileSync(p, "utf-8") : "";
      };

      res.json({
        "app.py": readSafe("app.py"),
        "requirements.txt": readSafe("requirements.txt"),
        "vercel.json": readSafe("vercel.json"),
        "render.yaml": readSafe("render.yaml"),
        "Procfile": readSafe("Procfile"),
        "README.md": readSafe("README.md"),
      });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to read project files." });
    }
  });

  // Vite middleware for development vs static build for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`NotebookLM to DOCX Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
