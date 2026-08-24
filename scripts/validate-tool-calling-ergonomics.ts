/**
 * validate-tool-calling-ergonomics.ts
 *
 * Comprehensive validation suite for World-Class Tool Call Handling,
 * Dynamic Tool Routing, Multi-Provider Serialization, Argument Self-Healing & Execution Ergonomics.
 */

import { ToolSchemaSerializer } from "../src/tooling/extensions/registry/tool-schema-serializer.js";
import { ToolCallArgParser } from "../src/tooling/extensions/registry/tool-call-arg-parser.js";
import { DynamicToolRouter } from "../src/tooling/extensions/registry/dynamic-tool-router.js";
import type { ToolDefinition } from "../src/core/contracts/tooling.contracts.js";

async function runValidationSuite(): Promise<void> {
  console.log("================================================================================");
  console.log(" LUMI Apex Tier: World-Class Tool Call Handling & Ergonomics Suite              ");
  console.log("================================================================================\n");

  let passedTests = 0;
  const totalTests = 6;

  // ---------------------------------------------------------------------------
  // Test 1: Multi-Provider Tool Schema Serialization
  // ---------------------------------------------------------------------------
  console.log("[Test 1/6] Validating Multi-Provider Tool Schema Serializer (OpenAI, Anthropic, Gemini, MCP)...");
  const serializer = new ToolSchemaSerializer();

  const sampleTool: ToolDefinition = {
    name: "batch_replace_symbols",
    description: "Replaces code symbols across files with optional dry-run and backup",
    category: "filesystem",
    tags: ["refactor", "symbols", "batch"],
    parameters: {
      files: {
        type: "array",
        required: true,
        description: "List of target file paths",
        items: { type: "string" },
      },
      searchPattern: {
        type: "string",
        required: true,
        description: "Regex pattern to match",
      },
      replacement: {
        type: "string",
        required: true,
        description: "Replacement string",
      },
      mode: {
        type: "string",
        required: false,
        enum: ["exact", "regex", "case_insensitive"],
        default: "exact",
        description: "Matching mode",
      },
      maxReplacements: {
        type: "integer",
        required: false,
        minimum: 1,
        maximum: 1000,
        description: "Maximum replacements to apply",
      },
      dryRun: {
        type: "boolean",
        required: false,
        default: false,
        description: "Simulate changes without writing to disk",
      },
    },
    execute: async () => ({ success: true }),
  };

  // 1a. OpenAI Function Format
  const openaiSchema = serializer.toOpenAIFunction(sampleTool);
  if (openaiSchema.type !== "function" || openaiSchema.function.name !== "batch_replace_symbols") {
    throw new Error("OpenAI Function serialization failed");
  }
  if (!openaiSchema.function.parameters.required.includes("files")) {
    throw new Error("OpenAI required parameters missing");
  }
  const modeProp = openaiSchema.function.parameters.properties.mode as Record<string, unknown>;
  if (!Array.isArray(modeProp.enum) || !modeProp.enum.includes("case_insensitive")) {
    throw new Error("OpenAI enum property serialization failed");
  }

  // 1b. Anthropic Format
  const anthropicSchema = serializer.toAnthropicTool(sampleTool);
  if (anthropicSchema.name !== "batch_replace_symbols" || !anthropicSchema.input_schema.properties.searchPattern) {
    throw new Error("Anthropic tool serialization failed");
  }

  // 1c. Gemini Format
  const geminiSchema = serializer.toGeminiDeclaration(sampleTool);
  if (geminiSchema.parameters.type !== "OBJECT") {
    throw new Error("Gemini declaration type must be uppercase OBJECT");
  }

  // 1d. MCP Format
  const mcpSchema = serializer.toMCPTool(sampleTool);
  if (!mcpSchema.inputSchema.properties.replacement) {
    throw new Error("MCP tool serialization failed");
  }

  console.log("  [✓] Multi-provider serialization verified for OpenAI, Anthropic, Gemini, and MCP standards.");
  passedTests++;

  // ---------------------------------------------------------------------------
  // Test 2: Multi-Strategy Argument Parser & Self-Healing Repair
  // ---------------------------------------------------------------------------
  console.log("[Test 2/6] Validating Multi-Strategy Argument Parser & Self-Healing Repairs...");
  const parser = new ToolCallArgParser();

  // 2a. Markdown fenced JSON
  const fenced = "```json\n{\n  \"filePath\": \"src/app.ts\",\n  \"content\": \"console.log('hello');\"\n}\n```";
  const p1 = parser.prepareArguments(
    {
      name: "write_file",
      description: "Writes file",
      parameters: {
        path: { type: "string", required: true },
        content: { type: "string", required: true },
      },
      execute: async () => {},
    },
    fenced
  );
  if (!p1.validation.valid || p1.args.path !== "src/app.ts") {
    throw new Error(`Markdown fence repair failed: ${JSON.stringify(p1)}`);
  }

  // 2b. Python booleans, single quotes, trailing commas, unescaped newlines
  const pythonish = "{\n  'cmd': 'npm test',\n  'isDaemon': False,\n  'timeout': '3000',\n  'tags': 'lint, security',\n}";
  const p2 = parser.prepareArguments(
    {
      name: "run_command",
      description: "Runs command",
      parameters: {
        command: { type: "string", required: true },
        isDaemon: { type: "boolean", required: false },
        timeout: { type: "number", required: false },
        tags: { type: "array", required: false },
      },
      execute: async () => {},
    },
    pythonish
  );
  if (!p2.validation.valid) {
    throw new Error(`Python repair validation failed: ${p2.validation.errors.join(", ")}`);
  }
  if (p2.args.command !== "npm test" || p2.args.isDaemon !== false || p2.args.timeout !== 3000) {
    throw new Error(`Python type coercion / alias failed: ${JSON.stringify(p2.args)}`);
  }
  if (!Array.isArray(p2.args.tags) || p2.args.tags.length !== 2) {
    throw new Error(`Comma-separated string to array coercion failed: ${JSON.stringify(p2.args.tags)}`);
  }

  // 2c. Truncated closing braces
  const truncated = "{\"query\": \"function handleTurn\", \"caseSensitive\": true";
  const p3 = parser.parseRawArguments(truncated);
  if (p3.args.query !== "function handleTurn" || p3.args.caseSensitive !== true) {
    throw new Error(`Truncated JSON bracket auto-closing failed: ${JSON.stringify(p3)}`);
  }

  console.log("  [✓] Multi-strategy parser repaired markdown fences, Python booleans, single quotes, and truncated braces.");
  passedTests++;

  // ---------------------------------------------------------------------------
  // Test 3: Actionable Error Diagnostics & Self-Healing Suggestions
  // ---------------------------------------------------------------------------
  console.log("[Test 3/6] Validating Actionable Error Diagnostics & Suggestion Generator...");
  const p4 = parser.prepareArguments(
    {
      name: "view_file",
      description: "View file contents",
      parameters: {
        path: { type: "string", required: true, description: "Target file path" },
        startLine: { type: "number", required: false },
      },
      execute: async () => {},
    },
    { startLine: 10 } // Missing 'path'
  );
  if (p4.validation.valid) {
    throw new Error("Expected validation failure for missing required parameter 'path'");
  }
  if (!p4.validation.suggestions || p4.validation.suggestions.length === 0) {
    throw new Error("Expected self-healing suggestions for missing parameter");
  }

  console.log("  [✓] Actionable error diagnostics generated clear remediation suggestions for the LLM.");
  passedTests++;

  // ---------------------------------------------------------------------------
  // Test 4: Dynamic Tool Router Context-Aware Partitioning & Token Savings
  // ---------------------------------------------------------------------------
  console.log("[Test 4/6] Validating Dynamic Tool Router Context Partitioning & Token Footprint...");
  const router = new DynamicToolRouter({ mode: "smart_dynamic" });

  const mockToolSuite: ToolDefinition[] = [
    { name: "view_file", description: "View file", category: "core", execute: async () => {} },
    { name: "write_file", description: "Write file", category: "core", execute: async () => {} },
    { name: "replace_file_content", description: "Edit file", category: "core", execute: async () => {} },
    { name: "run_command", description: "Execute shell command", category: "core", execute: async () => {} },
    { name: "list_dir", description: "List files", category: "core", execute: async () => {} },
    { name: "grep_search", description: "Regex grep", category: "core", execute: async () => {} },
    { name: "browser_navigate", description: "Navigate browser webpage", category: "browser", execute: async () => {} },
    { name: "browser_click", description: "Click DOM element", category: "browser", execute: async () => {} },
    { name: "worktree_create", description: "Create git worktree", category: "git", execute: async () => {} },
    { name: "db_query", description: "Execute SQL query on database", category: "database", execute: async () => {} },
    { name: "wallet_transfer", description: "Crypto token transfer", category: "wallet", execute: async () => {} },
  ];

  // 4a. Default prompt without domain triggers -> Core tools selected
  const defaultTools = router.selectRelevantTools(mockToolSuite, "Refactor the authentication logic in src/auth.ts");
  const defaultNames = defaultTools.map((t) => t.name);
  if (!defaultNames.includes("view_file") || !defaultNames.includes("write_file")) {
    throw new Error("Core tools missing from default selection");
  }
  if (defaultNames.includes("browser_click") || defaultNames.includes("wallet_transfer")) {
    throw new Error("Domain-specific tools should not be included without relevant prompt context");
  }

  // 4b. Prompt mentioning browser -> Browser tools dynamically activated
  const browserTools = router.selectRelevantTools(mockToolSuite, "Navigate to https://example.com and click the login button in the browser");
  const browserNames = browserTools.map((t) => t.name);
  if (!browserNames.includes("browser_navigate") || !browserNames.includes("browser_click")) {
    throw new Error("Browser tools should be dynamically activated for browser prompts");
  }

  // 4c. Token footprint comparison
  const allTokens = router.estimateToolTokens(mockToolSuite);
  const coreTokens = router.estimateToolTokens(defaultTools);
  if (coreTokens >= allTokens) {
    throw new Error("Dynamic tool router should reduce token footprint");
  }

  console.log(`  [✓] Context-aware routing verified: Core tools preserved, domain tools dynamically activated (Token savings: ${Math.round((1 - coreTokens / allTokens) * 100)}%).`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // Test 5: Tool Search & Explicit Activation
  // ---------------------------------------------------------------------------
  console.log("[Test 5/6] Validating Tool Search & Explicit Activation Mechanism...");
  const searchResults = router.searchTools(mockToolSuite, "sql query");
  if (searchResults.length === 0 || searchResults[0].name !== "db_query") {
    throw new Error(`Tool search failed: ${JSON.stringify(searchResults)}`);
  }

  router.activateTool("db_query");
  const activatedTools = router.selectRelevantTools(mockToolSuite, "General coding question");
  if (!activatedTools.some((t) => t.name === "db_query")) {
    throw new Error("Explicitly activated tool 'db_query' was not included");
  }
  router.clearExplicitTools();

  console.log("  [✓] Tool search DSL and explicit activation working deterministically.");
  passedTests++;

  // ---------------------------------------------------------------------------
  // Test 6: Grand Monolith Integration & Execution Ergonomics
  // ---------------------------------------------------------------------------
  console.log("[Test 6/6] Validating Monolith Tool Execution Pipeline & Schema Integration...");
  const { MonolithFactory } = await import("../src/factories/monolith-factory.js");
  const components = MonolithFactory.createEngine();

  // Test ValidatingToolRegistry with rich argument parser
  const viewResult = (await components.toolRegistry.executeTool("view_file", { path: "package.json", startLine: 1, endLine: 5 }, process.cwd())) as { content: string };
  if (!viewResult || !viewResult.content || !viewResult.content.includes("lumi-joy")) {
    throw new Error(`Monolith tool execution failed with prepared arguments: ${JSON.stringify(viewResult)}`);
  }

  // Test type coercion in live tool execution: string "1" and "5" coerced to number
  const coercedResult = (await components.toolRegistry.executeTool("view_file", { filePath: "package.json", startLine: "1", endLine: "5" } as any, process.cwd())) as { content: string };
  if (!coercedResult || !coercedResult.content || !coercedResult.content.includes("lumi-joy")) {
    throw new Error(`Monolith tool execution failed with coerced arguments: ${JSON.stringify(coercedResult)}`);
  }

  console.log("  [✓] Monolith tool execution pipeline passed with alias normalization and type coercion.");
  passedTests++;

  console.log("\n================================================================================");
  console.log(`  [✓] ALL ${passedTests}/${totalTests} WORLD-CLASS TOOL CALLING & ERGONOMICS TESTS PASSED! `);
  console.log("================================================================================\n");
}

runValidationSuite().catch((err) => {
  console.error("Validation failed with error:", err);
  process.exit(1);
});
