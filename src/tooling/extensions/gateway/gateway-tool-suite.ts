import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { IGatewayDispatcher, IBroccoliGatewaySubstrate, IGatewayDeliveryLedger, GatewayPlatformType } from "../../../core/contracts/gateway.contracts.js";

/**
 * Model-facing tool suite for messaging gateway dispatch & channel management.
 */
export class GatewayToolSuite {
  private dispatcher: IGatewayDispatcher;
  private substrate: IBroccoliGatewaySubstrate;
  private deliveryLedger: IGatewayDeliveryLedger;

  constructor(
    dispatcher: IGatewayDispatcher,
    substrate: IBroccoliGatewaySubstrate,
    deliveryLedger: IGatewayDeliveryLedger
  ) {
    this.dispatcher = dispatcher;
    this.substrate = substrate;
    this.deliveryLedger = deliveryLedger;
  }

  setDispatcher(dispatcher: IGatewayDispatcher): void {
    this.dispatcher = dispatcher;
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "gateway_broadcast_message",
        description: "Broadcast an outbound message across a connected messaging channel (Telegram, Discord, Slack, Webhook).",
        parameters: {
          platform: {
            type: "string",
            required: true,
            description: "Target platform: 'telegram', 'discord', 'slack', 'webhook'.",
          },
          channelId: {
            type: "string",
            required: true,
            description: "Unique destination channel / chat / room ID.",
          },
          content: {
            type: "string",
            required: true,
            description: "Message content string to send.",
          },
          threadId: {
            type: "string",
            required: false,
            description: "Optional thread/topic ID for nested replies.",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("gateway_broadcast_message", args);
        },
      },
      {
        name: "gateway_list_channels",
        description: "List all active channels registered across connected messaging platforms.",
        parameters: {
          platform: {
            type: "string",
            required: false,
            description: "Optional platform filter ('telegram', 'discord', 'slack', 'webhook').",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("gateway_list_channels", args);
        },
      },
      {
        name: "gateway_inspect_session",
        description: "Inspect specific channel session state, inbound/outbound stats, and thread context.",
        parameters: {
          channelId: {
            type: "string",
            required: true,
            description: "Channel identifier.",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("gateway_inspect_session", args);
        },
      },
      {
        name: "gateway_delivery_status",
        description: "Check outbound delivery ledger status and pending queue depth.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("gateway_delivery_status", args);
        },
      },
    ];
  }

  async executeTool(name: string, args: Record<string, unknown>): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      switch (name) {
        case "gateway_broadcast_message": {
          const platform = String(args.platform) as GatewayPlatformType;
          const channelId = String(args.channelId);
          const content = String(args.content);
          const threadId = args.threadId ? String(args.threadId) : undefined;
          const result = await this.dispatcher.broadcastMessage(platform, channelId, content, threadId);
          return { success: result.status !== "failed", data: result, error: result.error };
        }
        case "gateway_list_channels": {
          const platform = args.platform ? (String(args.platform) as GatewayPlatformType) : undefined;
          const channels = this.substrate.listChannels(platform);
          return { success: true, data: channels };
        }
        case "gateway_inspect_session": {
          const channelId = String(args.channelId);
          const session = this.substrate.getChannel(channelId);
          if (!session) {
            return { success: false, error: `Channel session '${channelId}' not found` };
          }
          return { success: true, data: session };
        }
        case "gateway_delivery_status": {
          const pending = this.deliveryLedger.getPending();
          const history = this.deliveryLedger.getHistory(20);
          return {
            success: true,
            data: {
              pendingQueueDepth: pending.length,
              recentDeliveries: history.length,
              recentHistory: history,
            },
          };
        }
        default:
          return { success: false, error: `Unknown gateway tool '${name}'` };
      }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
