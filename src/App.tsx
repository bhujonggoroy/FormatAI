import React, { useState, useMemo, useEffect, useRef } from "react";
import { Header } from "./components/Header";
import { FormattedPreview } from "./components/FormattedPreview";
import { AISettingsModal } from "./components/AISettingsModal";
import { SystematicSkillsModal } from "./components/SystematicSkillsModal";
import { SkillsManagerModal, SkillsModalTab } from "./components/SkillsManagerModal";
import { SidebarSettingsDrawer } from "./components/SidebarSettingsDrawer";
import { ToolbarGrid } from "./components/ToolbarGrid";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SplashScreen } from "./components/SplashScreen";
import { SAMPLE_NOTES, SampleNote } from "./data/samples";
import { cleanClientSideNotebookLM } from "./utils/cleaner";
import { generateFilenameFromContent, getDisplayTitleFromContent } from "./utils/filename";
import { downloadPreviewAsPdf, generateDocumentPdf } from "./utils/pdfGenerator";
import { usePWAInstallPrompt } from "./utils/pwaInstall";
import { skillRegistry } from "./skills";
import { ACADEMIC_THEMES, getAcademicTheme } from "./utils/theme";
import { validateAIPolishOutput } from "./utils/aiValidation";
import { logPipelineDebug } from "./utils/debugLogger";
import {
  parseDocumentBlocks,
  collectFailedBlocks,
  collectFailedFragments,
  replaceSingleBlockInDocument,
  replaceFragmentInBlock,
  replaceFragmentInDocument,
  assertFragmentSurgicallyReplaced,
  detectBlockFormattingIssue,
  extractSubstantiveText,
  type DocumentBlock,
  type BrokenFragment,
} from "./utils/blockIntegrity";
import { AIStatusBanner } from "./components/AIStatusBanner";
import { AIStatusNotification } from "./types/ai";
import {
  createLocalFormatNotification,
  classifyAiPolishSuccess,
  classifyErrorDetails,
  classifyFallbackChain,
  createQualityGateWarningNotification,
} from "./utils/aiStatusClassifier";
import {
  getUserSettings,
  saveUserSettings,
  getUserProviders,
  saveUserProviders,
  getUserPreferences,
  recordProviderMetric,
  recordAuditLogEntry,
  healAndNormalizeProviders,
} from "./utils/userLocalStorage";
import { getActiveModels } from "./config/modelRegistry";
import { ModelInfo } from "./types/ai";
import {
  Sparkles,
  Eraser,
  Clipboard,
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Eye,
  Columns,
  X,
  FileDown,
  ShieldAlert,
  Upload,
} from "lucide-react";

