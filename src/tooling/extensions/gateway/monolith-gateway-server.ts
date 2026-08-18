import type { LumiMonolith } from "../../../index.js";
import type { JsonRpcNotification } from "../../../core/contracts/tooling.contracts.js";

export interface GatewayRequestEnvelope {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface GatewayResponseEnvelope {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string };
}

/**
 * MonolithGatewayServer.
 * Absorbed from packages/server (Pass 17 / ADR-012).
 *
 * Provides a remote JSON-RPC 2.0 RPC gateway for web applications, webviews, and external client tools.
 */
export class MonolithGatewayServer {
  async handleJsonRpcRequest(rawJson: string, monolith: LumiMonolith): Promise<string> {
    let req: GatewayRequestEnvelope;
    try {
      req = JSON.parse(rawJson);
    } catch {
      return JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error: Invalid JSON" },
      });
    }

    try {
      if (req.method === "engine/tick") {
        const prompt = String(req.params?.prompt ?? "");
        const tickResult = await monolith.tick({ prompt });
        return this.formatSuccess(req.id, tickResult);
      }

      if (req.method === "engine/snapshot") {
        const snapshot = monolith.createSnapshot();
        return this.formatSuccess(req.id, snapshot);
      }

      if (req.method === "engine/audit") {
        const cwd = String(req.params?.cwd ?? monolith.sessionContext.cwd);
        const audit = await monolith.stabilityDoctor.auditEnvironment(cwd, monolith.eyes);
        return this.formatSuccess(req.id, audit);
      }

      if (req.method === "kanban/listBoards") {
        const boards = monolith.kanbanBoardSupervisor.listBoards();
        return this.formatSuccess(req.id, { boards });
      }

      if (req.method === "kanban/getBoard") {
        const boardId = String(req.params?.boardId ?? "default");
        const board = monolith.kanbanBoardSupervisor.getBoard(boardId);
        return this.formatSuccess(req.id, { board });
      }

      if (req.method === "kanban/createTask") {
        const res = monolith.kanbanBoardSupervisor.createTask(req.params as any);
        return this.formatSuccess(req.id, res);
      }

      if (req.method === "kanban/updateTask") {
        const boardId = String(req.params?.boardId ?? "default");
        const taskId = String(req.params?.taskId ?? "");
        const mutation = (req.params?.mutation ?? {}) as any;
        const res = monolith.kanbanBoardSupervisor.updateTask(boardId, taskId, mutation);
        return this.formatSuccess(req.id, res);
      }

      if (req.method === "kanban/getGroupedTasks") {
        const boardId = String(req.params?.boardId ?? "default");
        const groupBy = req.params?.groupBy as any;
        const sortBy = req.params?.sortBy as any;
        const sortDirection = req.params?.sortDirection as any;
        const swimlanes = monolith.kanbanBoardSupervisor.getGroupedTasks(boardId, groupBy, sortBy, sortDirection);
        return this.formatSuccess(req.id, { swimlanes });
      }

      if (req.method === "kanban/getTaskHierarchy") {
        const boardId = String(req.params?.boardId ?? "default");
        const taskId = String(req.params?.taskId ?? "");
        const hierarchy = monolith.kanbanBoardSupervisor.getTaskHierarchy(taskId, boardId);
        return this.formatSuccess(req.id, { hierarchy });
      }

      if (req.method === "kanban/checkDeadlines") {
        const boardId = String(req.params?.boardId ?? "default");
        const warningWindowMs = typeof req.params?.warningWindowMs === "number" ? req.params.warningWindowMs : 86400000;
        const report = monolith.kanbanBoardSupervisor.checkUpcomingDeadlines(boardId, warningWindowMs);
        return this.formatSuccess(req.id, { report });
      }

      if (req.method === "kanban/getNotifications") {
        const history = monolith.broccoliKanbanSubstrate.getNotificationDispatcher().getHistory(req.params as any);
        return this.formatSuccess(req.id, { notifications: history });
      }

      if (req.method === "kanban/sendNotification") {
        const res = await monolith.broccoliKanbanSubstrate.getNotificationDispatcher().dispatch(req.params as any);
        return this.formatSuccess(req.id, res);
      }

      if (req.method === "kanban/exportHtml") {
        const boardId = String(req.params?.boardId ?? "default");
        const html = monolith.kanbanBoardSupervisor.exportHtml(boardId);
        return this.formatSuccess(req.id, { html });
      }

      if (req.method === "goal/getGoal") {
        const sessionId = String(req.params?.sessionId ?? "default");
        const goal = monolith.goalSupervisor.getGoal(sessionId);
        return this.formatSuccess(req.id, { goal });
      }

      if (req.method === "goal/listGoals") {
        const query = typeof req.params?.query === "string" ? req.params.query : undefined;
        const goals = monolith.goalSupervisor.listGoals(query);
        return this.formatSuccess(req.id, { goals });
      }

      if (req.method === "goal/setGoal") {
        const sessionId = String(req.params?.sessionId ?? "default");
        const text = String(req.params?.goal ?? "");
        const goal = monolith.goalSupervisor.setGoal(sessionId, text, req.params as any);
        return this.formatSuccess(req.id, { goal });
      }

      if (req.method === "goal/getGroupedGoals") {
        const groupBy = req.params?.groupBy as any;
        const sortBy = req.params?.sortBy as any;
        const sortDirection = req.params?.sortDirection as any;
        const lanes = monolith.goalSupervisor.getGroupedGoals(groupBy, sortBy, sortDirection);
        return this.formatSuccess(req.id, { lanes });
      }

      if (req.method === "goal/getHierarchy") {
        const sessionId = String(req.params?.sessionId ?? "default");
        const hierarchy = monolith.goalSupervisor.getGoalWithHierarchy(sessionId);
        return this.formatSuccess(req.id, { hierarchy });
      }

      if (req.method === "goal/getVelocityMetrics") {
        const metrics = monolith.goalSupervisor.getVelocityMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "goal/evaluateGates") {
        const sessionId = String(req.params?.sessionId ?? "default");
        const cwd = String(req.params?.cwd ?? monolith.sessionContext.cwd);
        const report = await monolith.goalSupervisor.evaluateGates(sessionId, cwd);
        return this.formatSuccess(req.id, { report });
      }

      if (req.method === "goal/exportHtml") {
        const sessionId = String(req.params?.sessionId ?? "default");
        const html = monolith.goalSupervisor.exportHtml(sessionId);
        return this.formatSuccess(req.id, { html });
      }

      if (req.method === "goal/getNotifications") {
        const history = monolith.broccoliGoalSubstrate.getNotificationDispatcher().getHistory(req.params as any);
        return this.formatSuccess(req.id, { notifications: history });
      }

      if (req.method === "goal/sendNotification") {
        const res = await monolith.broccoliGoalSubstrate.getNotificationDispatcher().dispatch(req.params as any);
        return this.formatSuccess(req.id, res);
      }

      return JSON.stringify({
        jsonrpc: "2.0",
        id: req.id,
        error: { code: -32601, message: `Method '${req.method}' not found` },
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return JSON.stringify({
        jsonrpc: "2.0",
        id: req.id,
        error: { code: -32603, message: `Internal server error: ${errorMsg}` },
      });
    }
  }

  private formatSuccess(id: string | number, result: unknown): string {
    const res: GatewayResponseEnvelope = {
      jsonrpc: "2.0",
      id,
      result,
    };
    return JSON.stringify(res);
  }
}
