import {
  cleanNotebookLMTreeArtifacts,
  standardizeMathToLatex,
} from "../docxService.ts";
import { cleanClientSideNotebookLM } from "../../utils/cleaner.ts";
import {
  validateAIPolishOutput,
  formatValidationFeedback,
  type AIErrorCategory,
} from "../../utils/aiValidation.ts";
import {
  createDocumentChunks,
  reassembleDocumentChunks,
} from "../../utils/documentChunker.ts";
import { parseDocumentBlocks } from "../../utils/blockIntegrity.ts";
import { logPipelineDebug } from "../../utils/debugLogger.ts";
import { classifyErrorDetails } from "../../utils/aiStatusClassifier.ts";
import { aiRequestManager } from "../ai/AIRequestManager.ts";
import {
  getCombinedSkillPromptInstructions,
  executeSkillPipeline,
} from "../../skills/index.ts";

export interface CleanNotesResult {
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

export const ACADEMIC_MATH_SYSTEM_INSTRUCTION = `You are an expert academic mathematical editor, LaTeX typesetter, and technical document formatter.

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

export async function cleanNotesWithMultiProviderAI(
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
     | Statistic | A numerical characteristic calculated from a sample, e.g., $\\bar{x}$ or $\\hat{p}$ |
     | Parameter | A numerical characteristic of a population, e.g., $\\mu$, $\\sigma$, or $P$ |
     | Sampling Error | The difference between a sample statistic and the corresponding population parameter |
   - Formula Tables & Summary Formula Sheets (MUST be converted to clean 2-column Markdown Tables):
     | Statistic | Standard Error Formula for a Large or Infinite Population |
     | :--- | :--- |
     | Sample mean, $\\bar{x}$ | $SE(\\bar{x}) = \\frac{\\sigma}{\\sqrt{n}}$ |
     | Sample proportion, $\\hat{p}$ | $SE(\\hat{p}) = \\sqrt{\\frac{P(1-P)}{n}}$ |

     And for Section 5 Summary Formula Sheet:
     | Concept | Formula |
     | :--- | :--- |
     | Sample mean | $\\bar{x} = \\frac{1}{n} \\sum_{i=1}^n x_i$ |
     | Sample proportion | $\\hat{p} = \\frac{x}{n}$ |
     | Mean of sample mean | $E(\\bar{X}) = \\mu$ |
     | Variance of sample mean | $\\text{Var}(\\bar{X}) = \\frac{\\sigma^2}{n}$ |
     | Standard error of sample mean | $SE(\\bar{X}) = \\frac{\\sigma}{\\sqrt{n}}$ |
     | Finite-population SE of mean | $SE(\\bar{X}) = \\sqrt{\\frac{N-n}{N-1}} \\cdot \\frac{\\sigma}{\\sqrt{n}}$ |
     | Mean of sample proportion | $E(\\hat{p}) = P$ |
     | Variance of sample proportion | $\\text{Var}(\\hat{p}) = \\frac{P(1-P)}{n}$ |
     | Standard error of sample proportion | $SE(\\hat{p}) = \\sqrt{\\frac{P(1-P)}{n}}$ |
     | $Z$-score for a mean | $Z = \\frac{\\bar{X} - \\mu}{\\frac{\\sigma}{\\sqrt{n}}}$ |
     | $Z$-score for a proportion | $Z = \\frac{\\hat{p} - P}{\\sqrt{\\frac{P(1-P)}{n}}}$ |
     | Difference of two proportions | $E(\\hat{p}_1 - \\hat{p}_2) = P_1 - P_2$ |
     | SE of difference of proportions | $SE(\\hat{p}_1 - \\hat{p}_2) = \\sqrt{\\frac{P_1(1-P_1)}{n_1} + \\frac{P_2(1-P_2)}{n_2}}$ |
     | $Z$-score for difference of proportions | $Z = \\frac{(\\hat{p}_1 - \\hat{p}_2) - (P_1 - P_2)}{\\sqrt{\\frac{P_1(1-P_1)}{n_1} + \\frac{P_2(1-P_2)}{n_2}}}$ |
   - Distribution Classification Tables:
     | Distribution | Symbol | Main Use |
     | :--- | :---: | :--- |
     | Student’s $t$-distribution | $t$ | Used for inference about a population mean when $\\sigma$ is unknown, especially for small samples |
     | Chi-square distribution | $\\chi^2$ | Used for inference about population variance and goodness-of-fit tests |
     | Fisher’s $F$-distribution | $F$ | Used to compare two population variances and in analysis of variance |
   - Standalone Mathematical Equations (Centered $$ ... $$):
     All standalone definitions, variances, standard errors, limits, normality conditions, and probability intervals MUST be typeset on their own line as display math:
     $$ \\text{Sampling Error} = \\bar{x} - \\mu $$
     $$ \\frac{n}{N} > 0.10 $$
     $$ \\sqrt{\\frac{N - n}{N - 1}} $$
     $$ SE(\\bar{X}) = \\sqrt{\\frac{N - n}{N - 1}} \\cdot \\frac{\\sigma}{\\sqrt{n}} $$
     $$ \\bar{X} \\sim N\\left(\\mu, \\frac{\\sigma^2}{n}\\right) $$
     $$ \\bar{X} \\approx N\\left(\\mu, \\frac{\\sigma^2}{n}\\right) $$
     $$ \\mu_{\\bar{X}} = E(\\bar{X}) = \\mu $$
     $$ \\text{Var}(\\bar{X}) = \\sigma_{\\bar{X}}^2 = \\frac{\\sigma^2}{n} $$
     $$ \\sigma_{\\bar{X}} = \\frac{\\sigma}{\\sqrt{n}} $$
     $$ \\hat{p} = \\frac{X}{n} $$
     $$ P = \\frac{k}{N} $$
     $$ \\mu_{\\hat{p}} = E(\\hat{p}) = P $$
     $$ \\sigma_{\\hat{p}}^2 = \\text{Var}(\\hat{p}) = \\frac{P(1-P)}{n} $$
     $$ SE(\\hat{p}) = \\sqrt{\\frac{P(1-P)}{n}} $$
     $$ nP > 15 $$
     $$ n(1 - P) > 15 $$
     $$ X \\sim \\text{Binomial}(n, P) $$
     $$ E(\\hat{p}_1 - \\hat{p}_2) = P_1 - P_2 $$
     $$ SE(\\hat{p}_1 - \\hat{p}_2) = \\sqrt{\\frac{P_1(1-P_1)}{n_1} + \\frac{P_2(1-P_2)}{n_2}} $$
     $$ n_1P_1 > 15 $$
     $$ n_1(1-P_1) > 15 $$
     $$ n_2P_2 > 15 $$
     $$ n_2(1-P_2) > 15 $$
     $$ P(|\\hat{p} - P| < 0.05) $$
   - Applications & Characteristic Lists:
     Format as bullet points with bold lead-in titles:
     • **Generalization:** Drawing conclusions about a population based on sample information.
     • **Risk calculation:** Estimating the probability of sampling error in a conclusion.
     • **Confidence intervals:** Determining a likely range for an unknown population parameter.
     • **Hypothesis testing:** Assessing whether sample evidence supports or contradicts a population claim.
     • **Interval probability:** Calculating the probability that a sample statistic lies within a specified interval around the true population parameter.
   - LaTeX Math Normalization:
     Correct all raw LaTeX codes in text (e.g. \\bar{x} -> $\\bar{x}$, \\mu -> $\\mu$, \\sigma -> $\\sigma$, \\pi -> $\\pi$, p -> $p$, \\hat{p} -> $\\hat{p}$, \\chi^2 -> $\\chi^2$, etc.). Never leave bare backslashes in running text.

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

    const processSingleChunk = async (chunk: (typeof chunks)[0]) => {
      const chunkPrompt = `You are acting as the AI Polish & Quality-Enhancement Layer for FormatAI (Processing Section ${chunk.chunkIndex + 1} of ${chunk.totalChunks}).
Preserve all equations ($$...$$, \\(...\\)), tables, headers, and content intact. Fix formatting and notation without omitting anything.

Expected Block Identifiers in this section:
${chunk.expectedBlockIds.join(", ")}

---
## SECTION ${chunk.chunkIndex + 1} BASELINE TO POLISH:
${chunk.rawText}

OUTPUT FORMAT: Return raw polished Markdown directly with NO conversational filler and NO top-level \`\`\`markdown fence.`;