export default function App() {
  const [inputText, setInputText] = useState<string>(SAMPLE_NOTES[0].text);
  const [docTitle, setDocTitle] = useState<string>(() => getDisplayTitleFromContent(SAMPLE_NOTES[0].text));
  const [fontFamily, setFontFamily] = useState<string>("Times New Roman");
  const [accentColor, setAccentColor] = useState<string>("#1A365D");
  const [equationFormat, setEquationFormat] = useState<"native" | "latex" | "unicode">("native");
  const [formatMode, setFormatMode] = useState<"auto" | "study_guide" | "exam_bank">("study_guide");

  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [conversionStage, setConversionStage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<AIStatusNotification | null>(null);
  const [aiSettingsInitialTab, setAiSettingsInitialTab] = useState<"control" | "fallback" | "stats" | "logs">("control");
  const [validationAlert, setValidationAlert] = useState<{
    failed: boolean;
    reason: string;
    errors: string[];
  } | null>(null);

  const [cleanedMarkdown, setCleanedMarkdown] = useState<string | null>(null);
  const [viewLayout, setViewLayout] = useState<"split" | "editor" | "preview">(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      return "split";
    }
    return "editor";
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isAISettingsModalOpen, setIsAISettingsModalOpen] = useState<boolean>(false);
  const [isSkillModalOpen, setIsSkillModalOpen] = useState<boolean>(false);
  const [isSkillsManagerModalOpen, setIsSkillsManagerModalOpen] = useState<boolean>(false);
  const [skillsModalTab, setSkillsModalTab] = useState<SkillsModalTab>("skills");
  const [activeSkillsCount, setActiveSkillsCount] = useState<number>(() => skillRegistry.getEnabledSkillIds().length);

  // Active in-flight AI Polish request sequence ID to eliminate race conditions
  const activePolishRequestIdRef = useRef<number>(0);

  // PWA In-App Installation hook (Vanilla JS direct install system)
  const { hasNativePrompt, isInstalled, directInstall } = usePWAInstallPrompt();

  const handleInstallApp = async () => {
    setIsSidebarOpen(false);
    await directInstall();
  };

  // Multi-Provider AI telemetry state
  const [aiHealthInfo, setAiHealthInfo] = useState<{
    readyCount: number;
    providersSummary: string[];
    mode: string;
    freeOnly: boolean;
  } | null>(null);

  const fetchAIHealth = async () => {
    try {
      let templates: any[] = [];
      try {
        const res = await fetch("/api/ai/config");
        if (res.ok) {
          const data = await res.json();
          templates = data.providers || [];
        }
      } catch {}

      const userConfig = getUserSettings();
      let userProvs = getUserProviders(templates);
      if (!userProvs || userProvs.length === 0) {
        userProvs = healAndNormalizeProviders([], templates);
        saveUserProviders(userProvs);
      }

      // Populate provider model selection dropdowns with active, free-tier models from getActiveModels
      let provsUpdated = false;
      const sanitizedProvs = userProvs.map((prov) => {
        const activeModels = getActiveModels(prov.id);
        if (activeModels.length > 0) {
          const mappedModels: ModelInfo[] = activeModels.map((m) => ({
            id: m.id,
            name: m.name,
            provider: m.provider,
            status: m.status,
            free: m.free,
            isFree: m.isFree,
            apiAvailable: m.apiAvailable,
            deprecated: false,
            retired: false,
            freeTier: m.freeTier,
            contextWindow: m.contextWindow,
            capabilities: m.capabilities as string[],
            description: m.description,
          }));

          let selectedModel = prov.selectedModel;
          if (!mappedModels.some((m) => m.id === selectedModel)) {
            selectedModel = mappedModels[0].id;
            provsUpdated = true;
          }

          const hasChanged =
            !prov.availableModels ||
            prov.availableModels.length !== mappedModels.length ||
            prov.availableModels.some((pm, idx) => pm.id !== mappedModels[idx].id);

          if (hasChanged) {
            provsUpdated = true;
          }

          return {
            ...prov,
            availableModels: mappedModels,
            selectedModel,
          };
        }
        return prov;
      });

      if (provsUpdated) {
        saveUserProviders(sanitizedProvs);
      }

      // Ensure global activeModel in user settings points to an active, selectable model
      const activeProv = sanitizedProvs.find(
        (p) => p.id === (userConfig.activeProviderId || "gemini")
      );
      if (activeProv && activeProv.availableModels && activeProv.availableModels.length > 0) {
        if (!activeProv.availableModels.some((m) => m.id === userConfig.activeModel)) {
          userConfig.activeModel = activeProv.availableModels[0].id;
          saveUserSettings(userConfig);
        }
      }

      const ready = sanitizedProvs.filter((p) => p.enabled && (p.apiKeys || []).some((k) => k.enabled));
      setAiHealthInfo({
        readyCount: ready.length,
        providersSummary: ready.map((p) => p.name),
        mode: userConfig.mode,
        freeOnly: userConfig.freeOnlyMode,
      });
    } catch {
      // Non-blocking
    }
  };

  const [isAppReady, setIsAppReady] = useState<boolean>(false);

  useEffect(() => {
    fetchAIHealth().finally(() => {
      setIsAppReady(true);
    });
  }, []);

  // Compute live markdown instantly
  const effectiveMarkdown = useMemo(() => {
    if (cleanedMarkdown) return cleanedMarkdown;
    return cleanClientSideNotebookLM(inputText, formatMode, skillRegistry.getEnabledSkillIds());
  }, [cleanedMarkdown, inputText, formatMode, activeSkillsCount]);

  // Parse document into atomic blocks for deterministic integrity and targeted repairs
  const docBlocks = useMemo(() => {
    return parseDocumentBlocks(effectiveMarkdown);
  }, [effectiveMarkdown]);

  // Collect flagged blocks and exact fine-grained fragments that have KaTeX syntax errors, unmatched delimiters, or uncleaned artifacts
  const {
    fragments: detectedFragments,
    failedBlockIds: detectedFailedBlockIds,
    issuesMap: detectedIssuesMap,
    blockFragmentsMap: detectedBlockFragmentsMap,
  } = useMemo(() => {
    return collectFailedFragments(docBlocks);
  }, [docBlocks]);

  // Targeted single-block and queue repair state
  const [isRepairing, setIsRepairing] = useState<boolean>(false);
  const [repairProgress, setRepairProgress] = useState<{
    current: number;
    total: number;
    currentBlockId?: string;
  } | null>(null);

  // Centralized input updater that cleanly invalidates any active in-flight AI requests
  const handleUpdateInput = (newText: string, newTitle?: string) => {
    activePolishRequestIdRef.current++;
    setInputText(newText);
    setDocTitle(newTitle !== undefined ? newTitle : getDisplayTitleFromContent(newText));
    setCleanedMarkdown(null);
    setValidationAlert(null);
    setErrorMessage(null);
    setIsConverting(false);
    setConversionStage("");
  };

  // Load a sample note
  const handleLoadSample = (sample: SampleNote) => {
    handleUpdateInput(sample.text);
    setSuccessMessage(null);
  };

  // Paste from clipboard
  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        handleUpdateInput(text);
      }
    } catch {
      setErrorMessage("Please use Ctrl+V / Cmd+V to paste directly into the box.");
    }
  };

  // File upload input ref and handler (PDF / TXT / Markdown / DOCX)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === "string" && text.trim()) {
        const titleWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        handleUpdateInput(text, titleWithoutExt);
        setSuccessMessage(`Loaded "${file.name}" (${(file.size / 1024).toFixed(1)} KB) into FormatAI.`);
      }
    };
    reader.onerror = () => {
      setErrorMessage(`Failed to read "${file.name}". Please ensure it is a valid text/markdown/document file.`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Active AI provider ID state (synced with user settings and dropdown)
  const [activeProviderId, setActiveProviderId] = useState<string>(() => {
    return getUserSettings().activeProviderId || "formatai";
  });

  // Determine if running in "No AI" state (offline mode, no configured AI keys, or FormatAI selected)
  const isNoAI = useMemo(() => {
    if (activeProviderId === "formatai" || activeProviderId === "local") {
      return true;
    }
    const userConfig = getUserSettings();
    if (
      userConfig.activeProviderId === "formatai" ||
      userConfig.activeProviderId === "local" ||
      (userConfig as any).mode === "no_ai" ||
      (userConfig as any).mode === "formatai"
    ) {
      return true;
    }
    const userProvs = getUserProviders();
    const hasActiveKey = userProvs.some(
      (p) => p.enabled && (p.apiKeys || []).some((k) => k.enabled && k.key.trim().length > 0)
    );
    const hasServerAI = (aiHealthInfo?.readyCount ?? 0) > 0;
    return !hasActiveKey && !hasServerAI;
  }, [activeProviderId, aiHealthInfo]);

  // Trigger deterministic FormatAI normalization directly (Zero AI / No API key needed)
  const handleRunFormatAI = () => {
    if (!inputText.trim()) {
      setErrorMessage("Please paste your content first.");
      return;
    }

    const reqId = ++activePolishRequestIdRef.current;
    setIsConverting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setValidationAlert(null);
    setAiStatus(null);
    setConversionStage("Normalizing with FormatAI Academic Engine (No AI)...");

    try {
      const rawBlocks = parseDocumentBlocks(inputText);
      logPipelineDebug(
        "raw_input",
        {
          charCount: inputText.length,
          wordCount: inputText.trim().split(/\s+/).length,
        },
        "Client:Format"
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
        "Client:Format"
      );

      const startMs = Date.now();
      const cleaned = cleanClientSideNotebookLM(
        inputText,
        formatMode,
        skillRegistry.getEnabledSkillIds()
      );
      if (reqId !== activePolishRequestIdRef.current) return;
      const latencyMs = Math.max(1, Date.now() - startMs);
      setCleanedMarkdown(cleaned);

      const cleanedBlocks = parseDocumentBlocks(cleaned);
      logPipelineDebug(
        "formatting_result",
        {
          charCount: cleaned.length,
          blockCount: cleanedBlocks.length,
          stageDurationMs: latencyMs,
        },
        "Client:Format"
      );
      logPipelineDebug(
        "preview_input",
        {
          charCount: cleaned.length,
          blockCount: cleanedBlocks.length,
        },
        "Client:Format"
      );

      // Rule 2: Strictly truthful status - never claim AI was used
      const notif = createLocalFormatNotification(latencyMs);
      setAiStatus(notif);

      // Record Telemetry Metric & Audit Log
      recordProviderMetric(
        "formatai",
        "FormatAI (Deterministic Engine)",
        true,
        latencyMs,
        false,
        Math.round(inputText.length / 4),
        Math.round(cleaned.length / 4)
      );
      recordAuditLogEntry({
        requestSummary: `FormatAI Offline Normalization (${inputText.slice(0, 42).replace(/[\n\r]+/g, " ")}...)`,
        finalProvider: "FormatAI",
        finalModel: "standard-academic-engine",
        hopsCount: 0,
        totalLatencyMs: latencyMs,
        success: true,
        chain: [
          {
            providerId: "formatai",
            providerName: "FormatAI Engine",
            keyMasked: "Local Deterministic",
            model: "standard-academic-engine",
            status: "success",
            latencyMs,
            timestamp: Date.now(),
          },
        ],
      });
    } catch (err: any) {
      if (reqId !== activePolishRequestIdRef.current) return;
      setErrorMessage(err.message || "FormatAI normalization failed.");
    } finally {
      if (reqId === activePolishRequestIdRef.current) {
        setIsConverting(false);
        setConversionStage("");
      }
    }
  };

  // Trigger preview AI polish (or FormatAI if in No AI mode)
  const handlePreviewClean = async () => {
    if (!inputText.trim()) {
      setErrorMessage("Please paste your content first.");
      return;
    }

    // When No AI is available/active, route directly to FormatAI without making external AI calls
    if (isNoAI) {
      handleRunFormatAI();
      return;
    }

    setIsConverting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setValidationAlert(null);
    setAiStatus(null);
    setConversionStage("AI Engine is polishing notes & equations...");

    // Capture the current verified FormatAI Result before firing AI Polish
    const prePolishFormatAiResult = effectiveMarkdown;
    const reqStartTime = Date.now();
    const reqId = ++activePolishRequestIdRef.current;

    try {
      const userConfig = getUserSettings();
      const userProvs = getUserProviders();
      const userPrefs = getUserPreferences();

      const rawBlocks = parseDocumentBlocks(inputText);
      logPipelineDebug(
        "raw_input",
        {
          charCount: inputText.length,
          wordCount: inputText.trim().split(/\s+/).length,
        },
        "Client:AI"
      );
      logPipelineDebug(
        "parsed_blocks",
        {
          blockCount: rawBlocks.length,
          blockIds: rawBlocks.slice(0, 5).map((b) => b.id),
        },
        "Client:AI"
      );
      const baselineBlocks = parseDocumentBlocks(prePolishFormatAiResult);
      logPipelineDebug(
        "formatting_result",
        {
          charCount: prePolishFormatAiResult.length,
          blockCount: baselineBlocks.length,
        },
        "Client:AI"
      );
      logPipelineDebug(
        "ai_request",
        {
          providerId: userConfig.activeProviderId || "formatai",
          model: userConfig.activeModel || "default",
          charCount: inputText.length,
          blockCount: baselineBlocks.length,
        },
        "Client:AI"
      );

      const res = await fetch("/api/preview-clean", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: inputText,
          baselineMarkdown: prePolishFormatAiResult,
          equationFormat,
          formatMode,
          enabledSkillIds: skillRegistry.getEnabledSkillIds(),
          customPrompt: userPrefs.customPrompt,
          aiConfig: userConfig,
          userProviders: userProvs,
        }),
      });

      const latencyMs = Math.max(1, Date.now() - reqStartTime);
      const data = await res.json();

      logPipelineDebug(
        "ai_response",
        {
          providerId: data.provider_id || userConfig.activeProviderId,
          model: data.model || userConfig.activeModel,
          charCount: (data.cleaned_markdown || "").length,
          stageDurationMs: latencyMs,
        },
        "Client:AI"
      );

      // Guard against race condition: if user initiated a newer request or edited input in flight, discard stale response
      if (reqId !== activePolishRequestIdRef.current) {
        console.log("Discarding stale AI Polish response from superseded request.");
        return;
      }
      if (!res.ok) {
        // Record Telemetry Metric & Audit Log for failure
        recordProviderMetric(
          userConfig.activeProviderId || "formatai",
          userConfig.activeProviderId || "AI Provider",
          false,
          latencyMs,
          res.status === 429,
          Math.round(inputText.length / 4),
          0,
          data.error || "Failed to polish notes with AI."
        );
        recordAuditLogEntry({
          requestSummary: `Academic LaTeX Polish (${inputText.slice(0, 42).replace(/[\n\r]+/g, " ")}...)`,
          finalProvider: userConfig.activeProviderId || "AI Provider",
          finalModel: userConfig.activeModel || "default",
          hopsCount: (data.fallback_chain && data.fallback_chain.length > 0) ? data.fallback_chain.length - 1 : 0,
          totalLatencyMs: latencyMs,
          success: false,
          chain: (data.fallback_chain && data.fallback_chain.length > 0)
            ? data.fallback_chain
            : [
                {
                  providerId: (userConfig.activeProviderId || "unknown").toLowerCase(),
                  providerName: userConfig.activeProviderId || "AI Provider",
                  keyMasked: "Client Key",
                  model: userConfig.activeModel || "default",
                  status: res.status === 429 ? "rate_limited" : "server_error",
                  errorMessage: data.error,
                  latencyMs,
                  timestamp: Date.now(),
                },
              ],
        });

        // Update provider statuses if returned in error payload
        if (data.fallback_chain && Array.isArray(data.fallback_chain)) {
          const currentProvs = getUserProviders();
          let changed = false;
          data.fallback_chain.forEach((step: any) => {
            const prov = currentProvs.find((p) => p.id === step.providerId);
            if (prov) {
              if (step.status === "rate_limited") {
                prov.status = "rate_limited";
                prov.lastError = step.errorMessage || "Free tier rate limit / quota exceeded (429)";
                changed = true;
              } else if (step.status === "invalid_key" || step.status === "permission_denied") {
                prov.status = "invalid_key";
                prov.lastError = step.errorMessage || "API key error or invalid authentication";
                changed = true;
              }
            }
          });
          if (changed) saveUserProviders(currentProvs);
        }

        // Set User-Friendly Status Notification
        // Uses informative failure from fallback chain (e.g. rate limit / auth on real configured provider)
        // rather than blindly using unconfigured fallback
        const classified = classifyFallbackChain(
          data.fallback_chain,
          data.error || "Failed to polish notes with AI.",
          res.status
        );
        const activeProvider = classified.providerName || userConfig.activeProviderId || "AI Provider";
        const activeModel = classified.modelName || userConfig.activeModel;

        setAiStatus({
          ...classified,
          providerName: activeProvider,
          modelName: activeModel,
          latencyMs,
          timestamp: Date.now(),
          technicalDetails: {
            provider: activeProvider,
            model: activeModel || "default",
            requestStatus: `${res.status}`,
            errorCategory: classified.badgeLabel,
            executionTime: `${latencyMs}ms`,
            technicalErrorMessage: data.error || "Request failed",
            rawChain: data.fallback_chain,
          },
        });

        setCleanedMarkdown(null);
        return;
      }

      // ── STRICT QUALITY-GATE VALIDATION ─────────────────────────────────────────
      // FormatAI Result -> AI Polish -> AI Output ❌ -> Validation FAILED ->
      // Discard AI Output -> Restore/Keep FormatAI Result -> Preview remains unchanged
      const clientValidation = validateAIPolishOutput(
        data.cleaned_markdown,
        inputText,
        prePolishFormatAiResult
      );

      const isValidationFailed =
        Boolean(data.validation_failed) ||
        Boolean(data.discarded_ai_output) ||
        !clientValidation.isValid;

      logPipelineDebug(
        "validation",
        {
          isValid: !isValidationFailed,
          validationScore: data.validation_score ?? clientValidation.score,
          missingBlocksCount: clientValidation.blockComparison?.missingBlocks?.length || 0,
          charDiffPercent: clientValidation.blockComparison?.charCountDifferencePercent,
        },
        "Client:AI"
      );

      if (isValidationFailed) {
        // 1. Discard AI Output: DO NOT apply data.cleaned_markdown
        // 2. Restore/Keep FormatAI Result: Setting cleanedMarkdown to null ensures
        //    effectiveMarkdown immediately falls back to / retains the deterministic
        //    rule-based FormatAI result cleanClientSideNotebookLM(...)
        setCleanedMarkdown(null);

        // 3. Preview remains unchanged!
        const reason =
          data.discard_reason ||
          clientValidation.discardReason ||
          clientValidation.errors[0] ||
          "Formula syntax, delimiter balance, or content preservation checks failed.";

        const errorsList =
          data.validation_errors && data.validation_errors.length > 0
            ? data.validation_errors
            : clientValidation.errors;

        setValidationAlert({
          failed: true,
          reason,
          errors: errorsList,
        });

        // Record Telemetry Metric & Audit Log
        recordProviderMetric(
          data.provider_id || userConfig.activeProviderId,
          data.provider_name || userConfig.activeProviderId,
          false,
          latencyMs,
          false,
          Math.round(inputText.length / 4),
          Math.round((data.cleaned_markdown || "").length / 4),
          `Quality-Gate: ${reason}`
        );
        recordAuditLogEntry({
          requestSummary: `Academic LaTeX Polish (${inputText.slice(0, 42).replace(/[\n\r]+/g, " ")}...)`,
          finalProvider: data.provider_name || userConfig.activeProviderId,
          finalModel: data.model || userConfig.activeModel,
          hopsCount: data.fallback_count || 0,
          totalLatencyMs: latencyMs,
          success: false,
          chain: (data.fallback_chain && data.fallback_chain.length > 0)
            ? data.fallback_chain
            : [
                {
                  providerId: (data.provider_id || userConfig.activeProviderId).toLowerCase(),
                  providerName: data.provider_name || userConfig.activeProviderId,
                  keyMasked: "Client Key",
                  model: data.model || userConfig.activeModel,
                  status: "server_error",
                  errorMessage: `Quality-Gate Discarded: ${reason}`,
                  latencyMs,
                  timestamp: Date.now(),
                },
              ],
        });

        const notif = createQualityGateWarningNotification({
          reason,
          providerName: data.provider_name || userConfig.activeProviderId,
          latencyMs,
          errorCategory: data.error_category || clientValidation.errorCategory || "malformed",
        });
        setAiStatus(notif);
        return;
      }

      // ── VALIDATION PASSED ───────────────────────────────────────────────────────
      // Requirement 2: Empty/null/partial output must NEVER overwrite existing content
      if (!data.cleaned_markdown || typeof data.cleaned_markdown !== "string" || !data.cleaned_markdown.trim()) {
        console.warn("Rejecting empty/null output to prevent overwriting existing content.");
        setCleanedMarkdown(null);
        return;
      }
      if (prePolishFormatAiResult && data.cleaned_markdown.trim().length < prePolishFormatAiResult.length * 0.7) {
        console.warn("Rejecting partial/severely truncated output to prevent overwriting existing content.");
        setCleanedMarkdown(null);
        return;
      }

      setValidationAlert(null);
      setCleanedMarkdown(data.cleaned_markdown);

      logPipelineDebug(
        "preview_input",
        {
          charCount: data.cleaned_markdown.length,
          blockCount: parseDocumentBlocks(data.cleaned_markdown).length,
        },
        "Client:AI"
      );

      // Record Telemetry Metric & Audit Log
      recordProviderMetric(
        data.provider_id || userConfig.activeProviderId,
        data.provider_name || userConfig.activeProviderId,
        true,
        latencyMs,
        false,
        Math.round(inputText.length / 4),
        Math.round((data.cleaned_markdown || "").length / 4)
      );
      recordAuditLogEntry({
        requestSummary: `Academic LaTeX Polish (${inputText.slice(0, 42).replace(/[\n\r]+/g, " ")}...)`,
        finalProvider: data.provider_name || userConfig.activeProviderId,
        finalModel: data.model || userConfig.activeModel,
        hopsCount: data.fallback_count || 0,
        totalLatencyMs: latencyMs,
        success: true,
        chain: (data.fallback_chain && data.fallback_chain.length > 0)
          ? data.fallback_chain
          : [
              {
                providerId: (data.provider_id || userConfig.activeProviderId).toLowerCase(),
                providerName: data.provider_name || userConfig.activeProviderId,
                keyMasked: "Client Key",
                model: data.model || userConfig.activeModel,
                status: "success",
                latencyMs,
                timestamp: Date.now(),
              },
            ],
      });

      // Update provider statuses from fallback chain if present
      if (data.fallback_chain && Array.isArray(data.fallback_chain)) {
        const currentProvs = getUserProviders();
        let changed = false;
        data.fallback_chain.forEach((step: any) => {
          const prov = currentProvs.find((p) => p.id === step.providerId);
          if (prov) {
            if (step.status === "rate_limited") {
              prov.status = "rate_limited";
              prov.lastError = step.errorMessage || "Free tier quota exceeded (429)";
              changed = true;
            } else if (step.status === "invalid_key" || step.status === "permission_denied") {
              prov.status = "invalid_key";
              prov.lastError = step.errorMessage || "API key error or connection failed";
              changed = true;
            } else if (step.status === "success" && prov.status === "rate_limited") {
              prov.status = "active";
              changed = true;
            }
          }
        });
        if (changed) saveUserProviders(currentProvs);
      }

      // User-friendly AI Status Notification
      const notif = classifyAiPolishSuccess({
        providerName: data.provider_name || userConfig.activeProviderId || "Gemini",
        modelName: data.model || userConfig.activeModel || "default",
        fallbackCount: data.fallback_count || 0,
        fallbackChain: data.fallback_chain || [],
        latencyMs,
      });
      setAiStatus(notif);
      fetchAIHealth();
    } catch (err: any) {
      if (reqId !== activePolishRequestIdRef.current) return;
      // Rule 21 & Rule 24: If AI API fails, preserve existing FormatAI result intact. Preview remains unchanged.
      setCleanedMarkdown(null);
      const classified = classifyErrorDetails(err.message || "Network request failed");
      setAiStatus({
        ...classified,
        latencyMs: Math.max(1, Date.now() - reqStartTime),
        timestamp: Date.now(),
        technicalDetails: {
          requestStatus: "Client Network / Exception",
          errorCategory: classified.badgeLabel,
          technicalErrorMessage: err.message,
        },
      });
    } finally {
      if (reqId === activePolishRequestIdRef.current) {
        setIsConverting(false);
        setConversionStage("");
      }
    }
  };

  /**
   * Targeted repair for flagged broken fragments ("Fix flagged only").
   * Strictly isolates broken fragments:
   * - Does not re-send entire blocks; sends ONLY the broken fragment with 50-100 char context
   * - Instructs AI to return ONLY the repaired fragment
   * - Slices rawText and replaces ONLY startOffset..endOffset range
   * - Enforces Step 5 validation: asserts characters outside startOffset..endOffset are 100% byte-for-byte untouched
   * - Queues requests sequentially with throttle to avoid provider rate limits
   */
  const handleRepairFlaggedBlocks = async () => {
    if (isRepairing) return;

    const initialBlocks = parseDocumentBlocks(effectiveMarkdown);
    const initialFlagged = collectFailedFragments(initialBlocks);
    const totalToFix = initialFlagged.failedBlockIds.length;
    if (totalToFix === 0) return;

    setIsRepairing(true);
    setRepairProgress({ current: 0, total: totalToFix });
    setErrorMessage(null);
    setSuccessMessage(null);

    let currentMarkdown = effectiveMarkdown;
    let successCount = 0;
    let failCount = 0;

    const userConfig = getUserSettings();
    const userProvs = getUserProviders();

    for (let step = 0; step < totalToFix; step++) {
      const currentBlocks = parseDocumentBlocks(currentMarkdown);
      const { failedBlockIds, blockFragmentsMap } = collectFailedFragments(currentBlocks);
      if (failedBlockIds.length === 0) {
        break; // All issues resolved
      }

      const targetBlockId = failedBlockIds[0];
      const targetIndex = currentBlocks.findIndex((b) => b.id === targetBlockId);
      if (targetIndex === -1) {
        failCount++;
        continue;
      }

      const targetBlock = currentBlocks[targetIndex];
      const targetFragments = blockFragmentsMap[targetBlockId] || [];
      const prevBlockText = targetIndex > 0 ? currentBlocks[targetIndex - 1].rawText : "";
      const nextBlockText =
        targetIndex < currentBlocks.length - 1 ? currentBlocks[targetIndex + 1].rawText : "";

      setRepairProgress({
        current: step + 1,
        total: totalToFix,
        currentBlockId: targetBlock.id,
      });

      try {
        const res = await fetch("/api/repair-block", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetBlock,
            brokenFragment: targetFragments[0],
            prevBlockText,
            nextBlockText,
            equationFormat,
            aiConfig: userConfig,
            userProviders: userProvs,
          }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || "Repair failed.");
        }

        if (data.repairedFragment && targetFragments[0]) {
          const frag = targetFragments[0];
          const updatedRawText = replaceFragmentInBlock(
            targetBlock.rawText,
            frag.startOffset,
            frag.endOffset,
            data.repairedFragment.trim()
          );
          currentMarkdown = replaceSingleBlockInDocument(currentMarkdown, targetBlock.id, updatedRawText);
        } else if (data.repairedText) {
          currentMarkdown = replaceSingleBlockInDocument(currentMarkdown, targetBlock.id, data.repairedText.trim());
        }

        setCleanedMarkdown(currentMarkdown);
        successCount++;
      } catch (err: any) {
        console.warn(`Repair attempt failed for block ${targetBlock.id}:`, err);
        // Client-side deterministic repair fallback
        const candidate = cleanClientSideNotebookLM(targetBlock.rawText, "auto");
        if (candidate && candidate !== targetBlock.rawText) {
          currentMarkdown = replaceSingleBlockInDocument(currentMarkdown, targetBlock.id, candidate);
          setCleanedMarkdown(currentMarkdown);
          successCount++;
        } else {
          failCount++;
        }
      }

      if (step < totalToFix - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    setIsRepairing(false);
    setRepairProgress(null);

    // Compact notification: "koyta fail ta dekhaolei hobe means koy fail and success"
    if (failCount === 0 && successCount > 0) {
      setSuccessMessage(`Repaired: ${successCount} succeeded, 0 failed`);
      setErrorMessage(null);
    } else if (successCount > 0 && failCount > 0) {
      setSuccessMessage(`Repaired: ${successCount} succeeded, ${failCount} failed`);
      setErrorMessage(null);
    } else if (failCount > 0) {
      setErrorMessage(`Repair: 0 succeeded, ${failCount} failed`);
      setSuccessMessage(null);
    }
  };

  /**
   * Targeted repair for a single specific broken fragment.
   */
  const handleRepairSingleFragment = async (frag: BrokenFragment) => {
    if (isRepairing) return;

    setIsRepairing(true);
    setRepairProgress({ current: 1, total: 1, currentBlockId: frag.blockId });
    setErrorMessage(null);
    setSuccessMessage(null);

    const userConfig = getUserSettings();
    const userProvs = getUserProviders();

    const currentBlocks = parseDocumentBlocks(effectiveMarkdown);
    let targetIndex = currentBlocks.findIndex((b) => b.id === frag.blockId);
    if (targetIndex === -1) {
      const baseTargetId = frag.blockId.replace(/-\d+$/, "");
      targetIndex = currentBlocks.findIndex(
        (b) => b.id === baseTargetId || b.id.replace(/-\d+$/, "") === baseTargetId
      );
    }

    if (targetIndex === -1) {
      setErrorMessage("Repair: 0 succeeded, 1 failed");
      setIsRepairing(false);
      setRepairProgress(null);
      return;
    }

    const targetBlock = currentBlocks[targetIndex];
    const prevBlockText = targetIndex > 0 ? currentBlocks[targetIndex - 1].rawText : "";
    const nextBlockText =
      targetIndex < currentBlocks.length - 1 ? currentBlocks[targetIndex + 1].rawText : "";

    try {
      const res = await fetch("/api/repair-block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetBlock,
          brokenFragment: frag,
          prevBlockText,
          nextBlockText,
          equationFormat,
          aiConfig: userConfig,
          userProviders: userProvs,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Repair engine did not succeed.");
      }

      const candidateFrag = (data.repairedFragment || data.repairedText || "").trim();
      if (!candidateFrag) {
        throw new Error("AI returned empty content for fragment.");
      }

      // Step 5 Validation
      const updatedRawText = replaceFragmentInBlock(
        targetBlock.rawText,
        frag.startOffset,
        frag.endOffset,
        candidateFrag
      );

      const isSurgical = assertFragmentSurgicallyReplaced(
        targetBlock.rawText,
        updatedRawText,
        frag.startOffset,
        frag.endOffset,
        candidateFrag
      );

      if (!isSurgical) {
        throw new Error("Surgical validation error: Content outside fragment boundary was altered.");
      }

      const updatedDoc = replaceFragmentInDocument(
        effectiveMarkdown,
        frag.blockId,
        frag.startOffset,
        frag.endOffset,
        candidateFrag
      );

      setCleanedMarkdown(updatedDoc);
      setSuccessMessage("Repaired: 1 succeeded, 0 failed");
      setErrorMessage(null);
    } catch (err: any) {
      // Deterministic local fallback
      const candidate = cleanClientSideNotebookLM(targetBlock.rawText, "auto");
      if (candidate && candidate !== targetBlock.rawText) {
        const updatedDoc = replaceSingleBlockInDocument(effectiveMarkdown, targetBlock.id, candidate);
        setCleanedMarkdown(updatedDoc);
        setSuccessMessage("Repaired: 1 succeeded, 0 failed");
        setErrorMessage(null);
      } else {
        setErrorMessage("Repair: 0 succeeded, 1 failed");
        setSuccessMessage(null);
      }
    } finally {
      setIsRepairing(false);
      setRepairProgress(null);
    }
  };

  /**
   * Targeted repair for a single specific block.
   * If the block has fine-grained broken fragments, repairs them surgically.
   */
  const handleRepairSingleBlock = async (blockId: string) => {
    if (isRepairing) return;
    const blockFrags = detectedBlockFragmentsMap[blockId] || [];

    if (blockFrags.length > 0) {
      for (const frag of blockFrags) {
        await handleRepairSingleFragment(frag);
      }
      return;
    }

    const targetBlock = docBlocks.find((b) => b.id === blockId);
    if (!targetBlock) return;

    setIsRepairing(true);
    setRepairProgress({ current: 1, total: 1, currentBlockId: blockId });
    setErrorMessage(null);

    const userConfig = getUserSettings();
    const userProvs = getUserProviders();

    let targetIndex = docBlocks.findIndex((b) => b.id === blockId);
    if (targetIndex === -1) {
      const baseTargetId = blockId.replace(/-\d+$/, "");
      targetIndex = docBlocks.findIndex(
        (b) => b.id === baseTargetId || b.id.replace(/-\d+$/, "") === baseTargetId
      );
    }
    const prevBlockText = targetIndex > 0 ? docBlocks[targetIndex - 1].rawText : "";
    const nextBlockText = targetIndex >= 0 && targetIndex < docBlocks.length - 1 ? docBlocks[targetIndex + 1].rawText : "";

    try {
      const res = await fetch("/api/repair-block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetBlock,
          prevBlockText,
          nextBlockText,
          equationFormat,
          aiConfig: userConfig,
          userProviders: userProvs,
        }),
      });

      if (!res.ok) {
        let serverMsg = `HTTP ${res.status}`;
        try {
          const errBody = await res.json();
          serverMsg = errBody.error || serverMsg;
        } catch {}
        throw new Error(serverMsg);
      }

      const data = await res.json();
      if (!data.success || !data.repairedText) {
        throw new Error(data.error || "Repair did not succeed.");
      }

      const candidateText = data.repairedText.trim();
      if (!candidateText) {
        throw new Error("AI returned empty content for block.");
      }

      const origSubstantive = targetBlock.rawText.replace(/[^a-zA-Z0-9]/g, "").length;
      const candSubstantive = candidateText.replace(/[^a-zA-Z0-9]/g, "").length;
      if (origSubstantive > 20 && candSubstantive < origSubstantive * 0.4) {
        throw new Error("Repaired output was suspiciously short or truncated.");
      }

      const checkBlock: DocumentBlock = {
        id: targetBlock.id,
        type: targetBlock.type,
        rawText: candidateText,
        substantiveText: extractSubstantiveText(candidateText),
        charCount: candidateText.length,
        substantiveCharCount: extractSubstantiveText(candidateText).length,
        lineStart: 1,
        lineEnd: 1,
      };
      const issue = detectBlockFormattingIssue(checkBlock);
      if (issue) {
        throw new Error(`Repaired block still has issue: ${issue.reason}`);
      }

      const updatedDoc = replaceSingleBlockInDocument(effectiveMarkdown, blockId, candidateText);
      setCleanedMarkdown(updatedDoc);
      setSuccessMessage("Repaired: 1 succeeded, 0 failed");
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage("Repair: 0 succeeded, 1 failed");
      setSuccessMessage(null);
    } finally {
      setIsRepairing(false);
      setRepairProgress(null);
    }
  };

  // Main export handler: Supports docx, pdf, tex, md, txt formats
  const downloadFile = async (format: "docx" | "pdf" | "tex" | "md" | "txt" = "docx") => {
    if (!inputText.trim()) {
      setErrorMessage("Please paste your content first.");
      return;
    }

    setIsConverting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const formatLabels: Record<string, string> = {
      docx: "Word document (.docx)",
      pdf: "PDF document (.pdf)",
      tex: "LaTeX document (.tex)",
      md: "Markdown document (.md)",
      txt: "Plain text document (.txt)",
    };

    try {
      // Generate safe filename from CURRENT content for EVERY generation
      const activeContent = inputText.trim() || effectiveMarkdown || "";
      const safeBaseName = generateFilenameFromContent(activeContent);
      const safeFilename = `${safeBaseName}.${format === "pdf" ? "pdf" : format === "docx" ? "docx" : format}`;

      // If exporting as PDF: generate publication-ready text-based PDF
      if (format === "pdf") {
        setConversionStage("1/3: Preparing text-based academic PDF...");
        const previewSheet =
          (document.getElementById("academic-document-sheet") ||
          document.getElementById("preview-document-sheet") ||
          document.querySelector(".academic-paper-sheet")) as HTMLElement | null;

        await downloadPreviewAsPdf({
          element: previewSheet,
          title: docTitle || safeBaseName,
          markdown: activeContent,
          fontFamily,
          accentColor,
          mode: "text",
          onProgress: (stage) => setConversionStage(stage),
        });
        setSuccessMessage(`"${safeFilename}" (Text-based PDF) generated successfully!`);
        return;
      }

      setConversionStage(`1/2: Preparing ${formatLabels[format] || format}...`);

      const userConfig = getUserSettings();
      const userProvs = getUserProviders();
      const userPrefs = getUserPreferences();

      const response = await fetch(`/api/export?format=${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: inputText,
          cleanedMarkdown: effectiveMarkdown,
          title: safeBaseName,
          font: fontFamily,
          accent: accentColor,
          equationFormat,
          formatMode,
          format,
          enabledSkillIds: skillRegistry.getEnabledSkillIds(),
          customPrompt: userPrefs.customPrompt,
          aiConfig: userConfig,
          userProviders: userProvs,
        }),
      });

      if (!response.ok) {
        let errText = "Export failed.";
        try {
          const errJson = await response.json();
          errText = errJson.error || errText;
        } catch {}
        throw new Error(errText);
      }

      const providerHeader = response.headers.get("x-ai-provider");

      setConversionStage(`2/2: Generating ${formatLabels[format] || format}...`);

      const blob = await response.blob();

      // Download strictly using the content-generated safeFilename, completely avoiding sample or reference file naming conventions
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = safeFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      const providerNote = providerHeader ? ` via ${providerHeader}` : "";
      setSuccessMessage(`"${safeFilename}" downloaded successfully!${providerNote}`);

      // Background AI polish update if not yet polished
      if (!cleanedMarkdown) {
        fetch("/api/preview-clean", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: inputText,
            equationFormat,
            formatMode,
            enabledSkillIds: skillRegistry.getEnabledSkillIds(),
            customPrompt: userPrefs.customPrompt,
            aiConfig: userConfig,
            userProviders: userProvs,
          }),
        })
          .then((r) => r.json())
          .then((d) => {
            if (d.cleaned_markdown) setCleanedMarkdown(d.cleaned_markdown);
          })
          .catch(() => {});
      }
      fetchAIHealth();
    } catch (err: any) {
      setErrorMessage(err.message || "An error occurred during export.");
    } finally {
      setIsConverting(false);
      setConversionStage("");
    }
  };

  // Keep handleConvertToDocx for backward compatibility
  const handleConvertToDocx = () => downloadFile("docx");

  const charCount = inputText.length;
  const wordCount = inputText.trim() ? inputText.trim().split(/\s+/).length : 0;
  const lineCount = inputText ? inputText.split("\n").length : 0;
  const currentTheme = getAcademicTheme(accentColor);

  // Keyboard navigation for role="tablist" view switcher
  const handleViewSwitcherKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
    const availableTabs: Array<"split" | "editor" | "preview"> = isMobile
      ? ["editor", "preview"]
      : ["split", "editor", "preview"];

    const currentIndex = availableTabs.indexOf(viewLayout);
    let targetIndex = -1;

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      targetIndex = currentIndex >= 0 ? (currentIndex + 1) % availableTabs.length : 0;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      targetIndex = currentIndex >= 0 ? (currentIndex - 1 + availableTabs.length) % availableTabs.length : availableTabs.length - 1;
    } else if (e.key === "Home") {
      e.preventDefault();
      targetIndex = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      targetIndex = availableTabs.length - 1;
    }

    if (targetIndex !== -1) {
      const nextTab = availableTabs[targetIndex];
      setViewLayout(nextTab);
      const nextBtn = document.getElementById(`view-tab-${nextTab}`);
      nextBtn?.focus();
    }
  };

  return (
    <div className="h-[100dvh] max-h-[100dvh] bg-[#F4F6F8] text-slate-900 flex flex-col antialiased w-full overflow-hidden">
      {/* Precision Top Header */}
      <Header
        docTitle={docTitle}
        onDocTitleChange={setDocTitle}
        onToggleSidebar={() => setIsSidebarOpen(true)}
        accentColor={accentColor}
      />

      {/* Main Container Area - compact 8px vertical spacing */}
      <div className="max-w-7xl w-full mx-auto px-3 sm:px-4 pt-2 pb-0 flex flex-col gap-2 shrink-0">
        {/* Interactive 7-Tile Toolbar Card matching Mockup */}
        <ToolbarGrid
          fontFamily={fontFamily}
          onFontFamilyChange={setFontFamily}
          accentColor={accentColor}
          onAccentColorChange={setAccentColor}
          equationFormat={equationFormat}
          onEquationFormatChange={setEquationFormat}
          onInsertSymbol={(sym) => {
            setInputText((prev) => prev + sym);
          }}
          isAiPolishing={isConverting}
          onTriggerAiPolish={handlePreviewClean}
          onTriggerFormatAI={handleRunFormatAI}
          isNoAI={isNoAI}
          onProviderChange={(pId) => setActiveProviderId(pId)}
          aiProviderName={isNoAI ? "FormatAI" : aiHealthInfo?.providersSummary?.[0]}
          onDownloadDocx={handleConvertToDocx}
          onExportFormat={downloadFile}
          canDownload={Boolean(inputText.trim())}
          formatMode={formatMode}
          onFormatModeChange={(mode) => {
            setFormatMode(mode);
            setCleanedMarkdown(null);
          }}
          activeSkillsCount={activeSkillsCount}
          onOpenSkillsManager={() => {
            setSkillsModalTab("skills");
            setIsSkillsManagerModalOpen(true);
          }}
          onSkillsChanged={() => {
            setActiveSkillsCount(skillRegistry.getEnabledSkillIds().length);
            setCleanedMarkdown(null);
          }}
          onSelectSample={handleLoadSample}
          onOpenAISettings={(tab) => {
            if (tab) {
              setAiSettingsInitialTab(tab === "providers" ? "control" : (tab as any));
            } else {
              setAiSettingsInitialTab("control");
            }
            setIsAISettingsModalOpen(true);
          }}
          failedBlockCount={detectedFailedBlockIds.length}
          onRepairFlagged={handleRepairFlaggedBlocks}
          isRepairing={isRepairing}
        />

        {/* Compact Segmented View Switcher Bar (Split View | Raw Editor | Document Sheet) */}
        <div
          role="tablist"
          aria-label="Document view options"
          onKeyDown={handleViewSwitcherKeyDown}
          className="sticky top-[84px] sm:relative sm:top-auto z-10 w-full h-9 bg-slate-200/80 p-0.5 rounded-lg border border-slate-300 flex items-center select-none shrink-0"
        >
          {/* Sliding Active Tab Background Indicator */}
          <div
            aria-hidden="true"
            className={`absolute inset-y-0.5 rounded-md bg-white shadow-2xs border border-slate-200/80 pointer-events-none transition-transform duration-200 ease-out motion-reduce:transition-none ${
              "w-[calc((100%-4px)/2)] sm:w-[calc((100%-4px)/3)] left-0.5 " +
              (viewLayout === "preview"
                ? "translate-x-full sm:translate-x-[200%]"
                : viewLayout === "editor"
                ? "translate-x-0 sm:translate-x-full"
                : "translate-x-0 sm:translate-x-0")
            }`}
          />

          {/* Tab 1: Split View (Hidden on mobile <640px via CSS, visible on desktop) */}
          <button
            type="button"
            role="tab"
            id="view-tab-split"
            aria-selected={viewLayout === "split"}
            tabIndex={viewLayout === "split" ? 0 : -1}
            onClick={() => setViewLayout("split")}
            className={`relative z-10 hidden sm:inline-flex flex-1 h-full items-center justify-center gap-1.5 px-3 rounded-lg text-sm transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              viewLayout === "split"
                ? "font-semibold text-slate-900"
                : "font-medium text-slate-600 hover:text-slate-800"
            }`}
          >
            <Columns
              className="w-4 h-4 shrink-0"
              style={{ color: viewLayout === "split" ? currentTheme.hex : undefined }}
            />
            <span className="truncate">Split View</span>
          </button>

          {/* Tab 2: Raw Editor */}
          <button
            type="button"
            role="tab"
            id="view-tab-editor"
            aria-selected={viewLayout === "editor"}
            tabIndex={viewLayout === "editor" ? 0 : -1}
            onClick={() => setViewLayout("editor")}
            className={`relative z-10 flex-1 h-full inline-flex items-center justify-center gap-1.5 px-3 rounded-lg text-sm transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              viewLayout === "editor"
                ? "font-semibold text-slate-900"
                : "font-medium text-slate-600 hover:text-slate-800"
            }`}
          >
            <FileText
              className="w-4 h-4 shrink-0"
              style={{ color: viewLayout === "editor" ? currentTheme.hex : undefined }}
            />
            <span className="truncate">Raw Editor</span>
          </button>

          {/* Tab 3: Document Sheet */}
          <button
            type="button"
            role="tab"
            id="view-tab-preview"
            aria-selected={viewLayout === "preview"}
            tabIndex={viewLayout === "preview" ? 0 : -1}
            onClick={() => setViewLayout("preview")}
            className={`relative z-10 flex-1 h-full inline-flex items-center justify-center gap-1.5 px-3 rounded-lg text-sm transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              viewLayout === "preview"
                ? "font-semibold text-slate-900"
                : "font-medium text-slate-600 hover:text-slate-800"
            }`}
          >
            <Eye
              className="w-4 h-4 shrink-0"
              style={{ color: viewLayout === "preview" ? currentTheme.hex : undefined }}
            />
            <span className="truncate">Document Sheet</span>
          </button>
        </div>
      </div>

      {/* Main Workspace - fills remaining height with zero page scroll */}
      <main className="flex-1 min-h-0 max-w-7xl w-full mx-auto px-3 sm:px-4 pt-2 pb-16 sm:pb-2 flex flex-col gap-2 overflow-hidden">
        {/* Progress feedback bar */}
        {isConverting && (
          <div className="bg-blue-50 border border-blue-200 text-blue-900 px-3.5 py-2 rounded-xl text-xs flex items-center justify-between animate-fadeIn shadow-2xs shrink-0">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
              <span className="font-medium">{conversionStage || "Processing..."}</span>
            </div>
            <span className="text-[11px] text-blue-700 font-mono">Word • {fontFamily}</span>
          </div>
        )}

        {/* User-Friendly AI Status & Warning Notification System */}
        {aiStatus && (
          <div className="shrink-0">
            <AIStatusBanner
              notification={aiStatus}
              onDismiss={() => setAiStatus(null)}
              onOpenSettings={() => {
                setAiSettingsInitialTab("control");
                setIsAISettingsModalOpen(true);
              }}
              onRetry={handlePreviewClean}
              onOpenAuditLogs={() => {
                setAiSettingsInitialTab("logs");
                setIsAISettingsModalOpen(true);
              }}
            />
          </div>
        )}

        {/* General Error notification (fallback when aiStatus is not set) */}
        {!aiStatus && errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-900 px-3 py-1.5 rounded-xl text-xs flex items-center justify-between animate-fadeIn shadow-2xs shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-semibold truncate">{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer shrink-0"
              aria-label="Dismiss error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Validation Failure Banner (FormatAI Result Restored & Preview Unchanged) */}
        {validationAlert?.failed && (
          <div className="bg-amber-50 border border-amber-300 text-amber-950 px-3 py-1.5 rounded-xl text-xs flex items-center justify-between gap-3 animate-fadeIn shadow-2xs shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-extrabold text-amber-950 shrink-0">Validation Failed</span>
              <span className="text-slate-600 truncate text-[11px]">FormatAI Result restored: {validationAlert.reason}</span>
            </div>
            <button
              onClick={() => setValidationAlert(null)}
              className="text-amber-600 hover:text-amber-800 p-1 cursor-pointer shrink-0"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* General Success notification (fallback when aiStatus is not set) */}
        {!aiStatus && successMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-3 py-1.5 rounded-xl text-xs flex items-center justify-between animate-fadeIn shadow-2xs shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold truncate">{successMessage}</span>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-500 hover:text-emerald-700 p-1 cursor-pointer shrink-0"
              aria-label="Dismiss success"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* WORKSPACE VIEW: SPLIT */}
        {viewLayout === "split" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3 items-stretch flex-1 min-h-0 h-full overflow-hidden">
            {/* Left Pane: Raw Notes & AI Content Editor */}
            <div className="bg-white rounded-xl border border-slate-300 shadow-2xs flex flex-col h-full min-h-0 overflow-hidden">
              {/* Editor Header Bar with 40px height */}
              <div className="h-10 px-3 border-b border-slate-200 flex items-center justify-between bg-slate-100/90 shrink-0">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider truncate">
                  Raw Content (ChatGPT, Gemini, Claude, NotebookLM)
                </span>

                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".txt,.md,.markdown,.tex,.json,.csv,.latex,.docx,.pdf"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="h-7 inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 active:bg-slate-200 px-2 py-1 rounded-md border border-slate-300 shadow-2xs transition-colors cursor-pointer"
                    title="Upload document file (.txt, .md, .tex, .pdf, .docx)"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-600" />
                    <span>Upload</span>
                  </button>
                  <button
                    onClick={handlePasteClipboard}
                    className="h-7 inline-flex items-center gap-1 text-xs font-bold text-white px-2.5 py-1 rounded-md shadow-2xs transition-colors cursor-pointer"
                    style={{ backgroundColor: currentTheme.btnPrimary }}
                    title="Paste from clipboard"
                  >
                    <Clipboard className="w-3.5 h-3.5 text-white" />
                    <span>Paste</span>
                  </button>
                  <button
                    onClick={() => handleUpdateInput("", "FormatAI Document")}
                    className="h-7 inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 px-2 py-1 rounded-md border border-rose-300 shadow-2xs transition-colors cursor-pointer"
                    title="Clear input"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                </div>
              </div>

              {/* Editor Textarea - only this area scrolls on the left */}
              <textarea
                value={inputText}
                onChange={(e) => {
                  const val = e.target.value;
                  activePolishRequestIdRef.current++;
                  setInputText(val);
                  setDocTitle(getDisplayTitleFromContent(val));
                  if (cleanedMarkdown) setCleanedMarkdown(null);
                  if (validationAlert) setValidationAlert(null);
                }}
                placeholder="Paste AI-generated or copy-pasted content here (from ChatGPT, Gemini, Claude, NotebookLM, DeepSeek, or any lecture notes/formulas)...&#10;&#10;Examples:&#10;• Mathematical LaTeX: \frac{\partial T}{\partial t} = \alpha \nabla^2 T or SE(\hat{p}) = \sqrt{\frac{p(1-p)}{n}} typeset to native Word equations&#10;• Tree structures, markdown headers, bold terms, and lists format cleanly into professional academic DOCX"
                className="w-full flex-1 min-h-0 p-3 sm:p-4 font-mono text-xs sm:text-[13px] text-slate-900 bg-white resize-none focus:outline-none leading-relaxed select-text placeholder:text-slate-400 overflow-y-auto"
              />

              {/* Editor Status Bar */}
              <div className="h-8 px-3 border-t border-slate-200 bg-slate-100/90 text-xs text-slate-700 font-semibold flex items-center justify-between shrink-0 select-none">
                <div className="flex items-center gap-2">
                  <span>{charCount.toLocaleString()} chars • {lineCount} lines</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-xs text-slate-500 font-normal">{wordCount.toLocaleString()} words</span>
                </div>
                <span className="text-emerald-700 font-bold flex items-center gap-1.5 text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync Active
                </span>
              </div>
            </div>

            {/* Right Pane: Live Document Sheet - only document sheet scrolls on the right */}
            <div className="h-full min-h-0 flex flex-col overflow-hidden">
              <FormattedPreview
                markdown={effectiveMarkdown}
                docTitle={docTitle}
                fontFamily={fontFamily}
                accentColor={accentColor}
                equationFormat={equationFormat}
                isAiPolished={Boolean(cleanedMarkdown)}
                validationAlert={validationAlert}
                onDismissValidationAlert={() => setValidationAlert(null)}
                onTriggerAiPolish={handlePreviewClean}
                isAiPolishing={isConverting}
                onDownloadDocx={handleConvertToDocx}
                onDownloadPdf={() => downloadFile("pdf")}
                isDownloading={isConverting}
                failedBlockIds={detectedFailedBlockIds}
                blockIssuesMap={detectedIssuesMap}
                fragments={detectedFragments}
                blockFragmentsMap={detectedBlockFragmentsMap}
                onRepairSingleBlock={handleRepairSingleBlock}
                onRepairFragment={handleRepairSingleFragment}
                onRepairAllFlagged={handleRepairFlaggedBlocks}
                isRepairing={isRepairing}
                repairProgress={repairProgress}
              />
            </div>
          </div>
        )}

        {/* WORKSPACE VIEW: EDITOR ONLY */}
        {viewLayout === "editor" && (
          <div className="bg-white rounded-xl border border-slate-300 shadow-2xs flex flex-col flex-1 min-h-0 h-full overflow-hidden">
            <div className="h-10 px-3 border-b border-slate-200 flex items-center justify-between bg-slate-100/90 shrink-0">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider truncate">
                Raw Content (ChatGPT, Gemini, Claude, NotebookLM)
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="h-7 inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 active:bg-slate-200 px-2 py-1 rounded-md border border-slate-300 shadow-2xs transition-colors cursor-pointer"
                  title="Upload document file (.txt, .md, .tex, .pdf, .docx)"
                >
                  <Upload className="w-3.5 h-3.5 text-slate-600" />
                  <span>Upload</span>
                </button>
                <button
                  onClick={handlePasteClipboard}
                  className="h-7 inline-flex items-center gap-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-2.5 py-1 rounded-md shadow-2xs transition-colors cursor-pointer"
                >
                  <Clipboard className="w-3.5 h-3.5 text-white" />
                  <span>Paste</span>
                </button>
                <button
                  onClick={() => handleUpdateInput("", "FormatAI Document")}
                  className="h-7 inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 px-2 py-1 rounded-md border border-rose-300 shadow-2xs transition-colors cursor-pointer"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              </div>
            </div>

            <textarea
              value={inputText}
              onChange={(e) => {
                const val = e.target.value;
                activePolishRequestIdRef.current++;
                setInputText(val);
                setDocTitle(getDisplayTitleFromContent(val));
                if (cleanedMarkdown) setCleanedMarkdown(null);
                if (validationAlert) setValidationAlert(null);
              }}
              placeholder="Paste AI-generated or copy-pasted content here (from ChatGPT, Gemini, Claude, NotebookLM, or any notes/equations)..."
              className="w-full flex-1 min-h-0 p-3 sm:p-4 font-mono text-xs sm:text-sm text-slate-900 bg-white resize-none focus:outline-none leading-relaxed select-text placeholder:text-slate-400 overflow-y-auto"
            />

            <div className="h-8 px-3 border-t border-slate-200 bg-slate-100/90 text-xs text-slate-700 font-semibold flex items-center justify-between shrink-0 select-none">
              <div className="flex items-center gap-2">
                <span>{charCount.toLocaleString()} chars • {lineCount} lines</span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-500 font-normal">{wordCount.toLocaleString()} words</span>
              </div>
              <button
                onClick={() => setViewLayout("split")}
                className="text-blue-700 font-bold hover:underline cursor-pointer hidden sm:inline-block text-xs"
              >
                Switch to Split View →
              </button>
            </div>
          </div>
        )}

        {/* WORKSPACE VIEW: DOCUMENT PREVIEW ONLY */}
        {viewLayout === "preview" && (
          <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden">
            <FormattedPreview
              markdown={effectiveMarkdown}
              docTitle={docTitle}
              fontFamily={fontFamily}
              accentColor={accentColor}
              equationFormat={equationFormat}
              isAiPolished={Boolean(cleanedMarkdown)}
              validationAlert={validationAlert}
              onDismissValidationAlert={() => setValidationAlert(null)}
              onTriggerAiPolish={handlePreviewClean}
              isAiPolishing={isConverting}
              onDownloadDocx={handleConvertToDocx}
              onDownloadPdf={() => downloadFile("pdf")}
              isDownloading={isConverting}
              failedBlockIds={detectedFailedBlockIds}
              blockIssuesMap={detectedIssuesMap}
              fragments={detectedFragments}
              blockFragmentsMap={detectedBlockFragmentsMap}
              onRepairSingleBlock={handleRepairSingleBlock}
              onRepairFragment={handleRepairSingleFragment}
              onRepairAllFlagged={handleRepairFlaggedBlocks}
              isRepairing={isRepairing}
              repairProgress={repairProgress}
            />
          </div>
        )}
      </main>

      {/* Mobile Sticky Bottom Floating Action Dock (Mobile Users only, hidden on sm+) */}
      <div
        id="mobile-sticky-dock"
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t-2 border-slate-300 px-2.5 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] grid grid-cols-[1fr_2fr_1fr] items-center gap-1.5 shadow-[0_-4px_20px_rgba(0,0,0,0.12)]"
      >
        {/* View Switcher Toggle (Column 1: 1fr - Edit & Preview guaranteed >= 48x48px touch hit-box) */}
        <div className="flex bg-slate-200/90 p-0.5 rounded-2xl border border-slate-300 gap-0.5 shadow-2xs min-h-[48px] items-stretch">
          <button
            type="button"
            id="mobile-btn-edit"
            onClick={() => setViewLayout("editor")}
            className={`flex-1 min-h-[48px] px-1 rounded-xl text-xs font-black flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-95 ${
              viewLayout === "editor"
                ? "bg-white text-slate-900 shadow-sm border border-slate-300"
                : "text-slate-700 hover:text-slate-900 hover:bg-slate-300/40"
            }`}
            title="Switch to Editor"
            aria-label="Edit view"
          >
            <FileText
              className="w-4 h-4 shrink-0"
              style={{ color: viewLayout === "editor" ? currentTheme.hex : undefined }}
            />
            <span className="font-extrabold text-[11px] hidden min-[360px]:inline">Edit</span>
          </button>
          <button
            type="button"
            id="mobile-btn-preview"
            onClick={() => setViewLayout("preview")}
            className={`flex-1 min-h-[48px] px-1 rounded-xl text-xs font-black flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-95 ${
              viewLayout === "preview"
                ? "bg-white text-slate-900 shadow-sm border border-slate-300"
                : "text-slate-700 hover:text-slate-900 hover:bg-slate-300/40"
            }`}
            title="Switch to Preview"
            aria-label="Preview view"
          >
            <Eye
              className="w-4 h-4 shrink-0"
              style={{ color: viewLayout === "preview" ? currentTheme.hex : undefined }}
            />
            <span className="font-extrabold text-[11px] hidden min-[360px]:inline">Prev</span>
          </button>
        </div>

        {/* FormatAI / AI Polish Button (Column 2: 2fr - expanded horizontal space, guaranteed >= 48x48px touch hit-box) */}
        <button
          type="button"
          id="mobile-btn-ai-polish"
          onClick={isNoAI ? handleRunFormatAI : handlePreviewClean}
          disabled={isConverting}
          className="w-full min-h-[48px] min-w-[48px] px-2.5 py-2.5 rounded-2xl text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer border border-black/10"
          style={{ backgroundColor: currentTheme.btnPrimary }}
          title={isNoAI ? "Run FormatAI (No AI)" : "Run AI Polish"}
          aria-label={isNoAI ? "Run FormatAI" : "Run AI Polish"}
        >
          {isConverting ? (
            <Loader2 className="w-4 h-4 animate-spin shrink-0 text-white" />
          ) : (
            <Sparkles className="w-4 h-4 shrink-0 text-amber-300" />
          )}
          <span className="whitespace-nowrap font-extrabold truncate">
            {isConverting ? "Normalizing..." : isNoAI ? "FormatAI" : "AI Polish"}
          </span>
        </button>

        {/* Export DOCX Button (Column 3: 1fr - guaranteed >= 48x48px touch hit-box) */}
        <button
          type="button"
          id="mobile-btn-export"
          onClick={() => downloadFile("docx")}
          disabled={!inputText.trim() || isConverting}
          className="w-full min-h-[48px] min-w-[48px] px-2 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 active:bg-black active:scale-95 text-white font-black text-xs flex items-center justify-center gap-1 shadow-sm transition-all disabled:opacity-50 cursor-pointer border border-slate-700"
          title="Download Word Document (.docx)"
          aria-label="Export Word Document"
        >
          <FileDown className="w-4 h-4 shrink-0 text-blue-300" />
          <span className="whitespace-nowrap font-extrabold">
            <span>Export</span>
            <span className="hidden min-[380px]:inline"> DOCX</span>
          </span>
        </button>
      </div>

      {/* Educational Dedication & Open Source Footer */}
      <footer className="border-t-2 border-slate-300 bg-white py-4 px-4 sm:px-6 mt-8 pb-28 sm:pb-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2 text-center sm:text-left flex-wrap justify-center sm:justify-start">
            <span className="font-semibold text-slate-700">FormatAI</span>
            <span>•</span>
            <span>AI to Academic DOCX Typesetter</span>
            <span>•</span>
            <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Free for Students
            </span>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <button
              type="button"
              onClick={() => {
                setSkillsModalTab("license");
                setIsSkillsManagerModalOpen(true);
              }}
              className="font-semibold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer"
            >
              FormatAI License & Upstream Repos
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => {
                setSkillsModalTab("skills");
                setIsSkillsManagerModalOpen(true);
              }}
              className="font-medium text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
            >
              Modular Skills Pipeline
            </button>
          </div>
        </div>
      </footer>

      {/* 3-Lines (Hamburger) Drawer holding all configuration settings */}
      {isSidebarOpen && (
        <SidebarSettingsDrawer
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          readyProvidersCount={aiHealthInfo?.readyCount || 1}
          aiProvidersSummary={aiHealthInfo?.providersSummary || []}
          aiMode={aiHealthInfo?.mode || "failover"}
          isFreeOnly={aiHealthInfo?.freeOnly || false}
          onOpenAISettingsModal={() => setIsAISettingsModalOpen(true)}
          activeSkillsCount={activeSkillsCount}
          onOpenSkillsModal={() => {
            setSkillsModalTab("skills");
            setIsSkillsManagerModalOpen(true);
          }}
          onOpenLicenseModal={() => {
            setSkillsModalTab("license");
            setIsSkillsManagerModalOpen(true);
          }}
          fontFamily={fontFamily}
          onFontFamilyChange={setFontFamily}
          accentColor={accentColor}
          onAccentColorChange={setAccentColor}
          equationFormat={equationFormat}
          onEquationFormatChange={setEquationFormat}
          formatMode={formatMode}
          onFormatModeChange={(mode) => {
            setFormatMode(mode);
            setCleanedMarkdown(null);
          }}
          onPasteClipboard={handlePasteClipboard}
          onClearText={() => {
            setInputText("");
            setDocTitle("FormatAI Document");
            setCleanedMarkdown(null);
          }}
          charCount={charCount}
          wordCount={wordCount}
          isInstalled={isInstalled}
          hasNativePrompt={hasNativePrompt}
          onInstallApp={handleInstallApp}
        />
      )}

      {/* Multi-Provider AI Settings Modal */}
      {isAISettingsModalOpen && (
        <AISettingsModal
          isOpen={isAISettingsModalOpen}
          initialTab={aiSettingsInitialTab}
          onClose={() => {
            setIsAISettingsModalOpen(false);
            fetchAIHealth();
          }}
          onConfigChanged={fetchAIHealth}
        />
      )}

      {/* Systematic Formatting Skills Modal */}
      {isSkillModalOpen && (
        <SystematicSkillsModal
          isOpen={isSkillModalOpen}
          onClose={() => setIsSkillModalOpen(false)}
          activeMode={formatMode}
          onSelectMode={(mode) => {
            setFormatMode(mode);
            setCleanedMarkdown(null);
          }}
          onLoadSample={() => {
            handleLoadSample(SAMPLE_NOTES[0]);
            setFormatMode("study_guide");
          }}
        />
      )}

      {/* Modular GitHub Skills Manager Modal */}
      <ErrorBoundary fallbackTitle="Academic Skills Modal Paused">
        {isSkillsManagerModalOpen && (
          <SkillsManagerModal
            isOpen={isSkillsManagerModalOpen}
            initialTab={skillsModalTab}
            onClose={() => setIsSkillsManagerModalOpen(false)}
            onSkillsChanged={() => {
              setActiveSkillsCount(skillRegistry.getEnabledSkillIds().length);
              setCleanedMarkdown(null);
            }}
            onApplyText={(text) => {
              setInputText(text);
              setDocTitle(getDisplayTitleFromContent(text));
              setCleanedMarkdown(null);
            }}
          />
        )}
      </ErrorBoundary>

      {/* Initial FormatAI Splash / Loading Screen */}
      <SplashScreen isAppReady={isAppReady} />
    </div>
  );
}
