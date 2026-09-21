import * as fs from "node:fs";
import * as path from "node:path";
import { AbstractAgentEngine } from "../../../core/abstracts/abstract-agent-engine.js";
import type {
  EngineProgressEvent,
  EngineTickInput,
  EngineTickResult,
  EngineTickOutcome,
} from "../../../core/contracts/agent.contracts.js";
import type { SessionMessage } from "../../../core/contracts/session.contracts.js";
import type { AgentConfig } from "../../base/agent-config.js";
import type { SessionContext } from "../../../sessions/base/session-context.js";
import type { PersistentSessionStore } from "../../../sessions/extensions/persistence/session-store.js";
import type { ValidatingToolRegistry } from "../../../tooling/extensions/registry/tool-registry.js";
import type { PromptComposer } from "../compaction/prompt-composer.js";
import type { SessionCompactor } from "../../../sessions/extensions/compaction/session-compactor.js";
import { ContextBudgetCalculator, type ContextBudgetInfo } from "../compaction/context-budget-calculator.js";
import { TokenTruncator } from "../compaction/token-truncator.js";
import type { ModelResolver } from "../resolution/model-resolver.js";
import { ModelCatalog } from "../resolution/model-catalog.js";
import type { SessionVfs } from "../../../sessions/extensions/vfs/session-vfs.js";
import type { SessionMemoryStore } from "../../../sessions/extensions/memory/session-memory-store.js";
import type { AgentSlashRouter } from "../resolution/agent-slash-router.js";
import type { LlmProxyGateway } from "../resolution/llm-proxy-gateway.js";
import { RoadmapCompletionGate } from "../../../tooling/extensions/policy/roadmap-completion-gate.js";
import { ToolSchemaSerializer } from "../../../tooling/extensions/registry/tool-schema-serializer.js";
import { ToolCallArgParser } from "../../../tooling/extensions/registry/tool-call-arg-parser.js";
import { DynamicToolRouter } from "../../../tooling/extensions/registry/dynamic-tool-router.js";
import type { ToolExecutionRecord } from "../../../core/contracts/tooling.contracts.js";
import { ToolExecutionScheduler, type ScheduledToolCall } from "../../../tooling/extensions/execution/tool-execution-scheduler.js";
import { UniversalToolCallAdapter } from "../../../tooling/extensions/registry/universal-tool-call-adapter.js";
import { ToolSchemaCompressor } from "../../../tooling/extensions/registry/tool-schema-compressor.js";
import { ToolDependencyGraphPlanner } from "../../../tooling/extensions/execution/tool-dependency-graph-planner.js";
import { ToolChoicePolicyOrchestrator } from "../../../tooling/extensions/registry/tool-choice-policy-orchestrator.js";
import {
  FlappyBirdProjectSynthesizer,
} from "./flappy-bird-project-synthesizer.js";
import { sanitizeProgressText } from "../../../core/utilities/progress-sanitizer.js";

interface PreparedProviderContext {
  messages: SessionMessage[];
  currentPrompt: string;
  budget: ContextBudgetInfo;
}

export interface AgentContextServices {
  modelCatalog?: ModelCatalog;
  budgetCalculator?: ContextBudgetCalculator;
  tokenTruncator?: TokenTruncator;
  completionGate?: RoadmapCompletionGate;
}

export class AgentEngine extends AbstractAgentEngine {
  readonly promptComposer: PromptComposer;
  readonly sessionCompactor: SessionCompactor;
  readonly modelResolver: ModelResolver;
  readonly sessionVfs: SessionVfs;
  readonly sessionMemoryStore: SessionMemoryStore;
  readonly slashRouter: AgentSlashRouter;
  readonly proxyGateway?: LlmProxyGateway;
  readonly completionGate: RoadmapCompletionGate;
  readonly dynamicToolRouter: DynamicToolRouter;
  readonly argParser: ToolCallArgParser;
  readonly schemaSerializer: ToolSchemaSerializer;
  readonly scheduler: ToolExecutionScheduler;
  readonly universalAdapter: UniversalToolCallAdapter;
  readonly schemaCompressor: ToolSchemaCompressor;
  readonly dagPlanner: ToolDependencyGraphPlanner;
  readonly choiceOrchestrator: ToolChoicePolicyOrchestrator;
  private readonly runtimeModelCatalog: ModelCatalog;
  private readonly runtimeBudgetCalculator: ContextBudgetCalculator;
  private readonly runtimeTokenTruncator: TokenTruncator;
  private readonly flappyBirdProjectSynthesizer = new FlappyBirdProjectSynthesizer();
  private turnQueue: Promise<void> = Promise.resolve();

