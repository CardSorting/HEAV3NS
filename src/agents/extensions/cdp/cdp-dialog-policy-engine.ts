import type {
  CdpDialogEvent,
  CdpDialogPolicy,
  CdpDialogType,
  IBroccoliBrowserSubstrate,
  ICdpProtocolClient,
} from "../../../core/contracts/cdp.contracts.js";

/**
 * Deterministic Non-Blocking Dialog Arbitration Engine.
 *
 * Handles JavaScript dialogs at the protocol level via Page.handleJavaScriptDialog,
 * preventing execution hangs without brittle DOM/XHR monkey-patching.
 */
export class CdpDialogPolicyEngine {
  private policy: CdpDialogPolicy;
  private substrate: IBroccoliBrowserSubstrate;
  private cdpClient?: ICdpProtocolClient;
  private dialogCounter = 1;

  constructor(
    substrate: IBroccoliBrowserSubstrate,
    policy: CdpDialogPolicy = "auto_dismiss",
    cdpClient?: ICdpProtocolClient
  ) {
    this.substrate = substrate;
    this.policy = policy;
    this.cdpClient = cdpClient;
  }

  setPolicy(policy: CdpDialogPolicy): void {
    this.policy = policy;
  }

  getPolicy(): CdpDialogPolicy {
    return this.policy;
  }

  setCdpClient(cdpClient: ICdpProtocolClient): void {
    this.cdpClient = cdpClient;
  }

  async handleInboundDialogEvent(
    targetId: string,
    type: CdpDialogType,
    message: string,
    defaultPrompt?: string
  ): Promise<{ handled: boolean; actionTaken?: "accept" | "dismiss"; dialogId: string }> {
    const dialogId = `dialog-${Date.now()}-${this.dialogCounter++}`;
    const dialog: CdpDialogEvent = {
      id: dialogId,
      targetId,
      type,
      message,
      defaultPrompt,
      timestampMs: Date.now(),
      status: "pending",
    };

    this.substrate.addDialog(dialog);

    if (this.policy === "auto_dismiss") {
      await this.respondToDialog(dialogId, "dismiss");
      return { handled: true, actionTaken: "dismiss", dialogId };
    }

    if (this.policy === "auto_accept") {
      const responseText = type === "prompt" ? defaultPrompt || "" : undefined;
      await this.respondToDialog(dialogId, "accept", responseText);
      return { handled: true, actionTaken: "accept", dialogId };
    }

    // Interactive policy: leaves dialog pending in substrate
    return { handled: false, dialogId };
  }

  async respondToDialog(
    dialogId: string,
    action: "accept" | "dismiss",
    promptText?: string
  ): Promise<{ success: boolean; error?: string }> {
    const pendingList = this.substrate.getPendingDialogs();
    const targetDialog = pendingList.find((d) => d.id === dialogId) || pendingList[0];

    if (!targetDialog) {
      return { success: false, error: `No pending dialog found with ID '${dialogId}'` };
    }

    const accept = action === "accept";
    try {
      if (this.cdpClient && this.cdpClient.isConnected()) {
        await this.cdpClient.sendCommand("Page.handleJavaScriptDialog", {
          accept,
          promptText: promptText || targetDialog.defaultPrompt || "",
        });
      }

      this.substrate.updateDialog(targetDialog.id, accept ? "accepted" : "dismissed", promptText);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
