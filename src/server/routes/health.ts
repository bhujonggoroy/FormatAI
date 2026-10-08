import express from "express";
import path from "path";
import fs from "fs";

export const healthRouter = express.Router();

// PWA Manifest and Service Worker routes
healthRouter.get("/manifest.json", (_req, res) => {
  const manifestPath = path.join(process.cwd(), "public", "manifest.json");
  if (fs.existsSync(manifestPath)) {
    res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
    res.sendFile(manifestPath);
  } else {
    res.status(404).send("Manifest not found");
  }
});

healthRouter.get("/service-worker.js", (_req, res) => {
  const swPath = path.join(process.cwd(), "public", "service-worker.js");
  if (fs.existsSync(swPath)) {
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Service-Worker-Allowed", "/");
    res.sendFile(swPath);
  } else {
    res.status(404).send("Service Worker not found");
  }
});

// Health check endpoint
healthRouter.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    has_gemini_key: Boolean(process.env.GEMINI_API_KEY),
    service: "FormatAI",
  });
});

// Endpoint to fetch project files for inspector
healthRouter.get("/api/project-files", (_req, res) => {
  try {
    const readSafe = (fileName: string) => {
      const p = path.join(process.cwd(), fileName);
      return fs.existsSync(p) ? fs.readFileSync(p, "utf-8") : "";
    };

    res.json({
      "package.json": readSafe("package.json"),
      "README.md": readSafe("README.md"),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to read project files." });
  }
});
