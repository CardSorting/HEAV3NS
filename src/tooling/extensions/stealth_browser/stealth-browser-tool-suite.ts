/**
 * stealth-browser-tool-suite.ts
 *
 * Model tool definitions exposing Camoufox Stealth Browser Engine, Accessibility Ref
 * Navigation, Loopback Rewriting, and Storage to agents and CLI (Phase 111 / ADR-087 / Target #44).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { StealthBrowserSupervisor } from "../../../agents/extensions/stealth_browser/stealth-browser-supervisor.js";
import type { RefInteractionAction } from "../../../core/contracts/stealth-browser.contracts.js";

export class StealthBrowserToolSuite {
  private readonly supervisor: StealthBrowserSupervisor;

  constructor(supervisor: StealthBrowserSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "stealth_browser_navigate",
        description:
          "Navigates the stealth browser to a target URL with automatic loopback host rewriting (127.0.0.1 -> host.docker.internal) and C++ anti-fingerprint protection.",
        parameters: {
          url: {
            type: "string",
            description: "The destination URL to navigate to.",
            required: true,
          },
          tab_id: {
            type: "string",
            description: "Optional specific tab ID to navigate (defaults to active tab).",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const url = typeof args.url === "string" ? args.url : "about:blank";
          const tabId = typeof args.tab_id === "string" ? args.tab_id : undefined;
          const { tab, urlRewrite } = this.supervisor.navigate(url, tabId);
          return {
            success: true,
            tabId: tab.tabId,
            url: tab.url,
            title: tab.title,
            didRewriteLoopback: urlRewrite.didRewrite,
            effectiveUrl: urlRewrite.rewrittenUrl,
          };
        },
      },
      {
        name: "stealth_browser_snapshot",
        description:
          "Captures an accessibility tree snapshot with deterministic [ref=eX] numbered references for compact, high-speed LLM page reasoning.",
        parameters: {
          tab_id: {
            type: "string",
            description: "Optional tab ID to snapshot.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const tabId = typeof args.tab_id === "string" ? args.tab_id : undefined;
          const snapshot = this.supervisor.captureSnapshot(tabId);
          return {
            success: true,
            tabId: snapshot.tabId,
            url: snapshot.url,
            title: snapshot.title,
            totalInteractiveElements: snapshot.totalInteractiveElements,
            accessibilityTree: snapshot.textTree,
          };
        },
      },
      {
        name: "stealth_browser_interact_ref",
        description:
          "Executes an atomic interaction (click, type, press, scroll, hover, select) on an interactive element by its accessibility ref tag (e.g. 'e1', 'e2').",
        parameters: {
          ref_id: {
            type: "string",
            description: "The element reference tag (e.g. 'e1', 'e2').",
            required: true,
          },
          action: {
            type: "string",
            description: "Action to perform: click, type, press, scroll, hover, select, focus, clear.",
            required: true,
          },
          input_value: {
            type: "string",
            description: "Text value for 'type' action or option value for 'select'.",
            required: false,
          },
          tab_id: {
            type: "string",
            description: "Optional specific tab ID.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const refId = typeof args.ref_id === "string" ? args.ref_id : "";
          const action = (typeof args.action === "string" ? args.action : "click") as RefInteractionAction;
          const inputValue = typeof args.input_value === "string" ? args.input_value : undefined;
          const tabId = typeof args.tab_id === "string" ? args.tab_id : undefined;

          const result = this.supervisor.interactWithRef(refId, action, inputValue, tabId);
          return {
            success: result.success,
            refId: result.refId,
            action: result.action,
            elementRole: result.elementRole,
            elementName: result.elementName,
            navigationOccurred: result.navigationOccurred,
            newUrl: result.newUrl,
            error: result.error,
          };
        },
      },
      {
        name: "stealth_browser_manage_tabs",
        description: "Manages stealth browser tabs: open new tab, switch active tab, list open tabs, or close tab.",
        parameters: {
          operation: {
            type: "string",
            description: "Tab operation: 'open', 'switch', 'list', 'close'.",
            required: true,
          },
          target_url: {
            type: "string",
            description: "URL for 'open' operation.",
            required: false,
          },
          tab_id: {
            type: "string",
            description: "Tab ID for 'switch' or 'close' operation.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const op = typeof args.operation === "string" ? args.operation : "list";
          const targetUrl = typeof args.target_url === "string" ? args.target_url : "about:blank";
          const tabId = typeof args.tab_id === "string" ? args.tab_id : "";

          switch (op) {
            case "open": {
              const tab = this.supervisor.openTab(targetUrl);
              return { success: true, operation: "open", tab };
            }
            case "switch": {
              const ok = this.supervisor.switchTab(tabId);
              return { success: ok, operation: "switch", tabId };
            }
            case "close": {
              const ok = this.supervisor.closeTab(tabId);
              return { success: ok, operation: "close", tabId };
            }
            case "list":
            default: {
              const tabs = this.supervisor.listTabs();
              return { success: true, operation: "list", totalTabs: tabs.length, tabs };
            }
          }
        },
      },
      {
        name: "stealth_browser_inspect_storage",
        description: "Inspects or persists cookies and localStorage items across sessions.",
        parameters: {
          domain: {
            type: "string",
            description: "Domain to inspect (e.g. 'example.com').",
            required: false,
          },
          storage_type: {
            type: "string",
            description: "'cookies', 'localStorage', or 'all'.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const domain = typeof args.domain === "string" ? args.domain : undefined;
          const storageType = typeof args.storage_type === "string" ? args.storage_type : "all";

          const cookies = storageType === "localStorage" ? [] : this.supervisor.getCookies(domain);
          const localStorageItems =
            storageType === "cookies" || !domain ? [] : this.supervisor.getStorage(domain, "localStorage");

          return {
            success: true,
            domain: domain || "all",
            cookies,
            localStorage: localStorageItems,
          };
        },
      },
      {
        name: "stealth_browser_rewrite_url",
        description:
          "Checks and rewrites a URL for Docker or containerized environments (127.0.0.1 -> host.docker.internal).",
        parameters: {
          url: {
            type: "string",
            description: "The URL string to evaluate.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const url = typeof args.url === "string" ? args.url : "";
          const result = this.supervisor.navigate(url);
          return {
            success: true,
            originalUrl: result.urlRewrite.originalUrl,
            rewrittenUrl: result.urlRewrite.rewrittenUrl,
            didRewrite: result.urlRewrite.didRewrite,
            reason: result.urlRewrite.reason,
          };
        },
      },
    ];
  }
}