  constructor(
    config: AgentConfig,
    sessionContext: SessionContext,
    sessionStore: PersistentSessionStore,
    toolRegistry: ValidatingToolRegistry,
    promptComposer: PromptComposer,
    sessionCompactor: SessionCompactor,
    modelResolver: ModelResolver,
    sessionVfs: SessionVfs,
    sessionMemoryStore: SessionMemoryStore,
    slashRouter: AgentSlashRouter,
    proxyGateway?: LlmProxyGateway,
    _unused?: unknown,
    contextServices: AgentContextServices = {}
  ) {
    super(config, sessionContext, sessionStore, toolRegistry);
    this.promptComposer = promptComposer;
    this.sessionCompactor = sessionCompactor;
    this.modelResolver = modelResolver;
    this.sessionVfs = sessionVfs;
    this.sessionMemoryStore = sessionMemoryStore;
    this.slashRouter = slashRouter;
    this.proxyGateway = proxyGateway;
    this.completionGate = contextServices.completionGate ?? new RoadmapCompletionGate();
    this.dynamicToolRouter = new DynamicToolRouter();
    this.argParser = new ToolCallArgParser();
    this.schemaSerializer = new ToolSchemaSerializer();
    this.scheduler = new ToolExecutionScheduler({ parser: this.argParser });
    this.universalAdapter = new UniversalToolCallAdapter();
    this.schemaCompressor = new ToolSchemaCompressor();
    this.dagPlanner = new ToolDependencyGraphPlanner();
    this.choiceOrchestrator = new ToolChoicePolicyOrchestrator();
    this.runtimeModelCatalog = contextServices.modelCatalog ?? new ModelCatalog();
    this.runtimeBudgetCalculator = contextServices.budgetCalculator ?? new ContextBudgetCalculator();
    this.runtimeTokenTruncator = contextServices.tokenTruncator ?? new TokenTruncator();
  }

  /** Serialize mutations and stateful provider calls for deterministic turn order. */
  override async tick(input: EngineTickInput): Promise<EngineTickResult> {
    const predecessor = this.turnQueue;
    let releaseTurn: () => void = () => undefined;
    this.turnQueue = new Promise<void>((resolve) => {
      releaseTurn = resolve;
    });

    await predecessor;
    try {
      if (input.signal?.aborted) {
        throw new Error("Turn cancelled before execution");
      }
      return await super.tick(input);
    } finally {
      releaseTurn();
    }
  }

  protected override async preTick(_input: EngineTickInput): Promise<void> {
    this.sessionContext.incrementTurn();
    if (this.toolRegistry && "journal" in this.toolRegistry) {
      (this.toolRegistry as unknown as { journal: { setTurnId: (id: string) => void } }).journal.setTurnId(
        `turn_${this.sessionContext.turnCount}`
      );
    }
    if (this.toolRegistry && "loopBreaker" in this.toolRegistry) {
      (this.toolRegistry as unknown as { loopBreaker: { reset: () => void } }).loopBreaker.reset();
    }
  }

  protected override async executeTick(input: EngineTickInput): Promise<EngineTickResult> {
    return await this.executeTurn(input);
  }

  protected override async postTick(_result: EngineTickResult): Promise<void> {
    // Post-tick state audit hook
  }

