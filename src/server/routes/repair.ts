import express from "express";
import { executeRepair } from "../services/repairService.ts";
import { classifyFallbackChain } from "../../utils/aiStatusClassifier.ts";

export const repairRouter = express.Router();

// Targeted Single-Block / Fragment Repair Endpoint
// Solves: "Fix flagged only" — strictly repairs only the broken fragment or target block
export const handleRepairRequest = async (req: express.Request, res: express.Response) => {
  try {
    const {
      targetBlock,
      brokenFragment,
      fragment,
      prevBlockText,
      nextBlockText,
      equationFormat = "native",
      aiConfig,
      userProviders,
    } = req.body;

    if (!targetBlock || typeof targetBlock.rawText !== "string" || !targetBlock.rawText.trim()) {
      return res.status(400).json({ error: "Missing or empty targetBlock in request." });
    }

    const result = await executeRepair({
      targetBlock,
      brokenFragment,
      fragment,
      prevBlockText,
      nextBlockText,
      equationFormat,
      aiConfig,
      userProviders,
    });

    return res.json(result);
  } catch (err: any) {
    console.error("Block/Fragment repair error:", err);
    const fallbackChain = (err as any).fallbackChain || [];
    const classified = classifyFallbackChain(fallbackChain, err.message, 500);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to repair block or fragment.",
      error_category: classified.errorCategory,
      fallback_chain: fallbackChain,
    });
  }
};

repairRouter.post("/api/repair-block", handleRepairRequest);
repairRouter.post("/api/repair-fragment", handleRepairRequest);
