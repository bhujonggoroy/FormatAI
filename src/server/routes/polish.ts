import express from "express";
import { polishTextWithMultiProviderAI } from "../services/polishService.ts";
import { classifyFallbackChain } from "../../utils/aiStatusClassifier.ts";

export const polishRouter = express.Router();

// Dedicated AI Polish Endpoint (DOES NOT rerun format pipeline; ONLY fixes grammar, clarity, terminology, repetition)
polishRouter.post("/api/polish", async (req, res) => {
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
    const fallbackChain = (err as any).fallbackChain || [];
    const classified = classifyFallbackChain(fallbackChain, err.message, err.statusCode || 500);
    res.status(err.statusCode || 500).json({
      error: err.message || "Failed to polish text with AI.",
      error_category: classified.errorCategory,
      fallback_chain: fallbackChain,
    });
  }
});
