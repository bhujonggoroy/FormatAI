import type express from "express";
import rateLimit from "express-rate-limit";

/**
 * Rate limiting, split into SEPARATE groups. Each group has its OWN counter.
 * (Bug fixed: one shared limiter let the "test all models" tool — which calls /api/ai/test once per
 *  model — use up the whole budget, so clean / polish / repair / export all returned 429 for 10 minutes.)
 */

// Settings / model-testing tools: legitimately bursty (one request per model per provider).
export const AI_TOOL_PATHS = ["/api/ai/test", "/api/ai/test-all", "/api/ai/models", "/api/ai/providers/:id/test"];
// Document work: clean, polish and repair call paid AI providers.
export const AI_WORK_PATHS = ["/api/polish", "/api/preview-clean", "/api/repair-block", "/api/repair-fragment"];
// Exports: CPU work only, no AI cost.
export const EXPORT_PATHS = ["/api/export", "/api/convert", "/convert", "/export"];

const num = (v: string | undefined, d: number) => {
  const n = parseInt(v || "", 10);
  return Number.isFinite(n) && n > 0 ? n : d;
};

function makeLimiter(max: number, windowMs: number, message: string) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    statusCode: 429,
    message: { error: message },
  });
}

export function applyRateLimiting(app: express.Express) {
  const windowMs = num(process.env.RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000);
  // RATE_LIMIT_MAX keeps its old meaning for the AI document-work group (also used by tests).
  const work = makeLimiter(num(process.env.RATE_LIMIT_MAX, 60), windowMs, "Too many requests. Please try again later.");
  const exp = makeLimiter(num(process.env.EXPORT_RATE_LIMIT_MAX, num(process.env.RATE_LIMIT_MAX, 60)), windowMs, "Too many requests. Please try again later.");
  const tools = makeLimiter(num(process.env.AI_TOOL_RATE_LIMIT_MAX, 300), windowMs, "Too many model tests. Please wait a few minutes and try again.");

  AI_TOOL_PATHS.forEach((p) => app.use(p, tools));
  AI_WORK_PATHS.forEach((p) => app.use(p, work));
  EXPORT_PATHS.forEach((p) => app.use(p, exp));
}

// Central error handling middleware: JSON 413 for oversized payloads, JSON 500 without stack traces
export function centralErrorHandler(
  err: any,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction
) {
  if (err?.status === 413 || err?.type === "entity.too.large") {
    return res.status(413).json({ error: "Payload too large. Request body exceeds limit of 10MB." });
  }
  const statusCode =
    typeof err?.statusCode === "number" ? err.statusCode : typeof err?.status === "number" ? err.status : 500;
  const message = statusCode >= 500 ? "Internal server error" : err?.message || "An unexpected error occurred";
  return res.status(statusCode).json({ error: message });
}