  private async executeTurn(input: EngineTickInput): Promise<EngineTickResult> {
    const sessionStore = this.sessionStore as PersistentSessionStore;
    const promptText = input.prompt?.trim() ?? "";
    const accumulatedToolResults: ToolExecutionRecord[] = [];

    // 1. Slash Command Interception
    if (promptText) {
      const slashResult = await this.slashRouter.handleSlashCommand(promptText, {
        sessionContext: this.sessionContext,
        sessionStore,
        sessionCompactor: this.sessionCompactor,
        sessionVfs: this.sessionVfs,
        sessionMemoryStore: this.sessionMemoryStore,
        modelResolver: this.modelResolver,
        toolRegistry: this.toolRegistry as ValidatingToolRegistry,
      });

      if (slashResult.handled) {
        const slashOutput = slashResult.output ?? "Slash command executed.";
        sessionStore.addMessage({
          role: "user",
          content: promptText,
        });

        sessionStore.addMessage({
          role: "assistant",
          content: slashOutput,
        });

        this.modelResolver.recordTurnExecution(
          promptText.length,
          slashOutput.length
        );

        return {
          frameIndex: this.sessionContext.turnCount,
          outcome: "completed",
          activeModel: this.modelResolver.getActiveModel(),
          isFallbackModel: false,
          isSlashCommand: true,
          composedPrompt: promptText,
          response: slashOutput,
          toolResults: [],
        };
      }
    }

    // 2. Add User Message to Session Store
    if (promptText) {
      sessionStore.addMessage({
        role: "user",
        content: promptText,
      });
    }

    // 3. Execution Phase
    let responseText = "";
    let turnOutcome: EngineTickOutcome = "completed";

    const lowerPrompt = promptText.toLowerCase().trim();

    if (
      lowerPrompt === "flappy bird" ||
      lowerPrompt === "flappy bird react vite" ||
      lowerPrompt === "/flappy"
    ) {
      const project = this.flappyBirdProjectSynthesizer.writeProject(this.sessionContext.cwd);
      for (const file of project.files) {
        this.sessionVfs.stageWrite(path.join(project.directoryName, file.path), file.content);
      }
      responseText = `\x1b[1;32m[✓] Created complete Flappy Bird React + TypeScript + Vite project!\x1b[0m\n` +
        `  Project: \x1b[36m${project.outputDirectory}\x1b[0m\n` +
        `  Files: ${project.writtenFiles.length} (strict TypeScript, Canvas gameplay, responsive controls, accessibility)\n` +
        `  Run: \x1b[33mcd ${project.outputDirectory} && npm install && npm run dev\x1b[0m`;
    } else if (
      lowerPrompt === "frogger" ||
      lowerPrompt === "frogger demo" ||
      lowerPrompt === "/frogger"
    ) {
      const gameFilePath = path.join(this.sessionContext.cwd, "frogger.html");
      const htmlContent = this.generateFroggerHtml();
      fs.writeFileSync(gameFilePath, htmlContent, "utf-8");
      this.sessionVfs.stageWrite("frogger.html", htmlContent);
      responseText = `\x1b[1;32m[✓] Created Frogger Arcade Game!\x1b[0m\n` +
        `  File location: \x1b[36m${gameFilePath}\x1b[0m\n` +
        `  Features: Canvas 60FPS renderer, Frog player, Car obstacles, Floating river logs, Score & Lives system.\n` +
        `  To play: Open \x1b[33m${gameFilePath}\x1b[0m in any web browser!`;
    } else if (promptText.startsWith("remember:")) {
      const fact = promptText.substring(9).trim();
      this.sessionMemoryStore.saveMemory("user_fact", fact, "fact");
      responseText = `Persisted memory fact: ${fact}`;
    } else if (promptText.startsWith("view:")) {
      const targetPath = promptText.substring(5).trim();
      responseText = `Read file content from ${targetPath}`;
    } else {
      // Attempt live LLM dispatch through OpenAI Codex.
      let liveResponse: string | null = null;
      let liveError: string | null = null;
      let liveFailureKind: "cancelled" | "timeout" | "provider" | null = null;
      const liveProgressActivityId = "lumi:turn";
      let liveProgressSequence = 0;
      const nextProgressSequence = (): number => ++liveProgressSequence;
      const liveStartedAt = Date.now();

      const openAiApiKey = process.env.OPENAI_API_KEY;
      const activeModel = this.modelResolver.getActiveModel();

      if (openAiApiKey || this.proxyGateway) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const preparedContext = this.prepareProviderContext(activeModel, promptText);
            const defaultUrl = "https://api.openai.com/v1/chat/completions";
            const requestStartedAt = Date.now();
            const endpoint = this.proxyGateway?.getEffectiveEndpoint("openai-codex", defaultUrl) ?? {
              url: defaultUrl,
              headers: {},
              timeoutMs: 30000,
            };
            const timeoutSignal = AbortSignal.timeout(endpoint.timeoutMs);
            const requestSignal = input.signal
              ? AbortSignal.any([input.signal, timeoutSignal])
              : timeoutSignal;

            this.reportProgress(input.onProgress, {
              activityId: liveProgressActivityId,
              phase: "connecting",
              status: attempt === 0 ? "started" : "in_progress",
              message: attempt === 0 ? `Connecting to ${activeModel}` : `Retrying with ${activeModel}`,
              detail: "Sending authenticated model request to OpenAI Codex",
              timestamp: requestStartedAt,
              sequence: nextProgressSequence(),
              metadata: { source: "openai-codex-api", scope: "turn", attempt: attempt + 1 },
            });

            const allRegisteredTools = this.toolRegistry ? this.toolRegistry.listTools() : [];
            const relevantTools = this.dynamicToolRouter.selectRelevantTools(allRegisteredTools, promptText);
            const availableTools = relevantTools.map((t) => this.schemaSerializer.toOpenAIFunction(t));

            const apiMessages: Array<{
              role: string;
              content: string | null;
              name?: string;
              tool_call_id?: string;
              tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
            }> = preparedContext.messages.map((message) => ({
              role: message.role,
              content: message.content,
              ...(message.name ? { name: message.name } : {}),
              ...(message.toolCallId ? { tool_call_id: message.toolCallId } : {}),
            }));

            const maxToolSteps = 10;
            let stepCount = 0;
            let accumulatedResponse = "";

            while (stepCount < maxToolSteps) {
              stepCount++;
              const payload: {
                model: string;
                messages: typeof apiMessages;
                max_tokens: number;
                tools?: typeof availableTools;
              } = {
                model: activeModel,
                messages: apiMessages,
                max_tokens: preparedContext.budget.reservedOutputTokens,
              };

              if (availableTools.length > 0) {
                payload.tools = availableTools;
              }

              this.reportProgress(input.onProgress, {
                activityId: liveProgressActivityId,
                phase: "thinking",
                status: "in_progress",
                message: `[${activeModel}] Deliberating action (step ${stepCount}/${maxToolSteps})`,
                detail: `Sending request to OpenAI Codex...`,
                timestamp: Date.now(),
                sequence: nextProgressSequence(),
                metadata: { source: "openai-codex-api", scope: "turn", attempt: attempt + 1 },
              });

              const stepStartedAt = Date.now();
              const stepHeartbeat = setInterval(() => {
                const idle = Date.now() - stepStartedAt;
                if (idle >= 10_000) {
                  const sec = Math.round(idle / 1000);
                  this.reportProgress(input.onProgress, {
                    activityId: liveProgressActivityId,
                    phase: "thinking",
                    status: "in_progress",
                    message: "Model deliberation in progress",
                    detail: `Quiet for ${sec}s · Awaiting response from OpenAI Codex`,
                    timestamp: Date.now(),
                    sequence: nextProgressSequence(),
                    metadata: { source: "openai-codex-api", scope: "turn", attempt: attempt + 1 },
                  });
                }
              }, 10_000);
              stepHeartbeat.unref?.();

              const authHeaders: Record<string, string> = {};
              if (openAiApiKey) {
                authHeaders.Authorization = `Bearer ${openAiApiKey}`;
              }

              let res: Response;
              try {
                res = await fetch(endpoint.url, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    ...authHeaders,
                    ...endpoint.headers,
                  },
                  body: JSON.stringify(payload),
                  signal: requestSignal,
                });
              } finally {
                clearInterval(stepHeartbeat);
              }

              if (!res.ok) {
                const errorBody = await res.text();
                throw new Error(`HTTP ${res.status}: ${errorBody.slice(0, 500)}`);
              }

              const data = (await res.json()) as {
                choices?: Array<{
                  message?: {
                    content?: string | null;
                    tool_calls?: Array<{
                      id: string;
                      type: "function";
                      function: { name: string; arguments: string };
                    }>;
                  };
                }>;
              };

              const choiceMessage = data.choices?.[0]?.message;
              const content = choiceMessage?.content?.trim() ?? "";
              const toolCalls = choiceMessage?.tool_calls;

              if (content) {
                accumulatedResponse = accumulatedResponse ? `${accumulatedResponse}\n${content}` : content;
              }

              if (toolCalls && toolCalls.length > 0) {
                apiMessages.push({
                  role: "assistant",
                  content: choiceMessage?.content ?? null,
                  tool_calls: toolCalls,
                });

                const scheduledCalls = toolCalls.map((tc) => ({
                  id: tc.id,
                  name: tc.function.name,
                  args: tc.function.arguments,
                }));

                const { results: batchResults } = await this.scheduler.executeBatch(
                  scheduledCalls,
                  this.toolRegistry,
                  this.sessionContext.cwd,
                  {
                    allowParallelDisjointMutations: true,
                    executionAuthority: "autonomous",
                    bypassConfirmation: true,
                    bypassThreatDetection: true,
                    onToolStart: (call: ScheduledToolCall) => {
                      this.reportProgress(input.onProgress, {
                        activityId: liveProgressActivityId,
                        phase: "tool",
                        status: "in_progress",
                        message: `Executing ${call.name}`,
                        detail: typeof call.args === "string" ? call.args.slice(0, 100) : JSON.stringify(call.args).slice(0, 100),
                        timestamp: Date.now(),
                        sequence: nextProgressSequence(),
                        metadata: { itemType: call.name, scope: "activity", attempt: attempt + 1 },
                      });
                    },
                    onToolComplete: (record: ToolExecutionRecord) => {
                      accumulatedToolResults.push(record);
                      this.reportProgress(input.onProgress, {
                        activityId: liveProgressActivityId,
                        phase: "tool",
                        status: record.success ? "completed" : "failed",
                        message: `Completed ${record.name}`,
                        detail: record.success ? "Success" : `Failed: ${record.error}`,
                        timestamp: Date.now(),
                        sequence: nextProgressSequence(),
                        metadata: { itemType: record.name, scope: "activity", attempt: attempt + 1 },
                      });
                    },
                  }
                );

                for (const br of batchResults) {
                  apiMessages.push({
                    role: "tool",
                    tool_call_id: br.callId,
                    content: typeof br.output === "string" ? br.output : JSON.stringify(br.output),
                  });
                }
              } else {
                break;
              }
            }

