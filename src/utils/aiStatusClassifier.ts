import { AIStatusNotification, AIStatusType, FallbackLogEntry, FallbackStep } from "../types/ai";

/**
 * Helper to classify human-readable error reasons from technical messages or HTTP status.
 */
export function classifyErrorDetails(errorMessage?: string, statusCode?: number): {
  type: AIStatusType;
  badgeLabel: string;
  badgeIcon: string;
  badgeColor: "rose" | "amber";
  title: string;
  secondaryText: string;
  actionType: "settings" | "retry" | "another_provider";
  actionLabel: string;
  secondaryActionLabel?: string;
} {
  const msg = (errorMessage || "").toLowerCase();

  // 1. Quota / Rate Limit (429 or quota exceeded)
  if (
    statusCode === 429 ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("429") ||
    msg.includes("resource_exhausted") ||
    msg.includes("limit reached") ||
    msg.includes("too many requests") ||
    msg.includes("exceeded your current quota")
  ) {
    return {
      type: "quota",
      badgeLabel: "QUOTA",
      badgeIcon: "🔴",
      badgeColor: "rose",
      title: "AI usage limit reached.",
      secondaryText: "This provider cannot process more requests right now.",
      actionType: "another_provider",
      actionLabel: "Try Another Provider",
      secondaryActionLabel: "Retry",
    };
  }

  // 2. API Key Error / Authentication / Permission
  if (
    statusCode === 401 ||
    statusCode === 403 ||
    msg.includes("invalid api key") ||
    msg.includes("api key not valid") ||
    msg.includes("api_key") ||
    msg.includes("unauthorized") ||
    msg.includes("forbidden") ||
    msg.includes("permission_denied") ||
    msg.includes("permission denied") ||
    msg.includes("invalid_key") ||
    msg.includes("authentication") ||
    msg.includes("revoked")
  ) {
    return {
      type: "api_error",
      badgeLabel: "API ERROR",
      badgeIcon: "🔴",
      badgeColor: "rose",
      title: "AI API is not working.",
      secondaryText: "Your API key or provider connection needs attention.",
      actionType: "settings",
      actionLabel: "Check AI Settings",
      secondaryActionLabel: "Retry",
    };
  }

  // 3. General AI Failure
  return {
    type: "ai_failed",
    badgeLabel: "AI FAILED",
    badgeIcon: "🔴",
    badgeColor: "rose",
    title: "AI could not process your document.",
    secondaryText: "Check your AI settings and try again.",
    actionType: "settings",
    actionLabel: "Open AI Settings",
    secondaryActionLabel: "Retry",
  };
}

/**
 * Creates a pristine, strictly truthful status notification for local deterministic formatting.
 * Guaranteed to NEVER claim AI was used.
 */
export function createLocalFormatNotification(latencyMs: number = 0): AIStatusNotification {
  return {
    type: "local_format",
    badgeLabel: "LOCAL FORMAT",
    badgeIcon: "🟢",
    badgeColor: "emerald",
    title: "Formatting completed — No AI was used.",
    secondaryText: "FormatAI's offline academic engine processed your document.",
    providerName: "FormatAI Academic Engine",
    modelName: "offline-deterministic",
    latencyMs,
    timestamp: Date.now(),
    technicalDetails: {
      provider: "FormatAI Local Engine",
      model: "standard-academic-engine",
      requestStatus: "local_success",
      executionTime: `${latencyMs}ms`,
      technicalErrorMessage: "None (Deterministic rule-based normalization)",
    },
  };
}

/**
 * Creates a status notification when AI is intentionally turned off.
 */
export function createAiOffNotification(): AIStatusNotification {
  return {
    type: "ai_off",
    badgeLabel: "AI OFF",
    badgeIcon: "⚪",
    badgeColor: "slate",
    title: "AI processing is turned off.",
    secondaryText: "FormatAI will use local formatting only.",
    timestamp: Date.now(),
    actionType: "settings",
    actionLabel: "Enable AI in Settings",
  };
}

/**
 * Classifies a real AI response into the user-friendly status hierarchy.
 */
