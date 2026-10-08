import {
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  convertInchesToTwip,
  ShadingType,
  AlignmentType,
  Math as DocxMath,
  Document,
  Packer,
} from "docx";
import { parseMarkdown, plainText, type Root, type Node } from "../../shared/markdown/ast.ts";
import {
  parseLatexToDocxMath,
  cleanMathSymbols,
  type DocxOptions,
  parseInlineRunsAndMath,
  sanitizeMathToUnicode,
} from "../docxService.ts";
import { getActiveDocxOptions, executeSkillPipeline } from "../../skills/pipeline.ts";
import { cleanNotebookLMTreeArtifacts, standardizeMathToLatex } from "../../utils/mathNormalize.ts";
import { wrapBareMathEnvironments } from "../../utils/mathBlocks.ts";

export interface AstDocxContext {
  font: string;
  primaryAccent: string;
  secondaryAccent: string;
  bodyColor: string;
  equationFormat: "native" | "latex" | "unicode";
  isBooktabs: boolean;
}

interface StyleState {
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
  sizePt: number;
  color: string;
}

const HEADING_CONFIGS: Record<number, { level: (typeof HeadingLevel)[keyof typeof HeadingLevel]; spacing: { before: number; after: number }; sizePt: number; colorKey: "primary" | "secondary" | "dark" | "muted" }> = {
  1: { level: HeadingLevel.HEADING_1, spacing: { before: 360, after: 140 }, sizePt: 19, colorKey: "primary" },
  2: { level: HeadingLevel.HEADING_2, spacing: { before: 280, after: 100 }, sizePt: 14, colorKey: "secondary" },
  3: { level: HeadingLevel.HEADING_3, spacing: { before: 220, after: 80 }, sizePt: 12, colorKey: "dark" },
  4: { level: HeadingLevel.HEADING_4, spacing: { before: 180, after: 60 }, sizePt: 11.5, colorKey: "dark" },
  5: { level: HeadingLevel.HEADING_5, spacing: { before: 140, after: 50 }, sizePt: 11, colorKey: "muted" },
  6: { level: HeadingLevel.HEADING_6, spacing: { before: 120, after: 40 }, sizePt: 10.5, colorKey: "muted" },
};

function resolveColor(key: "primary" | "secondary" | "dark" | "muted", ctx: AstDocxContext): string {
  switch (key) {
    case "primary": return ctx.primaryAccent;
    case "secondary": return ctx.secondaryAccent;
    case "dark": return "334155";
    case "muted": return "64748B";
  }
}

/**
 * Transforms inline phrasing AST nodes (text, strong, emphasis, inlineMath, inlineCode, link, etc.)
 * into native Word TextRun and DocxMath elements.
 */
