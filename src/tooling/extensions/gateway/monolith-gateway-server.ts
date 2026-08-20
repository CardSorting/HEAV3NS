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

      // --- Cron & Automation RPC Endpoints (ADR-016) ---
      if (req.method === "cron/listJobs") {
        const statusFilter = (req.params as any)?.status;
        const jobs = monolith.monolithCronScheduler.listJobs(statusFilter);
        return this.formatSuccess(req.id, { jobs });
      }

      if (req.method === "cron/getJob") {
        const jobId = (req.params as any)?.jobId || "";
        const job = monolith.monolithCronScheduler.getJob(jobId);
        return this.formatSuccess(req.id, { job });
      }

      if (req.method === "cron/registerJob") {
        const manifest = req.params as any;
        const job = monolith.monolithCronScheduler.registerJob(manifest);
        return this.formatSuccess(req.id, { job });
      }

      if (req.method === "cron/triggerJob") {
        const jobId = (req.params as any)?.jobId || "";
        const outcome = await monolith.monolithCronScheduler.triggerJob(jobId);
        return this.formatSuccess(req.id, { outcome });
      }

      if (req.method === "cron/pauseJob") {
        const jobId = (req.params as any)?.jobId || "";
        const success = monolith.monolithCronScheduler.pauseJob(jobId);
        return this.formatSuccess(req.id, { success });
      }

      if (req.method === "cron/resumeJob") {
        const jobId = (req.params as any)?.jobId || "";
        const success = monolith.monolithCronScheduler.resumeJob(jobId);
        return this.formatSuccess(req.id, { success });
      }

      if (req.method === "cron/getGroupedJobs") {
        const groupBy = (req.params as any)?.groupBy || "status";
        const lanes = monolith.monolithCronScheduler.getGroupedJobs(groupBy);
        return this.formatSuccess(req.id, { lanes });
      }

      if (req.method === "cron/getMetrics") {
        const metrics = monolith.monolithCronScheduler.getCronMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "cron/auditHealth") {
        const jobId = (req.params as any)?.jobId || "";
        const audit = monolith.monolithCronScheduler.auditJobHealth(jobId);
        return this.formatSuccess(req.id, { audit });
      }

      // --- Autonomous Swarm Delegation RPC Endpoints (ADR-015) ---
      if (req.method === "swarm/listTasks") {
        const statusFilter = (req.params as any)?.status;
        const tasks = monolith.monolithSwarmDelegator.listTasks(statusFilter);
        return this.formatSuccess(req.id, { tasks });
      }

      if (req.method === "swarm/getTask") {
        const taskId = (req.params as any)?.taskId || "";
        const task = monolith.monolithSwarmDelegator.getTask(taskId);
        return this.formatSuccess(req.id, { task });
      }

      if (req.method === "swarm/delegateTask") {
        const manifest = req.params as any;
        const outcome = await monolith.monolithSwarmDelegator.delegateTask(manifest);
        return this.formatSuccess(req.id, { outcome });
      }

      if (req.method === "swarm/delegateBatch") {
        const tasks = (req.params as any)?.tasks || [];
        const result = await monolith.monolithSwarmDelegator.delegateBatch(tasks);
        return this.formatSuccess(req.id, { result });
      }

      if (req.method === "swarm/abortTask") {
        const taskId = (req.params as any)?.taskId || "";
        const reason = (req.params as any)?.reason || "Aborted via RPC";
        const success = monolith.monolithSwarmDelegator.abortTask(taskId, reason);
        return this.formatSuccess(req.id, { success });
      }

      if (req.method === "swarm/getGroupedTasks") {
        const groupBy = (req.params as any)?.groupBy || "status";
        const lanes = monolith.monolithSwarmDelegator.getGroupedTasks(groupBy);
        return this.formatSuccess(req.id, { lanes });
      }

      if (req.method === "swarm/getMetrics") {
        const metrics = monolith.monolithSwarmDelegator.getSwarmMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "swarm/auditHealth") {
        const parentTaskId = (req.params as any)?.parentTaskId;
        const audit = monolith.monolithSwarmDelegator.auditSwarmHealth(parentTaskId);
        return this.formatSuccess(req.id, { audit });
      }

      // --- Evolutionary Skill Tree RPC Endpoints (ADR-014) ---
      if (req.method === "skills/listNodes") {
        const nodes = monolith.evolutionarySkillEngine.getSubstrate().getAllNodes();
        return this.formatSuccess(req.id, { nodes });
      }

      if (req.method === "skills/getNode") {
        const skillId = (req.params as any)?.skillId || "";
        const node = monolith.evolutionarySkillEngine.getSubstrate().getNode(skillId);
        return this.formatSuccess(req.id, { node });
      }

      if (req.method === "skills/getDag") {
        const dag = monolith.evolutionarySkillEngine.getSubstrate().getDag();
        return this.formatSuccess(req.id, {
          topologicalOrder: dag.topologicalOrder,
          unlockedNodeIds: Array.from(dag.unlockedNodeIds),
          lockedNodeIds: Object.fromEntries(dag.lockedNodeIds.entries()),
          cycles: dag.cycles,
        });
      }

      if (req.method === "skills/getGroupedSkills") {
        const groupBy = (req.params as any)?.groupBy || "tier";
        const lanes = monolith.evolutionarySkillEngine.getGroupedSkills(groupBy);
        return this.formatSuccess(req.id, { lanes });
      }

      if (req.method === "skills/getMetrics") {
        const metrics = monolith.evolutionarySkillEngine.getSkillMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "skills/auditHealth") {
        const skillId = (req.params as any)?.skillId;
        const audit = monolith.evolutionarySkillEngine.auditSkillHealth(skillId);
        return this.formatSuccess(req.id, { audit });
      }

      if (req.method === "skills/forgeCustom") {
        const prompt = String((req.params as any)?.prompt || "");
        const name = (req.params as any)?.name;
        const category = (req.params as any)?.category;
        const tier = (req.params as any)?.tier;
        const appliedPacks = (req.params as any)?.appliedPacks;
        const targetSkillId = (req.params as any)?.targetSkillId;
        const manifest = monolith.evolutionarySkillEngine.getSubstrate().forgeCustomSkill(prompt, {
          name,
          category,
          tier,
          appliedPacks,
          targetSkillId,
        });
        return this.formatSuccess(req.id, { manifest });
      }

      if (req.method === "skills/wizardGetQuestions") {
        const questions = monolith.evolutionarySkillEngine.getSubstrate().getSkillWizardQuestions();
        return this.formatSuccess(req.id, { questions });
      }

      if (req.method === "skills/wizardSubmit") {
        const domainOrCategory = String((req.params as any)?.domainOrCategory || "workflow");
        const executionMode = String((req.params as any)?.executionMode || "autonomous_scripting");
        const initialTier = (req.params as any)?.initialTier;
        const name = (req.params as any)?.name;
        const customRules = (req.params as any)?.customRules;
        const appliedPacks = (req.params as any)?.appliedPacks;

        const manifest = monolith.evolutionarySkillEngine.getSubstrate().buildSkillFromWizard({
          domainOrCategory,
          executionMode,
          initialTier,
          name,
          customRules,
          appliedPacks,
        });
        return this.formatSuccess(req.id, { manifest });
      }

      if (req.method === "skills/cloneAndModify") {
        const sourceSkillId = String((req.params as any)?.sourceSkillId || "");
        const newSkillId = String((req.params as any)?.newSkillId || `fork-${Date.now()}`);
        const name = (req.params as any)?.name;
        const description = (req.params as any)?.description;
        const tier = (req.params as any)?.tier;
        const category = (req.params as any)?.category;

        const manifest = monolith.evolutionarySkillEngine.getSubstrate().cloneAndModifySkill(sourceSkillId, newSkillId, {
          name,
          description,
          tier,
          category,
        });
        return this.formatSuccess(req.id, { manifest });
      }

      if (req.method === "skills/listPowerUps") {
        const packs = monolith.evolutionarySkillEngine.getSubstrate().listSkillPowerUps();
        return this.formatSuccess(req.id, { packs });
      }

      if (req.method === "skills/applyPowerUp") {
        const skillId = String((req.params as any)?.skillId || "");
        const packId = String((req.params as any)?.packId || "");
        const manifest = monolith.evolutionarySkillEngine.getSubstrate().applySkillPowerUp(skillId, packId);
        return this.formatSuccess(req.id, { success: !!manifest, manifest });
      }

      if (req.method === "skills/lintNode") {
        const skillId = String((req.params as any)?.skillId || "");
        const report = monolith.evolutionarySkillEngine.getSubstrate().lintSkillNode(skillId);
        return this.formatSuccess(req.id, { report });
      }

      if (req.method === "skills/autoFixNode") {
        const skillId = String((req.params as any)?.skillId || "");
        const manifest = monolith.evolutionarySkillEngine.getSubstrate().autoFixSkillNode(skillId);
        return this.formatSuccess(req.id, { success: !!manifest, manifest });
      }

      if (req.method === "skills/syncDirectory") {
        const directoryPath = (req.params as any)?.directoryPath;
        const report = monolith.evolutionarySkillEngine.getSubstrate().syncDropDirectory(directoryPath);
        return this.formatSuccess(req.id, { report });
      }

      if (req.method === "skills/exportToDirectory") {
        const skillId = String((req.params as any)?.skillId || "");
        const format = (req.params as any)?.format || "skill_markdown";
        const filename = (req.params as any)?.filename;
        const filePath = monolith.evolutionarySkillEngine.getSubstrate().exportToDropDirectory(skillId, format, filename);
        return this.formatSuccess(req.id, { filePath, format });
      }

      if (req.method === "skills/getDropVaultStatus") {
        const directoryPath = (req.params as any)?.directoryPath;
        const status = monolith.evolutionarySkillEngine.getSubstrate().getDropVaultStatus(directoryPath);
        return this.formatSuccess(req.id, { status });
      }

      if (req.method === "skills/ingestDroppedFile") {
        const filePath = String((req.params as any)?.filePath || "");
        const res = monolith.evolutionarySkillEngine.getSubstrate().ingestDroppedFile(filePath);
        return this.formatSuccess(req.id, res);
      }

      // --- SOUL Persona & Ethos Kernel Endpoints (SOUL-001) ---
      if (req.method === "soul/getManifest") {
        const profileId = (req.params as any)?.profileId;
        const manifest = monolith.broccoliSoulSubstrate.getManifest(profileId);
        return this.formatSuccess(req.id, { manifest });
      }

      if (req.method === "soul/tuneTrait") {
        const traitId = String((req.params as any)?.traitId || "");
        const deltaOrTarget = Number((req.params as any)?.deltaOrTarget) || 0;
        const isDelta = Boolean((req.params as any)?.isDelta);
        const profileId = (req.params as any)?.profileId;
        const res = monolith.broccoliSoulSubstrate.tuneTrait(traitId, deltaOrTarget, isDelta, profileId);
        return this.formatSuccess(req.id, res);
      }

      if (req.method === "soul/switchArchetype") {
        const archetype = (req.params as any)?.archetype;
        const rationale = (req.params as any)?.rationale;
        const profileId = (req.params as any)?.profileId;
        const res = monolith.broccoliSoulSubstrate.switchArchetype(archetype, rationale, profileId);
        return this.formatSuccess(req.id, res);
      }

      if (req.method === "soul/appendAxiom") {
        const axiom = (req.params as any)?.axiom;
        const profileId = (req.params as any)?.profileId;
        const res = monolith.broccoliSoulSubstrate.appendAxiom(axiom, profileId);
        return this.formatSuccess(req.id, res);
      }

      if (req.method === "soul/getGroupedTraits") {
        const groupBy = (req.params as any)?.groupBy || "category";
        const sortBy = (req.params as any)?.sortBy || "weight";
        const direction = (req.params as any)?.direction || "desc";
        const lanes = monolith.broccoliSoulSubstrate.getGroupedTraits(groupBy, sortBy, direction);
        return this.formatSuccess(req.id, { lanes });
      }

      if (req.method === "soul/getMetrics") {
        const profileId = (req.params as any)?.profileId;
        const metrics = monolith.broccoliSoulSubstrate.getSoulMetrics(profileId);
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "soul/auditHealth") {
        const profileId = (req.params as any)?.profileId;
        const audit = monolith.broccoliSoulSubstrate.auditSoulHealth(profileId);
        return this.formatSuccess(req.id, { audit });
      }

      if (req.method === "soul/listPresets") {
        const category = (req.params as any)?.category;
        const presets = monolith.broccoliSoulSubstrate.listPresets(category);
        return this.formatSuccess(req.id, { presets });
      }

      if (req.method === "soul/applyPreset") {
        const presetId = String((req.params as any)?.presetId || "");
        const rationale = (req.params as any)?.rationale;
        const profileId = (req.params as any)?.profileId;
        const res = monolith.broccoliSoulSubstrate.applyPreset(presetId, rationale, profileId);
        return this.formatSuccess(req.id, res);
      }

      if (req.method === "soul/explainDiff") {
        const previousHash = (req.params as any)?.previousHash;
        const profileId = (req.params as any)?.profileId;
        const diff = monolith.broccoliSoulSubstrate.getDiffReport(previousHash, profileId);
        return this.formatSuccess(req.id, { diff });
      }

      if (req.method === "soul/searchFuzzy") {
        const query = String((req.params as any)?.query || "");
        const limit = Number((req.params as any)?.limit) || 5;
        const profileId = (req.params as any)?.profileId;
        const suggestions = monolith.broccoliSoulSubstrate.queryTraitsFuzzy(query, limit, profileId);
        return this.formatSuccess(req.id, { suggestions });
      }

      if (req.method === "soul/createBookmark") {
        const label = String((req.params as any)?.label || "checkpoint");
        const description = (req.params as any)?.description || "";
        const tags = Array.isArray((req.params as any)?.tags) ? (req.params as any)?.tags : [];
        const profileId = (req.params as any)?.profileId;
        const bookmark = monolith.broccoliSoulSubstrate.createBookmark(label, description, tags, profileId);
        return this.formatSuccess(req.id, { bookmark });
      }

      if (req.method === "soul/listBookmarks") {
        const tag = (req.params as any)?.tag;
        const profileId = (req.params as any)?.profileId;
        const bookmarks = monolith.broccoliSoulSubstrate.listBookmarks(tag, profileId);
        return this.formatSuccess(req.id, { bookmarks });
      }

      if (req.method === "soul/restoreBookmark") {
        const idOrLabel = String((req.params as any)?.bookmarkIdOrLabel || "");
        const profileId = (req.params as any)?.profileId;
        const restored = monolith.broccoliSoulSubstrate.restoreBookmark(idOrLabel, profileId);
        return this.formatSuccess(req.id, { restored });
      }

      if (req.method === "soul/exportFormat") {
        const format = (req.params as any)?.format || "soul_markdown";
        const profileId = (req.params as any)?.profileId;
        const exported = monolith.broccoliSoulSubstrate.exportFormat(format, profileId);
        return this.formatSuccess(req.id, { format, content: exported });
      }

      if (req.method === "soul/importFormat") {
        const content = String((req.params as any)?.content || "");
        const format = (req.params as any)?.format;
        const profileId = (req.params as any)?.profileId;
        const importRes = monolith.broccoliSoulSubstrate.importFormat(content, format, profileId);
        return this.formatSuccess(req.id, importRes);
      }

      if (req.method === "soul/getTaxonomy") {
        const taxonomy = monolith.broccoliSoulSubstrate.getTaxonomy();
        return this.formatSuccess(req.id, { taxonomy });
      }

      if (req.method === "soul/getAuditTrail") {
        const limit = Number((req.params as any)?.limit) || 50;
        const auditTrail = monolith.broccoliSoulSubstrate.getAuditTrail(limit);
        return this.formatSuccess(req.id, { auditTrail });
      }

      if (req.method === "soul/forgeCustom") {
        const prompt = String((req.params as any)?.prompt || "");
        const name = (req.params as any)?.name;
        const appliedPacks = (req.params as any)?.appliedPacks;
        const profileId = (req.params as any)?.profileId;
        const manifest = monolith.broccoliSoulSubstrate.forgeCustomSoul(prompt, { name, appliedPacks }, profileId);
        return this.formatSuccess(req.id, { manifest });
      }

      if (req.method === "soul/wizardGetQuestions") {
        const questions = monolith.broccoliSoulSubstrate.getWizardQuestions();
        return this.formatSuccess(req.id, { questions });
      }

      if (req.method === "soul/wizardSubmit") {
        const roleOrGoal = String((req.params as any)?.roleOrGoal || "custom");
        const personalityVibe = String((req.params as any)?.personalityVibe || "warm_encouraging");
        const communicationStyle = String((req.params as any)?.communicationStyle || "conversational");
        const strictnessLevel = String((req.params as any)?.strictnessLevel || "balanced");
        const name = (req.params as any)?.name;
        const customRules = (req.params as any)?.customRules;
        const appliedPacks = (req.params as any)?.appliedPacks;

        const manifest = monolith.broccoliSoulSubstrate.buildSoulFromWizard({
          name,
          roleOrGoal,
          personalityVibe,
          communicationStyle,
          strictnessLevel,
          customRules,
          appliedPacks,
        });
        return this.formatSuccess(req.id, { manifest });
      }

      if (req.method === "soul/cloneAndModify") {
        const sourceProfileId = String((req.params as any)?.sourceProfileId || "default");
        const newProfileId = String((req.params as any)?.newProfileId || `fork-${Date.now()}`);
        const name = (req.params as any)?.name;
        const summary = (req.params as any)?.summary;
        const style = (req.params as any)?.style || {};

        const manifest = monolith.broccoliSoulSubstrate.cloneAndModifyProfile(sourceProfileId, newProfileId, {
          name,
          summary,
          style,
        });
        return this.formatSuccess(req.id, { manifest });
      }

      if (req.method === "soul/listPersonalityPacks") {
        const packs = monolith.broccoliSoulSubstrate.listPersonalityPacks();
        return this.formatSuccess(req.id, { packs });
      }

      if (req.method === "soul/applyPersonalityPack") {
        const packId = String((req.params as any)?.packId || "");
        const profileId = (req.params as any)?.profileId;
        const res = monolith.broccoliSoulSubstrate.applyPersonalityPack(packId, profileId);
        return this.formatSuccess(req.id, res);
      }

      if (req.method === "soul/lintPersona") {
        const profileId = (req.params as any)?.profileId;
        const report = monolith.broccoliSoulSubstrate.lintProfile(profileId);
        return this.formatSuccess(req.id, { report });
      }

      if (req.method === "soul/autoFixPersona") {
        const profileId = (req.params as any)?.profileId;
        const res = monolith.broccoliSoulSubstrate.autoFixProfile(profileId);
        return this.formatSuccess(req.id, res);
      }

      if (req.method === "soul/syncDirectory") {
        const directoryPath = (req.params as any)?.directoryPath;
        const report = monolith.broccoliSoulSubstrate.syncDropDirectory(directoryPath);
        return this.formatSuccess(req.id, { report });
      }

      if (req.method === "soul/exportToDirectory") {
        const profileId = (req.params as any)?.profileId;
        const format = (req.params as any)?.format || "soul_markdown";
        const filename = (req.params as any)?.filename;
        const filePath = monolith.broccoliSoulSubstrate.exportToDropDirectory(profileId, format, filename);
        return this.formatSuccess(req.id, { filePath, format });
      }

      if (req.method === "soul/getDropVaultStatus") {
        const directoryPath = (req.params as any)?.directoryPath;
        const status = monolith.broccoliSoulSubstrate.getDropVaultStatus();
        return this.formatSuccess(req.id, { status });
      }

      if (req.method === "soul/ingestDroppedFile") {
        const filePath = String((req.params as any)?.filePath || "");
        const res = monolith.broccoliSoulSubstrate.ingestDroppedFile(filePath);
        return this.formatSuccess(req.id, res);
      }

      // --- Native Email & Inbox Endpoints (ADR-123) ---
      if (req.method === "email/listMessages") {
        const messages = monolith.broccoliEmailSubstrate.listMessages();
        return this.formatSuccess(req.id, { messages });
      }

      if (req.method === "email/getMessage") {
        const id = String((req.params as any)?.id || "");
        const message = monolith.broccoliEmailSubstrate.getMessage(id);
        return this.formatSuccess(req.id, { message });
      }

      if (req.method === "email/triageInbox") {
        const report = monolith.deterministicEmailEngine.triageInbox(monolith.broccoliEmailSubstrate.listMessages());
        return this.formatSuccess(req.id, { report });
      }

      if (req.method === "email/stageDraft") {
        const draft = (req.params as any)?.draft;
        if (draft) {
          monolith.broccoliEmailSubstrate.storeDraft(draft);
        }
        return this.formatSuccess(req.id, { success: true });
      }

      if (req.method === "email/approveDraft") {
        const draftId = String((req.params as any)?.draftId || "");
        const success = monolith.broccoliEmailSubstrate.approveDraft(draftId);
        return this.formatSuccess(req.id, { success });
      }

      if (req.method === "email/getGroupedEmails") {
        const groupBy = (req.params as any)?.groupBy || "disposition";
        const sortBy = (req.params as any)?.sortBy || "date";
        const direction = (req.params as any)?.direction || "desc";
        const lanes = monolith.broccoliEmailSubstrate.getGroupedEmails(groupBy, sortBy, direction);
        return this.formatSuccess(req.id, { lanes });
      }

      if (req.method === "email/getMetrics") {
        const metrics = monolith.broccoliEmailSubstrate.getEmailMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "email/auditHealth") {
        const audit = monolith.broccoliEmailSubstrate.auditEmailHealth();
        return this.formatSuccess(req.id, { audit });
      }

      // --- Unified Deadline & ESTOP Endpoints (ADR-101) ---
      if (req.method === "deadline/getMetrics") {
        const metrics = monolith.broccoliDeadlineSubstrate.getDeadlineMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "deadline/getEstopState") {
        const state = monolith.broccoliDeadlineSubstrate.getEstopState();
        return this.formatSuccess(req.id, { state });
      }

      if (req.method === "deadline/engageEstop") {
        const reason = (req.params as any)?.reason || "Operator stop";
        const engagedBy = (req.params as any)?.engagedBy || "operator";
        monolith.broccoliDeadlineSubstrate.setEstop(true, reason, engagedBy);
        return this.formatSuccess(req.id, { engaged: true, reason });
      }

      if (req.method === "deadline/disengageEstop") {
        monolith.broccoliDeadlineSubstrate.setEstop(false);
        return this.formatSuccess(req.id, { engaged: false });
      }

      if (req.method === "deadline/auditHealth") {
        const audit = monolith.broccoliDeadlineSubstrate.auditDeadlineHealth();
        return this.formatSuccess(req.id, { audit });
      }

      if (req.method === "deadline/getGroupedDeadlines") {
        const groupBy = (req.params as any)?.groupBy || "status";
        const sortBy = (req.params as any)?.sortBy || "timestamp";
        const direction = (req.params as any)?.direction || "desc";
        const lanes = monolith.broccoliDeadlineSubstrate.getGroupedDeadlines(groupBy, sortBy, direction);
        return this.formatSuccess(req.id, { lanes });
      }

      if (req.method === "deadline/listLeases") {
        const status = (req.params as any)?.status;
        const leases = monolith.broccoliDeadlineSubstrate.listLeases(status);
        return this.formatSuccess(req.id, { leases });
      }

      if (req.method === "deadline/runBounded") {
        const timeoutMs = Number((req.params as any)?.timeoutMs) || 5000;
        const actionName = String((req.params as any)?.actionName || "bounded_action");
        const simDuration = Number((req.params as any)?.simDurationMs) || 10;
        const result = await monolith.deadlineSupervisor.runBounded(async () => {
          await new Promise((r) => setTimeout(r, simDuration));
          return { action: actionName, status: "completed" };
        }, timeoutMs);
        return this.formatSuccess(req.id, { result });
      }

      // --- Knowledge Graph & Memory Curator Endpoints (ADR-028) ---
      if (req.method === "memory/getMetrics") {
        const metrics = monolith.broccoliLearningSubstrate.getMemoryMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "memory/auditHealth") {
        const audit = monolith.broccoliLearningSubstrate.auditMemoryHealth();
        return this.formatSuccess(req.id, { audit });
      }

      if (req.method === "memory/rememberNode") {
        const node = (req.params as any)?.node;
        if (node) {
          monolith.broccoliLearningSubstrate.rememberNode(node);
        }
        return this.formatSuccess(req.id, { success: true });
      }

      if (req.method === "memory/recallNodes") {
        const query = String((req.params as any)?.query || "");
        const results = monolith.broccoliLearningSubstrate.queryMemory({ query });
        return this.formatSuccess(req.id, { results });
      }

      if (req.method === "memory/forgetNode") {
        const nodeId = String((req.params as any)?.nodeId || "");
        const success = monolith.broccoliLearningSubstrate.forgetNode(nodeId);
        return this.formatSuccess(req.id, { success });
      }

      if (req.method === "memory/consolidateNodes") {
        const nodeIds = (req.params as any)?.nodeIds || [];
        const result = monolith.broccoliLearningSubstrate.bulkConsolidate(nodeIds);
        return this.formatSuccess(req.id, { result });
      }

      if (req.method === "memory/getGroupedMemories") {
        const groupBy = (req.params as any)?.groupBy || "type";
        const sortBy = (req.params as any)?.sortBy || "confidence";
        const direction = (req.params as any)?.direction || "desc";
        const lanes = monolith.broccoliLearningSubstrate.getGroupedMemories(groupBy, sortBy, direction);
        return this.formatSuccess(req.id, { lanes });
      }

      if (req.method === "memory/listNodes") {
        const nodes = monolith.broccoliLearningSubstrate.getGraph().getAllNodes();
        return this.formatSuccess(req.id, { nodes });
      }

      // --- Cost Governance & Token Accounting Endpoints (ADR-042) ---
      if (req.method === "cost/getMetrics") {
        const metrics = monolith.broccoliCostSubstrate.getCostMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "cost/auditHealth") {
        const audit = monolith.broccoliCostSubstrate.auditCostHealth();
        return this.formatSuccess(req.id, { audit });
      }

      if (req.method === "cost/calculateTurnCost") {
        const modelId = String((req.params as any)?.modelId || "gpt-4o");
        const promptTokens = Number((req.params as any)?.promptTokens) || 0;
        const completionTokens = Number((req.params as any)?.completionTokens) || 0;
        const cachedTokens = Number((req.params as any)?.cachedPromptTokens) || 0;
        const cost = monolith.deterministicCostGovernor.calculateTurnCost(modelId, promptTokens, completionTokens, cachedTokens);
        return this.formatSuccess(req.id, { cost });
      }

      if (req.method === "cost/evaluatePreFlight") {
        const modelId = String((req.params as any)?.modelId || "gpt-4o");
        const promptTokens = Number((req.params as any)?.promptTokens) || 0;
        const completionTokens = Number((req.params as any)?.completionTokens) || 0;
        const result = monolith.costGovernanceSupervisor.evaluatePreFlight(promptTokens, completionTokens, modelId);
        return this.formatSuccess(req.id, { result });
      }

      if (req.method === "cost/recordTurn") {
        const turnIndex = Number((req.params as any)?.turnIndex) || 1;
        const modelId = String((req.params as any)?.modelId || "gpt-4o");
        const promptTokens = Number((req.params as any)?.promptTokens) || 0;
        const completionTokens = Number((req.params as any)?.completionTokens) || 0;
        const cachedTokens = Number((req.params as any)?.cachedPromptTokens) || 0;
        const entry = monolith.costGovernanceSupervisor.recordTurn(turnIndex, modelId, promptTokens, completionTokens, cachedTokens);
        return this.formatSuccess(req.id, { entry });
      }

      if (req.method === "cost/setBudgetCap") {
        const config = (req.params as any)?.config || { hardCapEnforced: false };
        monolith.costGovernanceSupervisor.setBudgetCap(config);
        return this.formatSuccess(req.id, { success: true });
      }

      if (req.method === "cost/getGroupedCosts") {
        const groupBy = (req.params as any)?.groupBy || "model";
        const sortBy = (req.params as any)?.sortBy || "cost";
        const direction = (req.params as any)?.direction || "desc";
        const lanes = monolith.broccoliCostSubstrate.getGroupedCosts(groupBy, sortBy, direction);
        return this.formatSuccess(req.id, { lanes });
      }

      if (req.method === "cost/listLedger") {
        const limit = Number((req.params as any)?.limit) || 20;
        const ledger = monolith.broccoliCostSubstrate.listLedger(limit);
        return this.formatSuccess(req.id, { ledger });
      }

      // --- Checkpoint Kernel & CAS Store Endpoints (ADR-039) ---
      if (req.method === "checkpoint/getMetrics") {
        const metrics = monolith.broccoliCheckpointSubstrate.getCheckpointMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "checkpoint/auditHealth") {
        const audit = monolith.broccoliCheckpointSubstrate.auditCheckpointHealth();
        return this.formatSuccess(req.id, { audit });
      }

      if (req.method === "checkpoint/createCheckpoint") {
        const message = String((req.params as any)?.message || "Checkpoint commit");
        const files = (req.params as any)?.files || [];
        const commit = monolith.checkpointKernelSupervisor.checkpoint(message, files);
        return this.formatSuccess(req.id, { commit });
      }

      if (req.method === "checkpoint/rollback") {
        const checkpointId = String((req.params as any)?.checkpointId || "");
        const result = monolith.checkpointKernelSupervisor.rollback(checkpointId);
        return this.formatSuccess(req.id, { result });
      }

      if (req.method === "checkpoint/getCheckpoint") {
        const id = String((req.params as any)?.id || "");
        const commit = monolith.checkpointKernelSupervisor.getCheckpoint(id);
        return this.formatSuccess(req.id, { commit });
      }

      if (req.method === "checkpoint/listCheckpoints") {
        const limit = Number((req.params as any)?.limit) || 20;
        const checkpoints = monolith.broccoliCheckpointSubstrate.listCheckpoints(limit);
        return this.formatSuccess(req.id, { checkpoints });
      }

      if (req.method === "checkpoint/getGroupedCheckpoints") {
        const groupBy = (req.params as any)?.groupBy || "frame";
        const sortBy = (req.params as any)?.sortBy || "timestamp";
        const direction = (req.params as any)?.direction || "desc";
        const lanes = monolith.broccoliCheckpointSubstrate.getGroupedCheckpoints(groupBy, sortBy, direction);
        return this.formatSuccess(req.id, { lanes });
      }

      // --- Clarify & Intent Disambiguation Endpoints (ADR-037) ---
      if (req.method === "clarify/getMetrics") {
        const metrics = monolith.broccoliClarifySubstrate.getClarifyMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "clarify/auditHealth") {
        const audit = monolith.broccoliClarifySubstrate.auditClarifyHealth();
        return this.formatSuccess(req.id, { audit });
      }

      if (req.method === "clarify/askQuestion") {
        const question = String((req.params as any)?.question || "Clarification question");
        const choices = (req.params as any)?.choices || [];
        const mode = (req.params as any)?.mode || "single_select";
        const inq = monolith.clarifyInquirySupervisor.askQuestion(question, choices, mode);
        return this.formatSuccess(req.id, { inquiry: inq });
      }

      if (req.method === "clarify/resolveInquiry") {
        const inquiryId = String((req.params as any)?.inquiryId || "");
        const selectedChoices = (req.params as any)?.selectedChoiceIds || [];
        const res = monolith.clarifyInquirySupervisor.resolveInquiry(inquiryId, selectedChoices);
        return this.formatSuccess(req.id, { resolution: res });
      }

      if (req.method === "clarify/getInquiry") {
        const id = String((req.params as any)?.id || "");
        const inquiry = monolith.clarifyInquirySupervisor.getInquiry(id);
        return this.formatSuccess(req.id, { inquiry });
      }

      if (req.method === "clarify/listInquiries") {
        const limit = Number((req.params as any)?.limit) || 20;
        const inquiries = monolith.broccoliClarifySubstrate.listInquiries(limit);
        return this.formatSuccess(req.id, { inquiries });
      }

      if (req.method === "clarify/getGroupedInquiries") {
        const groupBy = (req.params as any)?.groupBy || "category";
        const lanes = monolith.broccoliClarifySubstrate.getGroupedInquiries(groupBy);
        return this.formatSuccess(req.id, { lanes });
      }

      if (req.method === "clarify/startGrillMe") {
        const title = String((req.params as any)?.title || "Grill-Me Plan Alignment");
        const rootQuestion = String((req.params as any)?.rootQuestion || "What is the primary objective?");
        const choices = (req.params as any)?.choices || ["Option A", "Option B"];
        const tree = monolith.clarifyInquirySupervisor.startGrillMeInterview(title, rootQuestion, choices);
        return this.formatSuccess(req.id, { tree });
      }

      // --- SWE Benchmark & Batch Evaluation Endpoints (ADR-036) ---
      if (req.method === "batch/getMetrics") {
        const metrics = monolith.broccoliBatchSubstrate.getBatchMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "batch/auditHealth") {
        const audit = monolith.broccoliBatchSubstrate.auditBatchHealth();
        return this.formatSuccess(req.id, { audit });
      }

      if (req.method === "batch/createRun") {
        const title = String((req.params as any)?.title || "Benchmark run");
        const benchmarkType = (req.params as any)?.benchmarkType || "swe_bench";
        const config = (req.params as any)?.config || {};
        const run = monolith.batchEvaluationSupervisor.createRun(title, benchmarkType, config);
        return this.formatSuccess(req.id, { run });
      }

      if (req.method === "batch/enqueueTask") {
        const runId = String((req.params as any)?.runId || "");
        const prompt = String((req.params as any)?.prompt || "");
        const criteria = (req.params as any)?.expectedCriteria || [];
        const task = monolith.batchEvaluationSupervisor.enqueueTask(runId, prompt, criteria);
        return this.formatSuccess(req.id, { task });
      }

      if (req.method === "batch/executeTask") {
        const taskId = String((req.params as any)?.taskId || "");
        const result = await monolith.batchEvaluationSupervisor.executeTask(taskId);
        return this.formatSuccess(req.id, { result });
      }

      if (req.method === "batch/getRun") {
        const runId = String((req.params as any)?.runId || "");
        const run = monolith.batchEvaluationSupervisor.getRun(runId);
        return this.formatSuccess(req.id, { run });
      }

      if (req.method === "batch/listRuns") {
        const limit = Number((req.params as any)?.limit) || 20;
        const runs = monolith.broccoliBatchSubstrate.listRuns(limit);
        return this.formatSuccess(req.id, { runs });
      }

      if (req.method === "batch/getGroupedTasks") {
        const groupBy = (req.params as any)?.groupBy || "benchmarkType";
        const lanes = monolith.broccoliBatchSubstrate.getGroupedTasks(groupBy);
        return this.formatSuccess(req.id, { lanes });
      }

      // --- Turn Retry & One-Shot Recovery Endpoints (ADR-107) ---
      if (req.method === "retry/getMetrics") {
        const metrics = monolith.broccoliTurnRetrySubstrate.getTurnRetryMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "retry/auditHealth") {
        const audit = monolith.broccoliTurnRetrySubstrate.auditTurnRetryHealth();
        return this.formatSuccess(req.id, { audit });
      }

      if (req.method === "retry/createState") {
        const turnIndex = Number((req.params as any)?.turnIndex) || 1;
        const errorCategory = (req.params as any)?.errorCategory;
        const state = monolith.turnRetrySupervisor.createState(turnIndex, errorCategory);
        return this.formatSuccess(req.id, { state });
      }

      if (req.method === "retry/triggerGuard") {
        const stateId = String((req.params as any)?.stateId || "");
        const branch = (req.params as any)?.branch;
        const details = (req.params as any)?.details;
        const success = monolith.turnRetrySupervisor.triggerGuard(stateId, branch, details);
        return this.formatSuccess(req.id, { success });
      }

      if (req.method === "retry/classifyAndRecover") {
        const turnIndex = Number((req.params as any)?.turnIndex) || 1;
        const errorMessage = String((req.params as any)?.errorMessage || "");
        const stateId = (req.params as any)?.stateId;
        const result = monolith.turnRetrySupervisor.classifyAndRecover(turnIndex, errorMessage, stateId);
        return this.formatSuccess(req.id, { result });
      }

      if (req.method === "retry/getState") {
        const stateId = String((req.params as any)?.stateId || "");
        const state = monolith.turnRetrySupervisor.getState(stateId);
        return this.formatSuccess(req.id, { state });
      }

      if (req.method === "retry/listStates") {
        const limit = Number((req.params as any)?.limit) || 20;
        const states = monolith.broccoliTurnRetrySubstrate.listStates(limit);
        return this.formatSuccess(req.id, { states });
      }

      if (req.method === "retry/getGroupedStates") {
        const groupBy = (req.params as any)?.groupBy || "status";
        const lanes = monolith.broccoliTurnRetrySubstrate.getGroupedStates(groupBy);
        return this.formatSuccess(req.id, { lanes });
      }

      // --- Code Execution & Sandboxed Scripting Endpoints (ADR-034) ---
      if (req.method === "execution/getMetrics") {
        const metrics = monolith.broccoliExecutionSubstrate.getExecutionMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "execution/auditHealth") {
        const audit = monolith.broccoliExecutionSubstrate.auditExecutionHealth();
        return this.formatSuccess(req.id, { audit });
      }

      if (req.method === "execution/executeCode") {
        const code = String((req.params as any)?.code || "");
        const language = (req.params as any)?.language || "javascript";
        const context = (req.params as any)?.context || {};
        const record = await monolith.codeExecutionSupervisor.executeCode(code, language, context);
        return this.formatSuccess(req.id, { record });
      }

      if (req.method === "execution/evaluateScript") {
        const script = String((req.params as any)?.script || "");
        const record = await monolith.codeExecutionSupervisor.evaluateScript(script);
        return this.formatSuccess(req.id, { record });
      }

      if (req.method === "execution/getExecution") {
        const id = String((req.params as any)?.id || "");
        const record = monolith.codeExecutionSupervisor.getExecution(id);
        return this.formatSuccess(req.id, { record });
      }

      if (req.method === "execution/listExecutions") {
        const limit = Number((req.params as any)?.limit) || 20;
        const records = monolith.broccoliExecutionSubstrate.listExecutions(limit);
        return this.formatSuccess(req.id, { records });
      }

      if (req.method === "execution/getGroupedExecutions") {
        const groupBy = (req.params as any)?.groupBy || "language";
        const lanes = monolith.broccoliExecutionSubstrate.getGroupedExecutions(groupBy);
        return this.formatSuccess(req.id, { lanes });
      }

      // --- Computer Use & Virtual Display Endpoints (ADR-040) ---
      if (req.method === "computer/getMetrics") {
        const metrics = monolith.broccoliDisplaySubstrate.getMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "computer/auditHealth") {
        const audit = monolith.broccoliDisplaySubstrate.auditHealth();
        return this.formatSuccess(req.id, { audit });
      }

      if (req.method === "computer/executeAction") {
        const action = (req.params as any)?.action || "capture";
        const params = (req.params as any)?.params || {};
        const result = monolith.computerUseSupervisor.executeAction(action, params);
        return this.formatSuccess(req.id, { result });
      }

      if (req.method === "computer/captureFrame") {
        const result = monolith.computerUseSupervisor.executeAction("capture");
        return this.formatSuccess(req.id, { frame: result.frame });
      }

      if (req.method === "computer/click") {
        const x = (req.params as any)?.x;
        const y = (req.params as any)?.y;
        const elementId = (req.params as any)?.elementId;
        const result = monolith.computerUseSupervisor.executeAction("click", { x, y, elementId });
        return this.formatSuccess(req.id, { result });
      }

      if (req.method === "computer/type") {
        const text = String((req.params as any)?.text || "");
        const result = monolith.computerUseSupervisor.executeAction("type", { text });
        return this.formatSuccess(req.id, { result });
      }

      if (req.method === "computer/listActions") {
        const limit = Number((req.params as any)?.limit) || 20;
        const actions = monolith.broccoliDisplaySubstrate.listActions(limit);
        return this.formatSuccess(req.id, { actions });
      }

      if (req.method === "computer/getGroupedActions") {
        const groupBy = (req.params as any)?.groupBy || "action";
        const lanes = monolith.broccoliDisplaySubstrate.getGroupedActions(groupBy);
        return this.formatSuccess(req.id, { lanes });
      }

      // --- Context Compression & Compactor Endpoints (ADR-038) ---
      if (req.method === "compression/getMetrics") {
        const metrics = monolith.broccoliCompressionSubstrate.getMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "compression/auditHealth") {
        const audit = monolith.broccoliCompressionSubstrate.auditHealth();
        return this.formatSuccess(req.id, { audit });
      }

      if (req.method === "compression/compactTrajectory") {
        const turns = (req.params as any)?.turns || [];
        const budget = (req.params as any)?.budget;
        const result = monolith.contextCompressionSupervisor.compactTrajectory(turns, budget);
        return this.formatSuccess(req.id, { result });
      }

      if (req.method === "compression/pruneToolResult") {
        const rawOutput = String((req.params as any)?.rawOutput || "");
        const policy = (req.params as any)?.policy;
        const result = monolith.contextCompressionSupervisor.pruneToolResult(rawOutput, policy);
        return this.formatSuccess(req.id, { result });
      }

      if (req.method === "compression/getSummary") {
        const id = String((req.params as any)?.id || "");
        const summary = monolith.contextCompressionSupervisor.getSummary(id);
        return this.formatSuccess(req.id, { summary });
      }

      if (req.method === "compression/listSummaries") {
        const limit = Number((req.params as any)?.limit) || 20;
        const summaries = monolith.broccoliCompressionSubstrate.listSummaries(limit);
        return this.formatSuccess(req.id, { summaries });
      }

      if (req.method === "compression/getGroupedSummaries") {
        const groupBy = (req.params as any)?.groupBy || "savingsTier";
        const lanes = monolith.broccoliCompressionSubstrate.getGroupedSummaries(groupBy);
        return this.formatSuccess(req.id, { lanes });
      }

      // --- Autonomous Agent Wallet & DeFi Endpoints (ADR-123) ---
      if (req.method === "wallet/getMetrics") {
        const metrics = monolith.broccoliWalletSubstrate.getMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "wallet/auditHealth") {
        const audit = monolith.broccoliWalletSubstrate.auditHealth();
        return this.formatSuccess(req.id, { audit });
      }

      if (req.method === "wallet/getPortfolio") {
        const address = String((req.params as any)?.address || "");
        const chain = (req.params as any)?.chain || "base";
        const result = monolith.walletSupervisor.getPortfolio(address, chain);
        return this.formatSuccess(req.id, { result });
      }

      if (req.method === "wallet/listPortfolios") {
        const portfolios = monolith.broccoliWalletSubstrate.listPortfolios();
        return this.formatSuccess(req.id, { portfolios });
      }

      if (req.method === "wallet/getGroupedPortfolios") {
        const groupBy = (req.params as any)?.groupBy || "chain";
        const lanes = monolith.broccoliWalletSubstrate.getGroupedPortfolios(groupBy);
        return this.formatSuccess(req.id, { lanes });
      }

      if (req.method === "wallet/simulateTransaction") {
        const chain = (req.params as any)?.chain || "base";
        const fromAddress = String((req.params as any)?.fromAddress || "");
        const toAddress = String((req.params as any)?.toAddress || "");
        const valueNative = (req.params as any)?.valueNative;
        const result = monolith.walletSupervisor.simulateTransaction({ chain, fromAddress, toAddress, valueNative });
        return this.formatSuccess(req.id, { result });
      }

      // --- Persistent Multi-Profile Endpoints (ADR-119) ---
      if (req.method === "profiles/getMetrics") {
        const metrics = monolith.broccoliProfileSubstrate.getMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "profiles/auditHealth") {
        const audit = monolith.broccoliProfileSubstrate.auditHealth();
        return this.formatSuccess(req.id, { audit });
      }

      if (req.method === "profiles/getProfile") {
        const id = String((req.params as any)?.id || "");
        const resolve = Boolean((req.params as any)?.resolve);
        const result = monolith.profileSupervisor.getProfile(id, resolve);
        return this.formatSuccess(req.id, { result });
      }

      if (req.method === "profiles/listProfiles") {
        const query = (req.params as any)?.query;
        const profiles = monolith.profileSupervisor.listProfiles(query);
        return this.formatSuccess(req.id, { profiles });
      }

      if (req.method === "profiles/getGroupedProfiles") {
        const groupBy = (req.params as any)?.groupBy || "category";
        const lanes = monolith.broccoliProfileSubstrate.getGroupedProfiles(groupBy);
        return this.formatSuccess(req.id, { lanes });
      }

      if (req.method === "profiles/bindSession") {
        const sessionId = String((req.params as any)?.sessionId || "");
        const profileId = String((req.params as any)?.profileId || "");
        const success = monolith.profileSupervisor.bindSession(sessionId, profileId);
        return this.formatSuccess(req.id, { success, sessionId, profileId });
      }

      // --- Two-Stage Session Titling & Cognitive Insights Endpoints (ADR-085) ---
      if (req.method === "titleInsights/getMetrics") {
        const metrics = monolith.broccoliTitleInsightsSubstrate.getMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "titleInsights/auditHealth") {
        const audit = monolith.broccoliTitleInsightsSubstrate.auditHealth();
        return this.formatSuccess(req.id, { audit });
      }

      if (req.method === "titleInsights/getTitle") {
        const sessionId = String((req.params as any)?.sessionId || "");
        const record = monolith.titleInsightsSupervisor.getTitle(sessionId);
        return this.formatSuccess(req.id, { record });
      }

      if (req.method === "titleInsights/listTitles") {
        const titles = monolith.titleInsightsSupervisor.getAllTitles();
        return this.formatSuccess(req.id, { titles });
      }

      if (req.method === "titleInsights/getGroupedTitles") {
        const groupBy = (req.params as any)?.groupBy || "provenance";
        const lanes = monolith.broccoliTitleInsightsSubstrate.getGroupedTitles(groupBy);
        return this.formatSuccess(req.id, { lanes });
      }

      if (req.method === "titleInsights/generateInsightsReport") {
        const days = Number((req.params as any)?.days || 30);
        const report = monolith.titleInsightsSupervisor.generateInsights(days);
        return this.formatSuccess(req.id, { report });
      }

      // --- Dollar-Denominated Billing Usage & Credit Meter Endpoints (Phase 132 / ADR-108) ---
      if (req.method === "billingUsage/getUsageModel") {
        const model = monolith.billingUsageSupervisor.getUsageModel();
        return this.formatSuccess(req.id, { model });
      }

      if (req.method === "billingUsage/debitUsage") {
        const amountUsd = Number((req.params as any)?.amountUsd || 0);
        const reason = (req.params as any)?.reason;
        const result = monolith.billingUsageSupervisor.debitUsage(amountUsd, reason);
        return this.formatSuccess(req.id, { result });
      }

      if (req.method === "billingUsage/addTopup") {
        const amountUsd = Number((req.params as any)?.amountUsd || 0);
        const reason = (req.params as any)?.reason;
        const result = monolith.billingUsageSupervisor.addTopup(amountUsd, reason);
        return this.formatSuccess(req.id, { result });
      }

      if (req.method === "billingUsage/getMetrics") {
        const metrics = monolith.broccoliBillingUsageSubstrate.getMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "billingUsage/auditHealth") {
        const audit = monolith.broccoliBillingUsageSubstrate.auditHealth();
        return this.formatSuccess(req.id, { audit });
      }

      if (req.method === "billingUsage/getGroupedTransactions") {
        const groupBy = (req.params as any)?.groupBy || "type";
        const lanes = monolith.broccoliBillingUsageSubstrate.getGroupedTransactions(groupBy);
        return this.formatSuccess(req.id, { lanes });
      }

      // --- Async Context Propagation & Security Inheritance Endpoints (Phase 133 / ADR-109) ---
      if (req.method === "threadContext/getMetrics") {
        const metrics = monolith.broccoliThreadContextSubstrate.getMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "threadContext/auditHealth") {
        const audit = monolith.broccoliThreadContextSubstrate.auditHealth();
        return this.formatSuccess(req.id, { audit });
      }

      if (req.method === "threadContext/listContexts") {
        const contexts = monolith.threadContextSupervisor.getAllContexts();
        return this.formatSuccess(req.id, { contexts });
      }

      if (req.method === "threadContext/getContext") {
        const contextId = String((req.params as any)?.contextId || "");
        const descriptor = monolith.broccoliThreadContextSubstrate.getContext(contextId);
        return this.formatSuccess(req.id, { descriptor });
      }

      if (req.method === "threadContext/getGroupedContexts") {
        const groupBy = (req.params as any)?.groupBy || "platform";
        const lanes = monolith.broccoliThreadContextSubstrate.getGroupedContexts(groupBy);
        return this.formatSuccess(req.id, { lanes });
      }

      if (req.method === "threadContext/requestDangerousApproval") {
        const command = String((req.params as any)?.command || "");
        const reason = String((req.params as any)?.reason || "");
        const result = await monolith.threadContextSupervisor.requestDangerousApproval(command, reason);
        return this.formatSuccess(req.id, { result });
      }

      // --- Background Review & Post-Turn Self-Improvement Endpoints (Phase 96 / ADR-048) ---
      if (req.method === "backgroundReview/getMetrics") {
        const metrics = monolith.broccoliReviewSubstrate.getMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "backgroundReview/auditHealth") {
        const audit = monolith.broccoliReviewSubstrate.auditHealth();
        return this.formatSuccess(req.id, { audit });
      }

      if (req.method === "backgroundReview/listReviews") {
        const reviews = monolith.backgroundReviewSupervisor.getReviews();
        return this.formatSuccess(req.id, { reviews });
      }

      if (req.method === "backgroundReview/getReview") {
        const reviewId = String((req.params as any)?.reviewId || "");
        const review = monolith.broccoliReviewSubstrate.getReview(reviewId);
        return this.formatSuccess(req.id, { review });
      }

      if (req.method === "backgroundReview/getGroupedReviews") {
        const groupBy = (req.params as any)?.groupBy || "turn_range";
        const lanes = monolith.broccoliReviewSubstrate.getGroupedReviews(groupBy);
        return this.formatSuccess(req.id, { lanes });
      }

      if (req.method === "backgroundReview/evaluateTurn") {
        const turnIndex = Number((req.params as any)?.turnIndex || 1);
        const userMessage = String((req.params as any)?.userMessage || "");
        const assistantResponse = String((req.params as any)?.assistantResponse || "");
        const toolsUsed = (req.params as any)?.toolsUsed || [];
        const result = monolith.backgroundReviewSupervisor.evaluateTurn(turnIndex, userMessage, assistantResponse, toolsUsed);
        return this.formatSuccess(req.id, { result });
      }

      // --- Diagnostic Doctor & Forensic State Salvage Endpoints (Phase 97 / ADR-049) ---
      if (req.method === "diagnosticDoctor/getMetrics") {
        const metrics = monolith.broccoliDoctorSubstrate.getMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "diagnosticDoctor/auditHealth") {
        const audit = monolith.broccoliDoctorSubstrate.auditHealth();
        return this.formatSuccess(req.id, { audit });
      }

      if (req.method === "diagnosticDoctor/listReports") {
        const reports = monolith.diagnosticDoctorSupervisor.getAllReports();
        return this.formatSuccess(req.id, { reports });
      }

      if (req.method === "diagnosticDoctor/getLatestReport") {
        const report = monolith.diagnosticDoctorSupervisor.getLatestReport();
        return this.formatSuccess(req.id, { report });
      }

      if (req.method === "diagnosticDoctor/getGroupedReports") {
        const groupBy = (req.params as any)?.groupBy || "severity";
        const lanes = monolith.broccoliDoctorSubstrate.getGroupedReports(groupBy);
        return this.formatSuccess(req.id, { lanes });
      }

      if (req.method === "diagnosticDoctor/runDiagnostics") {
        const report = monolith.diagnosticDoctorSupervisor.runDiagnostics();
        return this.formatSuccess(req.id, { report });
      }

      if (req.method === "diagnosticDoctor/salvageSession") {
        const sessionId = String((req.params as any)?.sessionId || "session-temp");
        const rawTranscript = (req.params as any)?.rawTranscript || [];
        const salvage = monolith.diagnosticDoctorSupervisor.salvageSession(sessionId, rawTranscript);
        return this.formatSuccess(req.id, { salvage });
      }

      // --- Identity Federation & Token Lease Endpoints (Phase 98 / ADR-052) ---
      if (req.method === "identityFederation/getMetrics") {
        const metrics = monolith.broccoliAuthSubstrate.getMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "identityFederation/auditHealth") {
        const audit = monolith.broccoliAuthSubstrate.auditHealth();
        return this.formatSuccess(req.id, { audit });
      }

      if (req.method === "identityFederation/listLeases") {
        const leases = monolith.identityFederationSupervisor.getAllLeases();
        return this.formatSuccess(req.id, { leases });
      }

      if (req.method === "identityFederation/getGroupedLeases") {
        const groupBy = (req.params as any)?.groupBy || "provider";
        const lanes = monolith.broccoliAuthSubstrate.getGroupedLeases(groupBy);
        return this.formatSuccess(req.id, { lanes });
      }

      if (req.method === "identityFederation/initiateDeviceFlow") {
        const providerId = (req.params as any)?.providerId || "nous";
        const pending = monolith.identityFederationSupervisor.initiateAuth(providerId);
        return this.formatSuccess(req.id, { pending });
      }

      if (req.method === "identityFederation/completeDeviceAuth") {
        const deviceCode = String((req.params as any)?.deviceCode || "");
        const providerId = (req.params as any)?.providerId || "nous";
        const tier = (req.params as any)?.tier || "pro";
        const lease = monolith.identityFederationSupervisor.completeDeviceAuth(deviceCode, providerId, tier);
        return this.formatSuccess(req.id, { lease });
      }

      if (req.method === "identityFederation/verifyTokenLease") {
        const providerId = (req.params as any)?.providerId || "nous";
        const lease = monolith.identityFederationSupervisor.getActiveLease(providerId);
        const valid = lease ? lease.expiresAt > Date.now() : false;
        return this.formatSuccess(req.id, { valid, lease });
      }

      // --- Session Archive & Multi-Format Exporter Endpoints (Phase 99 / ADR-053) ---
      if (req.method === "sessionArchive/getMetrics") {
        const metrics = monolith.broccoliArchiveSubstrate.getMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "sessionArchive/auditHealth") {
        const audit = monolith.broccoliArchiveSubstrate.auditHealth();
        return this.formatSuccess(req.id, { audit });
      }

      if (req.method === "sessionArchive/listManifests") {
        const manifests = monolith.sessionArchiveSupervisor.getAllManifests();
        return this.formatSuccess(req.id, { manifests });
      }

      if (req.method === "sessionArchive/getGroupedArchives") {
        const groupBy = (req.params as any)?.groupBy || "format";
        const lanes = monolith.broccoliArchiveSubstrate.getGroupedArchives(groupBy);
        return this.formatSuccess(req.id, { lanes });
      }

      if (req.method === "sessionArchive/exportSession") {
        const sessionId = String((req.params as any)?.sessionId || "session-temp");
        const turns = (req.params as any)?.turns || [];
        const format = (req.params as any)?.format || "markdown";
        const result = monolith.sessionArchiveSupervisor.exportSession(sessionId, turns, format);
        return this.formatSuccess(req.id, { result });
      }

      if (req.method === "sessionArchive/getManifest") {
        const archiveId = String((req.params as any)?.archiveId || "");
        const manifest = monolith.broccoliArchiveSubstrate.getManifest(archiveId);
        return this.formatSuccess(req.id, { manifest });
      }

      if (req.method === "sessionArchive/verifyPackage") {
        const archiveId = String((req.params as any)?.archiveId || "");
        const verified = monolith.sessionArchiveSupervisor.verifyPackage(archiveId);
        return this.formatSuccess(req.id, { archiveId, verified });
      }

      // --- Enterprise Integrations Hub & Recipes Endpoints (Phase 96 / ADR-126) ---
      if (req.method === "integrations/getMetrics") {
        const metrics = monolith.broccoliIntegrationsSubstrate.getMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "integrations/auditHealth") {
        const audit = monolith.broccoliIntegrationsSubstrate.auditHealth();
        return this.formatSuccess(req.id, { audit });
      }

      if (req.method === "integrations/listConnections") {
        const connections = monolith.integrationsSupervisor.listConnections();
        return this.formatSuccess(req.id, { connections });
      }

      if (req.method === "integrations/getGroupedConnections") {
        const groupBy = (req.params as any)?.groupBy || "category";
        const lanes = monolith.broccoliIntegrationsSubstrate.getGroupedConnections(groupBy);
        return this.formatSuccess(req.id, { lanes });
      }

      if (req.method === "integrations/listRecipes") {
        const recipes = monolith.integrationsSupervisor.listRecipes();
        return this.formatSuccess(req.id, { recipes });
      }

      if (req.method === "integrations/executeRecipe") {
        const recipeId = String((req.params as any)?.recipeId || "");
        const params = (req.params as any)?.params || {};
        const result = monolith.integrationsSupervisor.executeRecipe(recipeId, params);
        return this.formatSuccess(req.id, { result });
      }

      if (req.method === "integrations/queryIssues") {
        const provider = (req.params as any)?.provider;
        const issues = monolith.integrationsSupervisor.queryIssues({ provider });
        return this.formatSuccess(req.id, { issues });
      }

      // --- Verification Evidence & Quality Gates Endpoints (Phase 92 / ADR-044) ---
      if (req.method === "verificationEvidence/getMetrics") {
        const metrics = monolith.broccoliEvidenceSubstrate.getMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "verificationEvidence/auditHealth") {
        const audit = monolith.broccoliEvidenceSubstrate.auditHealth();
        return this.formatSuccess(req.id, { audit });
      }

      if (req.method === "verificationEvidence/listRecords") {
        const records = monolith.verificationEvidenceSupervisor.getRecords();
        return this.formatSuccess(req.id, { records });
      }

      if (req.method === "verificationEvidence/checkStopGate") {
        const evaluation = monolith.verificationEvidenceSupervisor.checkStopGate();
        return this.formatSuccess(req.id, { evaluation });
      }

      if (req.method === "verificationEvidence/getInsights") {
        const frames = (req.params as any)?.totalFrames || 1;
        const insights = monolith.verificationEvidenceSupervisor.getInsights(frames);
        return this.formatSuccess(req.id, { insights });
      }

      if (req.method === "verificationEvidence/recordEvidence") {
        const p = (req.params as any) || {};
        const record = monolith.verificationEvidenceSupervisor.recordEvidence({
          frameIndex: p.frameIndex || 1,
          command: p.command || "test",
          kind: p.kind || "test",
          scope: p.scope || "workspace",
          passed: p.passed !== false,
          exitCode: p.exitCode || 0,
          durationMs: p.durationMs || 10,
          outputSummary: p.outputSummary || "Pass",
          verifiedPaths: p.verifiedPaths || [],
        });
        return this.formatSuccess(req.id, { record });
      }

      // --- Atomic File Mutation & Patch Engine Endpoints (Phase 77 / ADR-029) ---
      if (req.method === "patchMutation/getMetrics") {
        const metrics = monolith.broccoliPatchSubstrate.getMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "patchMutation/auditHealth") {
        const audit = monolith.broccoliPatchSubstrate.auditHealth();
        return this.formatSuccess(req.id, { audit });
      }

      if (req.method === "patchMutation/listStaged") {
        const staged = monolith.atomicMutationSupervisor.listStaged();
        return this.formatSuccess(req.id, { staged });
      }

      if (req.method === "patchMutation/applyPatch") {
        const patchText = String((req.params as any)?.patch || "");
        const dryRun = Boolean((req.params as any)?.dryRun);
        const result = await monolith.atomicMutationSupervisor.applyPatch(patchText, { dryRun });
        return this.formatSuccess(req.id, { result });
      }

      if (req.method === "patchMutation/stageFile") {
        const filePath = String((req.params as any)?.filePath || "");
        const content = String((req.params as any)?.content || "");
        const entry = monolith.atomicMutationSupervisor.stageFile(filePath, content);
        return this.formatSuccess(req.id, { entry });
      }

      if (req.method === "patchMutation/commitAll") {
        const committed = monolith.atomicMutationSupervisor.commitAll();
        return this.formatSuccess(req.id, { committed });
      }

      // --- Skill Tree Linter Endpoints (Phase 135 / ADR-111 / Target #75) ---
      if (req.method === "skillLinter/getMetrics") {
        const metrics = monolith.broccoliSkillLinterSubstrate.getMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "skillLinter/auditHealth") {
        const audit = monolith.broccoliSkillLinterSubstrate.auditHealth();
        return this.formatSuccess(req.id, { audit });
      }

      if (req.method === "skillLinter/listReports") {
        const reports = monolith.skillLinterSupervisor.listReports();
        return this.formatSuccess(req.id, { reports });
      }

      if (req.method === "skillLinter/lintSkill") {
        const skillName = String((req.params as any)?.skillName || "");
        const rawContent = String((req.params as any)?.rawContent || (req.params as any)?.content || "");
        const dirName = (req.params as any)?.dirName;
        const report = monolith.skillLinterSupervisor.lintSkill({ skillName, rawContent, dirName });
        return this.formatSuccess(req.id, { report });
      }

      if (req.method === "skillLinter/validateDescription") {
        const description = String((req.params as any)?.description || "");
        const result = monolith.skillLinterSupervisor.validateDescription(description);
        return this.formatSuccess(req.id, { result });
      }

      if (req.method === "skillLinter/getConfig") {
        const config = monolith.skillLinterSupervisor.getConfig();
        return this.formatSuccess(req.id, { config });
      }

      // --- Terminal Output Cleaner Endpoints (Phase 136 / ADR-112 / Target #76) ---
      if (req.method === "terminalCleaner/getMetrics") {
        const metrics = monolith.broccoliTerminalCleanerSubstrate.getMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "terminalCleaner/auditHealth") {
        const audit = monolith.broccoliTerminalCleanerSubstrate.auditHealth();
        return this.formatSuccess(req.id, { audit });
      }

      if (req.method === "terminalCleaner/listEvents") {
        const events = monolith.terminalCleanerSupervisor.getSubstrate().listEvents();
        return this.formatSuccess(req.id, { events });
      }

      if (req.method === "terminalCleaner/stripAnsi") {
        const text = String((req.params as any)?.text || "");
        const cleaned = monolith.terminalCleanerSupervisor.stripAnsi(text);
        return this.formatSuccess(req.id, { cleaned });
      }

      if (req.method === "terminalCleaner/sanitizeDisplayText") {
        const text = String((req.params as any)?.text || "");
        const cleaned = monolith.terminalCleanerSupervisor.sanitizeDisplayText(text);
        return this.formatSuccess(req.id, { cleaned });
      }

      if (req.method === "terminalCleaner/classifyPath") {
        const filePath = String((req.params as any)?.filePath || "");
        const classification = monolith.terminalCleanerSupervisor.classifyPath(filePath);
        return this.formatSuccess(req.id, { filePath, classification });
      }

      if (req.method === "terminalCleaner/canWriteAsText") {
        const filePath = String((req.params as any)?.filePath || "");
        const check = monolith.terminalCleanerSupervisor.canWriteAsText(filePath);
        return this.formatSuccess(req.id, { filePath, ...check });
      }

      if (req.method === "terminalCleaner/getConfig") {
        const config = monolith.terminalCleanerSupervisor.getConfig();
        return this.formatSuccess(req.id, { config });
      }

      // --- Streaming Scrubber Endpoints (Phase 137 / ADR-113 / Target #77) ---
      if (req.method === "streamingScrubber/getMetrics") {
        const metrics = monolith.broccoliStreamingScrubberSubstrate.getMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "streamingScrubber/auditHealth") {
        const audit = monolith.broccoliStreamingScrubberSubstrate.auditHealth();
        return this.formatSuccess(req.id, { audit });
      }

      if (req.method === "streamingScrubber/listEvents") {
        const events = monolith.streamingScrubberSupervisor.getSubstrate().listEvents();
        return this.formatSuccess(req.id, { events });
      }

      if (req.method === "streamingScrubber/feedDelta") {
        const sessionId = String((req.params as any)?.sessionId || "default");
        const delta = String((req.params as any)?.delta || "");
        const visibleText = monolith.streamingScrubberSupervisor.feedDelta(sessionId, delta);
        return this.formatSuccess(req.id, { sessionId, visibleText });
      }

      if (req.method === "streamingScrubber/flushStream") {
        const sessionId = String((req.params as any)?.sessionId || "default");
        const tailText = monolith.streamingScrubberSupervisor.flushStream(sessionId);
        return this.formatSuccess(req.id, { sessionId, tailText });
      }

      if (req.method === "streamingScrubber/getSessionState") {
        const sessionId = String((req.params as any)?.sessionId || "default");
        const state = monolith.streamingScrubberSupervisor.getSessionState(sessionId);
        return this.formatSuccess(req.id, { sessionId, state });
      }

      if (req.method === "streamingScrubber/resetSession") {
        const sessionId = String((req.params as any)?.sessionId || "default");
        monolith.streamingScrubberSupervisor.resetSession(sessionId);
        return this.formatSuccess(req.id, { sessionId, reset: true });
      }

      if (req.method === "streamingScrubber/getConfig") {
        const config = monolith.streamingScrubberSupervisor.getConfig();
        return this.formatSuccess(req.id, { config });
      }

      // --- Self-Repository Guard Endpoints (Phase 138 / ADR-114 / Target #78) ---
      if (req.method === "selfRepoGuard/getMetrics") {
        const metrics = monolith.broccoliSelfRepoGuardSubstrate.getMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "selfRepoGuard/auditHealth") {
        const audit = monolith.broccoliSelfRepoGuardSubstrate.auditHealth();
        return this.formatSuccess(req.id, { audit });
      }

      if (req.method === "selfRepoGuard/listIncidents") {
        const incidents = monolith.selfRepoGuardSupervisor.getSubstrate().listIncidents();
        return this.formatSuccess(req.id, { incidents });
      }

      if (req.method === "selfRepoGuard/inspectShellCommand") {
        const command = String((req.params as any)?.command || "");
        const cwd = (req.params as any)?.cwd;
        const verdict = monolith.selfRepoGuardSupervisor.inspectShellCommand(command, cwd);
        return this.formatSuccess(req.id, { verdict });
      }

      if (req.method === "selfRepoGuard/getRunningSourceRoot") {
        const root = monolith.selfRepoGuardSupervisor.getRunningSourceRoot();
        return this.formatSuccess(req.id, { runningSourceRoot: root });
      }

      if (req.method === "selfRepoGuard/classifyGitOperation") {
        const subcommand = String((req.params as any)?.subcommand || "");
        const args = (req.params as any)?.args || [];
        const safety = monolith.selfRepoGuardSupervisor.classifyGitOperation(subcommand, args);
        return this.formatSuccess(req.id, { subcommand, safety });
      }

      if (req.method === "selfRepoGuard/getConfig") {
        const config = monolith.selfRepoGuardSupervisor.getConfig();
        return this.formatSuccess(req.id, { config });
      }

      // --- Preflight Security Threat Gate Endpoints (Phase 113 / ADR-089 / Target #79) ---
      if (req.method === "preflight/getMetrics") {
        const metrics = monolith.broccoliPreflightSubstrate.getMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "preflight/auditHealth") {
        const audit = monolith.broccoliPreflightSubstrate.auditHealth();
        return this.formatSuccess(req.id, { audit });
      }

      if (req.method === "preflight/listScans") {
        const scans = monolith.preflightScannerSupervisor.getSubstrate().listScans();
        return this.formatSuccess(req.id, { scans });
      }

      if (req.method === "preflight/scanCommand") {
        const command = String((req.params as any)?.command || "");
        const result = monolith.preflightScannerSupervisor.scanCommand(command);
        return this.formatSuccess(req.id, { result });
      }

      if (req.method === "preflight/getPolicy") {
        const policy = monolith.preflightScannerSupervisor.getPolicy();
        return this.formatSuccess(req.id, { policy });
      }

      if (req.method === "preflight/getSecurityStatus") {
        const status = monolith.preflightScannerSupervisor.getSecurityStatus();
        return this.formatSuccess(req.id, { status });
      }

      if (req.method === "preflight/resetCircuitBreaker") {
        monolith.preflightScannerSupervisor.resetCircuitBreaker();
        return this.formatSuccess(req.id, { breakerTripped: false });
      }

      // --- Schema Sanitizer Endpoints (Phase 139 / ADR-115 / Target #80) ---
      if (req.method === "schemaSanitizer/getMetrics") {
        const metrics = monolith.broccoliSchemaSanitizerSubstrate.getMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "schemaSanitizer/auditHealth") {
        const audit = monolith.broccoliSchemaSanitizerSubstrate.auditHealth();
        return this.formatSuccess(req.id, { audit });
      }

      if (req.method === "schemaSanitizer/listEvents") {
        const events = monolith.schemaSanitizerSupervisor.getSubstrate().listEvents();
        return this.formatSuccess(req.id, { events });
      }

      if (req.method === "schemaSanitizer/sanitizeToolSchema") {
        const schema = (req.params as any)?.schema || {};
        const name = (req.params as any)?.name;
        const result = monolith.schemaSanitizerSupervisor.sanitizeToolSchema(schema, name);
        return this.formatSuccess(req.id, { result });
      }

      if (req.method === "schemaSanitizer/unrenameArgs") {
        const originalSchema = (req.params as any)?.originalSchema;
        const args = (req.params as any)?.args;
        const unrenamed = monolith.schemaSanitizerSupervisor.unrenameToolArgs(originalSchema, args);
        return this.formatSuccess(req.id, { unrenamedArgs: unrenamed });
      }

      if (req.method === "schemaSanitizer/getConfig") {
        const config = monolith.schemaSanitizerSupervisor.getConfig();
        return this.formatSuccess(req.id, { config });
      }

      if (req.method === "schemaSanitizer/validatePropertyKey") {
        const key = String((req.params as any)?.key || "");
        const isValid = monolith.schemaSanitizerSupervisor.validatePropertyKey(key);
        return this.formatSuccess(req.id, { key, isValid });
      }

      // --- OSV Malware & Vulnerability Scanner Endpoints (Phase 128 / ADR-104 / Target #81) ---
      if (req.method === "osv/getMetrics") {
        const metrics = monolith.broccoliOsvSubstrate.getMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "osv/auditHealth") {
        const audit = monolith.broccoliOsvSubstrate.auditHealth();
        return this.formatSuccess(req.id, { audit });
      }

      if (req.method === "osv/listScans") {
        const scans = monolith.osvScannerSupervisor.getSubstrate().listScans();
        return this.formatSuccess(req.id, { scans });
      }

      if (req.method === "osv/scanPackage") {
        const pkg = (req.params as any)?.package;
        const result = await monolith.osvScannerSupervisor.scanPackage(pkg);
        return this.formatSuccess(req.id, { result });
      }

      if (req.method === "osv/checkCommand") {
        const command = String((req.params as any)?.command || "");
        const args = (req.params as any)?.args || [];
        const result = await monolith.osvScannerSupervisor.checkCommand(command, args);
        return this.formatSuccess(req.id, { result });
      }

      if (req.method === "osv/getConfig") {
        const config = monolith.osvScannerSupervisor.getConfig();
        return this.formatSuccess(req.id, { config });
      }

      if (req.method === "osv/clearCache") {
        monolith.osvScannerSupervisor.clearCache();
        return this.formatSuccess(req.id, { cacheCleared: true });
      }

      // --- Prompt Cache Boundary & Reasoning Sanitizer Endpoints (Phase 93 / ADR-045 / Target #82) ---
      if (req.method === "promptCache/getMetrics") {
        const metrics = monolith.broccoliPromptCacheSubstrate.getMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "promptCache/auditHealth") {
        const audit = monolith.broccoliPromptCacheSubstrate.auditHealth();
        return this.formatSuccess(req.id, { audit });
      }

      if (req.method === "promptCache/listBreakpoints") {
        const breakpoints = monolith.broccoliPromptCacheSubstrate.listBreakpoints();
        return this.formatSuccess(req.id, { breakpoints });
      }

      if (req.method === "promptCache/plan") {
        const systemPrompt = String((req.params as any)?.systemPrompt || "");
        const messages = (req.params as any)?.messages || [];
        const tools = (req.params as any)?.tools || [];
        const envelope = monolith.promptCacheSupervisor.generatePlan(systemPrompt, messages, tools);
        return this.formatSuccess(req.id, { envelope });
      }

      if (req.method === "promptCache/scrubReasoning") {
        const rawContent = String((req.params as any)?.rawContent || "");
        const result = monolith.promptCacheSupervisor.sanitizeAssistantResponse(rawContent);
        return this.formatSuccess(req.id, { result });
      }

      if (req.method === "promptCache/getConfig") {
        const config = monolith.promptCacheSupervisor.getConfig();
        return this.formatSuccess(req.id, { config });
      }

      // --- Progressive Tool Disclosure & Dynamic Schema Gateway Endpoints (Phase 91 / ADR-043 / Target #83) ---
      if (req.method === "disclosure/getMetrics") {
        const metrics = monolith.broccoliDisclosureSubstrate.getMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "disclosure/auditHealth") {
        const audit = monolith.broccoliDisclosureSubstrate.auditHealth();
        return this.formatSuccess(req.id, { audit });
      }

      if (req.method === "disclosure/listTools") {
        const tools = monolith.broccoliDisclosureSubstrate.listTools();
        return this.formatSuccess(req.id, { tools });
      }

      if (req.method === "disclosure/search") {
        const query = String((req.params as any)?.query || "");
        const tag = (req.params as any)?.tag ? String((req.params as any)?.tag) : undefined;
        const namespace = (req.params as any)?.namespace ? String((req.params as any)?.namespace) : undefined;
        const result = monolith.toolDisclosureSupervisor.searchTools(query, tag, namespace);
        return this.formatSuccess(req.id, { result });
      }

      if (req.method === "disclosure/describe") {
        const name = String((req.params as any)?.name || "");
        const tool = monolith.toolDisclosureSupervisor.describeTool(name);
        return this.formatSuccess(req.id, { tool });
      }

      if (req.method === "disclosure/activate") {
        const name = String((req.params as any)?.name || "");
        const activated = monolith.toolDisclosureSupervisor.activateTool(name);
        return this.formatSuccess(req.id, { activated });
      }

      if (req.method === "disclosure/getManifest") {
        const tokenBudget = typeof (req.params as any)?.tokenBudget === "number" ? (req.params as any)?.tokenBudget : 2000;
        const manifest = monolith.toolDisclosureSupervisor.getManifest(tokenBudget);
        return this.formatSuccess(req.id, { manifest });
      }

      if (req.method === "disclosure/getConfig") {
        const config = monolith.toolDisclosureSupervisor.getConfig();
        return this.formatSuccess(req.id, { config });
      }

      // --- Progressive Subdirectory Context Discovery & Dynamic Hints Endpoints (Phase 129 / ADR-105 / Target #84) ---
      if (req.method === "subdirHints/getMetrics") {
        const metrics = monolith.broccoliSubdirHintsSubstrate.getMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "subdirHints/auditHealth") {
        const audit = monolith.broccoliSubdirHintsSubstrate.auditHealth();
        return this.formatSuccess(req.id, { audit });
      }

      if (req.method === "subdirHints/getDiscoveredHints") {
        const hints = monolith.broccoliSubdirHintsSubstrate.getDiscoveredHints();
        return this.formatSuccess(req.id, { hints });
      }

      if (req.method === "subdirHints/getLoadedDirectories") {
        const loadedDirectories = monolith.broccoliSubdirHintsSubstrate.getLoadedDirectories();
        return this.formatSuccess(req.id, { loadedDirectories });
      }

      if (req.method === "subdirHints/checkTool") {
        const toolName = String((req.params as any)?.toolName || "read_file");
        const args = (req.params as any)?.args || {};
        const result = await monolith.subdirHintsSupervisor.checkToolCall(toolName, args);
        return this.formatSuccess(req.id, { result });
      }

      if (req.method === "subdirHints/registerVirtual") {
        const directoryPath = String((req.params as any)?.directoryPath || "");
        const filename = String((req.params as any)?.filename || "AGENTS.md");
        const content = String((req.params as any)?.content || "");
        monolith.subdirHintsSupervisor.registerVirtualHint(directoryPath, filename, content);
        return this.formatSuccess(req.id, { success: true });
      }

      if (req.method === "subdirHints/getConfig") {
        const config = monolith.subdirHintsSupervisor.getConfig();
        return this.formatSuccess(req.id, { config });
      }

      // --- Heredoc Terminal Endpoints ---
      if (req.method === "heredocTerminal/getMetrics") {
        const metrics = monolith.heredocTerminalSupervisor.getMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "heredocTerminal/auditHealth") {
        const health = monolith.heredocTerminalSupervisor.auditHealth();
        return this.formatSuccess(req.id, { health });
      }

      if (req.method === "heredocTerminal/preProcessCommand") {
        const command = String((req.params as any)?.command || "");
        const result = monolith.heredocTerminalSupervisor.preProcessCommand(command);
        return this.formatSuccess(req.id, result);
      }

      if (req.method === "heredocTerminal/synthesizeScript") {
        const script = String((req.params as any)?.script || "");
        const interpreter = (req.params as any)?.interpreter;
        const delimiter = (req.params as any)?.delimiter;
        const result = monolith.heredocTerminalSupervisor.synthesizeScript(script, { interpreter, delimiter });
        return this.formatSuccess(req.id, result);
      }

      if (req.method === "heredocTerminal/diagnose") {
        const exitCode = Number((req.params as any)?.exitCode || 0);
        const stdout = String((req.params as any)?.stdout || "");
        const stderr = String((req.params as any)?.stderr || "");
        const diag = monolith.heredocTerminalSupervisor.postProcessExecution(exitCode, stdout, stderr);
        return this.formatSuccess(req.id, diag);
      }

      if (req.method === "heredocTerminal/getConfig") {
        const config = monolith.heredocTerminalSupervisor.getConfig();
        return this.formatSuccess(req.id, { config });
      }

      // --- SSRF Defense Firewall & URL Safety Endpoints (Phase 118 / ADR-094 / Target #87) ---
      if (req.method === "urlSafety/getMetrics") {
        const metrics = monolith.broccoliUrlSafetySubstrate.getMetrics();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "urlSafety/auditHealth") {
        const health = monolith.broccoliUrlSafetySubstrate.auditHealth();
        return this.formatSuccess(req.id, { health });
      }

      if (req.method === "urlSafety/checkUrl") {
        const url = String((req.params as any)?.url || "");
        const allowPrivateUrls = (req.params as any)?.allowPrivateUrls === true;
        const allowLocalhost = (req.params as any)?.allowLocalhost === true;
        const result = monolith.urlSafetySupervisor.checkUrl(url, { allowPrivateUrls, allowLocalhost });
        return this.formatSuccess(req.id, { result });
      }

      if (req.method === "urlSafety/normalizeUrl") {
        const url = String((req.params as any)?.url || "");
        const normalized = monolith.urlSafetySupervisor.normalizeUrl(url);
        return this.formatSuccess(req.id, { normalizedUrl: normalized });
      }

      if (req.method === "urlSafety/classifyIp") {
        const ip = String((req.params as any)?.ip || "");
        const category = monolith.urlSafetySupervisor.classifyIp(ip);
        return this.formatSuccess(req.id, { ip, category });
      }

      if (req.method === "urlSafety/parseAlternativeIp") {
        const host = String((req.params as any)?.host || "");
        const canonicalIp = monolith.urlSafetySupervisor.parseAlternativeIp(host);
        return this.formatSuccess(req.id, { host, canonicalIp });
      }

      if (req.method === "urlSafety/listChecks") {
        const checks = monolith.urlSafetySupervisor.getAllChecks();
        return this.formatSuccess(req.id, { checks });
      }

      if (req.method === "urlSafety/getConfig") {
        const config = monolith.urlSafetySupervisor.getConfig();
        return this.formatSuccess(req.id, { config });
      }

      // --- Tool Execution Guard & Parallelism Scheduler Endpoints (Phase 94 / ADR-046 / Target #85) ---
      if (req.method === "executionGuard/getMetrics") {
        const metrics = monolith.broccoliExecutionGuardSubstrate.getMetricsReport();
        return this.formatSuccess(req.id, { metrics });
      }

      if (req.method === "executionGuard/auditHealth") {
        const health = monolith.broccoliExecutionGuardSubstrate.auditHealth();
        return this.formatSuccess(req.id, { health });
      }

      if (req.method === "executionGuard/planSegments") {
        const toolCalls = Array.isArray((req.params as any)?.toolCalls) ? (req.params as any).toolCalls : [];
        const segments = monolith.toolExecutionGuardSupervisor.planSegments(toolCalls);
        return this.formatSuccess(req.id, { segments });
      }

      if (req.method === "executionGuard/checkLoopGuardrail") {
        const frameIndex = Number((req.params as any)?.frameIndex ?? 1);
        const toolName = String((req.params as any)?.toolName || "");
        const args = (req.params as any)?.args || {};
        const decision = monolith.toolExecutionGuardSupervisor.checkLoopGuardrail(frameIndex, toolName, args);
        return this.formatSuccess(req.id, { decision });
      }

      if (req.method === "executionGuard/getViolations") {
        const violations = monolith.toolExecutionGuardSupervisor.getViolations();
        return this.formatSuccess(req.id, { violations });
      }

      if (req.method === "executionGuard/getLatestSegments") {
        const latestSegments = monolith.toolExecutionGuardSupervisor.getLatestSegments();
        return this.formatSuccess(req.id, { latestSegments });
      }

      if (req.method === "executionGuard/getConfig") {
        const config = monolith.toolExecutionGuardSupervisor.getConfig();
        return this.formatSuccess(req.id, { config });
      }

      if (req.method === "executionGuard/setConfig") {
        const updates = (req.params as any) || {};
        monolith.toolExecutionGuardSupervisor.updateConfig(updates);
        const config = monolith.toolExecutionGuardSupervisor.getConfig();
        return this.formatSuccess(req.id, { config });
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
