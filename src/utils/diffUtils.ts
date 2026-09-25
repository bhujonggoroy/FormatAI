/**
 * High-performance, zero-dependency Myers / LCS Diff Engine for FormatAI.
 * Computes line-level and word-level diffs between original and polished text.
 * If no changes exist, returns the localized status: "কোনো উন্নতি পাওয়া যায়নি".
 */

export interface WordDiffChunk {
  type: "added" | "removed" | "unchanged";
  text: string;
}

export interface DiffLine {
  type: "added" | "removed" | "unchanged";
  text: string;
  oldLineNumber?: number;
  newLineNumber?: number;
  wordDiffs?: WordDiffChunk[];
}

export interface DiffResult {
  hasChanges: boolean;
  message: string;
  lines: DiffLine[];
  stats: {
    added: number;
    removed: number;
    unchanged: number;
    totalOldLines: number;
    totalNewLines: number;
  };
}

export const NO_IMPROVEMENT_MESSAGE = "কোনো উন্নতি পাওয়া যায়নি";

/**
 * Computes Longest Common Subsequence table for array of tokens.
 */
function computeLcsTable<T>(a: T[], b: T[], equals: (x: T, y: T) => boolean = (x, y) => x === y): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (equals(a[i - 1], b[j - 1])) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp;
}

/**
 * Computes fine-grained word diff for changed text.
 */
export function computeWordDiff(oldText: string, newText: string): WordDiffChunk[] {
  if (oldText === newText) {
    return [{ type: "unchanged", text: oldText }];
  }

  // Tokenize by words, whitespace, and punctuation symbols
  const tokenize = (s: string): string[] => s.match(/[\w\d\u0980-\u09FF]+|[^\w\d\u0980-\u09FF\s]+|\s+/g) || [];
  const oldTokens = tokenize(oldText);
  const newTokens = tokenize(newText);

  if (oldTokens.length === 0 && newTokens.length === 0) {
    return [];
  }
  if (oldTokens.length === 0) {
    return [{ type: "added", text: newText }];
  }
  if (newTokens.length === 0) {
    return [{ type: "removed", text: oldText }];
  }

  // Cap token size for responsive rendering if very large
  if (oldTokens.length > 300 || newTokens.length > 300) {
    return [
      { type: "removed", text: oldText },
      { type: "added", text: newText },
    ];
  }

  const dp = computeLcsTable(oldTokens, newTokens);
  let i = oldTokens.length;
  let j = newTokens.length;
  const rawChunks: WordDiffChunk[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldTokens[i - 1] === newTokens[j - 1]) {
      rawChunks.push({ type: "unchanged", text: oldTokens[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawChunks.push({ type: "added", text: newTokens[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      rawChunks.push({ type: "removed", text: oldTokens[i - 1] });
      i--;
    }
  }

  rawChunks.reverse();

  // Merge consecutive chunks with the same type
  const merged: WordDiffChunk[] = [];
  for (const chunk of rawChunks) {
    if (merged.length > 0 && merged[merged.length - 1].type === chunk.type) {
      merged[merged.length - 1].text += chunk.text;
    } else {
      merged.push({ ...chunk });
    }
  }

  return merged;
}

/**
 * Computes structured line-by-line diff between two text documents.
 */
export function computeDocumentDiff(beforeText: string, afterText: string): DiffResult {
  const normBefore = (beforeText || "").replace(/\r\n/g, "\n");
  const normAfter = (afterText || "").replace(/\r\n/g, "\n");

  const beforeTrimmed = normBefore.trim();
  const afterTrimmed = normAfter.trim();

  // Check if text is identical (ignoring purely superficial whitespace at boundary)
  if (beforeTrimmed === afterTrimmed) {
    const lines = normBefore.split("\n").map((line, idx) => ({
      type: "unchanged" as const,
      text: line,
      oldLineNumber: idx + 1,
      newLineNumber: idx + 1,
    }));

    return {
      hasChanges: false,
      message: NO_IMPROVEMENT_MESSAGE,
      lines,
      stats: {
        added: 0,
        removed: 0,
        unchanged: lines.length,
        totalOldLines: lines.length,
        totalNewLines: lines.length,
      },
    };
  }

  const oldLines = normBefore.split("\n");
  const newLines = normAfter.split("\n");

  // Fast-path: if identical arrays
  if (oldLines.length === newLines.length && oldLines.every((l, i) => l === newLines[i])) {
    return {
      hasChanges: false,
      message: NO_IMPROVEMENT_MESSAGE,
      lines: oldLines.map((line, idx) => ({
        type: "unchanged",
        text: line,
        oldLineNumber: idx + 1,
        newLineNumber: idx + 1,
      })),
      stats: {
        added: 0,
        removed: 0,
        unchanged: oldLines.length,
        totalOldLines: oldLines.length,
        totalNewLines: newLines.length,
      },
    };
  }

  // Compute LCS on lines
  const dp = computeLcsTable(oldLines, newLines);
  let i = oldLines.length;
  let j = newLines.length;
  const rawDiff: Array<{ type: "added" | "removed" | "unchanged"; text: string; oldLine?: number; newLine?: number }> = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      rawDiff.push({
        type: "unchanged",
        text: oldLines[i - 1],
        oldLine: i,
        newLine: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawDiff.push({
        type: "added",
        text: newLines[j - 1],
        newLine: j,
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      rawDiff.push({
        type: "removed",
        text: oldLines[i - 1],
        oldLine: i,
      });
      i--;
    }
  }

  rawDiff.reverse();

  let addedCount = 0;
  let removedCount = 0;
  let unchangedCount = 0;

  const resultLines: DiffLine[] = rawDiff.map((item) => {
    if (item.type === "added") addedCount++;
    else if (item.type === "removed") removedCount++;
    else unchangedCount++;

    return {
      type: item.type,
      text: item.text,
      oldLineNumber: item.oldLine,
      newLineNumber: item.newLine,
    };
  });

  const hasChanges = addedCount > 0 || removedCount > 0;

  return {
    hasChanges,
    message: hasChanges ? `Polished with ${addedCount} additions and ${removedCount} revisions` : NO_IMPROVEMENT_MESSAGE,
    lines: resultLines,
    stats: {
      added: addedCount,
      removed: removedCount,
      unchanged: unchangedCount,
      totalOldLines: oldLines.length,
      totalNewLines: newLines.length,
    },
  };
}