function renderPhrasingNode(
  node: Node,
  ctx: AstDocxContext,
  style: StyleState
): (TextRun | DocxMath)[] {
  if (!node) return [];

  switch (node.type) {
    case "text": {
      const rawText = (node as any).value ?? "";
      if (!rawText) return [];
      return parseInlineRunsAndMath(
        rawText,
        ctx.font,
        style.sizePt,
        style.color,
        ctx.equationFormat,
        { bold: style.bold, italics: style.italics }
      );
    }

    case "inlineMath": {
      const mathExpr = ((node as any).value ?? "").trim();
      if (!mathExpr) return [];

      if (ctx.equationFormat === "native") {
        try {
          return [parseLatexToDocxMath(mathExpr)];
        } catch {
          return [
            new TextRun({
              text: cleanMathSymbols(mathExpr),
              font: "Cambria Math",
              size: style.sizePt * 2,
              color: "1A365D",
              bold: style.bold,
              italics: style.italics,
            }),
          ];
        }
      } else if (ctx.equationFormat === "latex") {
        return [
          new TextRun({
            text: `$${mathExpr}$`,
            font: "Cambria Math",
            size: style.sizePt * 2,
            color: "1A365D",
            bold: style.bold,
            italics: style.italics,
          }),
        ];
      } else {
        return [
          new TextRun({
            text: sanitizeMathToUnicode(mathExpr),
            font: "Cambria Math",
            size: style.sizePt * 2,
            color: "1A365D",
            bold: style.bold,
            italics: style.italics,
          }),
        ];
      }
    }

    case "inlineCode": {
      const code = (node as any).value ?? "";
      return [
        new TextRun({
          text: code,
          font: "Consolas",
          size: Math.max(8, style.sizePt - 1) * 2,
          color: "C53030",
        }),
      ];
    }

    case "strong": {
      const children = (node as any).children || [];
      return children.flatMap((child: Node) =>
        renderPhrasingNode(child, ctx, { ...style, bold: true })
      );
    }

    case "emphasis": {
      const children = (node as any).children || [];
      return children.flatMap((child: Node) =>
        renderPhrasingNode(child, ctx, { ...style, italics: true })
      );
    }

    case "delete": {
      const children = (node as any).children || [];
      return children.flatMap((child: Node) =>
        renderPhrasingNode(child, ctx, { ...style, strike: true })
      );
    }

    case "link": {
      const children = (node as any).children || [];
      return children.flatMap((child: Node) =>
        renderPhrasingNode(child, ctx, { ...style, color: ctx.primaryAccent })
      );
    }

    case "break": {
      return [new TextRun({ break: 1 })];
    }

    case "html": {
      const val = (node as any).value ?? "";
      return [
        new TextRun({
          text: val,
          font: ctx.font,
          size: style.sizePt * 2,
          color: style.color,
          bold: style.bold,
          italics: style.italics,
        }),
      ];
    }

    default: {
      if ("children" in node && Array.isArray((node as any).children)) {
        return (node as any).children.flatMap((c: Node) =>
          renderPhrasingNode(c, ctx, style)
        );
      }
      if ("value" in node && typeof (node as any).value === "string") {
        return [
          new TextRun({
            text: (node as any).value,
            font: ctx.font,
            size: style.sizePt * 2,
            color: style.color,
            bold: style.bold,
            italics: style.italics,
          }),
        ];
      }
      return [];
    }
  }
}

function renderPhrasingList(
  nodes: Node[],
  ctx: AstDocxContext,
  style: StyleState
): (TextRun | DocxMath)[] {
  const result: (TextRun | DocxMath)[] = [];
  for (const n of nodes) {
    result.push(...renderPhrasingNode(n, ctx, style));
  }
  return result.length > 0
    ? result
    : [new TextRun({ text: "", font: ctx.font, size: style.sizePt * 2, color: style.color })];
}

/**
 * Renders a block `math` node into a centered Office Math paragraph.
 */
function renderBlockMath(mathExpr: string): Paragraph {
  let expr = mathExpr.trim();
  expr = expr.replace(/(?:\\)+(?:quad|qquad|,|;|!)\s*$/g, "").trim();
  const mathObj = parseLatexToDocxMath(expr);
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 80, line: 240 },
    children: [mathObj],
  });
}

/**
 * Renders a fenced code block into a styled 1-cell Word table matching legacy docxService.
 */
function renderFencedCode(code: string, ctx: AstDocxContext): (Paragraph | Table)[] {
  const codeTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
      left: { style: BorderStyle.SINGLE, size: 14, color: ctx.primaryAccent },
      right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: {
              type: ShadingType.CLEAR,
              fill: "F8FAFC",
            },
            margins: {
              top: convertInchesToTwip(0.1),
              bottom: convertInchesToTwip(0.1),
              left: convertInchesToTwip(0.15),
              right: convertInchesToTwip(0.15),
            },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: code,
                    font: "Consolas",
                    size: 19,
                    color: "1E293B",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  return [codeTable, new Paragraph({ spacing: { after: 120 } })];
}

/**
 * Renders a GFM table into a styled Word table.
 */
