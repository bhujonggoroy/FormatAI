/**
 * FormatAI regression guard.  Run:  npm test      (= tsx tests/regression.ts)
 * Locks in the invariants that keep PREVIEW == DOCX == PDF input.  Any future change that breaks
 * one of these must be fixed (not the test) unless the product rule itself intentionally changes.
 */
import fs from "node:fs";
import http from "node:http";
import JSZip from "jszip";
import { SAMPLE_NOTES } from "../src/data/samples.ts";
import { cleanClientSideNotebookLM } from "../src/utils/cleaner.ts";
import { wrapBareMathEnvironments } from "../src/utils/mathBlocks.ts";
import { skillRegistry } from "../src/skills/registry.ts";
import { buildDocxFromMarkdown } from "../src/server/docxService.ts";
import { createServerApp } from "../server.backend.ts";
import { assertSafeEndpoint } from "../src/server/ai/safeUrl.ts";
import { parseMarkdown, walk, plainText } from "../src/shared/markdown/ast.ts";

process.env.RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX || "20";
process.env.AI_TOOL_RATE_LIMIT_MAX = process.env.AI_TOOL_RATE_LIMIT_MAX || "5";
const MUTATE = process.env.REGRESSION_MUTATE === "1"; // proves the tests can fail (must NOT be used in CI)
let failures = 0;
const check = (ok: boolean, name: string, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? "  -> " + detail : ""}`);
};

// compare on lowercase letters+digits only, with math removed (math lives in OMML, text in <w:t>)
const stripMath = (s: string) => s.replace(/\$\$[\s\S]*?\$\$/g, " ").replace(/\$[^$\n]*\$/g, " ");
const decode = (s: string) => s.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const norm = (s: string) => decode(stripMath(s)).replace(/\\[a-zA-Z]+/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
async function docxText(buf: Buffer) {
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file("word/document.xml")!.async("string");
  const text = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(" ");
  const all = [...xml.matchAll(/<(?:w|m):t[^>]*>([^<]*)<\/(?:w|m):t>/g)].map((m) => m[1]).join(" ");
  return { xml, text, all };
}

const ids = skillRegistry.getEnabledSkillIds();
for (const s of SAMPLE_NOTES) {
  const tag = `[${s.id}]`;
  const preview = cleanClientSideNotebookLM(s.text, "auto", ids);

  check(!/\*{4,}/.test(preview), `${tag} preview has no stray ****`);
  check(wrapBareMathEnvironments(preview) === preview, `${tag} preview has no bare multi-line math environment`);

  const buf = await buildDocxFromMarkdown(preview, {
    title: s.title, fontFamily: "Times New Roman", accentColor: "1A365D",
    equationFormat: "native", enabledSkillIds: ids, skipPreprocess: !MUTATE,
  });
  check(buf.subarray(0, 2).toString() === "PK", `${tag} docx is a valid zip`);
  const { xml, text, all } = await docxText(buf);
  const docPlain = norm(text); // w:t only: math lives in OMML (m:t) and is checked separately

  const headings = preview.split("\n").filter((l) => /^#{1,3}\s/.test(l)).map((l) => norm(l.replace(/^#+\s*/, "")));
  const missing = headings.filter((h) => h.length > 3 && !docPlain.includes(h.slice(0, 20)));
  check(missing.length === 0, `${tag} every preview heading is in the docx`, missing.slice(0, 2).join(" | "));

  const lastLine = norm([...preview.split("\n")].reverse().find((l) => norm(l).length > 12) || "");
  check(lastLine === "" || docPlain.includes(lastLine.slice(0, 20)), `${tag} docx is not truncated (last preview line present)`, lastLine.slice(0, 40));

  if (/\\begin\{(b|p|v)?matrix\}/.test(preview)) check(xml.includes("<m:m>"), `${tag} matrices are real Word matrices`);
  check(!/\*{3,}|\\begin\{|\$\$/.test(text), `${tag} no raw markup leaked into docx text`);

  // Shared markdown AST regression verification
  let ast: any = null;
  let parseThrew = false;
  try {
    ast = parseMarkdown(cleanClientSideNotebookLM(s));
  } catch {
    parseThrew = true;
  }
  check(!parseThrew && !!ast, `${tag} parseMarkdown(cleanClientSideNotebookLM(sample)) does not throw`);

  let astHeadings = 0;
  let inlineFromDoubleDollar = 0;
  if (ast) {
    walk(ast, (node) => {
      if (node.type === "heading") astHeadings++;
      if (node.type === "inlineMath" && (node as any).position) {
        const pos = (node as any).position;
        const raw = preview.slice(pos.start.offset, pos.end.offset).trim();
        if (raw.startsWith("$$") && raw.endsWith("$$")) {
          inlineFromDoubleDollar++;
        }
      }
    });
  }

  const headingLines = preview.split("\n").filter((l) => l.trim().startsWith("#")).length;
  check(inlineFromDoubleDollar === 0, `${tag} contains no inlineMath whose value came from a $$ line`);
  check(astHeadings === headingLines, `${tag} heading count (${astHeadings}) equals lines starting with # (${headingLines})`);
}

