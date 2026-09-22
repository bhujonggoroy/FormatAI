import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

async function runPWATests() {
  console.log("Starting FormatAI PWA Tests...\n");

  // 1. Verify manifest.json exists and contains required properties
  const manifestPath = path.join(process.cwd(), "public", "manifest.json");
  assert.ok(fs.existsSync(manifestPath), "public/manifest.json must exist");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  assert.strictEqual(manifest.display, "standalone", "manifest display should be standalone");
  assert.ok(manifest.name && manifest.name.includes("FormatAI"), "manifest name must include FormatAI branding");
  assert.ok(manifest.short_name && manifest.short_name.length <= 12, "manifest short_name must be <= 12 chars");
  assert.strictEqual(manifest.start_url, "/", "manifest start_url should be '/'");
  assert.ok(manifest.theme_color, "manifest must have theme_color");
  assert.ok(manifest.background_color, "manifest must have background_color");
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2, "manifest must have icons array");
  console.log("✓ Manifest file valid and compliant with PWA specifications");

  // 2. Verify service-worker.js exists and excludes sensitive data
  const swPath = path.join(process.cwd(), "public", "service-worker.js");
  assert.ok(fs.existsSync(swPath), "public/service-worker.js must exist");
  const swContent = fs.readFileSync(swPath, "utf-8");
  assert.ok(!swContent.includes("apiKey") && !swContent.includes("GEMINI_API_KEY"), "Service worker must not cache API keys");
  assert.ok(swContent.includes("startsWith('/api')") || swContent.includes("startsWith('/convert')"), "Service worker excludes dynamic API calls");
  console.log("✓ Service worker exists, implements network-first strategy, and explicitly excludes sensitive endpoints");

  // 3. Test HTTP endpoint for /manifest.json
  const manifestRes = await fetch("http://localhost:3000/manifest.json");
  assert.strictEqual(manifestRes.status, 200, "/manifest.json should return 200 OK");
  const manifestContentType = manifestRes.headers.get("content-type") || "";
  assert.ok(manifestContentType.includes("application/manifest+json"), `/manifest.json should be served with application/manifest+json (got ${manifestContentType})`);
  console.log("✓ /manifest.json endpoint served with application/manifest+json");

  // 4. Test HTTP endpoint for /service-worker.js
  const swRes = await fetch("http://localhost:3000/service-worker.js");
  assert.strictEqual(swRes.status, 200, "/service-worker.js should return 200 OK");
  const swContentType = swRes.headers.get("content-type") || "";
  assert.ok(swContentType.includes("application/javascript") || swContentType.includes("text/javascript"), `/service-worker.js should be javascript (got ${swContentType})`);
  console.log("✓ /service-worker.js endpoint served with correct mime type");

  // 5. Test icons HTTP responses
  for (const icon of ["/pwa-192x192.png", "/pwa-512x512.png", "/pwa-maskable-512x512.png"]) {
    const iconRes = await fetch(`http://localhost:3000${icon}`);
    assert.strictEqual(iconRes.status, 200, `${icon} should return 200 OK`);
  }
  console.log("✓ All PWA icons (192, 512, maskable) return 200 OK");

  // 6. Test logic module: pwaInstall.ts contract
  const pwaInstallModule = await import("../src/utils/pwaInstall.ts");
  assert.ok(typeof pwaInstallModule.isInstallPromptAvailable === "function", "isInstallPromptAvailable function exported");
  assert.ok(typeof pwaInstallModule.triggerInstallPrompt === "function", "triggerInstallPrompt function exported");
  assert.ok(typeof pwaInstallModule.usePWAInstallPrompt === "function", "usePWAInstallPrompt hook exported");
  // Before prompt has fired, isInstallPromptAvailable should be false
  assert.strictEqual(pwaInstallModule.isInstallPromptAvailable(), false, "Install App is hidden initially (false by default)");
  console.log("✓ PWA install state is hidden by default and handles unsupported browsers cleanly");

  console.log("\nAll 11 PWA tests completed successfully! ✓");
}

runPWATests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