      let chunkCandidateText = chunk.rawText; // Default to local baseline
      let failed = false;
      let failureReason: string | undefined;
      let errorCategory: AIErrorCategory | undefined;
      let isRateLimited = false;
      let providerId = "unknown";
      let providerName = "AI Provider";
      let model = "default";
      let chain: any[] = [];
      let fallbacks = 0;

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

        providerId = chunkAiRes.providerId;
        providerName = chunkAiRes.providerName;
        model = chunkAiRes.model;
        if (chunkAiRes.fallbackChain) chain = chunkAiRes.fallbackChain;
        fallbacks = Math.max(0, chunkAiRes.fallbackChain.length - 1);

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
              failed = true;
              failureReason = retryVal.discardReason || "Section failed validation after repair retry.";
              errorCategory = retryVal.errorCategory || "truncated";
              candidate = chunk.rawText; // Local formatting fallback
            }
          } catch (retryErr: any) {
            failed = true;
            failureReason = retryErr.message;
            errorCategory = classifyErrorDetails(retryErr.message).errorCategory;
            if (errorCategory === "rate_limit") isRateLimited = true;
            candidate = chunk.rawText; // Local formatting fallback
          }
        }

        chunkCandidateText = validation.isValid ? candidate : chunk.rawText;
      } catch (chunkErr: any) {
        console.warn(`Chunk ${chunk.chunkIndex + 1}/${chunk.totalChunks} AI call failed, using local formatting fallback:`, chunkErr.message);
        failed = true;
        failureReason = chunkErr.message;
        errorCategory = classifyErrorDetails(chunkErr.message).errorCategory;
        if (errorCategory === "rate_limit") isRateLimited = true;
        chunkCandidateText = chunk.rawText; // Local formatting fallback
      }

      return {
        chunkResult: {
          chunkIndex: chunk.chunkIndex,
          text: chunkCandidateText,
          expectedBlockIds: chunk.expectedBlockIds,
        },
        failed,
        failureReason,
        errorCategory,
        isRateLimited,
        providerId,
        providerName,
        model,
        chain,
        fallbacks,
      };
    };

    let forceSequential = false;
    for (let i = 0; i < chunks.length; ) {
      const concurrency = forceSequential ? 1 : Math.min(2, chunks.length - i);
      const chunkBatch = chunks.slice(i, i + concurrency);
      const batchResults = await Promise.all(chunkBatch.map(processSingleChunk));

      for (const res of batchResults) {
        if (res.isRateLimited) {
          forceSequential = true; // Fall back to sequential if a provider returns a rate-limit error
        }
        if (res.failed) {
          hadChunkFailure = true;
          if (res.failureReason) chunkFailureReason = res.failureReason;
          if (res.errorCategory) chunkErrorCategory = res.errorCategory;
        }
        if (res.providerId !== "unknown") lastProviderId = res.providerId;
        if (res.providerName !== "AI Provider") lastProviderName = res.providerName;
        if (res.model !== "default") lastModel = res.model;
        if (res.chain.length > 0) aggregatedChain = res.chain;
        totalFallbacks = Math.max(totalFallbacks, res.fallbacks);
        polishedChunkResults.push(res.chunkResult);
      }
      i += concurrency;
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
