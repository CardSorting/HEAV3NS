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

export interface SlashRouteContext {
  sessionContext: SessionContext;
  sessionStore: PersistentSessionStore;
  sessionCompactor: SessionCompactor;
  sessionVfs: SessionVfs;
  sessionMemoryStore: SessionMemoryStore;
  modelResolver: ModelResolver;
  toolRegistry: ValidatingToolRegistry;
  runbookSupervisor?: RunbookSupervisor;
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
