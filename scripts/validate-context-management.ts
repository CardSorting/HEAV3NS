import assert from "node:assert/strict";
import type { Codex } from "@openai/codex-sdk";
import { AgentConfig } from "../src/agents/base/agent-config.js";
import { ContextBudgetCalculator } from "../src/agents/extensions/compaction/context-budget-calculator.js";
import { PromptComposer } from "../src/agents/extensions/compaction/prompt-composer.js";
import { TokenTruncator } from "../src/agents/extensions/compaction/token-truncator.js";
import { AgentEngine } from "../src/agents/extensions/execution/agent-engine.js";
import { AgentSlashRouter } from "../src/agents/extensions/resolution/agent-slash-router.js";
import type { CodexProviderBridge } from "../src/agents/extensions/resolution/codex-provider-bridge.js";
import { ModelCatalog } from "../src/agents/extensions/resolution/model-catalog.js";
import { ModelResolver } from "../src/agents/extensions/resolution/model-resolver.js";
import type { SessionMessage } from "../src/core/contracts/session.contracts.js";
import { SessionContext } from "../src/sessions/base/session-context.js";
import { SessionCompactor } from "../src/sessions/extensions/compaction/session-compactor.js";
import { SessionMemoryStore } from "../src/sessions/extensions/memory/session-memory-store.js";
import { PersistentSessionStore } from "../src/sessions/extensions/persistence/session-store.js";
import { SessionVfs } from "../src/sessions/extensions/vfs/session-vfs.js";
import type { ValidatingToolRegistry } from "../src/tooling/extensions/registry/tool-registry.js";
import type { EngineProgressEvent } from "../src/core/contracts/agent.contracts.js";
import { AgentActivityTimeline } from "../src/tui/components/agent-activity-timeline.js";

function message(role: SessionMessage["role"], content: string, timestamp: number): SessionMessage {
  return { role, content, timestamp };
}

function makeTurns(count: number, size = 24): SessionMessage[] {
  const result: SessionMessage[] = [];
  for (let index = 0; index < count; index++) {
    result.push(message("user", `user-${index} ${"u".repeat(size)}`, index * 2 + 1));
    result.push(message("assistant", `assistant-${index} ${"a".repeat(size)}`, index * 2 + 2));
  }
  return result;
}

function createCompletionTestEngine(options: {
  sessionId: string;
  providerBridge: CodexProviderBridge;
  codex?: Codex;
  modelName?: string;
  systemPrompt?: string;
}): AgentEngine {
  const config = new AgentConfig({
    modelName: options.modelName ?? "gpt-5.6-terra",
    systemPrompt: options.systemPrompt ?? "COMPLETION TEST POLICY",
    maxTurns: 5,
    temperature: 0,
  });
  const toolRegistry = {
    ears: {
      startTimer: () => undefined,
      endTimer: () => 1,
    },
    listTools: () => [],
    getDeclarations: () => [],
  } as unknown as ValidatingToolRegistry;
  return new AgentEngine(
    config,
    new SessionContext({ sessionId: options.sessionId, cwd: process.cwd() }),
    new PersistentSessionStore(),
    toolRegistry,
    new PromptComposer(),
    new SessionCompactor({ maxTurnHistory: 5, preserveRecentTurns: 2 }),
    new ModelResolver(config.modelName),
    new SessionVfs(),
    new SessionMemoryStore(),
    new AgentSlashRouter(),
    options.providerBridge,
    undefined,
    options.codex
  );
}

function validateBudgetPolicy(): void {
  const calculator = new ContextBudgetCalculator();
  const budget = calculator.calculateBudget("catalog-model", 4_000, {
    contextWindowTokens: 32_000,
    safetyMarginTokens: 1_000,
    compactAtRatio: 0.8,
    targetRatio: 0.6,
  });

  assert.equal(budget.maxTokens, 32_000);
  assert.equal(budget.reservedOutputTokens, 4_000);
  assert.equal(budget.availableInputTokens, 27_000);
  assert.equal(budget.compactionTriggerTokens, 21_600);
  assert.equal(budget.targetInputTokens, 16_200);

  // Validate 900K context fallback for Codex / GPT models in budget calculator
  const gpt5Budget = calculator.calculateBudget("gpt-5.6-terra", 16_384);
  assert.equal(gpt5Budget.maxTokens, 900_000);

  const lunaBudget = calculator.calculateBudget("gpt-5.6-luna", 8_192);
  assert.equal(lunaBudget.maxTokens, 900_000);

  const solBudget = calculator.calculateBudget("gpt-5.6-sol", 8_192);
  assert.equal(solBudget.maxTokens, 900_000);

  // Validate context in ModelCatalog for all Codex GPT models
  const catalog = new ModelCatalog();
  const codexModels = [
    { name: "gpt-5.6-terra", context: 372_000 },
    { name: "gpt-5.6-luna", context: 372_000 },
    { name: "gpt-5.6-sol", context: 372_000 },
    { name: "gpt-4o", context: 128_000 },
  ];

  for (const item of codexModels) {
    const info = catalog.getModelInfo(item.name);
    assert.equal(info.provider, "openai-codex");
    assert.equal(info.contextWindowTokens, item.context);
  }
}