export function classifyAiPolishSuccess({
  providerName,
  modelName,
  fallbackCount = 0,
  fallbackChain = [],
  latencyMs,
}: {
  providerName: string;
  modelName: string;
  fallbackCount?: number;
  fallbackChain?: FallbackStep[];
  latencyMs: number;
}): AIStatusNotification {
  const isFallback = fallbackCount > 0 && fallbackChain && fallbackChain.length > 1;

  if (isFallback) {
    const primaryStep = fallbackChain[0];
    const finalStep = fallbackChain[fallbackChain.length - 1] || { providerName };
    const primary = primaryStep?.providerName || "Primary AI";
    const fallback = finalStep?.providerName || providerName;

    return {
      type: "ai_fallback",
      badgeLabel: "AI FALLBACK",
      badgeIcon: "🟡",
      badgeColor: "amber",
      title: "AI processing completed using a fallback provider.",
      secondaryText: `Primary AI was unavailable, so FormatAI used another enabled provider (${primary} → ${fallback}).`,
      primaryProvider: primary,
      fallbackProvider: fallback,
      providerName: fallback,
      modelName,
      latencyMs,
      timestamp: Date.now(),
      actionType: "audit",
      actionLabel: "View Audit Details",
      technicalDetails: {
        provider: fallback,
        model: modelName,
        requestStatus: "fallback_success",
        fallbackAttempt: `${primary} (failed) → ${fallback} (succeeded)`,
        executionTime: `${latencyMs}ms`,
        rawChain: fallbackChain,
      },
    };
  }

  // Normal Direct AI Success
  return {
    type: "ai_working",
    badgeLabel: "AI WORKING",
    badgeIcon: "🟢",
    badgeColor: "emerald",
    title: "AI Polish completed successfully.",
    secondaryText: `Your document was successfully processed using ${providerName}.`,
    providerName,
    modelName,
    latencyMs,
    timestamp: Date.now(),
    technicalDetails: {
      provider: providerName,
      model: modelName,
      requestStatus: "success",
      executionTime: `${latencyMs}ms`,
      rawChain: fallbackChain,
    },
  };
}

/**
 * Creates a notification when AI output failed quality-gate checks
 * and FormatAI local result was safely preserved.
 */
export function createQualityGateWarningNotification({
  reason,
  providerName,
  latencyMs,
}: {
  reason: string;
  providerName: string;
  latencyMs: number;
}): AIStatusNotification {
  return {
    type: "warning",
    badgeLabel: "WARNING",
    badgeIcon: "🟡",
    badgeColor: "amber",
    title: "Completed with warnings.",
    secondaryText: "Your document was processed, but some items may need review (FormatAI baseline preserved).",
    providerName,
    latencyMs,
    timestamp: Date.now(),
    actionType: "settings",
    actionLabel: "Review AI Settings",
    technicalDetails: {
      provider: providerName,
      requestStatus: "quality_gate_discarded",
      errorCategory: "Validation Discard",
      executionTime: `${latencyMs}ms`,
      technicalErrorMessage: `AI Output Discarded: ${reason}`,
    },
  };
}

/**
 * User-friendly summary descriptor for individual Fallback Audit Log entries.
 */
export interface AuditLogSummary {
  badgeLabel: string;
  badgeIcon: string;
  badgeColor: "emerald" | "amber" | "rose" | "slate" | "blue";
  headline: string;
  detailLine: string;
  isFallback: boolean;
  isSimulation: boolean;
  isLocal: boolean;
  primaryProvider?: string;
  fallbackProvider?: string;
  humanReason?: string;
}

