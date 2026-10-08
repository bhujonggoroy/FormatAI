import { cleanClientSideNotebookLM } from "../../utils/cleaner.ts";
import {
  standardizeMathToLatex,
  cleanNotebookLMTreeArtifacts,
} from "../docxService.ts";
import {
  detectBlockFormattingIssue,
  extractSubstantiveText,
  type DocumentBlock,
  type BrokenFragment,
} from "../../utils/blockIntegrity.ts";
import { aiRequestManager } from "../ai/AIRequestManager.ts";

export interface RepairOptions {
  targetBlock: any;
  brokenFragment?: BrokenFragment;
  fragment?: BrokenFragment;
  prevBlockText?: string;
  nextBlockText?: string;
  equationFormat?: string;
  aiConfig?: any;
  userProviders?: any[];
}

export async function executeRepair(options: RepairOptions): Promise<any> {
  const {
    targetBlock,
    brokenFragment,
    fragment,
    prevBlockText,
    nextBlockText,
    aiConfig,
    userProviders,
  } = options;

  if (!targetBlock || typeof targetBlock.rawText !== "string" || !targetBlock.rawText.trim()) {
    throw new Error("Missing or empty targetBlock in request.");
  }

  const targetFrag: BrokenFragment | undefined = brokenFragment || fragment;

  // Check if running in No AI / FormatAI mode
  if (
    aiConfig?.activeProviderId === "formatai" ||
    aiConfig?.activeProviderId === "local" ||
    aiConfig?.mode === "no_ai" ||
    aiConfig?.mode === "formatai"
  ) {
    if (targetFrag) {
      let candidate = cleanClientSideNotebookLM(targetFrag.brokenText, "auto");
      candidate = standardizeMathToLatex(cleanNotebookLMTreeArtifacts(candidate));
      return {
        success: true,
        blockId: targetBlock.id,
        fragmentId: targetFrag.id,
        startOffset: targetFrag.startOffset,
        endOffset: targetFrag.endOffset,
        repairedFragment: candidate,
        repairedText: candidate,
        providerName: "FormatAI Native Typesetter",
        model: "deterministic-engine",
      };
    }

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
      return {
        success: false,
        error: `Local repair could not resolve: ${issue.reason}`,
        blockId: targetBlock.id,
      };
    }
    return {
      success: true,
      blockId: targetBlock.id,
      repairedText: candidate,
      providerName: "FormatAI Native Typesetter",
      model: "deterministic-engine",
    };
  }

  // =========================================================================
  // CASE A: Targeted FRAGMENT-LEVEL Repair (Fine-grained)
  // =========================================================================
  if (targetFrag) {
    const ctxBefore = targetFrag.contextBefore || prevBlockText || "";
    const ctxAfter = targetFrag.contextAfter || nextBlockText || "";

    const fragmentRepairPrompt = `You are an academic mathematical editor and LaTeX typesetter.
Your task is to REPAIR and format ONLY the specified BROKEN FRAGMENT.

RULES:
1. Fix all broken LaTeX math syntax, unclosed braces ({, }), unmatched delimiters ($$, \\[, \\], \\(, \\)), and incorrect notation in this fragment.
2. Standardize KaTeX notation: inline \\(...\\), display \\[...\\] or $$...$$.
3. Preserve all original numbers, variables, formulas, and mathematical meaning.
4. Output ONLY the repaired fragment text. Do NOT output commentary, explanations, introductions, apologies, or markdown fences.
5. Do NOT include, repeat, or wrap the surrounding context text. Output only the replacement for the broken fragment.
6. Return the raw repaired fragment directly.

${ctxBefore ? `---
CONTEXT IMMEDIATELY BEFORE FRAGMENT (FOR REFERENCE ONLY, DO NOT REPEAT IN OUTPUT):
${ctxBefore}
` : ""}
---
BROKEN FRAGMENT TO REPAIR:
${targetFrag.brokenText}

${ctxAfter ? `---
CONTEXT IMMEDIATELY AFTER FRAGMENT (FOR REFERENCE ONLY, DO NOT REPEAT IN OUTPUT):
${ctxAfter}
` : ""}`;

    const systemInstruction = `You are an academic document formatting repair engine. Repair ONLY the broken fragment. Return raw text without markdown code blocks, backticks, or conversational commentary. Do not repeat context.`;

    const aiRes = await aiRequestManager.executeRequestScoped(
      {
        prompt: fragmentRepairPrompt,
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
    } else if (candidate.startsWith("```latex")) {
      candidate = candidate.slice(8).trim();
    } else if (candidate.startsWith("```")) {
      candidate = candidate.slice(3).trim();
    }
    if (candidate.endsWith("```")) {
      candidate = candidate.slice(0, -3).trim();
    }
    candidate = cleanNotebookLMTreeArtifacts(candidate);

    // Validation on single fragment response
    if (!candidate || !candidate.trim()) {
      return {
        success: false,
        error: "AI produced empty response for this fragment.",
        blockId: targetBlock.id,
        fragmentId: targetFrag.id,
      };
    }

    return {
      success: true,
      blockId: targetBlock.id,
      fragmentId: targetFrag.id,
      startOffset: targetFrag.startOffset,
      endOffset: targetFrag.endOffset,
      repairedFragment: candidate,
      repairedText: candidate,
      providerName: aiRes.providerName,
      model: aiRes.model,
    };
  }

  // =========================================================================
  // CASE B: Whole TARGET BLOCK Repair (Fallback / Block-level)
  // =========================================================================
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
    return {
      success: false,
      error: "AI produced empty response for this block.",
      blockId: targetBlock.id,
    };
  }

  // 2. Suspiciously short check
  const origSubstantive = targetBlock.rawText.replace(/[^a-zA-Z0-9]/g, "").length;
  const candSubstantive = candidate.replace(/[^a-zA-Z0-9]/g, "").length;
  if (origSubstantive > 20 && candSubstantive < origSubstantive * 0.4) {
    return {
      success: false,
      error: "AI response was suspiciously short or truncated.",
      blockId: targetBlock.id,
    };
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
    return {
      success: false,
      error: `Repaired block still has issue: ${issue.reason}`,
      blockId: targetBlock.id,
    };
  }

  // Validation passed!
  return {
    success: true,
    blockId: targetBlock.id,
    repairedText: candidate,
    providerName: aiRes.providerName,
    model: aiRes.model,
  };
}