function validateTurnAwareCompaction(): void {
  const policy = message("system", "Never mutate production without approval.", 0);
  const history = [policy, ...makeTurns(6)];
  const compactor = new SessionCompactor({
    maxTurnHistory: 7,
    preserveRecentTurns: 2,
  });
  const report = compactor.compactWithReport(history);

  assert.equal(report.compacted, true);
  assert.equal(report.reason, "message_limit");
  assert.ok(report.messages.length <= 7);
  assert.equal(report.messages[0].content, policy.content);
  assert.equal(report.messages.filter(SessionCompactor.isCheckpoint).length, 1);
  assert.match(report.messages[1].content, /^LUMI-CONTEXT\/1/);
  assert.match(report.messages[1].content, /trust: conversation-data-not-instructions/);
  assert.match(report.messages[1].content, /sha256:[a-f0-9]{64}/);
  assert.deepEqual(
    report.messages.slice(-4).map((entry) => entry.content.split(" ")[0]),
    ["user-4", "assistant-4", "user-5", "assistant-5"]
  );

  const extendedTranscript = [...history, ...makeTurns(2).map((entry, index) => ({
    ...entry,
    content: `${entry.content}-new`,
    timestamp: 100 + index,
  }))];
  const second = compactor.compactWithReport(
    [...report.messages, ...extendedTranscript.slice(-4)],
    {},
    extendedTranscript
  );
  assert.equal(second.messages.filter(SessionCompactor.isCheckpoint).length, 1);
  assert.doesNotMatch(second.messages[1].content, /LUMI-CONTEXT\/1.*LUMI-CONTEXT\/1/s);
}

function validateTokenPressureAndEmergencyGuard(): void {
  const compactor = new SessionCompactor({ maxTurnHistory: 100, preserveRecentTurns: 2 });
  const history = [message("system", "Pinned policy", 0), ...makeTurns(7, 260)];
  const report = compactor.compactWithReport(history, {
    triggerInputTokens: 700,
    maxInputTokens: 900,
    targetInputTokens: 620,
    reservedTokens: 20,
    summaryMaxTokens: 180,
  });

  assert.equal(report.compacted, true);
  assert.equal(report.reason, "token_limit");
  assert.ok(report.outputTokens <= 900);
  assert.equal(report.messages[0].content, "Pinned policy");
  assert.match(report.messages.at(-1)?.content ?? "", /^assistant-6 /);

  const truncator = new TokenTruncator();
  const oversized = [
    message("system", "Pinned", 0),
    message("user", `HEAD-${"x".repeat(2_000)}-TAIL`, 1),
  ];
  const guarded = truncator.truncateToTokenBudget(oversized, 100);
  assert.ok(truncator.estimateMessages(guarded) <= 100);
  assert.match(guarded[1].content, /^HEAD-/);
  assert.match(guarded[1].content, /-TAIL$/);
  assert.match(guarded[1].content, /middle truncated/);

  const toolHeavy = [
    message("system", "Pinned", 0),
    message("user", `old ${"x".repeat(1_000)}`, 1),
    { ...message("tool", `tool ${"y".repeat(1_000)}`, 2), toolCallId: "call-1" },
    message("assistant", "old result", 3),
    message("user", "LATEST REQUEST", 4),
  ];
  const selected = truncator.truncateToTokenBudget(toolHeavy, 80);
  assert.equal(selected.at(-1)?.content, "LATEST REQUEST");
  assert.equal(selected.some((entry) => entry.role === "tool"), false);

  const impossible = truncator.truncateToTokenBudget([
    message("system", `POLICY ${"p".repeat(1_000)}`, 0),
    message("user", `CURRENT ${"q".repeat(500)} END`, 1),
  ], 80);
  assert.equal(impossible[0].role, "system");
  assert.equal(impossible.at(-1)?.role, "user");
  assert.match(impossible.at(-1)?.content ?? "", /^CURRENT/);
  assert.ok(truncator.estimateMessages(impossible) <= 80);
}

