import { cleanNotebookLMTreeArtifacts } from "../docxService.ts";
import { NO_IMPROVEMENT_MESSAGE, computeDocumentDiff } from "../../utils/diffUtils.ts";
import { parseDocumentBlocks } from "../../utils/blockIntegrity.ts";
import {
  createDocumentChunks,
  reassembleDocumentChunks,
} from "../../utils/documentChunker.ts";
import { aiRequestManager } from "../ai/AIRequestManager.ts";
import {
  validateAIPolishOutput,
  formatValidationFeedback,
  type AIErrorCategory,
} from "../../utils/aiValidation.ts";
import { classifyErrorDetails } from "../../utils/aiStatusClassifier.ts";

export interface PolishNotesResult {
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
export async function polishTextWithMultiProviderAI(
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
