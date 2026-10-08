import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { Root, Node, Parent, RootContent } from "mdast";
import type { Math as MathNode, InlineMath as InlineMathNode } from "mdast-util-math";

export type { Root, Node, Parent, RootContent, MathNode, InlineMathNode };

export type Visitor = (
  node: Node,
  parent?: Parent,
  index?: number
) => void | boolean;

/**
 * Depth-first traversal of an mdast AST tree.
 * Returning false from the visitor stops recursion into the current node's children.
 */
export function walk(
  tree: Node,
  visitor: Visitor,
  parent?: Parent,
  index?: number
): void {
  const result = visitor(tree, parent, index);
  if (result === false) return;
  if ("children" in tree && Array.isArray((tree as Parent).children)) {
    const parentNode = tree as Parent;
    for (let i = 0; i < parentNode.children.length; i++) {
      walk(parentNode.children[i], visitor, parentNode, i);
    }
  }
}

/**
 * Extracts plain text from an mdast node and all of its descendants.
 */
export function plainText(node: Node | null | undefined): string {
  if (!node) return "";
  if ("value" in node && typeof (node as any).value === "string") {
    return (node as any).value;
  }
  if ("children" in node && Array.isArray((node as any).children)) {
    return (node as any).children.map(plainText).join("");
  }
  return "";
}

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath);

function isDoubleDollarInlineMath(node: Node, source: string): node is InlineMathNode {
  if (node.type !== "inlineMath") return false;
  const inline = node as InlineMathNode;
  if (!inline.position) {
    return false;
  }
  const raw = source.slice(inline.position.start.offset, inline.position.end.offset).trim();
  return raw.startsWith("$$") && raw.endsWith("$$");
}

function createMathNode(value: string, position: any): MathNode {
  return {
    type: "math",
    value,
    meta: null,
    position,
    data: {
      hName: "pre",
      hChildren: [
        {
          type: "element",
          tagName: "code",
          properties: { className: ["language-math", "math-display"] },
          children: [{ type: "text", value }],
        },
      ],
    },
  };
}

/**
 * Converts single-line $$ ... $$ parsed as paragraph > inlineMath into block math nodes,
 * ensuring both single-line and multi-line $$ equations are block math nodes while
 * real inline $x$ stays inlineMath.
 */
function normalizeChildren(children: any[], source: string): any[] {
  const result: any[] = [];
  for (const child of children) {
    if (child.type === "paragraph" && Array.isArray(child.children)) {
      const hasDoubleDollarMath = child.children.some((c: Node) =>
        isDoubleDollarInlineMath(c, source)
      );

      if (!hasDoubleDollarMath) {
        if (child.children) {
          child.children = normalizeChildren(child.children, source);
        }
        result.push(child);
        continue;
      }

      // Normalization rule: convert paragraph whose ONLY child is inlineMath from $$...$$
      if (child.children.length === 1) {
        const only = child.children[0] as InlineMathNode;
        result.push(createMathNode(only.value, child.position));
        continue;
      }

      // If a paragraph contains a $$...$$ equation along with adjacent phrasing content,
      // partition the children so the display equation becomes a block math node.
      let currentPara: any[] = [];
      for (const item of child.children) {
        if (isDoubleDollarInlineMath(item, source)) {
          if (currentPara.length > 0) {
            result.push({ type: "paragraph", children: currentPara });
            currentPara = [];
          }
          result.push(createMathNode(item.value, item.position));
        } else {
          currentPara.push(item);
        }
      }
      if (currentPara.length > 0) {
        result.push({ type: "paragraph", children: currentPara });
      }
    } else {
      if (child.children) {
        child.children = normalizeChildren(child.children, source);
      }
      result.push(child);
    }
  }
  return result;
}

/**
 * Parses markdown into an mdast syntax tree with GFM and LaTeX math support.
 * Standalone single-line and multi-line $$...$$ equations are normalized to block math nodes.
 */
export function parseMarkdown(md: string): Root {
  if (!md) {
    return { type: "root", children: [] };
  }
  const tree = parser.parse(md) as Root;
  tree.children = normalizeChildren(tree.children, md);
  return tree;
}