function validateLongHistoryScalability(): void {
  const history = makeTurns(1_000, 200);
  const compactor = new SessionCompactor({ maxTurnHistory: 30 });
  const startedAt = performance.now();
  const report = compactor.compactWithReport(history, {
    maxInputTokens: 120_000,
    triggerInputTokens: 90_000,
    targetInputTokens: 60_000,
  });
  const elapsedMs = performance.now() - startedAt;

  assert.equal(report.compacted, true);
  assert.ok(report.outputMessageCount <= 30);
  assert.ok(report.outputTokens <= 60_000);
  assert.ok(elapsedMs < 2_000, `Long-history compaction took ${elapsedMs.toFixed(2)}ms`);
}

function validateRandomizedContextInvariants(): void {
  const truncator = new TokenTruncator();
  for (let seed = 1; seed <= 100; seed++) {
    let state = seed;
    const random = (): number => ((state = (state * 1_664_525 + 1_013_904_223) >>> 0) / 4_294_967_296);
    const turnCount = 2 + Math.floor(random() * 40);
    const history: SessionMessage[] = [message("system", "policy", 0)];
    for (let index = 0; index < turnCount; index++) {
      history.push(
        message("user", `u-${index} ${"x".repeat(1 + Math.floor(random() * 800))}`, index * 2 + 1),
        message("assistant", `a-${index} ${"y".repeat(1 + Math.floor(random() * 800))}`, index * 2 + 2)
      );
    }

    const maxInputTokens = 80 + Math.floor(random() * 2_000);
    const compactor = new SessionCompactor({ maxTurnHistory: 3 + Math.floor(random() * 20) });
    const report = compactor.compactWithReport(history, {
      maxInputTokens,
      triggerInputTokens: Math.floor(maxInputTokens * 0.8),
      targetInputTokens: Math.floor(maxInputTokens * 0.6),
      summaryMaxTokens: 80 + Math.floor(random() * 300),
    });
    const guarded = truncator.truncateToTokenBudget(report.messages, maxInputTokens);

    assert.ok(truncator.estimateMessages(guarded) <= maxInputTokens);
    assert.equal(guarded[0]?.role, "system");
    assert.ok(guarded.some((entry) => entry.role === "user"));
    assert.ok(report.messages.filter(SessionCompactor.isCheckpoint).length <= 1);
  }
}

function validateDurableTranscriptAndRewind(): void {
  const store = new PersistentSessionStore();
  for (const entry of makeTurns(6)) {
    store.addMessage({ role: entry.role, content: entry.content });
  }
  const transcriptBefore = store.getTranscript().map((entry) => entry.content);
  const compactor = new SessionCompactor({ maxTurnHistory: 5, preserveRecentTurns: 2 });
  const report = store.compact(compactor);

  assert.equal(report.compacted, true);
  assert.ok(store.getMessages().length < store.getTranscript().length);
  assert.deepEqual(store.getTranscript().map((entry) => entry.content), transcriptBefore);
  assert.equal(store.exportJsonl().split("\n").length, transcriptBefore.length);
  assert.doesNotMatch(store.exportJsonl(), /LUMI-CONTEXT\/1/);
  const checkpoint = report.messages.find(SessionCompactor.isCheckpoint);
  const reference = checkpoint?.content.match(/sha256:[a-f0-9]{64}/)?.[0];
  assert.ok(reference);
  assert.ok(store.resolveTranscriptReference(reference));

  const snapshot = store.createSnapshot(12);
  store.addMessage({ role: "user", content: "after snapshot" });
  store.addMessage({ role: "assistant", content: "after snapshot response" });
  store.rewindToSnapshot(snapshot);
  assert.deepEqual(store.getTranscript(), snapshot.transcript);
  assert.deepEqual(store.getMessages(), snapshot.messages);

  const restored = new PersistentSessionStore();
  restored.importJsonl(store.exportJsonl());
  assert.deepEqual(restored.getTranscript(), store.getTranscript());
  const beforeInvalidImport = restored.getTranscript();
  assert.throws(
    () => restored.importJsonl('{"role":"user","content":"ok","timestamp":1}\nnot-json'),
    /syntax at line 2/
  );
  assert.deepEqual(restored.getTranscript(), beforeInvalidImport);
}