// Negative controls: the detectors above must actually flag the exact defects this project used to have.
const badPreview = "**(a)** Given:\nA = \\begin{bmatrix}\n2 & 1 \\\\ 3 & 4\n\\end{bmatrix}\n\n****Repeated Question:** ** Identical to 2021 Q1\n";
check(/\*{4,}/.test(badPreview), "control: stray **** detector fires on known-bad text");
check(wrapBareMathEnvironments(badPreview) !== badPreview, "control: bare-math-environment detector fires on known-bad text");
check(/\$\$A = \\begin\{bmatrix\} 2 & 1 \\\\ 3 & 4 \\end\{bmatrix\}\$\$/.test(wrapBareMathEnvironments(badPreview)), "control: wrapper repairs the known-bad matrix into one $$ block");

// End-to-end through the real HTTP route: the markdown the client sends must come back unmodified in the docx.
const server = http.createServer(createServerApp());
await new Promise<void>((r) => server.listen(0, r));
const port = (server.address() as any).port;
const md = "## Section\n\n**(a)** Given:\n\n$$A = \\begin{bmatrix} 1 & 2 \\\\ 3 & 4 \\end{bmatrix}$$\n\n**Repeated Question:** Identical to 2021 Q1.\n\nFinal sentence here.\n";
const res = await fetch(`http://127.0.0.1:${port}/api/export?format=docx`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text: "raw", cleanedMarkdown: md, title: "t" }),
});
const out = Buffer.from(await res.arrayBuffer());
const e2e = res.ok ? await docxText(out) : { xml: "", text: "", all: "" };
check(res.status === 200, "e2e /api/export returns 200", String(res.status));
check(e2e.xml.includes("<m:m>") && /final sentence here/i.test(e2e.text), "e2e export keeps preview markdown intact (matrix + last line)");
check(!/\*{2}Repeated|\*{3,}/.test(e2e.text), "e2e export has no stray ** markers");

// SSRF assertSafeEndpoint checks
const throwsSafeEndpoint = (url: string): boolean => {
  try {
    assertSafeEndpoint(url);
    return false;
  } catch {
    return true;
  }
};
check(throwsSafeEndpoint("http://169.254.169.254/"), "assertSafeEndpoint rejects http://169.254.169.254/");
check(throwsSafeEndpoint("https://metadata.google.internal/"), "assertSafeEndpoint rejects https://metadata.google.internal/");
check(throwsSafeEndpoint("http://localhost:11434"), "assertSafeEndpoint rejects http://localhost:11434");
check(throwsSafeEndpoint("https://10.0.0.5/"), "assertSafeEndpoint rejects https://10.0.0.5/");
check(!throwsSafeEndpoint("https://api.openai.com/v1"), "assertSafeEndpoint accepts https://api.openai.com/v1");

// Rate limiting check: 40 rapid POSTs to /api/export must end with a 429
let hit429 = false;
let last429Msg = "";
for (let i = 0; i < 40; i++) {
  const r = await fetch(`http://127.0.0.1:${port}/api/export?format=docx`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "test", cleanedMarkdown: md, title: "t" }),
  });
  if (r.status === 429) {
    hit429 = true;
    const body = (await r.json().catch(() => ({}))) as any;
    last429Msg = body?.error || "";
    break;
  }
}
check(hit429, "40 rapid POSTs to /api/export end with a 429");
check(last429Msg === "Too many requests. Please try again later.", "rate limit 429 message matches expectation");

// Check that model-test burst does not block document routes
let lastTestStatus = 0;
for (let i = 0; i < 8; i++) {
  const r = await fetch(`http://127.0.0.1:${port}/api/ai/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ providerId: "formatai" }),
  });
  lastTestStatus = r.status;
}
const cleanRes = await fetch(`http://127.0.0.1:${port}/api/preview-clean`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text: "hello" }),
});
check(
  lastTestStatus === 429 && cleanRes.status !== 429,
  "model-test burst does not block document routes"
);

// Route table snapshot verification
function extractRoutes(app: any): string[] {
  const routes: string[] = [];
  function walk(stack: any[], prefix = "") {
    for (const layer of stack) {
      if (layer.route) {
        const routePath = (prefix + layer.route.path).replace(/\/+/g, "/");
        for (const method of Object.keys(layer.route.methods)) {
          routes.push(`${method.toUpperCase()} ${routePath}`);
        }
      } else if (layer.name === "router" && layer.handle?.stack) {
        let p = prefix;
        if (layer.regexp && !layer.regexp.fast_slash) {
          const match = layer.regexp.source
            .replace("^\\/", "/")
            .replace("\\/?(?=\\/|$)", "")
            .replace(/\\\//g, "/")
            .replace(/\^/g, "")
            .replace(/\$$/g, "");
          p = (prefix + match).replace(/\/+/g, "/");
        }
        walk(layer.handle.stack, p);
      }
    }
  }
  if (app?._router?.stack) {
    walk(app._router.stack);
  }
  return Array.from(new Set(routes)).sort();
}

const expectedRoutesRaw = fs.readFileSync("tests/routes.snapshot.json", "utf-8");
const expectedRoutes: string[] = JSON.parse(expectedRoutesRaw);
const actualRoutes = extractRoutes(createServerApp());
const addedRoutes = actualRoutes.filter((r) => !expectedRoutes.includes(r));
const removedRoutes = expectedRoutes.filter((r) => !actualRoutes.includes(r));
check(
  addedRoutes.length === 0 && removedRoutes.length === 0,
  "route table matches tests/routes.snapshot.json",
  addedRoutes.length > 0 || removedRoutes.length > 0
    ? `Added: [${addedRoutes.join(", ")}], Removed: [${removedRoutes.join(", ")}]`
    : ""
);

server.close();

console.log(failures === 0 ? "\nALL REGRESSION CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