export function classifyAuditLogEntry(log: FallbackLogEntry): AuditLogSummary {
  const isSimulation = Boolean(
    log.isSimulation ||
    log.requestSummary?.toLowerCase().includes("simulation") ||
    log.requestSummary?.toLowerCase().includes("diagnostic simulation")
  );

  if (isSimulation) {
    return {
      badgeLabel: "SIMULATION",
      badgeIcon: "🔵",
      badgeColor: "blue",
      headline: "Fallback test completed",
      detailLine: "This was a simulated test. No real document processing was performed.",
      isFallback: true,
      isSimulation: true,
      isLocal: false,
      primaryProvider: log.chain?.[0]?.providerName || "Gemini",
      fallbackProvider: log.finalProvider || "Groq",
    };
  }

  const isLocal =
    log.finalProvider?.toLowerCase().includes("formatai") ||
    log.finalModel?.toLowerCase().includes("academic-engine") ||
    log.requestSummary?.toLowerCase().includes("offline") ||
    log.chain?.every((c) => c.providerId === "formatai");

  if (isLocal) {
    return {
      badgeLabel: "LOCAL FORMAT",
      badgeIcon: "🟢",
      badgeColor: "emerald",
      headline: "Formatting completed — No AI was used",
      detailLine: "Engine: FormatAI Offline / Deterministic Academic Engine",
      isFallback: false,
      isSimulation: false,
      isLocal: true,
    };
  }

  // Fallback check
  const hasFallback = (log.hopsCount > 0 || (log.chain && log.chain.length > 1)) && log.success;
  if (hasFallback) {
    const primary = log.chain?.[0]?.providerName || "Primary AI";
    const fallback = log.finalProvider || "Fallback AI";
    return {
      badgeLabel: "AI FALLBACK",
      badgeIcon: "🟡",
      badgeColor: "amber",
      headline: "AI processing completed using fallback",
      detailLine: `Primary: ${primary} → Fallback: ${fallback}`,
      isFallback: true,
      isSimulation: false,
      isLocal: false,
      primaryProvider: primary,
      fallbackProvider: fallback,
    };
  }

  if (log.success) {
    return {
      badgeLabel: "AI WORKING",
      badgeIcon: "🟢",
      badgeColor: "emerald",
      headline: "AI Polish completed successfully",
      detailLine: `Provider: ${log.finalProvider || "AI Provider"}`,
      isFallback: false,
      isSimulation: false,
      isLocal: false,
    };
  }

  // Failure
  const firstErrorStep = log.chain?.find((c) => c.status !== "success");
  const errMsg = firstErrorStep?.errorMessage || "Unknown error";
  const classified = classifyErrorDetails(errMsg);

  return {
    badgeLabel: classified.badgeLabel,
    badgeIcon: classified.badgeIcon,
    badgeColor: "rose",
    headline: classified.title,
    detailLine: `Reason: ${classified.secondaryText} (${log.finalProvider || "AI"})`,
    isFallback: false,
    isSimulation: false,
    isLocal: false,
    humanReason: classified.secondaryText,
  };
}

/**
 * Standard Status Signal Guide Legend items
 */
export const STATUS_SIGNAL_GUIDE = [
  {
    signal: "🟢",
    status: "AI WORKING",
    color: "text-emerald-700 bg-emerald-50 border-emerald-200",
    meaning: "AI successfully processed your document.",
  },
  {
    signal: "🟢",
    status: "LOCAL FORMAT",
    color: "text-emerald-700 bg-emerald-50 border-emerald-200",
    meaning: "No AI used. FormatAI processed it locally.",
  },
  {
    signal: "🟡",
    status: "AI FALLBACK",
    color: "text-amber-700 bg-amber-50 border-amber-200",
    meaning: "Primary AI failed; another enabled provider was used.",
  },
  {
    signal: "🟡",
    status: "WARNING",
    color: "text-amber-700 bg-amber-50 border-amber-200",
    meaning: "Completed, but something needs review.",
  },
  {
    signal: "🔴",
    status: "AI FAILED",
    color: "text-rose-700 bg-rose-50 border-rose-200",
    meaning: "AI processing failed.",
  },
  {
    signal: "🔴",
    status: "API ERROR",
    color: "text-rose-700 bg-rose-50 border-rose-200",
    meaning: "API key/provider is not working.",
  },
  {
    signal: "🔴",
    status: "QUOTA",
    color: "text-rose-700 bg-rose-50 border-rose-200",
    meaning: "AI usage/rate limit was reached.",
  },
  {
    signal: "⚪",
    status: "AI OFF",
    color: "text-slate-700 bg-slate-100 border-slate-300",
    meaning: "AI processing is disabled.",
  },
  {
    signal: "🔵",
    status: "SIMULATION",
    color: "text-blue-700 bg-blue-50 border-blue-200",
    meaning: "Simulated failover test (no real document processed).",
  },
] as const;
