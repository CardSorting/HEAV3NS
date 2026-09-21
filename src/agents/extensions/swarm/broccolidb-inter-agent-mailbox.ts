/**
 * [LAYER: AGENTS EXTENSION]
 * Pass 140: Zero-Dependency Broccoli Inter-Agent Mailbox
 *
 * Lifted from external source workspace/codemarie-new/broccolidb (core/agent-context/MailboxService.ts).
 * Provides decentralized inter-subagent communication queues (postMessage, pollInbox, postStatus)
 * with ring-buffer FIFO message bounds. Zero external npm dependencies.
 */

import { randomUUID } from "node:crypto";

export interface MailboxMessage {
  id: string;
  from: string;
  to: string;
  type: "vibe" | "audit" | "error" | "permission_request" | "permission_response";
  payload: unknown;
  timestamp: number;
  read: boolean;
}

export class BroccoliInterAgentMailbox {
  private readonly messages: MailboxMessage[] = [];
  private readonly maxMessages: number;

  constructor(maxMessages: number = 1000) {
    this.maxMessages = maxMessages;
  }

  /**
   * Posts a message to a specific target agent's inbox.
   */
  public postMessage(
    to: string,
    from: string,
    type: MailboxMessage["type"],
    payload: unknown
  ): MailboxMessage {
    const msg: MailboxMessage = {
      id: randomUUID(),
      from,
      to,
      type,
      payload,
      timestamp: Date.now(),
      read: false,
    };

    this.messages.push(msg);

    if (this.messages.length > this.maxMessages) {
      this.messages.splice(0, this.messages.length - this.maxMessages);
    }

    return msg;
  }

  /**
   * Helper method to broadcast status notifications.
   */
  public postStatus(agentId: string, status: string): MailboxMessage {
    return this.postMessage("system", agentId, "vibe", { status });
  }

  /**
   * Polls all unread messages for a target agent and marks them read.
   */
  public pollInbox(agentId: string): MailboxMessage[] {
    const unread = this.messages.filter((m) => m.to === agentId && !m.read);
    for (const m of unread) {
      m.read = true;
    }
    return unread;
  }
}
