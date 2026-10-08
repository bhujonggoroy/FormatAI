import crypto from "node:crypto";
import express from "express";
import {
  validateExportFormat,
  generateFilenameFromContent,
  generateLaTeXDocument,
  generateMarkdownDocument,
  generatePlainTextDocument,
  generatePdfBuffer,
  type ExportFormat,
} from "../exportService.ts";
import { buildDocxFromMarkdown } from "../docxService.ts";
import { cleanNotesWithMultiProviderAI } from "../services/cleanService.ts";

export const exportRouter = express.Router();

interface ExportCacheEntry {
  buffer: Buffer;
  contentType: string;
  providerName: string;
  modelName: string;
  fallbackCount: number;
  timestamp: number;
  size: number;
}

const MAX_EXPORT_CACHE_ENTRIES = 20;
const MAX_EXPORT_CACHE_BYTES = 50 * 1024 * 1024; // 50 MB
const EXPORT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

class ExportLRUCache {
  private cache = new Map<string, ExportCacheEntry>();
  private currentBytes = 0;

  private pruneExpired() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > EXPORT_CACHE_TTL_MS) {
        this.currentBytes -= entry.size;
        this.cache.delete(key);
      }
    }
  }

  get(key: string): ExportCacheEntry | undefined {
    this.pruneExpired();
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > EXPORT_CACHE_TTL_MS) {
      this.currentBytes -= entry.size;
      this.cache.delete(key);
      return undefined;
    }
    // Refresh LRU ordering
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry;
  }

  set(key: string, entry: Omit<ExportCacheEntry, "timestamp" | "size">): void {
    this.pruneExpired();
    const size = entry.buffer.length;
    if (size > MAX_EXPORT_CACHE_BYTES) return;

    if (this.cache.has(key)) {
      this.currentBytes -= this.cache.get(key)!.size;
      this.cache.delete(key);
    }

    while (
      (this.cache.size >= MAX_EXPORT_CACHE_ENTRIES || this.currentBytes + size > MAX_EXPORT_CACHE_BYTES) &&
      this.cache.size > 0
    ) {
      const oldestKey = this.cache.keys().next().value;
      if (!oldestKey) break;
      const oldestEntry = this.cache.get(oldestKey);
      if (oldestEntry) this.currentBytes -= oldestEntry.size;
      this.cache.delete(oldestKey);
    }

    const fullEntry: ExportCacheEntry = {
      ...entry,
      timestamp: Date.now(),
      size,
    };
    this.cache.set(key, fullEntry);
    this.currentBytes += size;
  }
}

const exportLRUCache = new ExportLRUCache();

