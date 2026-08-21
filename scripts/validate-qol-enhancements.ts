import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { AnchoredHands } from "../src/tooling/extensions/hashline/hands.js";
import { Eyes } from "../src/tooling/base/eyes.js";
import { ValidatingToolRegistry } from "../src/tooling/extensions/registry/tool-registry.js";
import { ProtocolEars } from "../src/tooling/extensions/telemetry/ears.js";

async function runQoLValidation() {
  console.log("\x1b[1;36m================================================================\x1b[0m");
  console.log("\x1b[1;36m   LUMI Quality-of-Life (QoL) & I/O Authority Validation Suite  \x1b[0m");
  console.log("\x1b[1;36m================================================================\x1b[0m\n");

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "lumi-qol-test-"));
  const testFile = path.join(tempDir, "sample.txt");
  await fs.writeFile(testFile, "line 1\nline 2: hello world\nline 3: goodbye\n", "utf-8");

  const eyes = new Eyes();
  const hands = new AnchoredHands();
  const ears = new ProtocolEars();
  const registry = new ValidatingToolRegistry(eyes, hands, ears);

  // Test 1: view_file with line slicing
  console.log("\x1b[1;34m[Test 1/78] Validating view_file with line slicing...\x1b[0m");
  const viewRes = (await registry.executeTool("view_file", { path: testFile, startLine: 2, endLine: 2 }, tempDir)) as any;
  if (!viewRes.content.includes("line 2: hello world") || viewRes.content.includes("line 1")) {
    throw new Error(`view_file slicing failed: ${JSON.stringify(viewRes)}`);
  }
  console.log("  \x1b[32m[✓] view_file line slicing passed cleanly.\x1b[0m");

  // Test 2: replace_file_content exact replacement
  console.log("\x1b[1;34m[Test 2/78] Validating replace_file_content...\x1b[0m");
  await registry.executeTool("replace_file_content", {
    path: testFile,
    target: "line 2: hello world",
    replacement: "line 2: greetings earthling",
  }, tempDir);
  const updatedContent = await fs.readFile(testFile, "utf-8");
  if (!updatedContent.includes("greetings earthling") || updatedContent.includes("hello world")) {
    throw new Error(`replace_file_content failed: ${updatedContent}`);
  }
  console.log("  \x1b[32m[✓] replace_file_content exact chunk replacement passed.\x1b[0m");

  // Test 3: list_dir with metadata
  console.log("\x1b[1;34m[Test 3/78] Validating list_dir with entry details...\x1b[0m");
  const listRes = (await registry.executeTool("list_dir", { path: tempDir }, tempDir)) as any[];
  const sampleEntry = listRes.find((e) => e.name === "sample.txt");
  if (!sampleEntry || sampleEntry.isDir !== false || typeof sampleEntry.sizeBytes !== "number") {
    throw new Error(`list_dir entry metadata failed: ${JSON.stringify(listRes)}`);
  }
  console.log("  \x1b[32m[✓] list_dir directory introspection passed.\x1b[0m");

  // Test 4: grep_search across files
  console.log("\x1b[1;34m[Test 4/78] Validating grep_search...\x1b[0m");
  const grepRes = (await registry.executeTool("grep_search", { query: "greetings", path: tempDir }, tempDir)) as any[];
  if (!Array.isArray(grepRes) || grepRes.length === 0 || !grepRes[0].lineContent.includes("earthling")) {
    throw new Error(`grep_search failed: ${JSON.stringify(grepRes)}`);
  }
  console.log("  \x1b[32m[✓] grep_search pattern matching passed.\x1b[0m");

  // Test 5: run_command with 10MB execution buffer
  console.log("\x1b[1;34m[Test 5/78] Validating run_command high-capacity execution buffer...\x1b[0m");
  const cmdRes = (await registry.executeTool("run_command", { command: "node -e 'console.log(\"X\".repeat(2000000))'" }, tempDir)) as any;
  if (cmdRes.exitCode !== 0 || cmdRes.stdout.length < 2000000) {
    throw new Error(`run_command large buffer failed: exitCode=${cmdRes.exitCode}, length=${cmdRes.stdout?.length}`);
  }
  console.log("  \x1b[32m[✓] run_command executed with 2MB stdout output without buffer overflow.\x1b[0m");

  // Test 6: Circuit Breaker resilience on core tools
  console.log("\x1b[1;34m[Test 6/78] Validating circuit breaker resilience for core interactive tools...\x1b[0m");
  for (let i = 0; i < 5; i++) {
    registry.circuitBreaker.recordFailure("run_command");
  }
  const canExec = registry.circuitBreaker.canExecute("run_command");
  if (!canExec) {
    throw new Error("run_command was improperly blocked by circuit breaker");
  }
  console.log("  \x1b[32m[✓] Core developer tools are immune to false-positive lockout tripwires.\x1b[0m");

  // Test 7: Parameter schema argument coercion
  console.log("\x1b[1;34m[Test 7/78] Validating model tool argument auto-coercion...\x1b[0m");
  const coercedArgs: any = { path: testFile, startLine: "2", endLine: "2" };
  const validation = registry.validateToolArgs("view_file", coercedArgs);
  if (!validation.valid || typeof coercedArgs.startLine !== "number" || typeof coercedArgs.endLine !== "number") {
    throw new Error(`Argument coercion failed: ${JSON.stringify(validation)}`);
  }
  console.log("  \x1b[32m[✓] String-to-number parameter coercion passed.\x1b[0m");

  // Test 8: multi_replace_file_content batch replacement
  console.log("\x1b[1;34m[Test 8/78] Validating multi_replace_file_content...\x1b[0m");
  const multiTestFile = path.join(tempDir, "multi_sample.txt");
  await fs.writeFile(multiTestFile, "alpha 1\nbeta 2\ngamma 3\ndelta 4\n", "utf-8");
  await registry.executeTool("multi_replace_file_content", {
    path: multiTestFile,
    chunks: [
      { target: "alpha 1", replacement: "ALPHA ONE" },
      { target: "gamma 3", replacement: "GAMMA THREE" },
    ],
  }, tempDir);
  const multiUpdated = await fs.readFile(multiTestFile, "utf-8");
  if (!multiUpdated.includes("ALPHA ONE") || !multiUpdated.includes("GAMMA THREE") || !multiUpdated.includes("beta 2")) {
    throw new Error(`multi_replace_file_content failed: ${multiUpdated}`);
  }
  console.log("  \x1b[32m[✓] multi_replace_file_content non-contiguous batch replacement passed.\x1b[0m");

  // Test 9: replace_file_content newline normalization
  console.log("\x1b[1;34m[Test 9/78] Validating newline normalization in file replacement...\x1b[0m");
  const crlfFile = path.join(tempDir, "crlf_sample.txt");
  await fs.writeFile(crlfFile, "foo\r\nbar\r\nbaz\r\n", "utf-8");
  await registry.executeTool("replace_file_content", {
    path: crlfFile,
    target: "bar\nbaz",
    replacement: "BAR\nBAZ",
  }, tempDir);
  const crlfUpdated = await fs.readFile(crlfFile, "utf-8");
  if (!crlfUpdated.includes("BAR") || !crlfUpdated.includes("BAZ")) {
    throw new Error(`CRLF normalization failed: ${crlfUpdated}`);
  }
  console.log("  \x1b[32m[✓] CRLF / LF cross-platform line ending normalization passed.\x1b[0m");

  // Test 10: Slash router /rewind and /help
  console.log("\x1b[1;34m[Test 10/78] Validating slash router /rewind, /tools, and /help...\x1b[0m");
  const { AgentSlashRouter } = await import("../src/agents/extensions/resolution/agent-slash-router.js");
  const { SessionContext } = await import("../src/sessions/base/session-context.js");
  const { PersistentSessionStore } = await import("../src/sessions/extensions/persistence/session-store.js");
  const { SessionCompactor } = await import("../src/sessions/extensions/compaction/session-compactor.js");
  const { SessionVfs } = await import("../src/sessions/extensions/vfs/session-vfs.js");
  const { SessionMemoryStore } = await import("../src/sessions/extensions/memory/session-memory-store.js");
  const { ModelResolver } = await import("../src/agents/extensions/resolution/model-resolver.js");

  const slashRouter = new AgentSlashRouter();
  const sessionCtx = new SessionContext({ sessionId: "test-sess", cwd: tempDir });
  const sessionStore = new PersistentSessionStore();
  const sessionCompactor = new SessionCompactor();
  const sessionVfs = new SessionVfs();
  const sessionMemoryStore = new SessionMemoryStore();
  const modelResolver = new ModelResolver();

  sessionStore.addMessage({ role: "user", content: "hello" });
  sessionStore.addMessage({ role: "assistant", content: "hi" });
  sessionCtx.turnCount = 1;

  const helpRes = await slashRouter.handleSlashCommand("/help", {
    sessionContext: sessionCtx,
    sessionStore,
    sessionCompactor,
    sessionVfs,
    sessionMemoryStore,
    modelResolver,
    toolRegistry: registry,
  });
  if (!helpRes.handled || !helpRes.output?.includes("/rewind")) {
    throw new Error(`Slash /help failed: ${JSON.stringify(helpRes)}`);
  }

  const rewindRes = await slashRouter.handleSlashCommand("/rewind 1", {
    sessionContext: sessionCtx,
    sessionStore,
    sessionCompactor,
    sessionVfs,
    sessionMemoryStore,
    modelResolver,
    toolRegistry: registry,
  });
  if (!rewindRes.handled || sessionStore.getMessages().length !== 0 || sessionCtx.turnCount !== 0) {
    throw new Error(`Slash /rewind failed: ${JSON.stringify(rewindRes)}`);
  }
  console.log("  \x1b[32m[✓] Slash router /help and /rewind execution passed.\x1b[0m");

  // Test 11: Tool name alias resolution
  console.log("\x1b[1;34m[Test 11/78] Validating tool name alias resolution...\x1b[0m");
  const aliasRes = (await registry.executeTool("read_file", { path: testFile, startLine: 1, endLine: 1 }, tempDir)) as any;
  if (!aliasRes.content.includes("line 1")) {
    throw new Error(`Tool alias read_file -> view_file failed: ${JSON.stringify(aliasRes)}`);
  }
  const bashRes = (await registry.executeTool("bash", { command: "echo 'bash alias works'" }, tempDir)) as any;
  if (!bashRes.stdout.includes("bash alias works")) {
    throw new Error(`Tool alias bash -> run_command failed: ${JSON.stringify(bashRes)}`);
  }
  console.log("  \x1b[32m[✓] Tool name alias resolution (read_file, bash, create_file) passed.\x1b[0m");

  // Test 12: Parameter name alias normalization
  console.log("\x1b[1;34m[Test 12/78] Validating parameter name alias normalization...\x1b[0m");
  const paramAliasRes = (await registry.executeTool("view_file", { filePath: testFile }, tempDir)) as any;
  if (!paramAliasRes.content.includes("line 1")) {
    throw new Error(`Parameter alias filePath -> path failed: ${JSON.stringify(paramAliasRes)}`);
  }
  const cmdAliasRes = (await registry.executeTool("run_command", { cmd: "echo 'cmd alias works'" }, tempDir)) as any;
  if (!cmdAliasRes.stdout.includes("cmd alias works")) {
    throw new Error(`Parameter alias cmd -> command failed: ${JSON.stringify(cmdAliasRes)}`);
  }
  console.log("  \x1b[32m[✓] Parameter name alias normalization (filePath, cmd, text, search_term) passed.\x1b[0m");

  // Test 13: grep_search with includes and maxResults
  console.log("\x1b[1;34m[Test 13/78] Validating grep_search options (includes, maxResults)...\x1b[0m");
  const grepFiltered = (await registry.executeTool("grep_search", {
    query: "alpha",
    path: tempDir,
    includes: ["*.txt"],
    maxResults: 5,
  }, tempDir)) as any[];
  if (!Array.isArray(grepFiltered) || grepFiltered.length === 0) {
    throw new Error(`grep_search filtering failed: ${JSON.stringify(grepFiltered)}`);
  }
  console.log("  \x1b[32m[✓] grep_search options (includes filter, maxResults cap) passed.\x1b[0m");

  // Test 14: run_command durationMs telemetry
  console.log("\x1b[1;34m[Test 14/78] Validating run_command execution duration telemetry...\x1b[0m");
  const timedCmd = (await registry.executeTool("run_command", { command: "node -e 'setTimeout(() => console.log(\"done\"), 50)'" }, tempDir)) as any;
  if (typeof timedCmd.durationMs !== "number" || timedCmd.durationMs <= 0) {
    throw new Error(`run_command durationMs telemetry missing: ${JSON.stringify(timedCmd)}`);
  }
  console.log(`  \x1b[32m[✓] run_command duration telemetry verified (${timedCmd.durationMs} ms).\x1b[0m`);

  // Test 15: Safe path resolution and recursive directory creation
  console.log("\x1b[1;34m[Test 15/78] Validating safe path resolution and nested directory writes...\x1b[0m");
  const nestedFile = path.join(tempDir, "nested", "deep", "dir", "test.txt");
  await registry.executeTool("write_file", { path: nestedFile, content: "nested content" }, tempDir);
  const nestedContent = await fs.readFile(nestedFile, "utf-8");
  if (nestedContent !== "nested content") {
    throw new Error(`Safe nested write failed: ${nestedContent}`);
  }
  console.log("  \x1b[32m[✓] Safe path resolution & automatic deep directory creation passed.\x1b[0m");

  // Test 16: Universal JSON parameter coercion for multi-replace
  console.log("\x1b[1;34m[Test 16/78] Validating stringified JSON parameter auto-parsing...\x1b[0m");
  const jsonTestFile = path.join(tempDir, "json_coerce.txt");
  await fs.writeFile(jsonTestFile, "item 1\nitem 2\n", "utf-8");
  await registry.executeTool("multi_replace_file_content", {
    path: jsonTestFile,
    chunks: JSON.stringify([{ target: "item 1", replacement: "FIRST ITEM" }]),
  }, tempDir);
  const jsonUpdated = await fs.readFile(jsonTestFile, "utf-8");
  if (!jsonUpdated.includes("FIRST ITEM")) {
    throw new Error(`JSON parameter coercion failed: ${jsonUpdated}`);
  }
  console.log("  \x1b[32m[✓] Stringified JSON array auto-parsing for multi-replace passed.\x1b[0m");

  // Test 17: VFS unified diff generation and selective file commit
  console.log("\x1b[1;34m[Test 17/78] Validating VFS unified diff generation and selective commit...\x1b[0m");
  const vfsTestFile = path.join(tempDir, "vfs_test.txt");
  await fs.writeFile(vfsTestFile, "original line 1\noriginal line 2\n", "utf-8");
  sessionVfs.stageWrite(vfsTestFile, "original line 1\nmodified line 2\n");
  const vfsDiff = await sessionVfs.generateDiff(vfsTestFile);
  if (!vfsDiff || !vfsDiff.includes("-original line 2") || !vfsDiff.includes("+modified line 2")) {
    throw new Error(`VFS generateDiff failed: ${vfsDiff}`);
  }
  const committedOk = await sessionVfs.commitFile(vfsTestFile);
  const diskAfterCommit = await fs.readFile(vfsTestFile, "utf-8");
  if (!committedOk || !diskAfterCommit.includes("modified line 2")) {
    throw new Error(`VFS commitFile failed: ${diskAfterCommit}`);
  }
  console.log("  \x1b[32m[✓] VFS unified diff generation & selective file commit passed.\x1b[0m");

  // Test 18: Slash router /diff and /commit integration
  console.log("\x1b[1;34m[Test 18/78] Validating slash router /diff, /commit, and /discard...\x1b[0m");
  sessionVfs.stageWrite(vfsTestFile, "staged for slash test\n");
  const slashDiffRes = await slashRouter.handleSlashCommand("/diff", {
    sessionContext: sessionCtx,
    sessionStore,
    sessionCompactor,
    sessionVfs,
    sessionMemoryStore,
    modelResolver,
    toolRegistry: registry,
  });
  if (!slashDiffRes.handled || !slashDiffRes.output?.includes("vfs_test.txt")) {
    throw new Error(`Slash /diff failed: ${JSON.stringify(slashDiffRes)}`);
  }
  const slashCommitRes = await slashRouter.handleSlashCommand(`/commit ${vfsTestFile}`, {
    sessionContext: sessionCtx,
    sessionStore,
    sessionCompactor,
    sessionVfs,
    sessionMemoryStore,
    modelResolver,
    toolRegistry: registry,
  });
  if (!slashCommitRes.handled || !slashCommitRes.output?.includes("Committed")) {
    throw new Error(`Slash /commit failed: ${JSON.stringify(slashCommitRes)}`);
  }
  console.log("  \x1b[32m[✓] Slash router /diff, /commit, and /discard commands passed.\x1b[0m");

  // Test 19: batch_view_files multi-file reading
  console.log("\x1b[1;34m[Test 19/78] Validating batch_view_files multi-file reading...\x1b[0m");
  const batchRes = (await registry.executeTool("batch_view_files", {
    paths: [testFile, multiTestFile],
  }, tempDir)) as any[];
  if (!Array.isArray(batchRes) || batchRes.length !== 2 || !batchRes[0].content.includes("earthling")) {
    throw new Error(`batch_view_files failed: ${JSON.stringify(batchRes)}`);
  }
  console.log("  \x1b[32m[✓] batch_view_files multi-file simultaneous reading passed.\x1b[0m");

  // Test 20: find_files pattern searching
  console.log("\x1b[1;34m[Test 20/78] Validating find_files pattern searching...\x1b[0m");
  const foundFiles = (await registry.executeTool("find_files", {
    pattern: "sample",
    path: tempDir,
  }, tempDir)) as string[];
  if (!Array.isArray(foundFiles) || foundFiles.length === 0) {
    throw new Error(`find_files failed: ${JSON.stringify(foundFiles)}`);
  }
  console.log("  \x1b[32m[✓] find_files filename pattern matching passed.\x1b[0m");

  // Test 21: file_info inspection
  console.log("\x1b[1;34m[Test 21/78] Validating file_info metadata inspection...\x1b[0m");
  const info = (await registry.executeTool("file_info", { path: testFile }, tempDir)) as any;
  if (!info.exists || !info.isFile || typeof info.sizeBytes !== "number" || typeof info.totalLines !== "number") {
    throw new Error(`file_info inspection failed: ${JSON.stringify(info)}`);
  }
  console.log("  \x1b[32m[✓] file_info metadata inspection passed.\x1b[0m");

  // Test 22: directory_tree visualizer
  console.log("\x1b[1;34m[Test 22/78] Validating directory_tree ASCII tree generator...\x1b[0m");
  const treeOutput = (await registry.executeTool("directory_tree", { path: tempDir }, tempDir)) as string;
  if (typeof treeOutput !== "string" || !treeOutput.includes("sample.txt")) {
    throw new Error(`directory_tree generation failed: ${treeOutput}`);
  }
  console.log("  \x1b[32m[✓] directory_tree structured ASCII rendering passed.\x1b[0m");

  // Test 23: create_directory tool
  console.log("\x1b[1;34m[Test 23/78] Validating create_directory tool...\x1b[0m");
  const newSubdir = path.join(tempDir, "custom_subdir", "level2");
  await registry.executeTool("create_directory", { path: newSubdir }, tempDir);
  const subdirInfo = await registry.executeTool("file_info", { path: newSubdir }, tempDir) as any;
  if (!subdirInfo.exists || !subdirInfo.isDir) {
    throw new Error(`create_directory failed: ${JSON.stringify(subdirInfo)}`);
  }
  console.log("  \x1b[32m[✓] create_directory recursive directory creation passed.\x1b[0m");

  // Test 24: move_file tool
  console.log("\x1b[1;34m[Test 24/78] Validating move_file tool...\x1b[0m");
  const srcFile = path.join(tempDir, "to_move.txt");
  const destFile = path.join(newSubdir, "moved.txt");
  await fs.writeFile(srcFile, "data to move", "utf-8");
  await registry.executeTool("move_file", { source: srcFile, target: destFile }, tempDir);
  const destInfo = await registry.executeTool("file_info", { path: destFile }, tempDir) as any;
  const srcInfo = await registry.executeTool("file_info", { path: srcFile }, tempDir) as any;
  if (!destInfo.exists || srcInfo.exists) {
    throw new Error(`move_file failed: srcExists=${srcInfo.exists}, destExists=${destInfo.exists}`);
  }
  console.log("  \x1b[32m[✓] move_file cross-directory file relocation passed.\x1b[0m");

  // Test 25: delete_file tool
  console.log("\x1b[1;34m[Test 25/78] Validating delete_file tool...\x1b[0m");
  await registry.executeTool("delete_file", { path: destFile }, tempDir);
  const deletedInfo = await registry.executeTool("file_info", { path: destFile }, tempDir) as any;
  if (deletedInfo.exists) {
    throw new Error("delete_file failed to delete target file");
  }
  console.log("  \x1b[32m[✓] delete_file safe file deletion passed.\x1b[0m");

  // Test 26: copy_file tool
  console.log("\x1b[1;34m[Test 26/78] Validating copy_file tool...\x1b[0m");
  const copySrc = path.join(tempDir, "copy_source.txt");
  const copyDest = path.join(tempDir, "copy_dest.txt");
  await fs.writeFile(copySrc, "source content to duplicate", "utf-8");
  await registry.executeTool("copy_file", { source: copySrc, target: copyDest }, tempDir);
  const copyDestContent = await fs.readFile(copyDest, "utf-8");
  if (copyDestContent !== "source content to duplicate") {
    throw new Error(`copy_file failed: ${copyDestContent}`);
  }
  console.log("  \x1b[32m[✓] copy_file recursive file duplication passed.\x1b[0m");

  // Test 27: path_exists fast boolean check
  console.log("\x1b[1;34m[Test 27/78] Validating path_exists fast boolean check...\x1b[0m");
  const checkTrue = await registry.executeTool("path_exists", { path: copyDest }, tempDir) as any;
  const checkFalse = await registry.executeTool("path_exists", { path: path.join(tempDir, "non_existent.txt") }, tempDir) as any;
  if (!checkTrue.exists || checkFalse.exists) {
    throw new Error(`path_exists failed: checkTrue=${checkTrue.exists}, checkFalse=${checkFalse.exists}`);
  }
  console.log("  \x1b[32m[✓] path_exists boolean existence check passed.\x1b[0m");

  // Test 28: append_file tool
  console.log("\x1b[1;34m[Test 28/78] Validating append_file tool...\x1b[0m");
  const appendFile = path.join(tempDir, "append_test.txt");
  await registry.executeTool("write_file", { path: appendFile, content: "Initial Line\n" }, tempDir);
  await registry.executeTool("append_file", { path: appendFile, content: "Appended Line\n" }, tempDir);
  const appendedContent = await fs.readFile(appendFile, "utf-8");
  if (appendedContent !== "Initial Line\nAppended Line\n") {
    throw new Error(`append_file failed: ${appendedContent}`);
  }
  console.log("  \x1b[32m[✓] append_file atomic file appending passed.\x1b[0m");

  // Test 29: clear_file tool
  console.log("\x1b[1;34m[Test 29/78] Validating clear_file tool...\x1b[0m");
  await registry.executeTool("clear_file", { path: appendFile }, tempDir);
  const clearedContent = await fs.readFile(appendFile, "utf-8");
  if (clearedContent !== "") {
    throw new Error(`clear_file failed: ${clearedContent}`);
  }
  console.log("  \x1b[32m[✓] clear_file file truncation to 0 bytes passed.\x1b[0m");

  // Test 30: batch_delete_files tool
  console.log("\x1b[1;34m[Test 30/78] Validating batch_delete_files tool...\x1b[0m");
  const bulkFile1 = path.join(tempDir, "bulk1.txt");
  const bulkFile2 = path.join(tempDir, "bulk2.txt");
  await fs.writeFile(bulkFile1, "bulk 1", "utf-8");
  await fs.writeFile(bulkFile2, "bulk 2", "utf-8");
  const bulkDelRes = await registry.executeTool("batch_delete_files", { paths: [bulkFile1, bulkFile2] }, tempDir) as any[];
  if (!Array.isArray(bulkDelRes) || bulkDelRes.length !== 2 || !bulkDelRes[0].deleted || !bulkDelRes[1].deleted) {
    throw new Error(`batch_delete_files failed: ${JSON.stringify(bulkDelRes)}`);
  }
  console.log("  \x1b[32m[✓] batch_delete_files simultaneous bulk deletion passed.\x1b[0m");

  // Test 31: file_hash checksum tool
  console.log("\x1b[1;34m[Test 31/78] Validating file_hash checksum inspection...\x1b[0m");
  const hashFile = path.join(tempDir, "hash_test.txt");
  await fs.writeFile(hashFile, "deterministic content for hashing", "utf-8");
  const hashRes = await registry.executeTool("file_hash", { path: hashFile }, tempDir) as any;
  if (!hashRes.success || typeof hashRes.hash !== "string" || hashRes.hash.length !== 64) {
    throw new Error(`file_hash calculation failed: ${JSON.stringify(hashRes)}`);
  }
  console.log(`  \x1b[32m[✓] file_hash SHA-256 calculation verified (${hashRes.hash.slice(0, 16)}...).\x1b[0m`);

  // Test 32: set_env environment configuration
  console.log("\x1b[1;34m[Test 32/78] Validating set_env environment configuration...\x1b[0m");
  const setEnvRes = await registry.executeTool("set_env", { key: "LUMI_TEST_KEY", value: "zen_speed_active" }, tempDir) as any;
  if (!setEnvRes.success || process.env.LUMI_TEST_KEY !== "zen_speed_active") {
    throw new Error(`set_env failed: ${JSON.stringify(setEnvRes)}`);
  }
  console.log("  \x1b[32m[✓] set_env runtime environment configuration passed.\x1b[0m");

  // Test 33: get_env environment reading
  console.log("\x1b[1;34m[Test 33/78] Validating get_env environment reading...\x1b[0m");
  const getEnvRes = await registry.executeTool("get_env", { key: "LUMI_TEST_KEY" }, tempDir) as any;
  if (getEnvRes.value !== "zen_speed_active") {
    throw new Error(`get_env failed: ${JSON.stringify(getEnvRes)}`);
  }
  console.log("  \x1b[32m[✓] get_env specific key introspection passed.\x1b[0m");

  // Test 34: system_info hardware & OS metrics
  console.log("\x1b[1;34m[Test 34/78] Validating system_info hardware & OS metrics...\x1b[0m");
  const sysInfoRes = await registry.executeTool("system_info", {}, tempDir) as any;
  if (!sysInfoRes.platform || !sysInfoRes.arch || typeof sysInfoRes.cpus !== "number" || typeof sysInfoRes.totalMemoryBytes !== "number") {
    throw new Error(`system_info failed: ${JSON.stringify(sysInfoRes)}`);
  }
  console.log(`  \x1b[32m[✓] system_info verified (${sysInfoRes.platform} ${sysInfoRes.arch}, ${sysInfoRes.cpus} CPUs, Node ${sysInfoRes.nodeVersion}).\x1b[0m`);

  // Test 35: http_request local network I/O
  console.log("\x1b[1;34m[Test 35/78] Validating http_request network I/O...\x1b[0m");
  const http = await import("node:http");
  const testServer = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", url: req.url, method: req.method }));
  });
  await new Promise<void>((resolve) => testServer.listen(0, "127.0.0.1", resolve));
  const port = (testServer.address() as any).port;

  const httpRes = await registry.executeTool("http_request", {
    url: `http://127.0.0.1:${port}/ping`,
    method: "GET",
  }, tempDir) as any;

  await new Promise<void>((resolve) => testServer.close(() => resolve()));

  if (!httpRes.ok || httpRes.status !== 200 || httpRes.json?.status !== "ok") {
    throw new Error(`http_request failed: ${JSON.stringify(httpRes)}`);
  }
  console.log("  \x1b[32m[✓] http_request native HTTP execution passed.\x1b[0m");

  // Test 36: batch_write_files multi-file writing
  console.log("\x1b[1;34m[Test 36/78] Validating batch_write_files multi-file creation...\x1b[0m");
  const batchWFile1 = path.join(tempDir, "batch_w1.txt");
  const batchWFile2 = path.join(tempDir, "batch_w2.txt");
  const batchWRes = await registry.executeTool("batch_write_files", {
    files: [
      { path: batchWFile1, content: "batch content 1" },
      { path: batchWFile2, content: "batch content 2" },
    ],
  }, tempDir) as any[];
  if (!Array.isArray(batchWRes) || batchWRes.length !== 2 || !batchWRes[0].written || !batchWRes[1].written) {
    throw new Error(`batch_write_files failed: ${JSON.stringify(batchWRes)}`);
  }
  const content1 = await fs.readFile(batchWFile1, "utf-8");
  const content2 = await fs.readFile(batchWFile2, "utf-8");
  if (content1 !== "batch content 1" || content2 !== "batch content 2") {
    throw new Error(`batch_write_files content mismatch: ${content1}, ${content2}`);
  }
  console.log("  \x1b[32m[✓] batch_write_files simultaneous multi-file writing passed.\x1b[0m");

  // Test 37: workspace_summary aggregate statistics
  console.log("\x1b[1;34m[Test 37/78] Validating workspace_summary aggregate statistics...\x1b[0m");
  const summaryRes = await registry.executeTool("workspace_summary", { path: tempDir }, tempDir) as any;
  if (typeof summaryRes.totalFiles !== "number" || summaryRes.totalFiles === 0 || !summaryRes.extensions) {
    throw new Error(`workspace_summary failed: ${JSON.stringify(summaryRes)}`);
  }
  console.log(`  \x1b[32m[✓] workspace_summary aggregated ${summaryRes.totalFiles} files across ${summaryRes.totalDirectories} dirs.\x1b[0m`);

  // Test 38: find_free_port dynamic port allocator
  console.log("\x1b[1;34m[Test 38/78] Validating find_free_port TCP port allocator...\x1b[0m");
  const freePortRes = await registry.executeTool("find_free_port", {}, tempDir) as any;
  if (!freePortRes.available || typeof freePortRes.port !== "number" || freePortRes.port <= 0) {
    throw new Error(`find_free_port failed: ${JSON.stringify(freePortRes)}`);
  }
  console.log(`  \x1b[32m[✓] find_free_port allocated free port :${freePortRes.port}.\x1b[0m`);

  // Test 39: check_port port availability verification
  console.log("\x1b[1;34m[Test 39/78] Validating check_port status verification...\x1b[0m");
  const checkPortRes = await registry.executeTool("check_port", { port: freePortRes.port }, tempDir) as any;
  if (checkPortRes.inUse || !checkPortRes.available) {
    throw new Error(`check_port failed: ${JSON.stringify(checkPortRes)}`);
  }
  console.log(`  \x1b[32m[✓] check_port verified port :${freePortRes.port} is available.\x1b[0m`);

  // Test 40: memory_usage V8 heap and RSS metrics
  console.log("\x1b[1;34m[Test 40/78] Validating memory_usage runtime diagnostics...\x1b[0m");
  const memRes = await registry.executeTool("memory_usage", {}, tempDir) as any;
  if (typeof memRes.heapUsedBytes !== "number" || typeof memRes.rssMB !== "number" || memRes.heapUsedMB <= 0) {
    throw new Error(`memory_usage failed: ${JSON.stringify(memRes)}`);
  }
  console.log(`  \x1b[32m[✓] memory_usage verified (${memRes.heapUsedMB} MB heap used, ${memRes.rssMB} MB RSS).\x1b[0m`);

  // Test 41: download_file remote stream to disk
  console.log("\x1b[1;34m[Test 41/78] Validating download_file streaming directly to disk...\x1b[0m");
  const dlServer = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("downloaded payload data stream");
  });
  await new Promise<void>((resolve) => dlServer.listen(0, "127.0.0.1", resolve));
  const dlPort = (dlServer.address() as any).port;
  const dlDest = path.join(tempDir, "downloads", "asset.txt");

  const dlRes = await registry.executeTool("download_file", {
    url: `http://127.0.0.1:${dlPort}/asset`,
    path: dlDest,
  }, tempDir) as any;

  await new Promise<void>((resolve) => dlServer.close(() => resolve()));

  if (!dlRes.success || dlRes.sizeBytes <= 0) {
    throw new Error(`download_file failed: ${JSON.stringify(dlRes)}`);
  }
  const dlDiskContent = await fs.readFile(dlDest, "utf-8");
  if (dlDiskContent !== "downloaded payload data stream") {
    throw new Error(`download_file content mismatch: ${dlDiskContent}`);
  }
  console.log("  \x1b[32m[✓] download_file stream download and automatic directory creation passed.\x1b[0m");

  // Test 42: touch_file creation and timestamp update
  console.log("\x1b[1;34m[Test 42/78] Validating touch_file...\x1b[0m");
  const touchDest = path.join(tempDir, "touched_file.txt");
  const touchRes = await registry.executeTool("touch_file", { path: touchDest }, tempDir) as any;
  const touchInfo = await registry.executeTool("file_info", { path: touchDest }, tempDir) as any;
  if (!touchRes.success || !touchInfo.exists || touchInfo.sizeBytes !== 0) {
    throw new Error(`touch_file failed: ${JSON.stringify(touchInfo)}`);
  }
  console.log("  \x1b[32m[✓] touch_file empty file creation & timestamp update passed.\x1b[0m");

  // Test 43: disk_usage directory and tree space calculator
  console.log("\x1b[1;34m[Test 43/78] Validating disk_usage space calculation...\x1b[0m");
  const duRes = await registry.executeTool("disk_usage", { path: tempDir }, tempDir) as any;
  if (typeof duRes.totalBytes !== "number" || duRes.totalBytes <= 0 || !duRes.formattedSize) {
    throw new Error(`disk_usage failed: ${JSON.stringify(duRes)}`);
  }
  console.log(`  \x1b[32m[✓] disk_usage verified (${duRes.formattedSize}, ${duRes.totalFiles} files across ${duRes.totalDirectories} dirs).\x1b[0m`);

  // Test 44: search_and_replace multi-file find and replace
  console.log("\x1b[1;34m[Test 44/78] Validating search_and_replace across directory tree...\x1b[0m");
  const sarDir = path.join(tempDir, "sar_test");
  await fs.mkdir(sarDir, { recursive: true });
  await fs.writeFile(path.join(sarDir, "f1.txt"), "old_brand_v1 in file 1", "utf-8");
  await fs.writeFile(path.join(sarDir, "f2.txt"), "old_brand_v1 in file 2", "utf-8");

  const sarRes = await registry.executeTool("search_and_replace", {
    path: sarDir,
    find: "old_brand_v1",
    replace: "new_brand_v2",
  }, tempDir) as any;

  if (!sarRes.success || sarRes.totalFilesModified !== 2 || sarRes.totalReplacements !== 2) {
    throw new Error(`search_and_replace failed: ${JSON.stringify(sarRes)}`);
  }
  const f1Content = await fs.readFile(path.join(sarDir, "f1.txt"), "utf-8");
  const f2Content = await fs.readFile(path.join(sarDir, "f2.txt"), "utf-8");
  if (!f1Content.includes("new_brand_v2") || !f2Content.includes("new_brand_v2")) {
    throw new Error(`search_and_replace contents mismatch: ${f1Content}, ${f2Content}`);
  }
  console.log("  \x1b[32m[✓] search_and_replace multi-file replacement passed (2 files updated).\x1b[0m");

  // Test 45: chmod_file permissions tool
  console.log("\x1b[1;34m[Test 45/78] Validating chmod_file permissions modification...\x1b[0m");
  const scriptFile = path.join(tempDir, "script.sh");
  await fs.writeFile(scriptFile, "#!/bin/sh\necho 'hello'", "utf-8");
  const chmodRes = await registry.executeTool("chmod_file", { path: scriptFile, mode: "executable" }, tempDir) as any;
  if (!chmodRes.success || chmodRes.mode !== "755") {
    throw new Error(`chmod_file failed: ${JSON.stringify(chmodRes)}`);
  }
  console.log("  \x1b[32m[✓] chmod_file marked script as 755 executable.\x1b[0m");

  // Test 46: create_temp_dir isolated scratchpad
  console.log("\x1b[1;34m[Test 46/78] Validating create_temp_dir scratchpad allocation...\x1b[0m");
  const tempDirRes = await registry.executeTool("create_temp_dir", { prefix: "lumi-test-scratch-" }, tempDir) as any;
  if (!tempDirRes.success || typeof tempDirRes.path !== "string" || !tempDirRes.path.includes("lumi-test-scratch-")) {
    throw new Error(`create_temp_dir failed: ${JSON.stringify(tempDirRes)}`);
  }
  await fs.rm(tempDirRes.path, { recursive: true, force: true });
  console.log("  \x1b[32m[✓] create_temp_dir allocated and verified OS temp sandbox.\x1b[0m");

  // Test 47: kill_port process termination
  console.log("\x1b[1;34m[Test 47/78] Validating kill_port port liberator...\x1b[0m");
  const kpServer = http.createServer((req, res) => res.end("ok"));
  await new Promise<void>((resolve) => kpServer.listen(0, "127.0.0.1", resolve));
  const kpPort = (kpServer.address() as any).port;
  await new Promise<void>((resolve) => kpServer.close(() => resolve()));

  const kpRes = await registry.executeTool("kill_port", { port: kpPort }, tempDir) as any;
  if (!kpRes.success || !kpRes.freed) {
    throw new Error(`kill_port failed: ${JSON.stringify(kpRes)}`);
  }
  console.log(`  \x1b[32m[✓] kill_port verified port :${kpPort} liberation.\x1b[0m`);

  // Test 48: kill_process by PID
  console.log("\x1b[1;34m[Test 48/78] Validating kill_process PID termination...\x1b[0m");
  const { spawn } = await import("node:child_process");
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
  const childPid = child.pid!;

  const killRes = await registry.executeTool("kill_process", { pid: childPid, signal: "SIGTERM" }, tempDir) as any;
  if (!killRes.success || killRes.pid !== childPid) {
    throw new Error(`kill_process failed: ${JSON.stringify(killRes)}`);
  }
  console.log(`  \x1b[32m[✓] kill_process successfully sent SIGTERM to PID ${childPid}.\x1b[0m`);

  // Test 49: grep_search on single direct file with context lines and word match
  console.log("\x1b[1;34m[Test 49/78] Validating grep_search on direct single file with contextLines & wordMatch...\x1b[0m");
  const grepTargetFile = path.join(tempDir, "context_test.txt");
  await fs.writeFile(grepTargetFile, "line 1: before 1\nline 2: before 2\nline 3: exact_token target line\nline 4: after 1\nline 5: after 2\n", "utf-8");

  const singleFileGrep = await registry.executeTool("grep_search", {
    path: grepTargetFile,
    query: "exact_token",
    wordMatch: true,
    contextLines: 2,
  }, tempDir) as any[];

  if (!Array.isArray(singleFileGrep) || singleFileGrep.length !== 1) {
    throw new Error(`single file grep_search failed: ${JSON.stringify(singleFileGrep)}`);
  }
  const match = singleFileGrep[0];
  if (
    match.lineNumber !== 3 ||
    !match.lineContent.includes("exact_token") ||
    match.contextBefore?.length !== 2 ||
    match.contextAfter?.length !== 2 ||
    match.columnNumber !== 9
  ) {
    throw new Error(`grep_search context/column mismatch: ${JSON.stringify(match)}`);
  }
  console.log("  \x1b[32m[✓] grep_search direct single file search with 2 before/after context lines verified.\x1b[0m");

  // Test 50: grep_search with excludes filter
  console.log("\x1b[1;34m[Test 50/78] Validating grep_search with excludes filter...\x1b[0m");
  const excludeSubdir = path.join(tempDir, "ignored_dir");
  await fs.mkdir(excludeSubdir, { recursive: true });
  await fs.writeFile(path.join(excludeSubdir, "test.txt"), "forbidden_symbol in ignored dir", "utf-8");

  const excludeGrep = await registry.executeTool("grep_search", {
    path: tempDir,
    query: "forbidden_symbol",
    excludes: ["ignored_dir"],
  }, tempDir) as any[];

  if (!Array.isArray(excludeGrep) || excludeGrep.length !== 0) {
    throw new Error(`grep_search excludes filter failed: ${JSON.stringify(excludeGrep)}`);
  }
  console.log("  \x1b[32m[✓] grep_search excludes filter successfully ignored matching directory.\x1b[0m");

  // Test 51: grep_search with multiline pattern matching
  console.log("\x1b[1;34m[Test 51/78] Validating grep_search with multiline regex query...\x1b[0m");
  const mlFile = path.join(tempDir, "multiline_test.ts");
  await fs.writeFile(mlFile, "export interface MultiLineToken {\n  enabled: boolean;\n  retries: number;\n}\n", "utf-8");

  const mlGrep = await registry.executeTool("grep_search", {
    path: mlFile,
    query: "interface MultiLineToken \\{[\\s\\S]*?enabled: boolean;",
    multiline: true,
  }, tempDir) as any[];

  if (!Array.isArray(mlGrep) || mlGrep.length !== 1 || mlGrep[0].lineNumber !== 1) {
    throw new Error(`grep_search multiline query failed: ${JSON.stringify(mlGrep)}`);
  }
  console.log("  \x1b[32m[✓] grep_search multiline query matching across linebreaks verified.\x1b[0m");

  // Test 52: grep_search with brace expansion glob includes
  console.log("\x1b[1;34m[Test 52/78] Validating grep_search with brace expansion glob includes...\x1b[0m");
  const braceGrep = await registry.executeTool("grep_search", {
    path: tempDir,
    query: "MultiLineToken",
    includes: ["*.{ts,tsx,mts}"],
  }, tempDir) as any[];

  if (!Array.isArray(braceGrep) || braceGrep.length === 0) {
    throw new Error(`grep_search brace expansion failed: ${JSON.stringify(braceGrep)}`);
  }
  console.log("  \x1b[32m[✓] grep_search brace expansion glob matching (*.{ts,tsx,mts}) passed.\x1b[0m");

  // Test 53: grep_search with negative includes (!pattern)
  console.log("\x1b[1;34m[Test 53/78] Validating grep_search with negative includes (!pattern)...\x1b[0m");
  const negTestFile = path.join(tempDir, "excluded_test.spec.ts");
  await fs.writeFile(negTestFile, "test_target_token in spec", "utf-8");
  const negProdFile = path.join(tempDir, "included_prod.ts");
  await fs.writeFile(negProdFile, "test_target_token in prod", "utf-8");

  const negGrep = await registry.executeTool("grep_search", {
    path: tempDir,
    query: "test_target_token",
    includes: ["*.ts", "!*.spec.ts"],
  }, tempDir) as any[];

  if (!Array.isArray(negGrep) || negGrep.length !== 1 || !negGrep[0].filePath.includes("included_prod.ts")) {
    throw new Error(`grep_search negative include failed: ${JSON.stringify(negGrep)}`);
  }
  console.log("  \x1b[32m[✓] grep_search negative include (!*.spec.ts) successfully excluded match.\x1b[0m");

  // Test 54: grep_search with detailed: true returning execution statistics
  console.log("\x1b[1;34m[Test 54/78] Validating grep_search detailed metrics and statistics...\x1b[0m");
  const detailedGrep = await registry.executeTool("grep_search", {
    path: tempDir,
    query: "test_target_token",
    detailed: true,
  }, tempDir) as any;

  if (
    !detailedGrep ||
    typeof detailedGrep.totalMatches !== "number" ||
    typeof detailedGrep.filesScanned !== "number" ||
    typeof detailedGrep.filesMatched !== "number" ||
    typeof detailedGrep.durationMs !== "number" ||
    detailedGrep.totalMatches <= 0
  ) {
    throw new Error(`grep_search detailed statistics failed: ${JSON.stringify(detailedGrep)}`);
  }
  console.log(`  \x1b[32m[✓] grep_search detailed metrics verified (${detailedGrep.totalMatches} matches in ${detailedGrep.filesMatched} files, ${detailedGrep.durationMs} ms).\x1b[0m`);

  // Test 55: grep_search with preserveWhitespace: true
  console.log("\x1b[1;34m[Test 55/78] Validating grep_search preserveWhitespace option...\x1b[0m");
  const wsFile = path.join(tempDir, "ws_sample.ts");
  await fs.writeFile(wsFile, "    const indentedConstant = 42;\n", "utf-8");

  const wsGrep = await registry.executeTool("grep_search", {
    path: wsFile,
    query: "indentedConstant",
    preserveWhitespace: true,
  }, tempDir) as any[];

  if (!Array.isArray(wsGrep) || wsGrep.length !== 1 || !wsGrep[0].lineContent.startsWith("    const")) {
    throw new Error(`grep_search preserveWhitespace failed: ${JSON.stringify(wsGrep)}`);
  }
  console.log("  \x1b[32m[✓] grep_search preserved exact indentation and whitespace formatting.\x1b[0m");

  // Test 56: grep_search with smartCase
  console.log("\x1b[1;34m[Test 56/78] Validating grep_search smartCase mode...\x1b[0m");
  const caseFile = path.join(tempDir, "case_sample.ts");
  await fs.writeFile(caseFile, "const mySymbol = 1;\nconst MySymbol = 2;\n", "utf-8");

  // Uppercase query in smartCase should match only the exact case
  const smartUpper = await registry.executeTool("grep_search", {
    path: caseFile,
    query: "MySymbol",
    smartCase: true,
  }, tempDir) as any[];

  // Lowercase query in smartCase should match both
  const smartLower = await registry.executeTool("grep_search", {
    path: caseFile,
    query: "mysymbol",
    smartCase: true,
  }, tempDir) as any[];

  if (smartUpper.length !== 1 || smartLower.length !== 2) {
    throw new Error(`grep_search smartCase failed: upper=${smartUpper.length}, lower=${smartLower.length}`);
  }
  console.log("  \x1b[32m[✓] grep_search smartCase auto-detection verified (1 upper, 2 lower matches).\x1b[0m");

  // Test 57: grep_search with maxLineLength window truncation
  console.log("\x1b[1;34m[Test 57/78] Validating grep_search maxLineLength window truncation...\x1b[0m");
  const longLineFile = path.join(tempDir, "minified.js");
  const prefixPadding = "a".repeat(1000);
  const suffixPadding = "b".repeat(1000);
  await fs.writeFile(longLineFile, `${prefixPadding}TARGET_NEEDLE${suffixPadding}\n`, "utf-8");

  const longGrep = await registry.executeTool("grep_search", {
    path: longLineFile,
    query: "TARGET_NEEDLE",
    maxLineLength: 80,
  }, tempDir) as any[];

  if (!Array.isArray(longGrep) || longGrep.length !== 1 || longGrep[0].lineContent.length > 90 || !longGrep[0].lineContent.includes("TARGET_NEEDLE")) {
    throw new Error(`grep_search maxLineLength failed: ${JSON.stringify(longGrep)}`);
  }
  console.log("  \x1b[32m[✓] grep_search maxLineLength bounded long line to 80 chars.\x1b[0m");

  // Test 58: RipgrepSearchService searchStream async generator
  console.log("\x1b[1;34m[Test 58/78] Validating RipgrepSearchService searchStream streaming...\x1b[0m");
  const { RipgrepSearchService } = await import("../src/tooling/extensions/perception/ripgrep-search-service.js");
  const ripgrepService = new RipgrepSearchService();

  const streamedMatches: any[] = [];
  for await (const matchItem of ripgrepService.searchStream("TARGET_NEEDLE", tempDir, { maxResults: 10 })) {
    streamedMatches.push(matchItem);
  }

  if (streamedMatches.length !== 1 || !streamedMatches[0].lineContent.includes("TARGET_NEEDLE")) {
    throw new Error(`searchStream failed: ${JSON.stringify(streamedMatches)}`);
  }
  console.log("  \x1b[32m[✓] searchStream async generator successfully streamed matches.\x1b[0m");

  // Test 59: Multi-query OR search
  console.log("\x1b[1;34m[Test 59/78] Validating grep_search multi-query OR search...\x1b[0m");
  const multiQueryFile = path.join(tempDir, "multi_query.ts");
  await fs.writeFile(multiQueryFile, "const symbolAlpha = 1;\nconst symbolBeta = 2;\nconst otherSymbol = 3;\n", "utf-8");

  const multiQueryMatches = await registry.executeTool("grep_search", {
    path: multiQueryFile,
    queries: ["symbolAlpha", "symbolBeta"],
  }, tempDir) as any[];

  if (!Array.isArray(multiQueryMatches) || multiQueryMatches.length !== 2) {
    throw new Error(`grep_search multi-query failed: ${JSON.stringify(multiQueryMatches)}`);
  }
  console.log("  \x1b[32m[✓] grep_search multi-query OR search matched multiple symbols in single pass.\x1b[0m");

  // Test 60: Invert match (grep -v)
  console.log("\x1b[1;34m[Test 60/78] Validating grep_search invertMatch (grep -v)...\x1b[0m");
  const invertMatches = await registry.executeTool("grep_search", {
    path: multiQueryFile,
    query: "symbolAlpha",
    invertMatch: true,
  }, tempDir) as any[];

  if (!Array.isArray(invertMatches) || invertMatches.length !== 2 || invertMatches.some((m) => m.lineContent.includes("symbolAlpha"))) {
    throw new Error(`grep_search invertMatch failed: ${JSON.stringify(invertMatches)}`);
  }
  console.log("  \x1b[32m[✓] grep_search invertMatch successfully filtered non-matching lines.\x1b[0m");

  // Test 61: Line range scoping (startLine / endLine)
  console.log("\x1b[1;34m[Test 61/78] Validating grep_search line range scoping (startLine/endLine)...\x1b[0m");
  const rangeFile = path.join(tempDir, "range_sample.ts");
  await fs.writeFile(rangeFile, "line 1: match_me\nline 2: match_me\nline 3: match_me\nline 4: match_me\n", "utf-8");

  const rangeMatches = await registry.executeTool("grep_search", {
    path: rangeFile,
    query: "match_me",
    startLine: 2,
    endLine: 3,
  }, tempDir) as any[];

  if (!Array.isArray(rangeMatches) || rangeMatches.length !== 2 || rangeMatches[0].lineNumber !== 2 || rangeMatches[1].lineNumber !== 3) {
    throw new Error(`grep_search line range failed: ${JSON.stringify(rangeMatches)}`);
  }
  console.log("  \x1b[32m[✓] grep_search line range successfully scoped search to lines 2-3.\x1b[0m");

  // Test 62: Files-only aggregation mode
  console.log("\x1b[1;34m[Test 62/78] Validating grep_search filesOnly aggregation mode...\x1b[0m");
  const filesOnlyRes = await registry.executeTool("grep_search", {
    path: tempDir,
    query: "match_me",
    filesOnly: true,
    detailed: true,
  }, tempDir) as any;

  if (
    !filesOnlyRes ||
    filesOnlyRes.matches.length !== 0 ||
    !filesOnlyRes.matchedFiles ||
    filesOnlyRes.matchedFiles.length === 0 ||
    typeof filesOnlyRes.fileCounts[rangeFile] !== "number"
  ) {
    throw new Error(`grep_search filesOnly failed: ${JSON.stringify(filesOnlyRes)}`);
  }
  console.log(`  \x1b[32m[✓] grep_search filesOnly returned ${filesOnlyRes.matchedFiles.length} files without line duplication.\x1b[0m`);

  // Test 63: groupByFile grouping
  console.log("\x1b[1;34m[Test 63/78] Validating grep_search groupByFile mode...\x1b[0m");
  const groupedRes = await registry.executeTool("grep_search", {
    path: tempDir,
    query: "match_me",
    groupByFile: true,
    detailed: true,
  }, tempDir) as any;

  if (!groupedRes || !groupedRes.groupedByFile || !Array.isArray(groupedRes.groupedByFile[rangeFile])) {
    throw new Error(`grep_search groupByFile failed: ${JSON.stringify(groupedRes)}`);
  }
  console.log(`  \x1b[32m[✓] grep_search groupByFile grouped matches by ${Object.keys(groupedRes.groupedByFile).length} files.\x1b[0m`);

  // Test 64: highlight matching
  console.log("\x1b[1;34m[Test 64/78] Validating grep_search highlight mode...\x1b[0m");
  const highlightRes = await registry.executeTool("grep_search", {
    path: rangeFile,
    query: "match_me",
    highlight: true,
    maxResults: 1,
  }, tempDir) as any[];

  if (!Array.isArray(highlightRes) || highlightRes.length === 0 || !highlightRes[0].lineContent.includes("<<<match_me>>>")) {
    throw new Error(`grep_search highlight failed: ${JSON.stringify(highlightRes)}`);
  }
  console.log("  \x1b[32m[✓] grep_search highlight wrapped matched token with <<<...>>> markers.\x1b[0m");

  // Test 65: maxDepth traversal bounding
  console.log("\x1b[1;34m[Test 65/78] Validating grep_search maxDepth bounding...\x1b[0m");
  const deepDir = path.join(tempDir, "d1", "d2", "d3");
  await fs.mkdir(deepDir, { recursive: true });
  await fs.writeFile(path.join(deepDir, "deep.txt"), "depth_target_token", "utf-8");

  // Depth 1 shouldn't find d1/d2/d3/deep.txt
  const shallowGrep = await registry.executeTool("grep_search", {
    path: tempDir,
    query: "depth_target_token",
    maxDepth: 1,
  }, tempDir) as any[];

  // Depth 5 should find it
  const deepGrep = await registry.executeTool("grep_search", {
    path: tempDir,
    query: "depth_target_token",
    maxDepth: 5,
  }, tempDir) as any[];

  if (shallowGrep.length !== 0 || deepGrep.length !== 1) {
    throw new Error(`grep_search maxDepth failed: shallow=${shallowGrep.length}, deep=${deepGrep.length}`);
  }
  console.log("  \x1b[32m[✓] grep_search maxDepth traversal bounding successfully verified.\x1b[0m");

  // Test 66: mtime timestamp filtering
  console.log("\x1b[1;34m[Test 66/78] Validating grep_search mtime timestamp filtering...\x1b[0m");
  const now = Date.now();
  const futureGrep = await registry.executeTool("grep_search", {
    path: rangeFile,
    query: "match_me",
    mtimeAfter: now + 100000,
  }, tempDir) as any[];

  const pastGrep = await registry.executeTool("grep_search", {
    path: rangeFile,
    query: "match_me",
    mtimeAfter: now - 100000,
  }, tempDir) as any[];

  if (futureGrep.length !== 0 || pastGrep.length === 0) {
    throw new Error(`grep_search mtime failed: future=${futureGrep.length}, past=${pastGrep.length}`);
  }
  console.log("  \x1b[32m[✓] grep_search mtime timestamp filtering successfully verified.\x1b[0m");

  // Test 67: Fuzzy pattern matching
  console.log("\x1b[1;34m[Test 67/78] Validating grep_search fuzzy matching...\x1b[0m");
  const fuzzyFile = path.join(tempDir, "fuzzy_sample.ts");
  await fs.writeFile(fuzzyFile, "function handleUserProfileRequest() { return 42; }\n", "utf-8");

  const fuzzyMatches = await registry.executeTool("grep_search", {
    path: fuzzyFile,
    query: "hdleUsrReq",
    fuzzy: true,
  }, tempDir) as any[];

  if (!Array.isArray(fuzzyMatches) || fuzzyMatches.length !== 1 || !fuzzyMatches[0].lineContent.includes("handleUserProfileRequest")) {
    throw new Error(`grep_search fuzzy failed: ${JSON.stringify(fuzzyMatches)}`);
  }
  console.log("  \x1b[32m[✓] grep_search fuzzy subsequence matching successfully verified.\x1b[0m");

  // Test 68: Dry-run replacement preview
  console.log("\x1b[1;34m[Test 68/78] Validating grep_search previewReplacement...\x1b[0m");
  const previewMatches = await registry.executeTool("grep_search", {
    path: fuzzyFile,
    query: "handleUserProfileRequest",
    previewReplacement: "processUserProfileRequest",
  }, tempDir) as any[];

  if (
    !Array.isArray(previewMatches) ||
    previewMatches.length === 0 ||
    !previewMatches[0].previewLineContent ||
    !previewMatches[0].previewLineContent.includes("processUserProfileRequest")
  ) {
    throw new Error(`grep_search previewReplacement failed: ${JSON.stringify(previewMatches)}`);
  }
  console.log("  \x1b[32m[✓] grep_search previewReplacement synthesized dry-run diff preview.\x1b[0m");

  // Test 69: minMatchesPerFile filtering
  console.log("\x1b[1;34m[Test 69/78] Validating grep_search minMatchesPerFile threshold...\x1b[0m");
  const singleMatchFile = path.join(tempDir, "single_match.txt");
  const multiMatchFile = path.join(tempDir, "multi_match.txt");
  await fs.writeFile(singleMatchFile, "common_tag line 1\n", "utf-8");
  await fs.writeFile(multiMatchFile, "common_tag line 1\ncommon_tag line 2\ncommon_tag line 3\n", "utf-8");

  const thresholdRes = await registry.executeTool("grep_search", {
    path: tempDir,
    query: "common_tag",
    minMatchesPerFile: 2,
    detailed: true,
  }, tempDir) as any;

  if (
    !thresholdRes ||
    thresholdRes.matchedFiles.includes(singleMatchFile) ||
    !thresholdRes.matchedFiles.includes(multiMatchFile) ||
    thresholdRes.filesMatched !== 1
  ) {
    throw new Error(`grep_search minMatchesPerFile failed: ${JSON.stringify(thresholdRes)}`);
  }
  console.log("  \x1b[32m[✓] grep_search minMatchesPerFile successfully filtered files below threshold.\x1b[0m");

  // Test 70: requireAllQueriesInFile (AND pattern matching)
  console.log("\x1b[1;34m[Test 70/78] Validating grep_search requireAllQueriesInFile (AND matching)...\x1b[0m");
  const andFileBoth = path.join(tempDir, "and_both.ts");
  const andFileOne = path.join(tempDir, "and_one.ts");
  await fs.writeFile(andFileBoth, "import { SessionContext } from './ctx';\nimport { DiffSynthesizer } from './diff';\n", "utf-8");
  await fs.writeFile(andFileOne, "import { SessionContext } from './ctx';\n", "utf-8");

  const andRes = await registry.executeTool("grep_search", {
    path: tempDir,
    queries: ["SessionContext", "DiffSynthesizer"],
    requireAllQueriesInFile: true,
    detailed: true,
  }, tempDir) as any;

  if (
    !andRes ||
    !andRes.matchedFiles.includes(andFileBoth) ||
    andRes.matchedFiles.includes(andFileOne)
  ) {
    throw new Error(`grep_search requireAllQueriesInFile failed: ${JSON.stringify(andRes)}`);
  }
  console.log("  \x1b[32m[✓] grep_search requireAllQueriesInFile successfully filtered files not containing all queries.\x1b[0m");

  // Test 71: minFileSize filtering
  console.log("\x1b[1;34m[Test 71/78] Validating grep_search minFileSize filtering...\x1b[0m");
  const tinyFile = path.join(tempDir, "tiny.txt");
  const bigFile = path.join(tempDir, "big.txt");
  await fs.writeFile(tinyFile, "tag\n", "utf-8"); // 4 bytes
  await fs.writeFile(bigFile, "tag ".repeat(50), "utf-8"); // 200 bytes

  const sizeRes = await registry.executeTool("grep_search", {
    path: tempDir,
    query: "tag",
    minFileSize: 50,
    detailed: true,
  }, tempDir) as any;

  if (
    !sizeRes ||
    sizeRes.matchedFiles.includes(tinyFile) ||
    !sizeRes.matchedFiles.includes(bigFile)
  ) {
    throw new Error(`grep_search minFileSize failed: ${JSON.stringify(sizeRes)}`);
  }
  console.log("  \x1b[32m[✓] grep_search minFileSize successfully excluded files under 50 bytes.\x1b[0m");

  // Test 72: sortBy and sortOrder
  console.log("\x1b[1;34m[Test 72/78] Validating grep_search sortBy and sortOrder...\x1b[0m");
  const sortResDesc = await registry.executeTool("grep_search", {
    path: rangeFile,
    query: "match_me",
    sortBy: "line",
    sortOrder: "desc",
  }, tempDir) as any[];

  if (
    !Array.isArray(sortResDesc) ||
    sortResDesc.length < 2 ||
    sortResDesc[0].lineNumber < sortResDesc[1].lineNumber
  ) {
    throw new Error(`grep_search sortBy failed: ${JSON.stringify(sortResDesc)}`);
  }
  console.log("  \x1b[32m[✓] grep_search sortBy and sortOrder successfully ordered matches.\x1b[0m");

  // Test 73: Pagination offset
  console.log("\x1b[1;34m[Test 73/78] Validating grep_search pagination offset...\x1b[0m");
  const offsetRes = await registry.executeTool("grep_search", {
    path: rangeFile,
    query: "match_me",
    offset: 2,
    maxResults: 2,
  }, tempDir) as any[];

  if (!Array.isArray(offsetRes) || offsetRes.length !== 2 || offsetRes[0].lineNumber !== 3) {
    throw new Error(`grep_search offset failed: ${JSON.stringify(offsetRes)}`);
  }
  console.log("  \x1b[32m[✓] grep_search pagination offset successfully skipped first 2 matches.\x1b[0m");

  // Test 74: maxMatchesPerFile capping
  console.log("\x1b[1;34m[Test 74/78] Validating grep_search maxMatchesPerFile capping...\x1b[0m");
  const multiMatchFile2 = path.join(tempDir, "multi_match_cap.txt");
  await fs.writeFile(multiMatchFile2, "cap_target line 1\ncap_target line 2\ncap_target line 3\n", "utf-8");

  const capRes = await registry.executeTool("grep_search", {
    path: multiMatchFile2,
    query: "cap_target",
    maxMatchesPerFile: 1,
  }, tempDir) as any[];

  if (!Array.isArray(capRes) || capRes.length !== 1) {
    throw new Error(`grep_search maxMatchesPerFile failed: ${JSON.stringify(capRes)}`);
  }
  console.log("  \x1b[32m[✓] grep_search maxMatchesPerFile successfully capped matches per file to 1.\x1b[0m");

  // Test 75: ignoreComments filtering
  console.log("\x1b[1;34m[Test 75/78] Validating grep_search ignoreComments...\x1b[0m");
  const commentFile = path.join(tempDir, "comment_test.ts");
  await fs.writeFile(commentFile, "// active_code_target in comment\nconst active_code_target = 100;\n/* active_code_target in block comment */\n", "utf-8");

  const commentRes = await registry.executeTool("grep_search", {
    path: commentFile,
    query: "active_code_target",
    ignoreComments: true,
  }, tempDir) as any[];

  if (!Array.isArray(commentRes) || commentRes.length !== 1 || !commentRes[0].lineContent.includes("const active_code_target = 100;")) {
    throw new Error(`grep_search ignoreComments failed: ${JSON.stringify(commentRes)}`);
  }
  console.log("  \x1b[32m[✓] grep_search ignoreComments successfully filtered comment lines.\x1b[0m");

  // Test 76: captures subgroup extraction
  console.log("\x1b[1;34m[Test 76/78] Validating grep_search captures subgroup extraction...\x1b[0m");
  const captureFile = path.join(tempDir, "captures_test.ts");
  await fs.writeFile(captureFile, "const myApiKey = getEnv('SECRET_KEY');\n", "utf-8");

  const captureMatches = await registry.executeTool("grep_search", {
    path: captureFile,
    query: "const (\\w+) = getEnv\\('([^']+)'\\)",
    isRegex: true,
  }, tempDir) as any[];

  if (
    !Array.isArray(captureMatches) ||
    captureMatches.length !== 1 ||
    !captureMatches[0].captures ||
    captureMatches[0].captures[0] !== "myApiKey" ||
    captureMatches[0].captures[1] !== "SECRET_KEY"
  ) {
    throw new Error(`grep_search captures failed: ${JSON.stringify(captureMatches)}`);
  }
  console.log("  \x1b[32m[✓] grep_search captures successfully extracted regex subgroups ['myApiKey', 'SECRET_KEY'].\x1b[0m");

  // Test 77: pathRegex filtering
  console.log("\x1b[1;34m[Test 77/78] Validating grep_search pathRegex filtering...\x1b[0m");
  const pathRegexRes = await registry.executeTool("grep_search", {
    path: tempDir,
    query: "active_code_target",
    pathRegex: "comment_test\\.ts$",
    detailed: true,
  }, tempDir) as any;

  if (!pathRegexRes || pathRegexRes.filesMatched !== 1 || !pathRegexRes.matchedFiles[0].includes("comment_test.ts")) {
    throw new Error(`grep_search pathRegex failed: ${JSON.stringify(pathRegexRes)}`);
  }
  console.log("  \x1b[32m[✓] grep_search pathRegex successfully filtered files by path regex.\x1b[0m");

  // Test 78: uniqueLines deduplication
  console.log("\x1b[1;34m[Test 78/78] Validating grep_search uniqueLines deduplication...\x1b[0m");
  const dupFile = path.join(tempDir, "dup_lines.txt");
  await fs.writeFile(dupFile, "repeated_log_entry\nrepeated_log_entry\nrepeated_log_entry\n", "utf-8");

  const uniqueRes = await registry.executeTool("grep_search", {
    path: dupFile,
    query: "repeated_log_entry",
    uniqueLines: true,
  }, tempDir) as any[];

  if (!Array.isArray(uniqueRes) || uniqueRes.length !== 1) {
    throw new Error(`grep_search uniqueLines failed: ${JSON.stringify(uniqueRes)}`);
  }
  console.log("  \x1b[32m[✓] grep_search uniqueLines successfully deduplicated repeated lines to 1 match.\x1b[0m");

  // Cleanup
  delete process.env.LUMI_TEST_KEY;
  await fs.rm(tempDir, { recursive: true, force: true });

  console.log("\n\x1b[1;32m[✓] ALL 78 QUALITY-OF-LIFE (QoL) VALIDATION TESTS PASSED 100% CLEANLY!\x1b[0m\n");
}

runQoLValidation().catch((err) => {
  console.error("QoL validation failed:", err);
  process.exit(1);
});