function renderGfmTable(tableNode: any, ctx: AstDocxContext): (Paragraph | Table)[] {
  const rows = tableNode.children || [];
  if (rows.length === 0) return [];

  const aligns = tableNode.align || [];

  const docxRows: TableRow[] = rows.map((rowNode: any, rowIdx: number) => {
    const isHeader = rowIdx === 0;
    const cells = rowNode.children || [];

    return new TableRow({
      children: cells.map((cellNode: any, colIdx: number) => {
        const cellPlainText = plainText(cellNode);
        const colAlign = aligns[colIdx];
        const isNumeric =
          /^[\d.,\s/%+-]+$/.test(cellPlainText) ||
          /^(?:Variable|Income|Expenditure|Speed|GPA|Hour|ID|Year|x\d*|y\d*|Height|Weight|Age)$/i.test(cellPlainText);

        const alignment =
          colAlign === "center"
            ? AlignmentType.CENTER
            : colAlign === "right"
              ? AlignmentType.RIGHT
              : colAlign === "left"
                ? AlignmentType.LEFT
                : isNumeric
                  ? AlignmentType.CENTER
                  : AlignmentType.LEFT;

        const cellRuns = renderPhrasingList(cellNode.children || [], ctx, {
          sizePt: isHeader ? 10.5 : 10,
          color: isHeader ? "0F172A" : "1E293B",
          bold: isHeader,
        });

        return new TableCell({
          shading: isHeader
            ? {
                type: ShadingType.CLEAR,
                fill: ctx.isBooktabs ? "F8FAFC" : "F1F5F9",
              }
            : undefined,
          borders: ctx.isBooktabs
            ? {
                top: { style: BorderStyle.NONE },
                bottom: isHeader
                  ? { style: BorderStyle.SINGLE, size: 6, color: "000000" }
                  : { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              }
            : {
                top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
                left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
                right: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
              },
          margins: {
            top: convertInchesToTwip(0.06),
            bottom: convertInchesToTwip(0.06),
            left: convertInchesToTwip(0.08),
            right: convertInchesToTwip(0.08),
          },
          children: [
            new Paragraph({
              alignment,
              spacing: { before: 20, after: 20, line: 240 },
              children: cellRuns,
            }),
          ],
        });
      }),
    });
  });

  const docxTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.CENTER,
    borders: ctx.isBooktabs
      ? {
          top: { style: BorderStyle.SINGLE, size: 12, color: "000000" },
          bottom: { style: BorderStyle.SINGLE, size: 12, color: "000000" },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
          insideHorizontal: { style: BorderStyle.NONE },
          insideVertical: { style: BorderStyle.NONE },
        }
      : {
          top: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
          bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
          left: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
          right: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
          insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
        },
    rows: docxRows,
  });

  return [docxTable, new Paragraph({ spacing: { after: 120 } })];
}

/**
 * Renders nested ordered and unordered lists into Word Paragraph elements.
 */
function renderList(
  listNode: any,
  depth: number,
  ctx: AstDocxContext
): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];
  const isOrdered = Boolean(listNode.ordered);
  const startNum = typeof listNode.start === "number" ? listNode.start : 1;
  const items = listNode.children || [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemChildren = item.children || [];
    let isFirstBlock = true;

    for (const block of itemChildren) {
      if (block.type === "list") {
        elements.push(...renderList(block, depth + 1, ctx));
        continue;
      }

      if (block.type === "paragraph") {
        const phrasingRuns = renderPhrasingList(block.children || [], ctx, {
          sizePt: 11,
          color: ctx.bodyColor,
        });

        if (isFirstBlock) {
          isFirstBlock = false;
          if (isOrdered) {
            const numPrefix = `${startNum + i}.`;
            elements.push(
              new Paragraph({
                indent: {
                  left: convertInchesToTwip(0.25 * (depth + 1)),
                  hanging: convertInchesToTwip(0.25),
                },
                spacing: { before: 50, after: 40, line: 276 },
                children: [
                  new TextRun({
                    text: `${numPrefix} `,
                    bold: true,
                    font: ctx.font,
                    size: 22,
                    color: ctx.primaryAccent,
                  }),
                  ...phrasingRuns,
                ],
              })
            );
          } else {
            elements.push(
              new Paragraph({
                bullet: { level: Math.min(8, depth) },
                spacing: { before: 24, after: 36, line: 260 },
                children: phrasingRuns,
              })
            );
          }
        } else {
          // Continuation paragraph in list item
          elements.push(
            new Paragraph({
              indent: { left: convertInchesToTwip(0.25 * (depth + 1)) },
              spacing: { before: 20, after: 30, line: 260 },
              children: phrasingRuns,
            })
          );
        }
      } else {
        // Other block types (e.g. table, code, math) inside list item
        elements.push(...renderBlockNode(block, ctx));
      }
    }
  }

  return elements;
}

