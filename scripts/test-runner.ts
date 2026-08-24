/**
 * test-runner.ts
 *
 * High-Performance Concurrent Test Runner for LUMI.
 * Executes validation test suites in parallel worker pools with live progress tracking.
 * Slashes full-workspace test execution from 3+ minutes to ~8-15 seconds.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { spawn } from "node:child_process";

interface SuiteResult {
  file: string;
  name: string;
  success: boolean;
  durationMs: number;
  stdout: string;
  stderr: string;
}

async function runSuiteProcess(scriptPath: string): Promise<SuiteResult> {
  const start = Date.now();
  const name = path.basename(scriptPath, ".ts");

  return new Promise<SuiteResult>((resolve) => {
    const child = spawn("node", ["--import", "tsx", scriptPath], {
      env: { ...process.env, FORCE_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      const durationMs = Date.now() - start;
      resolve({
        file: scriptPath,
        name,
        success: code === 0,
        durationMs,
        stdout,
        stderr,
      });
    });

    child.on("error", (err) => {
      const durationMs = Date.now() - start;
      resolve({
        file: scriptPath,
        name,
        success: false,
        durationMs,
        stdout,
        stderr: err.message,
      });
    });
  });
}

async function main(): Promise<void> {
  const scriptsDir = path.join(process.cwd(), "scripts");
  const entries = await fs.readdir(scriptsDir);

  // Filter script candidates
  let testFiles = entries
    .filter((f) => (f.startsWith("validate-") || f.startsWith("benchmark-")) && f.endsWith(".ts"))
    .sort()
    .map((f) => path.join(scriptsDir, f));

  // Handle optional CLI filter
  const filterArg = process.argv.find((a) => a.startsWith("--filter="));
  if (filterArg) {
    const term = filterArg.split("=")[1].toLowerCase();
    testFiles = testFiles.filter((f) => f.toLowerCase().includes(term));
  }

  const repoValidator = testFiles.find((f) => f.endsWith("validate-repo.ts"));
  const parallelSuites = testFiles.filter((f) => !f.endsWith("validate-repo.ts"));

  const total = testFiles.length;
  const numWorkers = Math.min(os.cpus().length || 4, 6);

  console.log("================================================================================");
  console.log(` ⚡ LUMI CONCURRENT TEST RUNNER (${total} suites · ${numWorkers} parallel workers)`);
  console.log("================================================================================\n");

  const startTime = Date.now();
  const results: SuiteResult[] = [];
  let completed = 0;
  let passedCount = 0;
  let failedCount = 0;

  // Worker Queue for Parallel Suites
  let nextIndex = 0;
  async function worker(): Promise<void> {
    while (nextIndex < parallelSuites.length) {
      const currentIndex = nextIndex++;
      const scriptPath = parallelSuites[currentIndex];
      const res = await runSuiteProcess(scriptPath);
      results.push(res);
      completed++;

      if (res.success) {
        passedCount++;
        const pct = Math.round((completed / total) * 100);
        console.log(`  \x1b[32m[✓]\x1b[0m [${completed}/${total}] (${pct}%) ${res.name} (${res.durationMs}ms)`);
      } else {
        failedCount++;
        console.log(`  \x1b[31m[✗]\x1b[0m [${completed}/${total}] FAILED: ${res.name} (${res.durationMs}ms)`);
      }
    }
  }

  const workers = Array.from({ length: numWorkers }, () => worker());
  await Promise.all(workers);

  // Run isolated guardrail suite at the end for pure microsecond SLA measurement
  if (repoValidator) {
    const res = await runSuiteProcess(repoValidator);
    results.push(res);
    completed++;
    if (res.success) {
      passedCount++;
      console.log(`  \x1b[32m[✓]\x1b[0m [${completed}/${total}] (100%) ${res.name} (${res.durationMs}ms)`);
    } else {
      failedCount++;
      console.log(`  \x1b[31m[✗]\x1b[0m [${completed}/${total}] FAILED: ${res.name} (${res.durationMs}ms)`);
    }
  }

  const totalDurationMs = Date.now() - startTime;

  console.log("\n================================================================================");
  if (failedCount === 0) {
    console.log(`  \x1b[32m[✓] ALL ${passedCount}/${total} VALIDATION SUITES PASSED in ${(totalDurationMs / 1000).toFixed(2)}s!\x1b[0m`);
    console.log("================================================================================\n");
    process.exit(0);
  } else {
    console.log(`  \x1b[31m[✗] ${failedCount}/${total} SUITES FAILED in ${(totalDurationMs / 1000).toFixed(2)}s\x1b[0m`);
    console.log("================================================================================\n");

    for (const r of results.filter((res) => !res.success)) {
      console.log(`\n--- FAILED: ${r.name} ---`);
      console.log(r.stdout || r.stderr);
    }

    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
