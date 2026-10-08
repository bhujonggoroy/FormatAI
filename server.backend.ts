import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import http from "node:http";
import express from "express";
import helmet from "helmet";
import path from "path";
import fs from "fs";
import compression from "compression";
import { applyRateLimiting, centralErrorHandler } from "./src/server/middleware/rateLimit.ts";
import { healthRouter } from "./src/server/routes/health.ts";
import { aiConfigRouter } from "./src/server/routes/aiConfig.ts";
import { skillsRouter } from "./src/server/routes/skills.ts";
import { cleanRouter } from "./src/server/routes/clean.ts";
import { polishRouter } from "./src/server/routes/polish.ts";
import { repairRouter } from "./src/server/routes/repair.ts";
import { exportRouter } from "./src/server/routes/export.ts";
export function getTargetPort(): number {
  const portArgIdx = process.argv.indexOf("--port");
  if (portArgIdx !== -1 && process.argv[portArgIdx + 1]) {
    const val = Number(process.argv[portArgIdx + 1]);
    if (!isNaN(val) && val > 0) return val;
  }
  if (process.env.DEFAULT_APP_PORT) {
    const val = Number(process.env.DEFAULT_APP_PORT);
    if (!isNaN(val) && val > 0) return val;
  }
  if (process.env.NGINX_PORT && String(process.env.PORT) === String(process.env.NGINX_PORT)) return 3000;
  if (process.env.PORT && process.env.PORT !== "8080") {
    const val = Number(process.env.PORT);
    if (!isNaN(val) && val > 0) return val;
  }
  return 3000;
}

const PORT = getTargetPort();

export function createServerApp(): express.Express {
  const app = express();
  app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"], scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"], fontSrc: ["'self'", "data:"],
          imgSrc: ["'self'", "data:", "blob:", "https:"], connectSrc: ["'self'", "https:", "http:"],
          mediaSrc: ["'self'", "data:", "blob:"], objectSrc: ["'none'"], frameAncestors: ["'self'", "*"],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      frameguard: false,
    })
  );

  // Compress text/JSON/HTML/JS/CSS, skipping already-compressed binary payloads (docx, pdf, zip)
  app.use(
    compression({
      filter: (req, res) => {
        if (req.headers["x-no-compression"]) return false;
        const contentType = res.getHeader("Content-Type") || "";
        const ctStr = String(contentType).toLowerCase();
        if (
          ctStr.includes("application/vnd.openxmlformats-officedocument") ||
          ctStr.includes("application/pdf") ||
          ctStr.includes("application/zip") ||
          ctStr.includes("image/") ||
          ctStr.includes("font/")
        ) {
          return false;
        }
        return compression.filter(req, res);
      },
    })
  );

  // Requirement 6: every /api route -> Cache-Control: no-store
  app.use((req, res, next) => {
    if (req.path.startsWith("/api") || req.path === "/export" || req.path === "/convert") {
      res.setHeader("Cache-Control", "no-store");
    }
    next();
  });

  applyRateLimiting(app);
  app.use(express.json({ limit: "10mb" }));

  app.use(healthRouter);
  app.use(aiConfigRouter);
  app.use(skillsRouter);
  app.use(cleanRouter);
  app.use(polishRouter);
  app.use(repairRouter);
  app.use(exportRouter);
  app.use(centralErrorHandler);
  return app;
}

export const app = createServerApp();
let isServerListening = false;
let activeHttpServer: http.Server | null = null;

export async function startStandaloneServer() {
  if (isServerListening && activeHttpServer) return activeHttpServer;
  isServerListening = true;
  const httpServer = http.createServer(app);
  activeHttpServer = httpServer;

  const distPath = path.join(process.cwd(), "dist");
  const hasDist = fs.existsSync(distPath) && fs.existsSync(path.join(distPath, "index.html"));
  const isProduction = process.env.NODE_ENV === "production" || hasDist;

  const serveStaticWithHeaders = (rootPath: string) => {
    app.use(
      "/assets",
      express.static(path.join(rootPath, "assets"), {
        maxAge: "1y",
        immutable: true,
        setHeaders: (res) => {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        },
      })
    );
    app.use(
      express.static(rootPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith("index.html")) {
            res.setHeader("Cache-Control", "no-cache");
          }
        },
      })
    );
    app.get("*", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(rootPath, "index.html"));
    });
  };

  if (isProduction && hasDist) {
    serveStaticWithHeaders(distPath);
  } else {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({ server: { middlewareMode: true, ws: { server: httpServer } }, appType: "spa" });
      app.use(vite.middlewares);
    } catch (viteErr) {
      console.warn("Vite middleware unavailable, serving dist fallback:", viteErr);
      if (fs.existsSync(distPath)) {
        serveStaticWithHeaders(distPath);
      }
    }
  }

  httpServer.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`[FormatAI Server] Port ${PORT} is already in use. Server instance already running.`);
    } else {
      console.error("[FormatAI Server] HTTP server error:", err);
    }
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`FormatAI Server running on http://0.0.0.0:${PORT}`);
  });
  return httpServer;
}

if (!process.env.VERCEL) {
  startStandaloneServer().catch((err) => console.error("Failed to start server:", err));
}

export default app;