/**
 * Transforms an AST block node into Word elements.
 */
function renderBlockNode(
  node: Node,
  ctx: AstDocxContext
): (Paragraph | Table)[] {
  switch (node.type) {
    case "heading": {
      const depth = Math.min(6, Math.max(1, (node as any).depth || 1));
      const config = HEADING_CONFIGS[depth] || HEADING_CONFIGS[1];
      const color = resolveColor(config.colorKey, ctx);
      const runs = renderPhrasingList((node as any).children || [], ctx, {
        sizePt: config.sizePt,
        color,
        bold: true,
      });

      return [
        new Paragraph({
          heading: config.level,
          spacing: config.spacing,
          children: runs,
        }),
      ];
    }

    case "paragraph": {
      const text = plainText(node).trim();

      // Check pure data array
      if (/^(\s*\d+(?:\.\d+)?(?:,\s*|\s+)){3,}\d+(?:\.\d+)?(?:,\s*)?$/.test(text)) {
        const tokens = text.replace(/,/g, " ").trim().split(/\s+/);
        const formattedData = tokens.join(", ");
        return [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 40, after: 40, line: 260 },
            children: [
              new TextRun({
                text: formattedData,
                font: ctx.font,
                size: 21,
                color: "1E293B",
              }),
            ],
          }),
        ];
      }

      // Check Metadata / Side note pattern
      const metaMatch = text.match(/^(?:\s*[-*•o]\s+)?(?:\*{0,2})(\(?Side note:|\(?Note:|Frequency:)\s*(.*?)(?:\*{0,2})$/i);
      if (metaMatch) {
        const label = metaMatch[1];
        const noteContent = metaMatch[2].replace(/^\*+|\*+$/g, "").trim();
        const isSideNote = /side note|note/i.test(label);

        return [
          new Paragraph({
            indent: { left: convertInchesToTwip(0.35) },
            spacing: { before: 20, after: 40, line: 240 },
            children: [
              new TextRun({
                text: `${label} `,
                font: ctx.font,
                size: 19,
                color: "64748B",
                italics: isSideNote,
                bold: !isSideNote,
              }),
              ...parseInlineRunsAndMath(noteContent, ctx.font, 9.5, "64748B", ctx.equationFormat, { italics: isSideNote }),
            ],
          }),
        ];
      }

      // Check Sub-questions & Lettered list items (e.g. (a) ... or a. ...)
      const subMatch = text.match(/^\s*(?:[-*•o]\s+)?(?:\*{0,2})([a-z]\.|\([a-z]\)|[a-z]\)|\(i{1,3}\)|[i-v]+\.|\([0-9]+\))\s*(.*)$/i);
      if (subMatch) {
        const prefix = subMatch[1].replace(/^\(/, "").replace(/\)$/, ".");
        const subContent = subMatch[2].replace(/^\*+|\*+$/g, "").trim();

        return [
          new Paragraph({
            indent: { left: convertInchesToTwip(0.35), hanging: convertInchesToTwip(0.2) },
            spacing: { before: 24, after: 36, line: 260 },
            children: [
              new TextRun({
                text: `${prefix} `,
                bold: true,
                font: ctx.font,
                size: 22,
                color: "0F172A",
              }),
              ...parseInlineRunsAndMath(subContent, ctx.font, 11, ctx.bodyColor, ctx.equationFormat),
            ],
          }),
        ];
      }

      // Standard paragraph
      const runs = renderPhrasingList((node as any).children || [], ctx, {
        sizePt: 11,
        color: ctx.bodyColor,
      });

      return [
        new Paragraph({
          spacing: { before: 30, after: 110, line: 288 },
          children: runs,
        }),
      ];
    }

    case "math": {
      return [renderBlockMath((node as any).value ?? "")];
    }

    case "code": {
      return renderFencedCode((node as any).value ?? "", ctx);
    }

    case "table": {
      return renderGfmTable(node, ctx);
    }

    case "list": {
      return renderList(node, 0, ctx);
    }

    case "blockquote": {
      const quoteChildren = (node as any).children || [];
      const result: (Paragraph | Table)[] = [];

      for (const qChild of quoteChildren) {
        if (qChild.type === "paragraph") {
          const runs = renderPhrasingList(qChild.children || [], ctx, {
            sizePt: 10.5,
            color: "1E293B",
          });
          result.push(
            new Paragraph({
              indent: { left: convertInchesToTwip(0.2) },
              border: {
                left: {
                  color: ctx.primaryAccent,
                  space: 10,
                  style: BorderStyle.SINGLE,
                  size: 18,
                },
              },
              spacing: { before: 40, after: 60, line: 276 },
              children: runs,
            })
          );
        } else {
          result.push(...renderBlockNode(qChild, ctx));
        }
      }
      return result;
    }

    case "thematicBreak": {
      return [
        new Paragraph({
          spacing: { before: 100, after: 100 },
          border: {
            bottom: {
              style: BorderStyle.SINGLE,
              size: 6,
              color: "CBD5E1",
            },
          },
        }),
      ];
    }

    default: {
      if ("children" in node && Array.isArray((node as any).children)) {
        return (node as any).children.flatMap((c: Node) =>
          renderBlockNode(c, ctx)
        );
      }
      return [];
    }
  }
}

