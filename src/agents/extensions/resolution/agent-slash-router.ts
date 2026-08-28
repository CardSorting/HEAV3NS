import type { SessionContext } from "../../../sessions/base/session-context.js";
import type { PersistentSessionStore } from "../../../sessions/extensions/persistence/session-store.js";
import type { SessionCompactor } from "../../../sessions/extensions/compaction/session-compactor.js";
import type { SessionVfs } from "../../../sessions/extensions/vfs/session-vfs.js";
import type { SessionMemoryStore } from "../../../sessions/extensions/memory/session-memory-store.js";
import type { ModelResolver } from "./model-resolver.js";
import type { ValidatingToolRegistry } from "../../../tooling/extensions/registry/tool-registry.js";

import type { RunbookSupervisor } from "../runbooks/runbook-supervisor.js";
import { RunbookHumanizer } from "../runbooks/runbook-humanizer.js";
import { RunbookCatalog } from "../runbooks/runbook-catalog.js";
import { StatefulCompactionSynthesizer } from "../../../tooling/extensions/compaction/stateful-compaction-synthesizer.js";
import type { AdversarialScrutinySupervisor } from "../adversarial/adversarial-scrutiny-supervisor.js";
import { AdversarialHumanizer } from "../adversarial/adversarial-humanizer.js";
import type { IBroccoliAcpSubstrate, IAcpPermissionGate } from "../../../core/contracts/acp.contracts.js";

export interface SlashRouteContext {
  sessionContext: SessionContext;
  sessionStore: PersistentSessionStore;
  sessionCompactor: SessionCompactor;
  sessionVfs: SessionVfs;
  sessionMemoryStore: SessionMemoryStore;
  modelResolver: ModelResolver;
  toolRegistry: ValidatingToolRegistry;
  runbookSupervisor?: RunbookSupervisor;
  adversarialSupervisor?: AdversarialScrutinySupervisor;
  adversarialHumanizer?: AdversarialHumanizer;
  acpSubstrate?: IBroccoliAcpSubstrate;
  acpPermissionGate?: IAcpPermissionGate;
}

export interface SlashRouteResult {
  handled: boolean;
  output?: string;
}

