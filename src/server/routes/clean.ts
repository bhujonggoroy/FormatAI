import express from "express";
import { cleanNotesWithMultiProviderAI } from "../services/cleanService.ts";
import { classifyFallbackChain } from "../../utils/aiStatusClassifier.ts";

export const cleanRouter = express.Router();

// Preview clean Markdown text without DOCX generation
cleanRouter.post("/api/preview-clean", async (req, res) => {
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
    const fallbackChain = (err as any).fallbackChain || [];
    const classified = classifyFallbackChain(fallbackChain, err.message, err.statusCode || 500);
    res.status(err.statusCode || 500).json({
      error: err.message || "Failed to process notes.",
      error_category: classified.errorCategory,
      fallback_chain: fallbackChain,
    });
  }
});