// Main export & conversion endpoint: Supports docx, pdf, tex, md, txt
export const handleExport = async (req: express.Request, res: express.Response) => {
  try {
    const {
      text,
      cleanedMarkdown: clientCleanedMarkdown,
      title = "FormatAI Academic Document",
      font = "Times New Roman",
      accent = "1A365D",
      equationFormat = "native",
      formatMode = "auto",
      enabledSkillIds,
      customPrompt,
      aiConfig,
      userProviders,
    } = req.body || {};

    // Validate requested format (query param or body param, defaulting to 'docx')
    const rawFormat = req.query.format || (req.body && req.body.format) || "docx";
    let targetFormat: ExportFormat;
    try {
      targetFormat = validateExportFormat(rawFormat);
    } catch (formatErr: any) {
      return res.status(400).json({ error: formatErr.message || "Invalid export format. Allowed formats: docx, pdf, tex, md, txt." });
    }

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Please paste your notes or AI content to convert." });
    }

    console.log(`Starting export [format: ${targetFormat}] for: "${title}" (length: ${text.length} chars, eqFormat: ${equationFormat}, formatMode: ${formatMode}, hasPreview: ${Boolean(clientCleanedMarkdown)})`);
    
    // Step 1: Use the exact markdown the user previewed, or clean via Multi-Provider AIRequestManager
    let markdownToBuild = clientCleanedMarkdown;
    let providerName = "Instant Preview";
    let modelName = "verified";
    let fallbackCount = 0;

    if (!markdownToBuild || typeof markdownToBuild !== "string" || !markdownToBuild.trim()) {
      const aiResult = await cleanNotesWithMultiProviderAI(
        text,
        equationFormat,
        formatMode,
        enabledSkillIds,
        customPrompt,
        aiConfig,
        userProviders
      );
      markdownToBuild = aiResult.cleanedMarkdown;
      providerName = aiResult.providerName;
      modelName = aiResult.model;
      fallbackCount = aiResult.fallbackCount;
    }

    // Dynamically generate filename independently for every generation directly from user content
    const baseFilename = generateFilenameFromContent(text || markdownToBuild);
    const exportFilename = `${baseFilename}.${targetFormat}`;
    const encodedFilename = encodeURIComponent(exportFilename);
    const asciiFallback = exportFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const contentDispositionHeader = `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedFilename}`;

    // Requirement 7: Export cache check: sha256(format + title + options + markdown)
    const normalizedSkills = Array.isArray(enabledSkillIds) ? [...enabledSkillIds].sort() : [];
    const cacheKey = crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          format: targetFormat,
          title,
          font,
          accent: accent.replace('#', ''),
          equationFormat,
          formatMode,
          enabledSkillIds: normalizedSkills,
          markdown: markdownToBuild,
        })
      )
      .digest("hex");

    const cached = exportLRUCache.get(cacheKey);
    if (cached) {
      res.setHeader("x-ai-provider", cached.providerName);
      res.setHeader("x-ai-model", cached.modelName);
      res.setHeader("x-ai-fallback-count", String(cached.fallbackCount));
      res.setHeader("x-export-cache", "HIT");
      res.setHeader("Content-Type", cached.contentType);
      res.setHeader("Content-Disposition", contentDispositionHeader);
      res.setHeader("Content-Length", cached.buffer.length);
      return res.end(cached.buffer);
    }

    // Common AI telemetry headers
    res.setHeader("x-ai-provider", providerName);
    res.setHeader("x-ai-model", modelName);
    res.setHeader("x-ai-fallback-count", String(fallbackCount));
    res.setHeader("x-export-cache", "MISS");

    let outBuffer: Buffer;
    let contentType: string;

    // Handle each supported format
    switch (targetFormat) {
      case "docx": {
        // Build DOCX buffer with native Word Math & typography (Preserved Original)
        outBuffer = await buildDocxFromMarkdown(markdownToBuild, {
          title,
          fontFamily: font,
          accentColor: accent.replace('#', ''),
          equationFormat: equationFormat as any,
          enabledSkillIds,
          skipPreprocess: Boolean(clientCleanedMarkdown && typeof clientCleanedMarkdown === "string" && clientCleanedMarkdown.trim()),
        });
        contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        break;
      }

      case "pdf": {
        // Generate PDF with PDFKit
        outBuffer = await generatePdfBuffer(markdownToBuild, {
          title,
          fontFamily: font,
          accentColor: accent,
        });
        contentType = "application/pdf";
        break;
      }

      case "tex": {
        // Generate LaTeX document (.tex)
        const texContent = generateLaTeXDocument(markdownToBuild, title);
        outBuffer = Buffer.from(texContent, "utf-8");
        contentType = "text/x-tex; charset=utf-8";
        break;
      }

      case "md": {
        // Generate clean Markdown (.md)
        const mdContent = generateMarkdownDocument(markdownToBuild, title);
        outBuffer = Buffer.from(mdContent, "utf-8");
        contentType = "text/markdown; charset=utf-8";
        break;
      }

      case "txt": {
        // Generate Plain Text (.txt)
        const txtContent = generatePlainTextDocument(markdownToBuild, title);
        outBuffer = Buffer.from(txtContent, "utf-8");
        contentType = "text/plain; charset=utf-8";
        break;
      }

      default:
        return res.status(400).json({ error: "Unsupported export format." });
    }

    // Save to LRU cache
    exportLRUCache.set(cacheKey, {
      buffer: outBuffer,
      contentType,
      providerName,
      modelName,
      fallbackCount,
    });

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", contentDispositionHeader);
    res.setHeader("Content-Length", outBuffer.length);
    return res.end(outBuffer);
  } catch (err: any) {
    console.error("Export error:", err);
    res.status(500).json({ error: err.message || "Failed to export document." });
  }
};

exportRouter.post("/convert", handleExport);
exportRouter.post("/api/convert", handleExport);
exportRouter.post("/export", handleExport);
exportRouter.post("/api/export", handleExport);