/**
 * Walks the parsed AST and emits Word docx elements.
 */
export function astToDocxElements(
  root: Root,
  ctx: AstDocxContext
): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];
  for (const child of root.children) {
    elements.push(...renderBlockNode(child, ctx));
  }
  return elements;
}

/**
 * Builds a professionally formatted Word (.docx) document from Markdown notes
 * using the shared AST parser.
 */
export async function buildDocxFromAst(
  markdownText: string,
  options: DocxOptions = {}
): Promise<Buffer> {
  const mergedOptions = getActiveDocxOptions(options, options.enabledSkillIds);
  const ctx: AstDocxContext = {
    font: mergedOptions.fontFamily || "Times New Roman",
    primaryAccent: mergedOptions.accentColor || "1A365D",
    secondaryAccent: "2B6CB0",
    bodyColor: "2D3748",
    equationFormat: mergedOptions.equationFormat || "native",
    isBooktabs: mergedOptions.tableStyle === "booktabs",
  };

  let cleanedMarkdown: string;
  if (options.skipPreprocess) {
    cleanedMarkdown = markdownText;
  } else {
    const skillResult = executeSkillPipeline(markdownText, options.enabledSkillIds);
    const textAfterSkills = skillResult.text;
    cleanedMarkdown = standardizeMathToLatex(cleanNotebookLMTreeArtifacts(textAfterSkills));
  }

  // Ensure bare multi-line math environments are enclosed in $$ before AST parsing
  const readyMarkdown = wrapBareMathEnvironments(cleanedMarkdown);
  const ast = parseMarkdown(readyMarkdown);
  const children = astToDocxElements(ast, ctx);

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1.0),
              bottom: convertInchesToTwip(1.0),
              left: convertInchesToTwip(1.0),
              right: convertInchesToTwip(1.0),
            },
          },
        },
        children: children.length > 0 ? children : [new Paragraph({ text: "Empty document." })],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
