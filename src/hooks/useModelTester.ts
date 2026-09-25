/**
 * UniversalModelTester Hook
 *
 * Reusable React hook for managing AI model discovery & testing state across
 * all AI providers (Gemini, Groq, OpenRouter, Mistral, Cohere, HuggingFace, Cloudflare, Custom).
 *
 * Manages:
 * - Testing stages & live progress (percentage, model tallies, active model)
 * - Segregated "Ready to Deploy" vs "Not Ready" models
 * - Normalized error mapping per failed model
 * - Cancellation and cache management
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  runUniversalModelTest,
  getCachedModelTestReport,
  clearModelTestReport,
  ModelTestingProgress,
  ProviderModelTestReport,
  TestedModelItem,
  TestingStage,
  FailureCategory,
  UniversalTestOptions,
  categorizeFailure,
} from "../services/UniversalModelTester";
import { canonicalProviderId } from "../shared/centralModelCatalog";

export interface UseModelTesterOptions {
  providerId?: string;
  apiKey?: string;
  customEndpoint?: string;
  accountId?: string;
  autoLoadCache?: boolean;
}

export interface ModelErrorDetails {
  category: FailureCategory;
  reason: string;
}

export interface UseModelTesterReturn {
  // State
  isTesting: boolean;
  stage: TestingStage;
  progress: ModelTestingProgress | null;
  report: ProviderModelTestReport | null;
  readyModels: TestedModelItem[];
  notReadyModels: TestedModelItem[];
  errorMap: Record<string, ModelErrorDetails>;
  errorMessage: string | null;

  // Convenience progress metrics
  progressPercent: number;
  testedCount: number;
  totalCount: number;
  readyCount: number;
  notReadyCount: number;
  currentModelId?: string;
  currentModelName?: string;

  // Actions
  scan: (
    overrideProviderId?: string,
    overrideApiKey?: string,
    overrideOptions?: UniversalTestOptions
  ) => Promise<ProviderModelTestReport | null>;
  cancelScan: () => void;
  clearReport: (targetProviderId?: string) => void;
  loadCachedReport: (targetProviderId?: string) => void;
}

export function useModelTester(options: UseModelTesterOptions = {}): UseModelTesterReturn {
  const {
    providerId: defaultProviderId,
    apiKey: defaultApiKey,
    customEndpoint: defaultEndpoint,
    accountId: defaultAccountId,
    autoLoadCache = true,
  } = options;

  const [report, setReport] = useState<ProviderModelTestReport | null>(null);
  const [progress, setProgress] = useState<ModelTestingProgress | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const scanRequestIdRef = useRef<number>(0);
  const activeProviderRef = useRef<string | undefined>(defaultProviderId);
  activeProviderRef.current = defaultProviderId;

  // Synchronize cache when defaultProviderId changes
  useEffect(() => {
    // Abort any ongoing scan if provider changed
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    scanRequestIdRef.current++;
    setIsTesting(false);

    const canonical = canonicalProviderId(defaultProviderId);
    if (autoLoadCache && canonical) {
      const cached = getCachedModelTestReport(canonical);
      setReport(cached || null);
      setProgress(null);
      setErrorMessage(null);
    }
  }, [defaultProviderId, autoLoadCache]);

  // Clean up any ongoing test on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      scanRequestIdRef.current++;
    };
  }, []);

  /**
   * Trigger a full scan for a provider (utilizing the adapter system)
   * GUARANTEE: Only tests models of the specified current provider!
   * GUARANTEE: Prevents overlapping requests with AbortController and request ID sequencing.
   */
  const scan = useCallback(
    async (
      overrideProviderId?: string,
      overrideApiKey?: string,
      overrideOptions?: UniversalTestOptions
    ): Promise<ProviderModelTestReport | null> => {
      const targetProvider = canonicalProviderId(overrideProviderId || defaultProviderId || "");
      const targetApiKey = overrideApiKey !== undefined ? overrideApiKey : defaultApiKey || "";

      if (!targetProvider) {
        const err = "No provider ID specified for model scan.";
        setErrorMessage(err);
        return null;
      }

      // Abort any ongoing scan first (Prevents overlapping requests)
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      const currentReqId = ++scanRequestIdRef.current;

      setIsTesting(true);
      setErrorMessage(null);
      setProgress({
        providerId: targetProvider,
        stage: "validating_key",
        totalModels: 0,
        testedCount: 0,
        readyCount: 0,
        notReadyCount: 0,
        progressPercent: 0,
      });

      try {
        const result = await runUniversalModelTest(
          targetProvider,
          targetApiKey,
          {
            customEndpoint: overrideOptions?.customEndpoint || defaultEndpoint,
            accountId: overrideOptions?.accountId || defaultAccountId,
            timeoutMs: overrideOptions?.timeoutMs,
            signal: controller.signal,
          },
          (p: ModelTestingProgress) => {
            // Guard against stale progress from superseded requests
            if (currentReqId === scanRequestIdRef.current) {
              setProgress({ ...p });
            }
          }
        );

        // Guard against stale results from superseded requests
        if (currentReqId !== scanRequestIdRef.current) {
          return null;
        }

        setReport(result);
        if (result.status === "error" && result.errorMessage) {
          setErrorMessage(result.errorMessage);
        }
        return result;
      } catch (err: any) {
        if (currentReqId !== scanRequestIdRef.current) {
          return null;
        }

        if (controller.signal.aborted) {
          setProgress((prev) =>
            prev
              ? {
                  ...prev,
                  stage: "cancelled",
                  errorMessage: "Model scan was cancelled.",
                }
              : null
          );
          return null;
        }

        const msg = err.message || "Failed to complete model testing.";
        setErrorMessage(msg);
        setProgress((prev) =>
          prev
            ? {
                ...prev,
                stage: "error",
                errorMessage: msg,
              }
            : null
        );
        return null;
      } finally {
        if (currentReqId === scanRequestIdRef.current) {
          setIsTesting(false);
          abortControllerRef.current = null;
        }
      }
    },
    [defaultProviderId, defaultApiKey, defaultEndpoint, defaultAccountId]
  );

  /**
   * Cancel an ongoing scan
   */
  const cancelScan = useCallback(() => {
    scanRequestIdRef.current++;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsTesting(false);
    setProgress((prev) =>
      prev
        ? {
            ...prev,
            stage: "cancelled",
            errorMessage: "Scan cancelled by user.",
          }
        : null
    );
  }, []);

  /**
   * Clear cached test report
   */
  const clearReport = useCallback((targetProviderId?: string) => {
    const pId = canonicalProviderId(targetProviderId || activeProviderRef.current);
    if (pId) {
      clearModelTestReport(pId);
    }
    setReport(null);
    setProgress(null);
    setErrorMessage(null);
  }, []);

  /**
   * Explicitly reload cached report
   */
  const loadCachedReport = useCallback((targetProviderId?: string) => {
    const pId = canonicalProviderId(targetProviderId || activeProviderRef.current);
    if (pId) {
      const cached = getCachedModelTestReport(pId);
      setReport(cached || null);
    }
  }, []);

  // Derived readiness arrays - STRICTLY ISOLATED to THIS provider
  const readyModels = useMemo(() => {
    const list = report?.readyModels || [];
    const canonical = canonicalProviderId(defaultProviderId);
    return canonical ? list.filter((m) => canonicalProviderId(m.provider) === canonical) : list;
  }, [report, defaultProviderId]);

  const notReadyModels = useMemo(() => {
    const list = report?.notReadyModels || [];
    const canonical = canonicalProviderId(defaultProviderId);
    return canonical ? list.filter((m) => canonicalProviderId(m.provider) === canonical) : list;
  }, [report, defaultProviderId]);

  // Normalized error mapping for all failed/not-ready models
  const errorMap = useMemo(() => {
    const map: Record<string, ModelErrorDetails> = {};
    for (const item of notReadyModels) {
      map[item.id] = {
        category: item.failureCategory || "unknown",
        reason: item.reason || "Model unavailable or failed diagnostic check",
      };
    }
    return map;
  }, [notReadyModels]);

  // Derived progress metrics
  const stage = progress?.stage || (isTesting ? "testing_models" : "idle");
  const progressPercent = progress?.progressPercent || 0;
  const testedCount = progress?.testedCount || report?.totalTested || 0;
  const totalCount = progress?.totalModels || (report ? report.readyModels.length + report.notReadyModels.length : 0);
  const readyCount = progress?.readyCount || readyModels.length;
  const notReadyCount = progress?.notReadyCount || notReadyModels.length;
  const currentModelId = progress?.currentModelId;
  const currentModelName = progress?.currentModelName;

  return {
    isTesting,
    stage,
    progress,
    report,
    readyModels,
    notReadyModels,
    errorMap,
    errorMessage: errorMessage || progress?.errorMessage || null,
    progressPercent,
    testedCount,
    totalCount,
    readyCount,
    notReadyCount,
    currentModelId,
    currentModelName,
    scan,
    cancelScan,
    clearReport,
    loadCachedReport,
  };
}

// Alias for convenience
export const useUniversalModelTester = useModelTester;
