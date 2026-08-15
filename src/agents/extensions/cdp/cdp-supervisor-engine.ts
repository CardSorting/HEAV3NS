import type {
  CdpTarget,
  CdpDomSnapshot,
  ICdpSupervisor,
  ICdpProtocolClient,
  IBroccoliBrowserSubstrate,
} from "../../../core/contracts/cdp.contracts.js";
import { CdpNavigationGuard } from "./cdp-navigation-guard.js";
import { CdpDialogPolicyEngine } from "./cdp-dialog-policy-engine.js";
import { CdpDomSnapshotter, type RawCdpNode } from "../../../tooling/extensions/cdp/cdp-dom-snapshotter.js";

/**
 * Deterministic CDP Browser Supervisor Engine.
 *
 * Orchestrates multi-target lifecycle, protocol event dispatching,
 * bounded DOM snapshotting, safe navigation, and dialog resolution.
 */
export class CdpSupervisorEngine implements ICdpSupervisor {
  private readonly substrate: IBroccoliBrowserSubstrate;
  private readonly navGuard: CdpNavigationGuard;
  private readonly dialogPolicy: CdpDialogPolicyEngine;
  private readonly domSnapshotter: CdpDomSnapshotter;
  private readonly cdpClient: ICdpProtocolClient;

  constructor(
    substrate: IBroccoliBrowserSubstrate,
    navGuard: CdpNavigationGuard,
    dialogPolicy: CdpDialogPolicyEngine,
    domSnapshotter: CdpDomSnapshotter,
    cdpClient: ICdpProtocolClient
  ) {
    this.substrate = substrate;
    this.navGuard = navGuard;
    this.dialogPolicy = dialogPolicy;
    this.domSnapshotter = domSnapshotter;
    this.cdpClient = cdpClient;

    this.wireProtocolEvents();
    this.initializeDefaultTarget();
  }

  private initializeDefaultTarget(): void {
    if (this.substrate.listTargets().length === 0) {
      this.substrate.addTarget({
        targetId: "target-primary-page",
        type: "page",
        title: "About Blank",
        url: "about:blank",
        attached: true,
      });
    }
  }