export class AgentSlashRouter {
  async handleSlashCommand(commandStr: string, context: SlashRouteContext): Promise<SlashRouteResult> {
    const trimmed = commandStr.trim();
    if (!trimmed.startsWith("/")) {
      return { handled: false };
    }

    const [cmd, ...args] = trimmed.split(" ");
    const lowerCmd = cmd.toLowerCase();

    switch (lowerCmd) {
      case "/runbook": {
        const supervisor = context.runbookSupervisor;
        if (!supervisor) {
          return { handled: true, output: "Runbook FSM supervisor not initialized in this session." };
        }

        const subCmd = (args[0] || "").toLowerCase();

        if (subCmd === "presets") {
          const presets = RunbookCatalog.listPresets();
          let out = "📚 **Available Standard Runbook Presets**:\n\n";
          for (const p of presets) {
            out += `• **${p.icon} \`/runbook start ${p.id}\`** — ${p.name} (${p.stageCount} stages: ${p.stages.join(" ──► ")})\n`;
            out += `  └─ ${p.description}\n`;
          }
          return { handled: true, output: out };
        }

        if (subCmd === "start") {
          const presetId = args[1] || "coding_loop";
          try {
            const spec = RunbookCatalog.instantiate(presetId);
            const state = await supervisor.start(spec, { fresh: true });
            const pipeline = RunbookHumanizer.renderAsciiPipeline(spec, state.current);
            return {
              handled: true,
              output: `🚀 **Started Runbook Preset**: ${RunbookHumanizer.formatTitle(spec.name)}\n\n${pipeline}\n\n📍 Active Stage: **${state.current}**`,
            };
          } catch (err: any) {
            return { handled: true, output: `❌ Failed to start runbook preset: ${err.message}` };
          }
        }

        if (subCmd === "goto") {
          const target = args[1];
          if (!target) {
            return { handled: true, output: "Usage: `/runbook goto <target_node>`" };
          }
          try {
            const res = await supervisor.goto(target);
            return {
              handled: true,
              output: `✅ **Advanced to stage**: ${RunbookHumanizer.formatTitle(res.current)} (from '${res.from}')`,
            };
          } catch (err: any) {
            return { handled: true, output: `🛑 **Transition Blocked**: ${err.message}` };
          }
        }

        // Default or /runbook status / story
        try {
          const run = await supervisor.getRun();
          const spec = await supervisor.getSpec();
          if (!run || !spec) {
            return {
              handled: true,
              output: "No active runbook running. Start one with `/runbook start <preset>` or view `/runbook presets`.",
            };
          }

          const history = await supervisor.history();

          if (subCmd === "story") {
            const story = RunbookHumanizer.humanizeStory(run, spec, history);
            return { handled: true, output: story.plainSummary };
          }

          if (subCmd === "compact") {
            const synth = new StatefulCompactionSynthesizer();
            const prompt = synth.synthesizeCompactionPrompt(run, spec);
            return { handled: true, output: `🧹 **Stateful Compaction Prompt**:\n\n\`\`\`text\n${prompt}\n\`\`\`` };
          }

          const pipeline = RunbookHumanizer.renderAsciiPipeline(spec, run.current);
          const humanState = RunbookHumanizer.humanizeState(run.current, spec.nodes[run.current], spec);
          const dynCount = (await supervisor.dynamicList()).length;

          let out = `🗺️ **Runbook FSM**: ${RunbookHumanizer.formatTitle(spec.name)} (Run: \`${run.runId}\`)\n\n`;
          out += `${pipeline}\n\n`;
          out += `📍 **Active Stage**: ${humanState.icon} **${humanState.displayName}** (${humanState.progressPercent}% complete)\n`;
          out += `ℹ️ ${humanState.summary}\n\n`;
          out += `🔬 Dynamic Micro-Checks: ${dynCount} active\n`;
          if (humanState.nextPermittedActions.length > 0) {
            out += `➡️ Next Actions:\n` + humanState.nextPermittedActions.map((a) => `  • ${a}`).join("\n");
          }
          return { handled: true, output: out };
        } catch {
          return {
            handled: true,
            output: "No active runbook running. Start one with `/runbook start <preset>` or view `/runbook presets`.",
          };
        }
      }

      case "/stats": {
        const msgCount = context.sessionStore.getMessages().length;
        const transcriptCount = context.sessionStore.getTranscript().length;
        const metrics = context.modelResolver.getMetrics();
        const memories = context.sessionMemoryStore.listMemories().length;
        const staged = context.sessionVfs.exportStaged().length;
        const slab = context.sessionStore.getSlabSnapshot();
        const output = `--- Engine Monolith Telemetry Stats ---
Session ID: ${context.sessionContext.sessionId}
Turn Count: ${context.sessionContext.turnCount}
Active Messages: ${msgCount}
Durable Transcript Messages: ${transcriptCount}
Active Model: ${context.modelResolver.getActiveModel()}
Estimated Tokens Consumed: ${metrics.totalTokensEstimated}
Memories Stored: ${memories}
VFS Staged Files: ${staged}
Slab Allocated Bytes: ${slab.allocatedBytes} / ${slab.capacityBytes}`;
        return { handled: true, output };
      }

      case "/vfs": {
        const staged = context.sessionVfs.exportStaged();
        if (staged.length === 0) {
          return { handled: true, output: "VFS overlay clean (0 staged files)." };
        }
        const summary = staged.map((f) => `- [STAGED] ${f.path} (${f.content.length} bytes)`).join("\n");
        return { handled: true, output: `VFS Staged Files:\n${summary}` };
      }

      case "/memory": {
        const memories = context.sessionMemoryStore.listMemories();
        if (memories.length === 0) {
          return { handled: true, output: "Long-term memory store empty." };
        }
        const summary = memories.map((m) => `- [${m.category}] ${m.key} = ${m.value}`).join("\n");
        return { handled: true, output: `Long-Term Memory Facts:\n${summary}` };
      }

      case "/compact": {
        const beforeCount = context.sessionStore.getMessages().length;
        const report = context.sessionStore.compact(context.sessionCompactor, { force: true });
        const afterCount = context.sessionStore.getMessages().length;
        return {
          handled: true,
          output: report.compacted
            ? `Compacted active context: ${beforeCount} -> ${afterCount} messages, ${report.inputTokens} -> ${report.outputTokens} estimated tokens. Full transcript retained.`
            : `Context already minimal (${afterCount} active messages). Full transcript retained.`,
        };
      }

      case "/terra": {
        const active = context.modelResolver.switchToTerra();
        return {
          handled: true,
          output: `✅ **Active Model set to**: \`${active}\` (Flagship Reasoning Engine · 900k Context · 16k Max Output)`,
        };
      }

      case "/luna": {
        const active = context.modelResolver.switchToLuna();
        return {
          handled: true,
          output: `⚡ **Active Model set to**: \`${active}\` (High-Velocity Engine · 900k Context · 8k Max Output)`,
        };
      }

      case "/sol": {
        const active = context.modelResolver.switchToSol();
        return {
          handled: true,
          output: `⚖️ **Active Model set to**: \`${active}\` (Balanced Engine · 900k Context · 8k Max Output)`,
        };
      }

      case "/model": {
        if (args.length === 0 || !args[0]?.trim()) {
          const current = context.modelResolver.getActiveModel();
          return {
            handled: true,
            output: `Active Model: \`${current}\`\n\nQuick Switches:\n• \`/terra\` → \`gpt-5.6-terra\` (Flagship Reasoning)\n• \`/luna\` → \`gpt-5.6-luna\` (High-Velocity)\n• \`/sol\` → \`gpt-5.6-sol\` (Balanced)\n\nUsage: \`/model <name>\``,
          };
        }
        const target = args.join(" ").trim();
        const active = context.modelResolver.setActiveModel(target);
        return {
          handled: true,
          output: `✅ **Active Model set to**: \`${active}\``,
        };
      }

      case "/models": {
        const current = context.modelResolver.getActiveModel();
        const codexModels = context.modelResolver.getCodexModels();
        let out = `🤖 **Available OpenAI Codex Models**:\n`;
        for (const m of codexModels) {
          const isActive = m === current ? " `[ACTIVE]`" : "";
          let role = "OpenAI Codex Engine";
          if (m.includes("terra")) role = "Flagship Reasoning (900k ctx)";
          else if (m.includes("luna")) role = "High-Velocity (900k ctx)";
          else if (m.includes("sol")) role = "Balanced (900k ctx)";
          out += `• **\`${m}\`** — *${role}*${isActive}\n`;
        }
        out += `\n💡 Quick Switch: Type \`/terra\`, \`/luna\`, or \`/sol\` to swap instantly.`;
        return { handled: true, output: out };
      }

      case "/rewind": {
        const count = Math.max(1, parseInt(args[0] || "1", 10) || 1);
        const currentMsgs = context.sessionStore.getMessages();
        const removeCount = count * 2;
        const remaining = Math.max(0, currentMsgs.length - removeCount);
        const retained = currentMsgs.slice(0, remaining);
        context.sessionStore.clear();
        for (const msg of retained) {
          context.sessionStore.addMessage(msg);
        }
        context.sessionContext.turnCount = Math.max(0, context.sessionContext.turnCount - count);
        return {
          handled: true,
          output: `⏪ **Rewound ${count} turn(s)**. Active messages: ${remaining}. Turn count: ${context.sessionContext.turnCount}.`,
        };
      }

      case "/diff": {
        const staged = context.sessionVfs.exportStaged();
        if (staged.length === 0) {
          return { handled: true, output: "No staged file modifications in VFS overlay." };
        }
        const targetFile = args[0]?.trim();
        if (targetFile) {
          const diff = await context.sessionVfs.generateDiff(targetFile);
          if (!diff) {
            return { handled: true, output: `File '${targetFile}' is not staged in VFS overlay.` };
          }
          return { handled: true, output: `📝 **Diff for \`${targetFile}\`**:\n\n\`\`\`diff\n${diff}\n\`\`\`` };
        }

        let out = `📝 **Staged File Mutations (${staged.length} files)**:\n\n`;
        for (const f of staged) {
          out += `• \`${f.path}\` (${f.content.length} bytes)\n`;
          const diff = await context.sessionVfs.generateDiff(f.path);
          if (diff) {
            out += `\`\`\`diff\n${diff.slice(0, 500)}${diff.length > 500 ? "\n..." : ""}\n\`\`\`\n`;
          }
        }
        return { handled: true, output: out };
      }

      case "/commit": {
        const targetFile = args[0]?.trim();
        if (targetFile) {
          const ok = await context.sessionVfs.commitFile(targetFile);
          return {
            handled: true,
            output: ok
              ? `✅ Committed staged file \`${targetFile}\` to disk.`
              : `❌ File \`${targetFile}\` is not staged in VFS.`,
          };
        }
        const committed = await context.sessionVfs.commitAll();
        return {
          handled: true,
          output: `✅ Committed ${committed.length} staged file(s) to disk:\n` + committed.map((p) => `• \`${p}\``).join("\n"),
        };
      }

      case "/discard": {
        const targetFile = args[0]?.trim();
        if (targetFile) {
          const ok = context.sessionVfs.discardFile(targetFile);
          return {
            handled: true,
            output: ok
              ? `🗑️ Discarded staged changes for \`${targetFile}\`.`
              : `❌ File \`${targetFile}\` is not staged in VFS.`,
          };
        }
        context.sessionVfs.clear();
        return { handled: true, output: "🗑️ Cleared and discarded all staged VFS files." };
      }

      case "/tools": {
        const allTools = context.toolRegistry.listTools();
        let out = `🔧 **Active Tool Registry (${allTools.length} tools)**:\n\n`;
        for (const t of allTools.slice(0, 15)) {
          const params = t.parameters ? Object.keys(t.parameters).join(", ") : "none";
          out += `• **\`${t.name}\`** (\`${params}\`)\n  └─ ${t.description}\n`;
        }
        if (allTools.length > 15) {
          out += `\n*(+ ${allTools.length - 15} more tools)*`;
        }
        return { handled: true, output: out };
      }

      case "/scrutinize":
      case "/redteam": {
        const supervisor = context.adversarialSupervisor;
        const humanizer = context.adversarialHumanizer ?? new AdversarialHumanizer();
        if (!supervisor) {
          return { handled: true, output: "Adversarial scrutiny supervisor is not initialized in this session." };
        }

        const inputPlan = args.join(" ").trim();
        if (!inputPlan) {
          return {
            handled: true,
            output: "Usage: `/scrutinize <plan text or file path>` (e.g. `/scrutinize implementation_plan.md`)",
          };
        }

        const verdict = supervisor.scrutinizePlan(inputPlan);
        const banner = humanizer.renderVerdictBanner(verdict);
        return { handled: true, output: `\`\`\`text\n${banner}\n\`\`\`` };
      }

      case "/provenance": {
        const supervisor = context.adversarialSupervisor;
        const humanizer = context.adversarialHumanizer ?? new AdversarialHumanizer();
        if (!supervisor) {
          return { handled: true, output: "Adversarial scrutiny supervisor is not initialized in this session." };
        }

        const raw = args.join(" ");
        const parts = raw.split(" against ");
        if (parts.length < 2) {
          return {
            handled: true,
            output: "Usage: `/provenance <claim> against <evidence text>`",
          };
        }

        const [claim, evidence] = parts;
        const proof = supervisor.auditProvenance(claim.trim(), evidence.trim());
        const report = humanizer.renderProvenanceReport([proof]);
        return { handled: true, output: `\`\`\`text\n${report}\n\`\`\`` };
      }

      case "/decompose": {
        const supervisor = context.adversarialSupervisor;
        const humanizer = context.adversarialHumanizer ?? new AdversarialHumanizer();
        if (!supervisor) {
          return { handled: true, output: "Adversarial scrutiny supervisor is not initialized in this session." };
        }

        const text = args.join(" ").trim();
        if (!text) {
          return {
            handled: true,
            output: "Usage: `/decompose <prompt or output text>`",
          };
        }

        const decomp = supervisor.decomposeCognitiveSpend(text);
        const report = humanizer.renderCognitiveDecomposition(decomp);
        return { handled: true, output: `\`\`\`text\n${report}\n\`\`\`` };
      }

      case "/acp": {
        const substrate = context.acpSubstrate;
        if (!substrate) {
          return { handled: true, output: "Agent Client Protocol (ACP) subsystem is not initialized in this session." };
        }
        const sessions = substrate.listSessions();
        const pending = substrate.listPendingApprovals();
        const changesets = substrate.listChangesets();
        const audits = substrate.listRiskAudits();

        let out = `⚡ **Agent Client Protocol (ACP) Bridge Telemetry**\n\n`;
        out += `• **Active IDE Sessions**: ${sessions.length} (${sessions.map((s) => `\`${s.sessionId}\` [${s.mode}]`).join(", ") || "None"})\n`;
        out += `• **Pending Edit Approvals**: ${pending.length}\n`;
        out += `• **Recorded Changesets**: ${changesets.length}\n`;
        out += `• **Adversarial Risk Audits**: ${audits.length}\n`;
        out += `• **RPC Handled Calls**: ${substrate.getRpcCallCount()}\n\n`;
        out += `💡 *Tip*: Open the \`AcpDashboardModal\` in interactive TUI to review pending diffs with colorized adversarial risk shields.`;
        return { handled: true, output: out };
      }

      case "/help":
      case "/shortcuts": {
        return {
          handled: true,
          output: `💡 **LUMI Quick-Reference & Shortcuts**:

• \`/rewind [n]\` — Instantly rewind $n$ conversation turns
• \`/stats\` — Inspect telemetry, token estimates, and slab metrics
• \`/memory\` — List long-term facts & Knowledge Items
• \`/vfs\` — Inspect staged virtual filesystem mutations
• \`/diff\` — View line diff of staged file edits
• \`/tools\` — List registered model and developer tools
• \`/compact\` — Force progressive context window compaction
• \`/clear\` — Reset active session state and turn counter
• \`/terra\`, \`/luna\`, \`/sol\` — Fast model swapping
• \`/model <name>\` — Switch active LLM model
• \`/runbook presets\` — Explore interactive FSM runbook workflows
• \`/scrutinize <plan>\` — Senior architect adversarial plan red-teaming
• \`/provenance <claim> against <text>\` — Assert fail-closed factual grounding
• \`/decompose <text>\` — Cognitive spend & compressibility analysis
• \`/acp\` — Inspect Agent Client Protocol sessions & diff approvals`,
        };
      }

      case "/clear": {
        context.sessionStore.clear();
        context.sessionVfs.clear();
        context.sessionContext.turnCount = 0;
        return { handled: true, output: "Cleared active session state and reset turn counter." };
      }

      default:
        return { handled: false };
    }
  }
}