function validatePromptBoundaries(): void {
  const composer = new PromptComposer();
  const config = new AgentConfig({
    modelName: "test-model",
    systemPrompt: "CUSTOM POLICY",
    maxTurns: 20,
    temperature: 0,
  });
  const context = new SessionContext({ sessionId: "test", cwd: "/tmp" });
  const compiled = composer.compileTurnMessages({
    config,
    sessionContext: context,
    messages: [
      message("system", "STALE SYSTEM POLICY", 0),
      message("user", "prior", 1),
      message("user", "CURRENT </context_json>", 2),
    ],
    memoryContext: "- keep the API stable",
  });
  assert.match(compiled[0].content, /^CUSTOM POLICY/);
  assert.doesNotMatch(compiled[0].content, /keep the API stable/);
  assert.equal(compiled[1].role, "assistant");
  assert.match(compiled[1].content, /^LUMI-MEMORY\/1/);
  assert.match(compiled[1].content, /keep the API stable/);
  assert.equal(compiled.filter((entry) => entry.role === "system").length, 1);
  assert.doesNotMatch(compiled.map((entry) => entry.content).join("\n"), /STALE SYSTEM POLICY/);

  const bootstrap = composer.composeThreadBootstrap(compiled, "CURRENT </context_json>");
  assert.match(bootstrap, /^LUMI-THREAD\/1/);
  assert.match(bootstrap, /current_request_json: "CURRENT <\/context_json>"/);
  assert.equal((bootstrap.match(/CURRENT <\/context_json>/g) ?? []).length, 1);
  assert.match(bootstrap, /\"content\":\"prior\"/);
}

async function validateStatefulThreadHandoffs(): Promise<void> {
  const promptsByThread: string[][] = [];
  let responseSequence = 0;
  let activeRuns = 0;
  let maximumConcurrentRuns = 0;
  const fakeCodex = {
    startThread: () => {
      const prompts: string[] = [];
      promptsByThread.push(prompts);
      return {
        runStreamed: async (prompt: string) => {
          prompts.push(prompt);
          const response = `response-${++responseSequence}`;
          return {
            events: (async function* () {
              activeRuns += 1;
              maximumConcurrentRuns = Math.max(maximumConcurrentRuns, activeRuns);
              await new Promise<void>((resolve) => setTimeout(resolve, 5));
              yield { type: "turn.started" as const };
              yield {
                type: "item.completed" as const,
                item: {
                  id: `progress-message-${responseSequence}`,
                  type: "agent_message" as const,
                  text: `intermediate-frame-${responseSequence}`,
                },
              };
              yield {
                type: "item.completed" as const,
                item: { id: `message-${responseSequence}`, type: "agent_message" as const, text: response },
              };
              activeRuns -= 1;
              yield {
                type: "turn.completed" as const,
                usage: {
                  input_tokens: 10,
                  cached_input_tokens: 0,
                  cache_write_input_tokens: 0,
                  output_tokens: 3,
                  reasoning_output_tokens: 0,
                },
              };
            })(),
          };
        },
      };
    },
  } as unknown as Codex;
  const providerBridge = {
    resolveProviderAuth: async () => ({ headers: {}, authType: "codex-oauth" as const }),
    resolveProviderName: () => "openai",
    getDefaultEndpointForModel: () => "https://api.openai.com/v1/chat/completions",
  } as unknown as CodexProviderBridge;
  const toolRegistry = {
    ears: {
      startTimer: () => undefined,
      endTimer: () => 1,
    },
    listTools: () => [],
    getDeclarations: () => [],
  } as unknown as ValidatingToolRegistry;
  const config = new AgentConfig({
    modelName: "gpt-5.6-luna",
    systemPrompt: "THREAD POLICY",
    maxTurns: 5,
    temperature: 0,
  });
  const sessionContext = new SessionContext({ sessionId: "thread-test", cwd: process.cwd() });
  const sessionStore = new PersistentSessionStore();
  const memoryStore = new SessionMemoryStore();
  const engine = new AgentEngine(
    config,
    sessionContext,
    sessionStore,
    toolRegistry,
    new PromptComposer(),
    new SessionCompactor({ maxTurnHistory: 5, preserveRecentTurns: 2 }),
    new ModelResolver(config.modelName),
    new SessionVfs(),
    memoryStore,
    new AgentSlashRouter(),
    providerBridge,
    undefined,
    fakeCodex
  );

  const concurrentResults = await Promise.all([
    engine.tick({ prompt: "turn one" }),
    engine.tick({ prompt: "turn two" }),
  ]);
  assert.deepEqual(concurrentResults.map((result) => result.outcome), ["completed", "completed"]);
  assert.deepEqual(concurrentResults.map((result) => result.response), ["response-1", "response-2"]);
  assert.equal(maximumConcurrentRuns, 1);
  assert.equal(promptsByThread.length, 1);
  assert.match(promptsByThread[0][0], /^LUMI-THREAD\/1/);
  assert.match(promptsByThread[0][0], /THREAD POLICY/);
  assert.equal(promptsByThread[0][1], "turn two");

  await engine.tick({ prompt: "turn three" });
  await engine.tick({ prompt: "turn four triggers compaction" });
  assert.equal(promptsByThread.length, 2);
  assert.match(promptsByThread[1][0], /^LUMI-THREAD\/1/);
  assert.match(promptsByThread[1][0], /LUMI-CONTEXT\/1/);
  assert.equal(
    (promptsByThread[1][0].match(/turn four triggers compaction/g) ?? []).length,
    1
  );
  assert.equal(sessionStore.getTranscript().length, 8);
  assert.ok(sessionStore.getMessages().length < sessionStore.getTranscript().length);

  await engine.tick({ prompt: "remember: prefer tabs" });
  const threadCountBeforeMemoryTurn = promptsByThread.length;
  await engine.tick({ prompt: "use my saved preference" });
  assert.equal(promptsByThread.length, threadCountBeforeMemoryTurn + 1);
  assert.match(promptsByThread.at(-1)?.[0] ?? "", /prefer tabs/);

  const snapshot = sessionStore.createSnapshot(6);
  const threadCountBeforeRewind = promptsByThread.length;
  sessionStore.rewindToSnapshot(snapshot);
  await engine.tick({ prompt: "continue after rewind" });
  assert.equal(promptsByThread.length, threadCountBeforeRewind + 1);
  assert.match(promptsByThread.at(-1)?.[0] ?? "", /^LUMI-THREAD\/1/);

  sessionStore.addMessage({ role: "assistant", content: "external session mutation" });
  const threadCountBeforeExternalMutation = promptsByThread.length;
  await engine.tick({ prompt: "observe external mutation" });
  assert.equal(promptsByThread.length, threadCountBeforeExternalMutation + 1);
  assert.match(promptsByThread.at(-1)?.[0] ?? "", /external session mutation/);

  memoryStore.saveMemory("style", "keep public APIs stable", "rule");
  const threadCountBeforeExternalMemory = promptsByThread.length;
  await engine.tick({ prompt: "observe external memory" });
  assert.equal(promptsByThread.length, threadCountBeforeExternalMemory + 1);
  assert.match(promptsByThread.at(-1)?.[0] ?? "", /keep public APIs stable/);
}

async function validateIncompleteCodexStreamIsNotCompletion(): Promise<void> {
  let attemptCount = 0;
  const fakeCodex = {
    startThread: () => ({
      runStreamed: async () => ({
        events: (async function* () {
          attemptCount += 1;
          yield { type: "turn.started" as const };
          yield {
            type: "item.completed" as const,
            item: {
              id: `intermediate-message-${attemptCount}`,
              type: "agent_message" as const,
              text: "intermediate response frame",
            },
          };
          // A disconnected stream can end here. Without turn.completed this
          // message is progress, not a successfully completed agent turn.
        })(),
      }),
    }),
  } as unknown as Codex;
  const providerBridge = {
    resolveProviderAuth: async () => ({ headers: {}, authType: "codex-oauth" as const }),
  } as unknown as CodexProviderBridge;
  const progressEvents: Array<{ phase: string; status: string }> = [];
  const engine = createCompletionTestEngine({
    sessionId: "incomplete-stream-test",
    providerBridge,
    codex: fakeCodex,
    modelName: "gpt-5.6-luna",
  });

  const result = await engine.tick({
    prompt: "finish the implementation",
    onProgress: (event) => progressEvents.push(event),
  });

  assert.equal(attemptCount, 2);
  assert.equal(result.outcome, "failed");
  assert.notEqual(result.response, "intermediate response frame");
  assert.match(result.response, /Codex stream ended before turn completion/);
  assert.equal(
    progressEvents.some((event) => event.phase === "completed" && event.status === "completed"),
    false
  );
  assert.equal(
    progressEvents.some((event) => event.phase === "failed" && event.status === "failed"),
    true
  );
}

async function validateRetryHasOneOrderedTerminal(): Promise<void> {
  let runCount = 0;
  const fakeCodex = {
    startThread: () => ({
      runStreamed: async () => {
        const currentRun = ++runCount;
        return {
          events: (async function* () {
            yield { type: "turn.started" as const };
            yield {
              type: "item.completed" as const,
              item: {
                id: `message-${currentRun}`,
                type: "agent_message" as const,
                text: currentRun === 1 ? "intermediate retry frame" : "final response",
              },
            };
            if (currentRun === 1) {
              yield {
                type: "turn.failed" as const,
                error: { message: "transient provider disconnect" },
              };
              return;
            }
            yield {
              type: "turn.completed" as const,
              usage: {
                input_tokens: 10,
                cached_input_tokens: 0,
                cache_write_input_tokens: 0,
                output_tokens: 3,
                reasoning_output_tokens: 0,
              },
            };
          })(),
        };
      },
    }),
  } as unknown as Codex;
  const providerBridge = {
    resolveProviderAuth: async () => ({ headers: {}, authType: "codex-oauth" as const }),
  } as unknown as CodexProviderBridge;
  const progressEvents: EngineProgressEvent[] = [];
  const engine = createCompletionTestEngine({
    sessionId: "retry-terminal-test",
    providerBridge,
    codex: fakeCodex,
    systemPrompt: "RETRY POLICY",
  });

  const result = await engine.tick({
    prompt: "retry safely",
    onProgress: (event) => progressEvents.push(event),
  });

  assert.equal(runCount, 2);
  assert.equal(result.outcome, "completed");
  assert.equal(result.response, "final response");
  for (let index = 1; index < progressEvents.length; index++) {
    assert.ok(progressEvents[index].sequence > progressEvents[index - 1].sequence);
  }
  const terminalEvents = progressEvents.filter((event) =>
    event.metadata?.scope === "turn" &&
    (event.status === "completed" || event.status === "failed" || event.status === "cancelled")
  );
  assert.equal(terminalEvents.length, 1);
  assert.equal(terminalEvents[0].status, "completed");
  assert.equal(
    progressEvents.some((event) =>
      event.activityId === "codex:attempt:1" &&
      event.metadata?.scope === "activity" &&
      event.status === "failed"
    ),
    true
  );
}

async function validateTurnCompletedWithoutMessageFails(): Promise<void> {
  let runCount = 0;
  const fakeCodex = {
    startThread: () => ({
      runStreamed: async () => ({
        events: (async function* () {
          runCount += 1;
          yield { type: "turn.started" as const };
          yield {
            type: "turn.completed" as const,
            usage: {
              input_tokens: 10,
              cached_input_tokens: 0,
              cache_write_input_tokens: 0,
              output_tokens: 0,
              reasoning_output_tokens: 0,
            },
          };
        })(),
      }),
    }),
  } as unknown as Codex;
  const providerBridge = {
    resolveProviderAuth: async () => ({ headers: {}, authType: "codex-oauth" as const }),
  } as unknown as CodexProviderBridge;
  const progressEvents: EngineProgressEvent[] = [];
  const engine = createCompletionTestEngine({
    sessionId: "empty-codex-response-test",
    providerBridge,
    codex: fakeCodex,
    systemPrompt: "EMPTY POLICY",
  });

  const result = await engine.tick({
    prompt: "return a response",
    onProgress: (event) => progressEvents.push(event),
  });
  assert.equal(runCount, 2);
  assert.equal(result.outcome, "failed");
  assert.match(result.response, /without a final response/);
  assert.equal(
    progressEvents.some((event) => event.metadata?.scope === "turn" && event.status === "completed"),
    false
  );
}

async function validateCancellationHasOneTerminal(): Promise<void> {
  let runCount = 0;
  const fakeCodex = {
    startThread: () => ({
      runStreamed: async (_prompt: string, options: { signal?: AbortSignal }) => ({
        events: (async function* () {
          runCount += 1;
          yield { type: "turn.started" as const };
          await new Promise<never>((_resolve, reject) => {
            if (options.signal?.aborted) {
              reject(new Error("aborted"));
              return;
            }
            options.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
          });
        })(),
      }),
    }),
  } as unknown as Codex;
  const providerBridge = {
    resolveProviderAuth: async () => ({ headers: {}, authType: "codex-oauth" as const }),
  } as unknown as CodexProviderBridge;
  const progressEvents: EngineProgressEvent[] = [];
  const controller = new AbortController();
  const engine = createCompletionTestEngine({
    sessionId: "cancel-terminal-test",
    providerBridge,
    codex: fakeCodex,
    systemPrompt: "CANCEL POLICY",
  });

  const resultPromise = engine.tick({
    prompt: "cancel this turn",
    signal: controller.signal,
    onProgress: (event) => progressEvents.push(event),
  });
  setTimeout(() => controller.abort(), 5);
  const result = await resultPromise;

  assert.equal(runCount, 1);
  assert.equal(result.outcome, "cancelled");
  const terminalEvents = progressEvents.filter((event) =>
    event.metadata?.scope === "turn" &&
    (event.status === "completed" || event.status === "failed" || event.status === "cancelled")
  );
  assert.equal(terminalEvents.length, 1);
  assert.equal(terminalEvents[0].status, "cancelled");
}

async function validateMissingCredentialsDoNotRetry(): Promise<void> {
  let resolutionCount = 0;
  const providerBridge = {
    resolveProviderAuth: async () => {
      resolutionCount += 1;
      return { headers: {}, authType: "none" as const };
    },
  } as unknown as CodexProviderBridge;
  const progressEvents: EngineProgressEvent[] = [];
  const engine = createCompletionTestEngine({
    sessionId: "missing-auth-test",
    providerBridge,
    modelName: "missing-auth-model",
    systemPrompt: "AUTH POLICY",
  });

  const result = await engine.tick({
    prompt: "requires a provider",
    onProgress: (event) => progressEvents.push(event),
  });
  assert.equal(resolutionCount, 1);
  assert.equal(result.outcome, "failed");
  assert.equal(
    progressEvents.filter((event) => event.metadata?.scope === "turn" && event.status === "failed").length,
    1
  );
}

function validateTimelineTerminalIsExactlyOnce(): void {
  const timeline = new AgentActivityTimeline({ model: "test-model", startedAt: 0 });
  timeline.update({
    activityId: "codex:item:message:turn",
    phase: "completed",
    status: "completed",
    message: "Item complete",
    timestamp: 1,
    sequence: 1,
    metadata: { source: "codex-sdk", scope: "activity" },
  });
  assert.equal(timeline.isTerminal(), false);

  timeline.update({
    activityId: "codex:turn",
    phase: "failed",
    status: "failed",
    message: "Turn failed",
    timestamp: 2,
    sequence: 2,
    metadata: { source: "codex-sdk", scope: "turn" },
  });
  assert.equal(timeline.getTerminalStatus(), "failed");

  timeline.update({
    activityId: "codex:turn",
    phase: "completed",
    status: "completed",
    message: "Late completion",
    timestamp: 3,
    sequence: 3,
    metadata: { source: "codex-sdk", scope: "turn" },
  });
  assert.equal(timeline.getTerminalStatus(), "failed");
}

async function validateEmptyApiResponseIsNotCompletion(): Promise<void> {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  globalThis.fetch = (async () => {
    requestCount += 1;
    return new Response(JSON.stringify({ choices: [{ message: { content: "   " } }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  const progressEvents: EngineProgressEvent[] = [];

  try {
    const providerBridge = {
      resolveProviderAuth: async () => ({ headers: {}, authType: "api-key" as const }),
      resolveProviderName: () => "openai",
      getDefaultEndpointForModel: () => "https://api.openai.com/v1/chat/completions",
    } as unknown as CodexProviderBridge;
    const engine = createCompletionTestEngine({
      sessionId: "empty-api-response-test",
      providerBridge,
      modelName: "api-empty-model",
      systemPrompt: "API POLICY",
    });

    const result = await engine.tick({
      prompt: "return content",
      onProgress: (event) => progressEvents.push(event),
    });
    assert.equal(result.outcome, "failed");
    assert.equal(requestCount, 2);
    assert.match(result.response, /without assistant content/);
    assert.equal(
      progressEvents.some((event) => event.metadata?.scope === "turn" && event.status === "completed"),
      false
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function validateStatelessMultiTurnPayloads(): Promise<void> {
  const requests: Array<Record<string, unknown>> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response(JSON.stringify({
      choices: [{ message: { content: `api-response-${requests.length}` } }],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const providerBridge = {
      resolveProviderAuth: async () => ({
        headers: { Authorization: "Bearer test" },
        authType: "api-key" as const,
      }),
      resolveProviderName: () => "openai",
      getDefaultEndpointForModel: () => "https://api.openai.com/v1/chat/completions",
    } as unknown as CodexProviderBridge;
    const toolRegistry = {
      ears: {
        startTimer: () => undefined,
        endTimer: () => 1,
      },
      listTools: () => [],
      getDeclarations: () => [],
    } as unknown as ValidatingToolRegistry;
    const config = new AgentConfig({
      modelName: "api-test-model",
      systemPrompt: "STATELESS POLICY",
      maxTurns: 20,
      temperature: 0,
    });
    const engine = new AgentEngine(
      config,
      new SessionContext({ sessionId: "api-test", cwd: process.cwd() }),
      new PersistentSessionStore(),
      toolRegistry,
      new PromptComposer(),
      new SessionCompactor({ maxTurnHistory: 20 }),
      new ModelResolver(config.modelName),
      new SessionVfs(),
      new SessionMemoryStore(),
      new AgentSlashRouter(),
      providerBridge
    );

    await engine.tick({ prompt: "first API turn" });
    await engine.tick({ prompt: "second API turn" });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(requests.length, 2);
  const firstMessages = requests[0].messages as Array<{ role: string; content: string }>;
  const secondMessages = requests[1].messages as Array<{ role: string; content: string }>;
  assert.match(firstMessages[0].content, /^STATELESS POLICY/);
  assert.equal(firstMessages.at(-1)?.content, "first API turn");
  assert.ok(secondMessages.some((entry) => entry.content === "api-response-1"));
  assert.equal(secondMessages.at(-1)?.content, "second API turn");
  assert.equal(requests[0].max_tokens, 4_096);
}

async function validateEnvironmentAuthAndNoPromptHijack(): Promise<void> {
  const { CodexProviderBridge } = await import("../src/agents/extensions/resolution/codex-provider-bridge.js");
  const { EnvironmentKeyResolver } = await import("../src/agents/extensions/resolution/environment-key-resolver.js");
  const { CodexOAuthManager } = await import("../src/agents/extensions/resolution/codex-oauth-manager.js");

  const envResolver = new EnvironmentKeyResolver();
  const oauthMgr = new CodexOAuthManager();
  const bridge = new CodexProviderBridge(oauthMgr, undefined, envResolver);

  // Test provider name and endpoint resolution
  assert.equal(bridge.resolveProviderName("claude-3-5-sonnet"), "anthropic");
  assert.equal(bridge.resolveProviderName("gemini-1.5-pro"), "google");
  assert.equal(bridge.resolveProviderName("deepseek-v3"), "deepseek");
  assert.equal(bridge.resolveProviderName("openrouter/meta-llama"), "openrouter");
  assert.equal(bridge.resolveProviderName("llama3:latest"), "ollama");

  assert.equal(bridge.getDefaultEndpointForModel("openrouter/anthropic/claude-3.5-sonnet"), "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(bridge.getDefaultEndpointForModel("deepseek-v3"), "https://api.deepseek.com/chat/completions");
  assert.equal(bridge.getDefaultEndpointForModel("llama3:latest"), "http://localhost:11434/v1/chat/completions");

  // Test environment variable authentication resolution
  const testOpenaiKey = ["sk", "test-env-key-for-lumi"].join("-");
  const testAnthropicKey = ["sk", "ant", "test-key"].join("-");
  const testGeminiKey = ["A", "Iza", "SyTestKey"].join("");
  const testDeepseekKey = ["sk", "ds", "test-key"].join("-");
  const testOpenrouterKey = ["sk", "or", "test-key"].join("-");

  process.env.OPENAI_API_KEY = testOpenaiKey;
  process.env.ANTHROPIC_API_KEY = testAnthropicKey;
  process.env.GEMINI_API_KEY = testGeminiKey;
  process.env.DEEPSEEK_API_KEY = testDeepseekKey;
  process.env.OPENROUTER_API_KEY = testOpenrouterKey;

  try {
    const authOpenAI = await bridge.resolveProviderAuth("gpt-5.6-terra");
    assert.ok(authOpenAI.authType === "api-key" || authOpenAI.authType === "codex-oauth");
    if (authOpenAI.authType === "api-key") {
      assert.equal(authOpenAI.headers.Authorization, `Bearer ${testOpenaiKey}`);
    } else {
      assert.ok(authOpenAI.headers.Authorization?.startsWith("Bearer "));
    }

    const authAnthropic = await bridge.resolveProviderAuth("claude-3-5-sonnet");
    assert.equal(authAnthropic.authType, "api-key");
    assert.equal(authAnthropic.headers.Authorization, `Bearer ${testAnthropicKey}`);

    const authGemini = await bridge.resolveProviderAuth("gemini-1.5-pro");
    assert.equal(authGemini.authType, "api-key");
    assert.equal(authGemini.headers.Authorization, `Bearer ${testGeminiKey}`);

    const authDeepSeek = await bridge.resolveProviderAuth("deepseek-v3");
    assert.equal(authDeepSeek.authType, "api-key");
    assert.equal(authDeepSeek.headers.Authorization, "Bearer sk-ds-test-key");

    const authOpenRouter = await bridge.resolveProviderAuth("openrouter/anthropic/claude-3.5-sonnet");
    assert.equal(authOpenRouter.authType, "api-key");
    assert.equal(authOpenRouter.headers.Authorization, "Bearer sk-or-test-key");
    assert.equal(authOpenRouter.headers["HTTP-Referer"], "https://github.com/CardSorting/LUMI-JOY");

    const authOllama = await bridge.resolveProviderAuth("llama3:latest");
    assert.equal(authOllama.authType, "api-key");
  } finally {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
  }
}

async function main(): Promise<void> {
  validateBudgetPolicy();
  validateTurnAwareCompaction();
  validateTokenPressureAndEmergencyGuard();
  validateLongHistoryScalability();
  validateRandomizedContextInvariants();
  validateDurableTranscriptAndRewind();
  validatePromptBoundaries();
  validateTimelineTerminalIsExactlyOnce();
  await validateStatefulThreadHandoffs();
  await validateIncompleteCodexStreamIsNotCompletion();
  await validateRetryHasOneOrderedTerminal();
  await validateTurnCompletedWithoutMessageFails();
  await validateCancellationHasOneTerminal();
  await validateMissingCredentialsDoNotRetry();
  await validateStatelessMultiTurnPayloads();
  await validateEmptyApiResponseIsNotCompletion();
  await validateEnvironmentAuthAndNoPromptHijack();
  console.log("Context validation passed (budgets, compaction, persistence, concurrency, and provider handoffs).\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
