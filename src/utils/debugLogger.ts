/**
 * Phase 6: Development-Only Debug Logger
 *
 * Provides structured, development-only telemetry tracing the transformation pipeline:
 * Raw Input → Parsed Blocks → Formatting Result → AI Request → AI Response → Validation → Preview Input
 *
 * SECURITY & PRIVACY INVARIANT:
 * - Production: No sensitive text, user content, or API keys are EVER logged.
 * - Only anonymized structural metadata (block count, lengths, stable IDs, stage durations) is emitted.
 */

export interface PipelineDebugTrace {
  stage:
    | "raw_input"
    | "parsed_blocks"
    | "formatting_result"
    | "ai_request"
    | "ai_response"
    | "validation"
    | "preview_input";
  timestamp: number;
  contextLabel: string;
  metadata: {
    charCount?: number;
    wordCount?: number;
    blockCount?: number;
    blockIds?: string[];
    blockTypes?: Record<string, number>;
    providerId?: string;
    model?: string;
    validationScore?: number;
    isValid?: boolean;
    missingBlocksCount?: number;
    charDiffPercent?: number;
    stageDurationMs?: number;
    errorMessage?: string;
    stage?: string;
    blockId?: string;
    repairedLength?: number;
  };
}

const isBrowser = typeof window !== "undefined";
const isNode = typeof process !== "undefined" && Boolean(process.versions?.node);

export const isDevMode = (): boolean => {
  if (isBrowser) {
    return (
      Boolean((window as any).__FORMATAI_DEBUG__) ||
      Boolean((window as any).__DEV__) ||
      (typeof location !== "undefined" &&
        (location.hostname === "localhost" ||
          location.hostname === "127.0.0.1" ||
          location.port === "3000"))
    );
  }
  if (isNode) {
    return process.env.NODE_ENV !== "production" || process.env.FORMATAI_DEBUG === "true";
  }
  return false;
};

// In-memory trace buffer for developer inspection & testing (max 50 entries)
const traceBuffer: PipelineDebugTrace[] = [];
const MAX_TRACES = 50;

/**
 * Returns a copy of recent pipeline debug traces.
 */
export function getPipelineTraces(): PipelineDebugTrace[] {
  return [...traceBuffer];
}

/**
 * Clears pipeline debug traces.
 */
export function clearPipelineTraces(): void {
  traceBuffer.length = 0;
}

/**
 * Strips any sensitive fields, retaining strictly non-sensitive structural metadata.
 */
function sanitizeMetadata(metadata: Record<string, any>): PipelineDebugTrace["metadata"] {
  const allowedKeys = new Set([
    "charCount",
    "wordCount",
    "blockCount",
    "blockIds",
    "blockTypes",
    "providerId",
    "model",
    "validationScore",
    "isValid",
    "missingBlocksCount",
    "charDiffPercent",
    "stageDurationMs",
    "errorMessage",
    "stage",
    "blockId",
    "repairedLength",
  ]);

  const sanitized: Record<string, any> = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (allowedKeys.has(k)) {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

/**
 * Log pipeline checkpoint in development.
 *
 * Pipeline flow:
 * Raw Input → Parsed Blocks → Formatting Result → AI Request → AI Response → Validation → Preview Input
 */
export function logPipelineDebug(
  stage: PipelineDebugTrace["stage"],
  metadata: PipelineDebugTrace["metadata"],
  contextLabel: string = "Pipeline"
): void {
  if (!isDevMode()) return;

  const safeMetadata = sanitizeMetadata(metadata);
  const trace: PipelineDebugTrace = {
    stage,
    timestamp: Date.now(),
    contextLabel,
    metadata: safeMetadata,
  };

  traceBuffer.push(trace);
  if (traceBuffer.length > MAX_TRACES) {
    traceBuffer.shift();
  }

  const blockSummary = safeMetadata.blockCount !== undefined ? ` [Blocks: ${safeMetadata.blockCount}]` : "";
  const charSummary = safeMetadata.charCount !== undefined ? ` [Chars: ${safeMetadata.charCount}]` : "";
  const providerSummary = safeMetadata.providerId ? ` [Provider: ${safeMetadata.providerId}/${safeMetadata.model || "default"}]` : "";
  const durationSummary = safeMetadata.stageDurationMs !== undefined ? ` [Duration: ${safeMetadata.stageDurationMs}ms]` : "";
  const validSummary = safeMetadata.isValid !== undefined ? ` [Valid: ${safeMetadata.isValid} (score: ${safeMetadata.validationScore ?? "N/A"})]` : "";

  if (isBrowser) {
    console.log(
      `%c[DEBUG:${contextLabel}] %c${stage.toUpperCase()}${blockSummary}${charSummary}${providerSummary}${validSummary}${durationSummary}`,
      "color: #4f46e5; font-weight: bold;",
      "color: #0284c7; font-weight: 600;",
      safeMetadata
    );
  } else {
    // Clean Node.js stdout logging without browser CSS %c codes
    console.log(
      `[DEBUG:${contextLabel}] ${stage.toUpperCase()}${blockSummary}${charSummary}${providerSummary}${validSummary}${durationSummary}`,
      safeMetadata
    );
  }
}

