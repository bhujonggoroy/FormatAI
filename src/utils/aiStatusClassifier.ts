import { AIStatusNotification, AIStatusType, AIErrorCategory, FallbackLogEntry, FallbackStep } from "../types/ai";

/**
 * Helper to classify human-readable error reasons from technical messages, category, or HTTP status into 7 distinct categories:
 * 1. key_missing
 * 2. invalid_key
 * 3. rate_limit
 * 4. timeout
 * 5. network
 * 6. truncated
 * 7. malformed
 */
export function classifyErrorDetails(
  errorMessage?: string,
  statusCode?: number,
  explicitCategory?: AIErrorCategory
): {
  type: AIStatusType;
  errorCategory: AIErrorCategory;
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

  // Explicit category override
  if (explicitCategory) {
    switch (explicitCategory) {
      case "key_missing":
        return {
          type: "key_missing",
          errorCategory: "key_missing",
          badgeLabel: "KEY MISSING",
          badgeIcon: "🔑",
          badgeColor: "amber",
          title: "API key is missing.",
          secondaryText: "No active API key configured for this provider. Add a key in AI Settings or use local formatting.",
          actionType: "settings",
          actionLabel: "Configure API Key",
          secondaryActionLabel: "Use Local Format",
        };
      case "invalid_key":
        return {
          type: "invalid_key",
          errorCategory: "invalid_key",
          badgeLabel: "INVALID KEY",
          badgeIcon: "🚫",
          badgeColor: "rose",
          title: "API key is invalid or unauthorized.",
          secondaryText: "Please check your API key credentials or provider permissions in AI Settings.",
          actionType: "settings",
          actionLabel: "Check AI Settings",
          secondaryActionLabel: "Retry",
        };
      case "rate_limit":
        return {
          type: "rate_limit",
          errorCategory: "rate_limit",
          badgeLabel: "RATE LIMIT",
          badgeIcon: "⏳",
          badgeColor: "rose",
          title: "Rate limit or free quota exceeded.",
          secondaryText: "Provider request limit reached. Try another provider or wait a few moments.",
          actionType: "another_provider",
          actionLabel: "Try Another Provider",
          secondaryActionLabel: "Retry",
        };
      case "timeout":
        return {
          type: "timeout",
          errorCategory: "timeout",
          badgeLabel: "TIMEOUT",
          badgeIcon: "⏱️",
          badgeColor: "amber",
          title: "Request timed out.",
          secondaryText: "The AI provider took too long to respond. The document will use local formatting or you can retry.",
          actionType: "retry",
          actionLabel: "Retry Polish",
          secondaryActionLabel: "Open AI Settings",
        };
      case "network":
        return {
          type: "network",
          errorCategory: "network",
          badgeLabel: "NETWORK",
          badgeIcon: "📡",
          badgeColor: "rose",
          title: "Network connection error.",
          secondaryText: "Unable to reach the provider endpoint. Please check your internet connection.",
          actionType: "retry",
          actionLabel: "Retry Request",
          secondaryActionLabel: "Open Settings",
        };
      case "truncated":
        return {
          type: "truncated",
          errorCategory: "truncated",
          badgeLabel: "TRUNCATED",
          badgeIcon: "✂️",
          badgeColor: "amber",
          title: "AI output was truncated or suspiciously small.",
          secondaryText: "The response ended prematurely or dropped expected blocks. FormatAI baseline was preserved intact.",
          actionType: "retry",
          actionLabel: "Retry Polish",
          secondaryActionLabel: "Review Baseline",
        };
      case "malformed":
        return {
          type: "malformed",
          errorCategory: "malformed",
          badgeLabel: "MALFORMED",
          badgeIcon: "⚠️",
          badgeColor: "amber",
          title: "AI output was malformed.",
          secondaryText: "The response contained broken JSON, unmatched equations, or syntax errors. FormatAI baseline preserved.",
          actionType: "retry",
          actionLabel: "Retry Polish",
          secondaryActionLabel: "Check Settings",
        };
    }
  }

  // 1. Key Missing
  if (
    msg.includes("no enabled api key") ||
    msg.includes("no api key") ||
    msg.includes("key is missing") ||
    msg.includes("missing api key") ||
    msg.includes("unconfigured")
  ) {
    return {
      type: "key_missing",
      errorCategory: "key_missing",
      badgeLabel: "KEY MISSING",
      badgeIcon: "🔑",
      badgeColor: "amber",
      title: "API key is missing.",
      secondaryText: "No active API key configured for this provider. Add a key in AI Settings or use local formatting.",
      actionType: "settings",
      actionLabel: "Configure API Key",
      secondaryActionLabel: "Use Local Format",
    };
  }

  // 2. Rate Limit (429 or quota exceeded)
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
      type: "rate_limit",
      errorCategory: "rate_limit",
      badgeLabel: "RATE LIMIT",
      badgeIcon: "⏳",
      badgeColor: "rose",
      title: "AI usage limit reached (429).",
      secondaryText: "This provider cannot process more requests right now. Try another provider or retry later.",
      actionType: "another_provider",
      actionLabel: "Try Another Provider",
      secondaryActionLabel: "Retry",
    };
  }

  // 3. Invalid API Key / Authentication / Permission
  if (
    statusCode === 401 ||
    statusCode === 403 ||
    msg.includes("invalid api key") ||
    msg.includes("api key not valid") ||
    msg.includes("unauthorized") ||
    msg.includes("forbidden") ||
    msg.includes("permission_denied") ||
    msg.includes("permission denied") ||
    msg.includes("invalid_key") ||
    msg.includes("authentication") ||
    msg.includes("revoked")
  ) {
    return {
      type: "invalid_key",
      errorCategory: "invalid_key",
      badgeLabel: "INVALID KEY",
      badgeIcon: "🚫",
      badgeColor: "rose",
      title: "API key is invalid or unauthorized.",
      secondaryText: "Your API key or provider connection needs attention in AI Settings.",
      actionType: "settings",
      actionLabel: "Check AI Settings",
      secondaryActionLabel: "Retry",
    };
  }

  // 4. Timeout
  if (
    statusCode === 408 ||
    statusCode === 504 ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("deadline exceeded")
  ) {
    return {
      type: "timeout",
      errorCategory: "timeout",
      badgeLabel: "TIMEOUT",
      badgeIcon: "⏱️",
      badgeColor: "amber",
      title: "Request timed out.",
      secondaryText: "The AI provider took longer than expected. FormatAI baseline was preserved.",
      actionType: "retry",
      actionLabel: "Retry Polish",
      secondaryActionLabel: "Open AI Settings",
    };
  }

  // 5. Network Connection Error
  if (
    msg.includes("econnrefused") ||
    msg.includes("connection_refused") ||
    msg.includes("connection refused") ||
    msg.includes("enotfound") ||
    msg.includes("fetch failed") ||
    msg.includes("failed to fetch") ||
    msg.includes("network error") ||
    msg.includes("network disconnected") ||
    msg.includes("net::") ||
    msg.includes("offline") ||
    msg.includes("connection failed") ||
    msg.includes("dns") ||
    msg.includes("socket hang up") ||
    msg.includes("ehostunreach")
  ) {
    return {
      type: "network",
      errorCategory: "network",
      badgeLabel: "NETWORK",
      badgeIcon: "📡",
      badgeColor: "rose",
      title: "Network connection error.",
      secondaryText: "Unable to reach the provider endpoint. Please check your internet connection.",
      actionType: "retry",
      actionLabel: "Retry Request",
      secondaryActionLabel: "Open Settings",
    };
  }

  // 6. Truncated / Suspiciously Small
  if (
    msg.includes("truncated") ||
    msg.includes("suspiciously small") ||
    msg.includes("missing expected") ||
    msg.includes("content dropped")
  ) {
    return {
      type: "truncated",
      errorCategory: "truncated",
      badgeLabel: "TRUNCATED",
      badgeIcon: "✂️",
      badgeColor: "amber",
      title: "AI output was truncated or suspiciously small.",
      secondaryText: "The response dropped content or stopped early. FormatAI baseline was preserved intact.",
      actionType: "retry",
      actionLabel: "Retry Polish",
      secondaryActionLabel: "Review Baseline",
    };
  }

  // 7. Malformed / Syntax / Delimiter
  if (
    msg.includes("malformed") ||
    msg.includes("unmatched") ||
    msg.includes("json") ||
    msg.includes("syntax error") ||
    msg.includes("empty")
  ) {
    return {
      type: "malformed",
      errorCategory: "malformed",
      badgeLabel: "MALFORMED",
      badgeIcon: "⚠️",
      badgeColor: "amber",
      title: "AI response was malformed.",
      secondaryText: "The AI output contained broken syntax or empty response. FormatAI baseline was preserved.",
      actionType: "retry",
      actionLabel: "Retry Polish",
      secondaryActionLabel: "Check Settings",
    };
  }

  // General fallback
  return {
    type: "ai_failed",
    errorCategory: "malformed",
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
  errorCategory = "malformed",
}: {
  reason: string;
  providerName: string;
  latencyMs: number;
  errorCategory?: AIErrorCategory;
}): AIStatusNotification {
  const badgeMap: Record<AIErrorCategory, { label: string; icon: string }> = {
    key_missing: { label: "KEY MISSING", icon: "🔑" },
    invalid_key: { label: "INVALID KEY", icon: "🚫" },
    rate_limit: { label: "RATE LIMIT", icon: "⏳" },
    timeout: { label: "TIMEOUT", icon: "⏱️" },
    network: { label: "NETWORK", icon: "📡" },
    truncated: { label: "TRUNCATED", icon: "✂️" },
    malformed: { label: "MALFORMED", icon: "⚠️" },
  };

  const badgeInfo = badgeMap[errorCategory] || { label: "AI DISCARDED", icon: "⚠️" };

  return {
    type: errorCategory,
    errorCategory,
    badgeLabel: badgeInfo.label,
    badgeIcon: badgeInfo.icon,
    badgeColor: "amber",
    title: `AI output rejected (${badgeInfo.label}). FormatAI Result restored.`,
    secondaryText: `Quality-Gate rejected AI output: ${reason}. Original document and baseline formatting kept completely intact.`,
    providerName,
    latencyMs,
    timestamp: Date.now(),
    actionType: "retry",
    actionLabel: "Retry Polish",
    secondaryActionLabel: "Review AI Settings",
    technicalDetails: {
      provider: providerName,
      requestStatus: "quality_gate_discarded",
      errorCategory: badgeInfo.label,
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
