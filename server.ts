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

  async function cleanNotesWithMultiProviderAI(rawText: string, equationFormat = "native"): Promise<CleanNotesResult> {
    const preCleaned = standardizeMathToLatex(cleanNotebookLMTreeArtifacts(rawText));

    const prompt = `You are an expert technical editor, academic formatter, and mathematical typesetter.
Your task is to take study notes copied from Google NotebookLM (which often contain messy tree-drawing pipes, broken LaTeX, unformatted math symbols, and truncated equations) and transform them into beautifully organized, publication-ready study notes formatted with standard Markdown and proper mathematical equation standards.

CRITICAL FORMATTING & EQUATION STANDARDS:
1. TREE ARTIFACT ELIMINATION:
   - Completely strip all tree-drawing characters: |, │, ├──, └──, ├─, └─, +, \`---\`.
   - Never output pipe vertical bars or branch ASCII symbols.
   - Transform the tree hierarchy into clean standard Markdown:
     - Main module or chapter: # Main Title
     - Major section titles (e.g. 2. Standard Errors, 2.3 Sample Size Dynamics): ## or ### Section Name
     - Items under sections become bullet points: - **Item Name:** Equation / explanation
     - Sub-bullets should be indented with 2 spaces.
2. MATHEMATICAL RIGOR & PROPER EQUATION FORMAT:
   - Convert all pseudo-math and broken notation into rigorous, standard LaTeX equations enclosed in $...$ for inline or $$...$$ for standalone display equations.
   - When a defined term includes a math symbol in parentheses, format cleanly:
     - Write: - **Parameter** ($\\theta$): or - **Statistic** ($T$):
     - Never trap math inside bold asterisks without dollar signs.
   - All mathematical variables, Greek symbols, parameters, and distributions MUST be enclosed in $...$:
     - e.g., $\\theta$, $T$, $\\mu$, $\\sigma^2$, $p$, $\\bar{X}$, $S^2$, $\\hat{p}$, $\\alpha$, $\\beta$, $\\chi^2_\\nu$, $t_\\nu$, $Z \\sim N(0,1)$.
   - Standalone display equations MUST be on their own line formatted as $$...$$:
     - e.g., $$ M(t) = (1 - 2t)^{-n/2} \\quad \\text{for } t < \\frac{1}{2} $$
     - e.g., $$ T = \\frac{Z}{\\sqrt{\\frac{\\chi^2}{\\nu}}} \\sim t_\\nu $$
   - NEVER wrap equations in Markdown tables (| ... |) or HTML tables. Equations must be native display or inline equations so Microsoft Word formats them directly with the Equation tool, not the Table tool.
   - When headings contain math (e.g. 5.2 Student's $t$-Distribution ($t_\\nu$)), enclose the mathematical symbols in $...$.
   - For example:
     - SE(p̂) = √[p(1 - p) / n] MUST become: $SE(\\hat{p}) = \\sqrt{\\frac{p(1 - p)}{n}}$
     - SE(X̄₁ - X̄₂) = √[(σ₁² / n₁) + (σ₂² / n₂)] MUST become: $SE(\\bar{X}_1 - \\bar{X}_2) = \\sqrt{\\frac{\\sigma_1^2}{n_1} + \\frac{\\sigma_2^2}{n_2}}$
     - SE(p̂₁ - p̂₂) = √[(p₁q₁ / n₁) + (p₂q₂ / n₂)] MUST become: $SE(\\hat{p}_1 - \\hat{p}_2) = \\sqrt{\\frac{p_1 q_1}{n_1} + \\frac{p_2 q_2}{n_2}}$
     - SE ∝ 1 / √n MUST become: $SE \\propto \\frac{1}{\\sqrt{n}}$
     - Multiplier: √[(N - n) / (N - 1)] MUST become: **Multiplier:** $\\sqrt{\\frac{N - n}{N - 1}}$
     - CI = X̄ ± 1.96 * (σ / √n) MUST become: $CI = \\bar{X} \\pm 1.96 \\cdot \\frac{\\sigma}{\\sqrt{n}}$
   - Always use proper LaTeX fractions (\\frac{num}{den}), radicals (\\sqrt{...}), hats (\\hat{...}), bars (\\bar{...}), and subscripts/superscripts.
   - Never output raw bracketed roots like √[...] or crude slashes in equations.
   - Avoid extra spaces before punctuation: write $\\mu$, not $\\mu ,$.
3. CONTENT PRESERVATION:
   - Preserve ALL original information, explanations, facts, concepts, theorems, examples, parenthetical notes (e.g. "(quadrupling n reduces SE by 50%)"), and derivations. Do NOT summarize or omit anything.
4. OUTPUT FORMAT:
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
      const { text, equationFormat = "native" } = req.body;
      if (!text || typeof text !== "string" || !text.trim()) {
        return res.status(400).json({ error: "Missing or empty 'text' field in request body." });
      }

      const result = await cleanNotesWithMultiProviderAI(text, equationFormat);
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
        title = "NotebookLM Notes",
        font = "Times New Roman",
        accent = "1A365D",
        equationFormat = "native"
      } = req.body;

      if (!text || typeof text !== "string" || !text.trim()) {
        return res.status(400).json({ error: "Please paste your NotebookLM notes to convert." });
      }

      console.log(`Starting conversion for: "${title}" (length: ${text.length} chars, eqFormat: ${equationFormat})`);
      
      // Step 1: Clean and format via Multi-Provider AIRequestManager with automated fallback
      const aiResult = await cleanNotesWithMultiProviderAI(text, equationFormat);

      // Step 2: Build DOCX buffer with native Word Math & typography
      const docxBuffer = await buildDocxFromMarkdown(aiResult.cleanedMarkdown, {
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
      res.setHeader("x-ai-provider", aiResult.providerName);
      res.setHeader("x-ai-model", aiResult.model);
      res.setHeader("x-ai-fallback-count", String(aiResult.fallbackCount));
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
