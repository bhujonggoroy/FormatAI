import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const distServer = path.join(process.cwd(), "dist", "server.cjs");
const hasDist = fs.existsSync(distServer);
const isProduction = hasDist && process.env.NODE_ENV !== "development";

if (isProduction) {
  // Production runtime (Cloud Run / container deployment)
  await import(pathToFileURL(distServer).href);
} else {
  // Development runtime or direct tsx execution
  await import("./server.backend.ts");
}

export {};
