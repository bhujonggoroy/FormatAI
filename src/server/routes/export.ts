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

    // Common AI telemetry headers
    res.setHeader("x-ai-provider", providerName);
    res.setHeader("x-ai-model", modelName);
    res.setHeader("x-ai-fallback-count", String(fallbackCount));

    // Handle each supported format
    switch (targetFormat) {
      case "docx": {
        // Build DOCX buffer with native Word Math & typography (Preserved Original)
        const docxBuffer = await buildDocxFromMarkdown(markdownToBuild, {
          title,
          fontFamily: font,
          accentColor: accent.replace('#', ''),
          equationFormat: equationFormat as any,
          enabledSkillIds,
          skipPreprocess: Boolean(clientCleanedMarkdown && typeof clientCleanedMarkdown === "string" && clientCleanedMarkdown.trim()),
        });

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        res.setHeader("Content-Disposition", contentDispositionHeader);
        res.setHeader("Content-Length", docxBuffer.length);
        return res.end(docxBuffer);
      }

      case "pdf": {
        // Generate PDF with PDFKit
        const pdfBuffer = await generatePdfBuffer(markdownToBuild, {
          title,
          fontFamily: font,
          accentColor: accent,
        });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", contentDispositionHeader);
        res.setHeader("Content-Length", pdfBuffer.length);
        return res.end(pdfBuffer);
      }

      case "tex": {
        // Generate LaTeX document (.tex)
        const texContent = generateLaTeXDocument(markdownToBuild, title);
        const texBuffer = Buffer.from(texContent, "utf-8");

        res.setHeader("Content-Type", "text/x-tex; charset=utf-8");
        res.setHeader("Content-Disposition", contentDispositionHeader);
        res.setHeader("Content-Length", texBuffer.length);
        return res.end(texBuffer);
      }

      case "md": {
        // Generate clean Markdown (.md)
        const mdContent = generateMarkdownDocument(markdownToBuild, title);
        const mdBuffer = Buffer.from(mdContent, "utf-8");

        res.setHeader("Content-Type", "text/markdown; charset=utf-8");
        res.setHeader("Content-Disposition", contentDispositionHeader);
        res.setHeader("Content-Length", mdBuffer.length);
        return res.end(mdBuffer);
      }

      case "txt": {
        // Generate Plain Text (.txt)
        const txtContent = generatePlainTextDocument(markdownToBuild, title);
        const txtBuffer = Buffer.from(txtContent, "utf-8");

        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("Content-Disposition", contentDispositionHeader);
        res.setHeader("Content-Length", txtBuffer.length);
        return res.end(txtBuffer);
      }

      default:
        return res.status(400).json({ error: "Unsupported export format." });
    }
  } catch (err: any) {
    console.error("Export error:", err);
    res.status(500).json({ error: err.message || "Failed to export document." });
  }
};

exportRouter.post("/convert", handleExport);
exportRouter.post("/api/convert", handleExport);
exportRouter.post("/export", handleExport);
exportRouter.post("/api/export", handleExport);
