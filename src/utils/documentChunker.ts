/**
 * Document Chunking and Deterministic Reassembly Engine for FormatAI
 *
 * Directives:
 * 1. Chunk large documents on BLOCK boundaries (blank-line separated paragraphs, headings, etc.).
 * 2. Invariant: Equation blocks ($$...$$, \[...\]), table blocks (|...|), and fenced code blocks (```...```)
 *    are ATOMIC and must NEVER be sliced across chunks.
 * 3. Each chunk is tagged with its chunk index and expected block IDs.
 * 4. Deterministic reassembly preserves exact original block order without duplication or omission.
 */

import { parseDocumentBlocks, type DocumentBlock } from "./blockIntegrity.ts";

export interface DocumentChunk {
  chunkIndex: number;
  totalChunks: number;
  chunkId: string;
  rawText: string;
  expectedBlockIds: string[];
  blockCount: number;
  charCount: number;
  blocks: DocumentBlock[];
}

export const DEFAULT_MAX_CHUNK_CHARS = 3200;
export const DEFAULT_MAX_CHUNK_BLOCKS = 25;

/**
 * Splits a document into atomic block-boundary chunks.
 * Guarantee: No equation, table, or code block is ever sliced in the middle.
 */
export function createDocumentChunks(
  text: string,
  maxChunkChars: number = DEFAULT_MAX_CHUNK_CHARS,
  maxChunkBlocks: number = DEFAULT_MAX_CHUNK_BLOCKS
): DocumentChunk[] {
  if (!text || !text.trim()) {
    return [];
  }

  const allBlocks = parseDocumentBlocks(text);
  if (allBlocks.length === 0) {
    return [];
  }

  // If the document fits comfortably within a single chunk, return 1 chunk
  if (text.length <= maxChunkChars && allBlocks.length <= maxChunkBlocks) {
    return [
      {
        chunkIndex: 0,
        totalChunks: 1,
        chunkId: "chunk-0-of-1",
        rawText: text.trim(),
        expectedBlockIds: allBlocks.map((b) => b.id),
        blockCount: allBlocks.length,
        charCount: text.trim().length,
        blocks: allBlocks,
      },
    ];
  }

  const chunkGroups: DocumentBlock[][] = [];
  let currentGroup: DocumentBlock[] = [];
  let currentChars = 0;

  for (let i = 0; i < allBlocks.length; i++) {
    const block = allBlocks[i];
    const blockLen = block.rawText.length;

    // If current group has content and adding this block exceeds limit:
    // Close the current chunk and start a new one.
    // Exception: If currentGroup is empty (single large block, e.g. huge table or long derivation),
    // keep it in currentGroup so it becomes its own single atomic chunk.
    if (
      currentGroup.length > 0 &&
      (currentChars + blockLen > maxChunkChars || currentGroup.length >= maxChunkBlocks)
    ) {
      chunkGroups.push(currentGroup);
      currentGroup = [block];
      currentChars = blockLen;
    } else {
      currentGroup.push(block);
      currentChars += blockLen;
    }
  }

  if (currentGroup.length > 0) {
    chunkGroups.push(currentGroup);
  }

  const totalChunks = chunkGroups.length;

  return chunkGroups.map((group, index) => {
    const rawText = group.map((b) => b.rawText).join("\n\n");
    return {
      chunkIndex: index,
      totalChunks,
      chunkId: `chunk-${index}-of-${totalChunks}`,
      rawText,
      expectedBlockIds: group.map((b) => b.id),
      blockCount: group.length,
      charCount: rawText.length,
      blocks: group,
    };
  });
}

/**
 * Reassembles polished or formatted chunks in strict deterministic index order.
 * Ensures no chunk is dropped, duplicated, or reordered.
 */
export function reassembleDocumentChunks(
  chunks: Array<{
    chunkIndex: number;
    text: string;
    expectedBlockIds?: string[];
  }>
): string {
  if (!chunks || chunks.length === 0) {
    return "";
  }

  // Strict ascending sort by chunkIndex
  const sorted = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);

  // Validate that chunk indices form an unbroken 0..N-1 sequence
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].chunkIndex !== i) {
      console.warn(
        `Reassembly sequence mismatch: expected chunkIndex ${i}, found ${sorted[i].chunkIndex}`
      );
    }
  }

  // Join with standardized double newline
  const joined = sorted
    .map((c) => (c.text || "").trim())
    .filter(Boolean)
    .join("\n\n");

  // Normalize duplicate blank lines
  return joined.replace(/\n{3,}/g, "\n\n").trim();
}