  private wireProtocolEvents(): void {
    this.cdpClient.onEvent((event) => {
      switch (event.method) {
        case "Page.javascriptDialogOpening": {
          const type = (event.params.type as any) || "alert";
          const message = (event.params.message as string) || "";
          const defaultPrompt = event.params.defaultPrompt as string | undefined;
          const targetId = (event.sessionId as string) || "target-primary-page";
          void this.dialogPolicy.handleInboundDialogEvent(targetId, type, message, defaultPrompt);
          break;
        }
        case "Runtime.consoleAPICalled": {
          const targetId = (event.sessionId as string) || "target-primary-page";
          const level = (event.params.type as any) || "log";
          const args = (event.params.args as Array<{ value?: unknown }>) || [];
          const text = args.map((a) => String(a.value ?? "")).join(" ");
          this.substrate.recordConsoleMessage({
            id: `console-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            targetId,
            level: ["log", "info", "warning", "error", "debug"].includes(level) ? level : "info",
            text,
            timestampMs: Date.now(),
          });
          break;
        }
        case "Network.requestWillBeSent": {
          const targetId = (event.sessionId as string) || "target-primary-page";
          const requestId = (event.params.requestId as string) || `req-${Date.now()}`;
          const request = (event.params.request as { url?: string; method?: string }) || {};
          this.substrate.recordNetworkRequest({
            requestId,
            targetId,
            url: request.url || "",
            method: request.method || "GET",
            failed: false,
            timestampMs: Date.now(),
          });
          break;
        }
      }
    });
  }

  getActiveTarget(): CdpTarget | undefined {
    return this.substrate.getActiveTarget();
  }

  async navigate(
    url: string,
    targetId?: string
  ): Promise<{ success: boolean; targetId: string; title: string; url: string; error?: string }> {
    const check = this.navGuard.validateNavigationUrl(url);
    if (!check.allowed) {
      return {
        success: false,
        targetId: targetId || "none",
        title: "",
        url,
        error: `Navigation blocked by guardrail: ${check.reason}`,
      };
    }

    const effectiveTargetId = targetId || this.substrate.getActiveTarget()?.targetId || "target-primary-page";
    const sanitizedUrl = check.sanitizedUrl || url;

    try {
      await this.cdpClient.sendCommand("Page.navigate", { url: sanitizedUrl });

      // Update substrate target
      const title = `Page: ${new URL(sanitizedUrl.startsWith("about:") ? "http://localhost" : sanitizedUrl).hostname || "Blank"}`;
      const target: CdpTarget = {
        targetId: effectiveTargetId,
        type: "page",
        title,
        url: sanitizedUrl,
        attached: true,
      };

      this.substrate.addTarget(target);
      this.substrate.setActiveTarget(effectiveTargetId);

      return {
        success: true,
        targetId: effectiveTargetId,
        title,
        url: sanitizedUrl,
      };
    } catch (err: unknown) {
      return {
        success: false,
        targetId: effectiveTargetId,
        title: "",
        url: sanitizedUrl,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async takeSnapshot(targetId?: string, maxDepth = 4): Promise<CdpDomSnapshot> {
    const active = this.substrate.getActiveTarget();
    const effectiveTargetId = targetId || active?.targetId || "target-primary-page";
    const currentUrl = active?.url || "about:blank";
    const currentTitle = active?.title || "Blank";

    try {
      const docResult = await this.cdpClient.sendCommand<{ root: RawCdpNode }>("DOM.getDocument", { depth: maxDepth });
      const pendingDialogs = this.substrate.getPendingDialogs();

      const snapshot = this.domSnapshotter.parseRawDom(
        effectiveTargetId,
        currentUrl,
        currentTitle,
        docResult?.root || { nodeId: 1, nodeType: 1, nodeName: "BODY" },
        pendingDialogs,
        maxDepth
      );

      this.substrate.cacheDomSnapshot(effectiveTargetId, snapshot);
      return snapshot;
    } catch {
      // Return cached or fallback snapshot
      const cached = this.substrate.getCachedDomSnapshot(effectiveTargetId);
      if (cached) return cached;

      return {
        targetId: effectiveTargetId,
        url: currentUrl,
        title: currentTitle,
        totalNodes: 1,
        interactiveNodesCount: 0,
        root: {
          id: 1,
          tag: "BODY",
          isInteractive: false,
          attributes: {},
          children: [],
        },
        pendingDialogs: this.substrate.getPendingDialogs(),
        timestampMs: Date.now(),
        textSummary: `<BODY>`,
      };
    }
  }

  async clickElement(selectorOrId: string | number, targetId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const expr = typeof selectorOrId === "number"
        ? `document.querySelector('[data-node-id="${selectorOrId}"]')?.click() || true`
        : `document.querySelector('${selectorOrId}')?.click() || true`;

      await this.cdpClient.sendCommand("Runtime.evaluate", { expression: expr });
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async typeText(selectorOrId: string | number, text: string, targetId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const expr = typeof selectorOrId === "number"
        ? `(() => { const el = document.querySelector('[data-node-id="${selectorOrId}"]'); if(el) el.value = ${JSON.stringify(text)}; })()`
        : `(() => { const el = document.querySelector('${selectorOrId}'); if(el) el.value = ${JSON.stringify(text)}; })()`;

      await this.cdpClient.sendCommand("Runtime.evaluate", { expression: expr });
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async handleDialog(
    action: "accept" | "dismiss",
    promptText?: string,
    dialogId?: string
  ): Promise<{ success: boolean; dialogId?: string; error?: string }> {
    const pending = this.substrate.getPendingDialogs();
    const effectiveId = dialogId || pending[0]?.id;

    if (!effectiveId) {
      return { success: false, error: "No pending dialogs found to handle" };
    }

    const result = await this.dialogPolicy.respondToDialog(effectiveId, action, promptText);
    return { success: result.success, dialogId: effectiveId, error: result.error };
  }

  async evaluateScript<T = unknown>(
    expression: string,
    targetId?: string
  ): Promise<{ success: boolean; result?: T; error?: string }> {
    try {
      const evalResult = await this.cdpClient.sendCommand<{ result?: { value?: T } }>("Runtime.evaluate", {
        expression,
        returnByValue: true,
      });

      return { success: true, result: evalResult?.result?.value };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async sendRawCdpCommand<T = unknown>(
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<{ success: boolean; result?: T; error?: string }> {
    try {
      const result = await this.cdpClient.sendCommand<T>(method, params);
      return { success: true, result };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