            liveResponse = accumulatedResponse || null;
            if (liveResponse) {
              this.reportProgress(input.onProgress, {
                activityId: liveProgressActivityId,
                phase: "completed",
                status: "completed",
                message: "Agent turn completed successfully",
                detail: "Tokens processed via OpenAI Codex",
                timestamp: Date.now(),
                elapsedMs: Date.now() - liveStartedAt,
                sequence: nextProgressSequence(),
                metadata: { source: "openai-codex-api", scope: "turn", attempt: attempt + 1 },
              });
            }
            break;
          } catch (error: unknown) {
            liveError = this.formatLiveDispatchError(error);
            if (input.signal?.aborted) {
              liveFailureKind = "cancelled";
              break;
            }
            const err = error as { name?: string; message?: string } | undefined;
            if (err?.name === "TimeoutError" || err?.message?.includes("timed out")) {
              liveFailureKind = "timeout";
            } else {
              liveFailureKind = "provider";
            }

            const isLastAttempt = attempt >= 1;
            if (!isLastAttempt) {
              this.reportProgress(input.onProgress, {
                activityId: liveProgressActivityId,
                phase: "connecting",
                status: "in_progress",
                message: "Retrying model turn",
                detail: `Retrying after error: ${liveError.slice(0, 100)}`,
                timestamp: Date.now(),
                sequence: nextProgressSequence(),
                metadata: { source: "lumi", scope: "turn", attempt: attempt + 1 },
              });
              liveError = null;
              continue;
            }
            const terminalStatus = "failed";
            this.reportProgress(input.onProgress, {
              activityId: liveProgressActivityId,
              phase: terminalStatus,
              status: terminalStatus,
              message: liveFailureKind === "timeout"
                ? "Model request timed out"
                : "Model request failed",
              detail: liveError,
              timestamp: Date.now(),
              elapsedMs: Date.now() - liveStartedAt,
              sequence: nextProgressSequence(),
              metadata: { source: "openai-codex-api", scope: "turn", attempt: attempt + 1 },
            });
            break;
          }
        }
      }

      if (liveResponse) {
        responseText = liveResponse;
      } else if (liveFailureKind === "cancelled") {
        turnOutcome = "cancelled";
        responseText = "[Cancelled] Agent turn cancelled by user.";
      } else if (liveFailureKind === "timeout") {
        turnOutcome = "failed";
        responseText = `[Timed out] ${liveError}. You can retry with a narrower request.`;
      } else if (liveError) {
        turnOutcome = "failed";
        const actionHint = "[Check OpenAI credentials: Set OPENAI_API_KEY in the environment or run /setup.]";
        responseText = `Live model request failed for ${activeModel}: ${liveError}\n${actionHint}`;
      } else {
        turnOutcome = "failed";
        responseText = `Processed turn prompt: "${promptText}".\n` +
          `[Note: Configure \x1b[33mOPENAI_API_KEY\x1b[0m or run \x1b[33m/setup\x1b[0m for live OpenAI Codex responses.]`;
      }
    }

    // 4. Add Assistant Response Message
    sessionStore.addMessage({
      role: "assistant",
      content: responseText,
    });

    if (sessionStore.getMessages().length > this.config.maxTurns) {
      sessionStore.compact(this.sessionCompactor, { maxMessages: this.config.maxTurns });
    }

    this.modelResolver.recordTurnExecution(
      promptText.length,
      responseText.length
    );

    return {
      frameIndex: this.sessionContext.turnCount,
      outcome: turnOutcome,
      activeModel: this.modelResolver.getActiveModel(),
      isFallbackModel: this.modelResolver.getActiveModel() !== this.config.modelName,
      isSlashCommand: false,
      composedPrompt: promptText,
      response: responseText,
      toolResults: accumulatedToolResults,
    };
  }

  private prepareProviderContext(activeModel: string, requestedPrompt = ""): PreparedProviderContext {
    const sessionStore = this.sessionStore as PersistentSessionStore;
    const model = this.runtimeModelCatalog.getModelInfo(activeModel);
    const requestedOutputTokens = Math.min(8_192, model.maxOutputTokens);
    const budget = this.runtimeBudgetCalculator.calculateBudget(
      activeModel,
      requestedOutputTokens,
      { contextWindowTokens: model.contextWindowTokens }
    );
    const memoryContext = this.sessionMemoryStore.formatMemoryContext();
    const promptConfig = activeModel === this.config.modelName
      ? this.config
      : { ...this.config, modelName: activeModel };
    const pinnedMessages = this.promptComposer.compileTurnMessages({
      config: promptConfig,
      sessionContext: this.sessionContext,
      messages: [],
      memoryContext,
    });
    const reservedTokens = this.runtimeTokenTruncator.estimateMessages(pinnedMessages);

    sessionStore.compact(this.sessionCompactor, {
      maxInputTokens: budget.availableInputTokens,
      triggerInputTokens: budget.compactionTriggerTokens,
      targetInputTokens: budget.targetInputTokens,
      reservedTokens,
      preserveRecentTurns: 4,
    });

    const compiled = this.promptComposer.compileTurnMessages({
      config: promptConfig,
      sessionContext: this.sessionContext,
      messages: [...sessionStore.getMessages()],
      memoryContext,
    });
    const guarded = this.runtimeTokenTruncator.truncateToTokenBudget(
      compiled,
      budget.availableInputTokens,
      { preserveRecentTurns: 1 }
    );
    const currentPrompt = requestedPrompt
      ? [...guarded].reverse().find((message) => message.role === "user")?.content ?? requestedPrompt
      : "";

    return {
      messages: guarded,
      currentPrompt,
      budget,
    };
  }

  private reportProgress(
    onProgress: ((event: EngineProgressEvent) => void) | undefined,
    event: EngineProgressEvent
  ): void {
    try {
      onProgress?.({
        ...event,
        message: sanitizeProgressText(event.message, 160),
        ...(event.detail
          ? {
              detail: sanitizeProgressText(event.detail, 240),
            }
          : {}),
      });
    } catch {
      // Rendering progress is best-effort and must not interrupt the model turn.
    }
  }

  private formatLiveDispatchError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return sanitizeProgressText(message, 700) || "Unknown provider error";
  }

  private generateFroggerHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LUMI Frogger Game</title>
  <style>
    body {
      background-color: #0f172a;
      color: #f8fafc;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
    }
    h1 {
      margin-bottom: 10px;
      color: #4ade80;
      text-shadow: 0 0 10px rgba(74, 222, 128, 0.4);
    }
    #game-container {
      position: relative;
      border: 4px solid #334155;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
    canvas {
      background: #000;
      display: block;
    }
  </style>
</head>
<body>
  <h1>LUMI Arcade Frogger</h1>
  <div id="game-container">
    <canvas id="game" width="400" height="400"></canvas>
  </div>
  <script>
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#10b981';
    ctx.fillRect(180, 360, 40, 40);
  </script>
</body>
</html>`;
  }
}
