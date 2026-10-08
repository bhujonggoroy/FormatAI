import express from "express";
import { aiRequestManager } from "../ai/AIRequestManager.ts";

export const aiConfigRouter = express.Router();

// Get static provider metadata templates and public configuration (no user keys, no shared state)
aiConfigRouter.get("/api/ai/config", (_req, res) => {
  try {
    res.json({
      config: aiRequestManager.getManagerConfig(),
      providers: aiRequestManager.getStaticProviderTemplates(),
      hasServerGeminiKey: Boolean(process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_1),
      hasServerKeys: {
        gemini: Boolean(process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY_2),
        groq: Boolean(process.env.GROQ_API_KEY || process.env.GROQ_API_KEY_1),
        openrouter: Boolean(process.env.OPENROUTER_API_KEY),
        mistral: Boolean(process.env.MISTRAL_API_KEY),
        cohere: Boolean(process.env.COHERE_API_KEY),
        huggingface: Boolean(process.env.HUGGINGFACE_API_KEY || process.env.HF_API_KEY || process.env.HUGGING_FACE_HUB_TOKEN),
        cloudflare: Boolean(process.env.CLOUDFLARE_API_KEY || process.env.CLOUDFLARE_API_TOKEN),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch AI configuration." });
  }
});

// Client-isolated acknowledgement for config updates (state lives in client localStorage)
aiConfigRouter.post("/api/ai/config", (_req, res) => {
  res.json({
    success: true,
    message: "AI settings are strictly managed in local browser storage.",
  });
});

// Client-isolated acknowledgement for provider updates
aiConfigRouter.post("/api/ai/providers/:id", (_req, res) => {
  res.json({
    success: true,
    message: "Provider settings are strictly managed in local browser storage.",
  });
});

// Client-isolated acknowledgement for adding keys
aiConfigRouter.post("/api/ai/providers/:id/keys", (_req, res) => {
  res.json({
    success: true,
    message: "API keys are stored strictly in local browser storage.",
  });
});

// Client-isolated acknowledgement for toggling keys
aiConfigRouter.patch("/api/ai/providers/:id/keys/:keyId", (_req, res) => {
  res.json({
    success: true,
    message: "Keys are stored strictly in local browser storage.",
  });
});

// Client-isolated acknowledgement for removing keys
aiConfigRouter.delete("/api/ai/providers/:id/keys/:keyId", (_req, res) => {
  res.json({
    success: true,
    message: "Keys are stored strictly in local browser storage.",
  });
});

// Authoritative model catalog retrieval endpoint
aiConfigRouter.post("/api/ai/models", async (req, res) => {
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
aiConfigRouter.post("/api/ai/test", async (req, res) => {
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
aiConfigRouter.post("/api/ai/providers/:id/test", async (req, res) => {
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
aiConfigRouter.post("/api/ai/test-all", async (req, res) => {
  try {
    const { providers } = req.body || {};
    const results = await aiRequestManager.testAllScoped(providers || []);
    res.json({ success: true, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Test all failed." });
  }
});

// Explicitly acknowledge saving (client persists to local storage)
aiConfigRouter.post("/api/ai/save", (_req, res) => {
  res.json({
    success: true,
    message: "Settings are stored locally in the current browser/profile environment.",
  });
});

// Client-managed stats endpoint
aiConfigRouter.get("/api/ai/stats", (_req, res) => {
  res.json({ stats: [] });
});

// Client-managed fallback audit logs endpoint
aiConfigRouter.get("/api/ai/logs", (_req, res) => {
  res.json({ logs: [] });
});

// Client-isolated acknowledgement for provider reordering
aiConfigRouter.post("/api/ai/reorder", (_req, res) => {
  res.json({
    success: true,
    message: "Provider priorities are stored locally in the current browser/profile environment.",
  });
});

// Reset to initial configuration templates
aiConfigRouter.post("/api/ai/reset", (_req, res) => {
  res.json({
    success: true,
    config: aiRequestManager.getManagerConfig(),
    providers: aiRequestManager.getStaticProviderTemplates(),
  });
});
