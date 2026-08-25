/**
 * validate-absolute-apex-dominion-flow.ts
 *
 * Comprehensive Validation Suite for Absolute Apex Dominion Pass:
 * 1. Semantic Code Chunk Slicer (slice_code_chunks)
 * 2. Interface Contract Differ (diff_interface_contracts)
 * 3. Security Vulnerability & Secret Leak Scanner (scan_security_vulnerabilities)
 * 4. Code Duplicate & Clone Detector (detect_code_duplicates)
 * 5. Monolith Subsystem Health & Cohesion Inspector (inspect_monolith_health)
 */

import * as assert from "node:assert";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { MonolithFactory } from "../src/factories/monolith-factory.js";

async function run() {
  console.log("================================================================================");
  console.log(" LUMI Absolute Apex Dominion: Slicer, Contract Differ, Secrets, Clones & Health  ");
  console.log("================================================================================\n");

  const components = MonolithFactory.createEngine();
  const registry = components.toolRegistry;
  const testDir = path.join(process.cwd(), "scratch", "absolute-apex-dominion-test");
  await fs.mkdir(testDir, { recursive: true });

  // --------------------------------------------------------------------------
  // Test 1: Semantic Code Chunk Slicer
  // --------------------------------------------------------------------------
  console.log("[Test 1/5] Validating Semantic Code Chunk Slicer...");
  {
    const sampleFile = path.join(testDir, "UserService.ts");
    await fs.writeFile(
      sampleFile,
      `import { db } from "./db";\nimport { logger } from "./logger";\n\nexport class UserService {\n  public async findUser(id: string) {\n    return db.users.find(id);\n  }\n\n  public async deleteUser(id: string) {\n    return db.users.remove(id);\n  }\n}\n`,
      "utf8"
    );

    const sliceRes: any = await registry.executeTool(
      "slice_code_chunks",
      { path: "UserService.ts", functionName: "deleteUser" },
      testDir
    );

    assert.strictEqual(sliceRes.success, true);
    assert.ok(sliceRes.codeChunk.includes("deleteUser"));
    assert.ok(sliceRes.headerContext.includes("import { db }"));
    assert.ok(sliceRes.headerContext.includes("UserService"));

    console.log(`  [✓] Code chunk slicer extracted method context with ${sliceRes.slicedLinesCount} lines.`);
  }

  // --------------------------------------------------------------------------
  // Test 2: Interface Contract Differ
  // --------------------------------------------------------------------------
  console.log("[Test 2/5] Validating Interface & Schema Contract Differ...");
  {
    const v1File = path.join(testDir, "contractsV1.ts");
    const v2File = path.join(testDir, "contractsV2.ts");

    await fs.writeFile(
      v1File,
      `export interface IUser {\n  id: string;\n  name: string;\n  email: string;\n}\n\nexport interface IDeleted {\n  tag: string;\n}\n`,
      "utf8"
    );

    await fs.writeFile(
      v2File,
      `export interface IUser {\n  id: string;\n  name: string;\n  avatarUrl: string;\n}\n\nexport interface INewContract {\n  active: boolean;\n}\n`,
      "utf8"
    );

    const diffRes: any = await registry.executeTool(
      "diff_interface_contracts",
      { sourcePath: "contractsV1.ts", targetPath: "contractsV2.ts" },
      testDir
    );

    assert.strictEqual(diffRes.success, true);
    assert.strictEqual(diffRes.hasDrift, true);
    assert.ok(diffRes.addedInterfaces.includes("INewContract"));
    assert.ok(diffRes.removedInterfaces.includes("IDeleted"));
    assert.strictEqual(diffRes.modifiedInterfaces.length, 1);
    assert.strictEqual(diffRes.modifiedInterfaces[0].interfaceName, "IUser");
    assert.ok(diffRes.modifiedInterfaces[0].addedFields.includes("avatarUrl"));
    assert.ok(diffRes.modifiedInterfaces[0].removedFields.includes("email"));

    console.log("  [✓] Interface differ detected added, removed, and modified contract fields.");
  }

  // --------------------------------------------------------------------------
  // Test 3: Security & Secret Leak Scanner
  // --------------------------------------------------------------------------
  console.log("[Test 3/5] Validating Security Vulnerability & Secret Leak Scanner...");
  {
    const insecureFile = path.join(testDir, "insecureSample.ts");
    const dummyStripeKey = ["sk", "live", "123456789012345678901234"].join("_");
    await fs.writeFile(
      insecureFile,
      `export const STRIPE_KEY = "${dummyStripeKey}";\nconst dyn = eval("2 + 2");\n`,
      "utf8"
    );

    const secRes: any = await registry.executeTool(
      "scan_security_vulnerabilities",
      {},
      testDir
    );

    assert.strictEqual(secRes.success, true);
    assert.ok(secRes.totalFindings >= 2);
    const types = secRes.findings.map((f: any) => f.type);
    assert.ok(types.includes("Stripe Secret Key"));
    assert.ok(types.includes("Dangerous eval() Invocation"));

    console.log(`  [✓] Security scanner detected ${secRes.totalFindings} vulnerabilities/secrets.`);
  }

  // --------------------------------------------------------------------------
  // Test 4: Code Duplicate & Clone Detector
  // --------------------------------------------------------------------------
  console.log("[Test 4/5] Validating Code Duplicate & Clone Detector...");
  {
    const clone1 = path.join(testDir, "clone1.ts");
    const clone2 = path.join(testDir, "clone2.ts");

    const duplicatedBlock = `function calculateMetrics(a: number, b: number) {\n  const sum = a + b;\n  const diff = a - b;\n  const prod = a * b;\n  return { sum, diff, prod };\n}\n`;

    await fs.writeFile(clone1, `// File 1\n${duplicatedBlock}`, "utf8");
    await fs.writeFile(clone2, `// File 2\n${duplicatedBlock}`, "utf8");

    const dupRes: any = await registry.executeTool(
      "detect_code_duplicates",
      { minLines: 5 },
      testDir
    );

    assert.strictEqual(dupRes.success, true);
    assert.ok(dupRes.duplicateGroupsCount >= 1);

    console.log(`  [✓] Duplicate detector isolated ${dupRes.duplicateGroupsCount} duplicate code clone clusters.`);
  }

  // --------------------------------------------------------------------------
  // Test 5: Monolith Subsystem Health & Cohesion Inspector
  // --------------------------------------------------------------------------
  console.log("[Test 5/5] Validating Monolith Subsystem Health & Cohesion Inspector...");
  {
    const healthRes: any = await registry.executeTool(
      "inspect_monolith_health",
      {},
      testDir
    );

    assert.strictEqual(healthRes.success, true);
    assert.strictEqual(healthRes.cohesionStatus, "OPTIMAL");
    assert.strictEqual(healthRes.componentCount, 591);
    assert.ok(healthRes.slabMemoryAllocated.includes("16MB"));
    assert.strictEqual(healthRes.subsystems.toolRegistry, "ONLINE");

    console.log(`  [✓] Monolith health inspector confirmed cohesionStatus: ${healthRes.cohesionStatus} (${healthRes.componentCount} components).`);
  }

  // Cleanup testDir
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});

  console.log("\n================================================================================");
  console.log("  [✓] ALL 5/5 ABSOLUTE APEX DOMINION FLOW SUITES PASSED!  ");
  console.log("================================================================================\n");
}

run().catch((err) => {
  console.error("Validation failed:", err);
  process.exit(1);
});
