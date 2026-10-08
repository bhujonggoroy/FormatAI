/**
 * Wraps bare multi-line LaTeX environments (matrix, cases, aligned, ...) in $$ ... $$
 * so that preview, DOCX, PDF and LaTeX export all treat them as one display equation.
 * Idempotent: text already inside $$ ... $$ or code fences is left untouched.
 */
const ENV = "pmatrix|bmatrix|vmatrix|Vmatrix|matrix|cases|aligned|align\\*?|array";

export function wrapBareMathEnvironments(text: string): string {
  if (!text || !text.includes("\\begin{")) return text;
  const lines = text.split("\n");
  const out: string[] = [];
  let inFence = false;
  let inDollar = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();

    if (t.startsWith("```")) { inFence = !inFence; out.push(line); continue; }
    if (inFence) { out.push(line); continue; }

    const dollarCount = (t.match(/\$\$/g) || []).length;
    if (inDollar) {
      if (dollarCount > 0) inDollar = false;
      out.push(line);
      continue;
    }
    if (dollarCount === 1) { inDollar = true; out.push(line); continue; }
    if (dollarCount >= 2 || t.includes("$")) { out.push(line); continue; }

    const m = line.match(new RegExp("^(.*?)\\\\begin\\{(" + ENV + ")\\}(.*)$"));
    if (!m) { out.push(line); continue; }
    const prefix = m[1];
    const env = m[2];
    const endRe = new RegExp("\\\\end\\{" + env.replace("*", "\\*") + "\\}");

    let body = "\\begin{" + env + "}" + m[3];
    let j = i;
    let closed = endRe.test(body);
    while (!closed && j + 1 < lines.length) {
      j++;
      if (lines[j].trim().startsWith("```") || lines[j].includes("$$")) break;
      body += " " + lines[j].trim();
      closed = endRe.test(lines[j]);
    }
    if (!closed) { out.push(line); continue; }

    const endMatch = body.match(new RegExp("^(.*?\\\\end\\{" + env.replace("*", "\\*") + "\\})(.*)$"));
    const mathPart = (endMatch ? endMatch[1] : body).replace(/\s+/g, " ").trim();
    const tail = endMatch ? endMatch[2].trim() : "";

    // short "A =" style left-hand side stays inside the equation
    const lhsOk = /^\s*[A-Za-z\\][A-Za-z0-9_{}\\^' ()]{0,24}=\s*$/.test(prefix);
    if (prefix.trim() && !lhsOk) out.push(prefix.trimEnd());
    out.push("$$" + (lhsOk ? prefix.trim() + " " : "") + mathPart + "$$");
    if (tail) out.push(tail);
    i = j;
  }
  return out.join("\n");
}
