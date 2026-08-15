import type { CdpDomNode, CdpDomSnapshot, CdpDialogEvent } from "../../../core/contracts/cdp.contracts.js";

const INTERACTIVE_TAGS = new Set([
  "A",
  "BUTTON",
  "INPUT",
  "SELECT",
  "TEXTAREA",
  "DETAILS",
  "SUMMARY",
]);

const IGNORED_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "SVG",
  "PATH",
  "LINK",
  "META",
]);

export interface RawCdpNode {
  nodeId: number;
  nodeType: number;
  nodeName?: string;
  nodeValue?: string;
  attributes?: string[];
  children?: RawCdpNode[];
}

/**
 * Bounded semantic DOM tree snapshotter.
 *
 * Extracts accessible and interactive elements while filtering out
 * styling noise, SVGs, scripts, and heavy data blobs to minimize LLM token overhead.
 */
export class CdpDomSnapshotter {
  parseRawDom(
    targetId: string,
    url: string,
    title: string,
    rawRoot: RawCdpNode,
    pendingDialogs: readonly CdpDialogEvent[] = [],
    maxDepth = 4
  ): CdpDomSnapshot {
    let totalNodes = 0;
    let interactiveCount = 0;

    const transformNode = (node: RawCdpNode, currentDepth: number): CdpDomNode | null => {
      const tag = (node.nodeName || "DIV").toUpperCase();
      if (IGNORED_TAGS.has(tag)) {
        return null;
      }

      totalNodes++;
      const attrs: Record<string, string> = {};
      if (node.attributes) {
        for (let i = 0; i < node.attributes.length; i += 2) {
          const key = node.attributes[i];
          const val = node.attributes[i + 1] ?? "";
          // Strip massive base64 URIs from attributes
          if (val.startsWith("data:") && val.length > 50) {
            attrs[key] = "[data-uri-truncated]";
          } else {
            attrs[key] = val;
          }
        }
      }

      let role = attrs.role;
      let text = node.nodeValue?.trim();
      let value = attrs.value;
      let href = attrs.href;

      // Extract child text if this is a container
      const children: CdpDomNode[] = [];
      if (node.children && currentDepth < maxDepth) {
        for (const child of node.children) {
          if (child.nodeType === 3) {
            // Text node
            const childText = child.nodeValue?.trim();
            if (childText) {
              text = text ? `${text} ${childText}` : childText;
            }
          } else {
            const transformedChild = transformNode(child, currentDepth + 1);
            if (transformedChild) {
              children.push(transformedChild);
            }
          }
        }
      }

      const isInteractive =
        INTERACTIVE_TAGS.has(tag) ||
        role === "button" ||
        role === "link" ||
        role === "checkbox" ||
        role === "textbox" ||
        attrs.onclick !== undefined ||
        attrs.tabindex !== undefined;

      if (isInteractive) {
        interactiveCount++;
      }

      return {
        id: node.nodeId,
        tag,
        role,
        name: attrs.name || attrs["aria-label"] || attrs.title || attrs.id,
        text,
        value,
        href,
        isInteractive,
        attributes: attrs,
        children,
      };
    };

    const root = transformNode(rawRoot, 0) ?? {
      id: 1,
      tag: "ROOT",
      isInteractive: false,
      attributes: {},
      children: [],
    };

    const textSummary = this.renderTextSummary(root);

    return {
      targetId,
      url,
      title,
      totalNodes,
      interactiveNodesCount: interactiveCount,
      root,
      pendingDialogs,
      timestampMs: Date.now(),
      textSummary,
    };
  }

  private renderTextSummary(node: CdpDomNode, depth = 0): string {
    const indent = "  ".repeat(depth);
    const lines: string[] = [];

    const descriptors: string[] = [];
    if (node.id) descriptors.push(`id=${node.id}`);
    if (node.role) descriptors.push(`role="${node.role}"`);
    if (node.name) descriptors.push(`name="${node.name}"`);
    if (node.href) descriptors.push(`href="${node.href}"`);
    if (node.isInteractive) descriptors.push(`[interactive]`);

    const descStr = descriptors.length > 0 ? ` (${descriptors.join(" ")})` : "";
    const textStr = node.text ? `: "${node.text}"` : "";

    lines.push(`${indent}<${node.tag}${descStr}>${textStr}`);

    for (const child of node.children) {
      lines.push(this.renderTextSummary(child, depth + 1));
    }

    return lines.join("\n");
  }
}
