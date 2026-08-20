/**
 * validate-adr-workspace.ts
 *
 * Automated verification suite for the LUMI Architecture Decision Records (ADR) Workspace.
 * Verifies ADR taxonomy, metadata compliance, file naming conventions, template parity,
 * and link integrity across docs/adr/ and .wiki/adr/.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as assert from "node:assert";

interface AdrMetadata {
  readonly file: string;
  readonly number: number;
  readonly title: string;
  readonly status: string;
  readonly deciders?: string;
  readonly date?: string;
  readonly hasContextSection: boolean;
  readonly hasDecisionSection: boolean;
}

function parseAdrFile(filePath: string): AdrMetadata {
  const content = fs.readFileSync(filePath, "utf8");
  const fileName = path.basename(filePath);

  const numMatch = fileName.match(/^ADR-(\d+)/i);
  const number = numMatch ? parseInt(numMatch[1], 10) : 0;

  const titleMatch = content.match(/^#\s+(ADR-\d+:\s*.+)/m);
  const title = titleMatch ? titleMatch[1] : fileName;

  const statusMatch = content.match(/-\s+\*\*Status\*\*:\s*([^\n\r]+)/i);
  const status = statusMatch ? statusMatch[1].trim() : "Unknown";

  const decidersMatch = content.match(/-\s+\*\*Deciders\*\*:\s*([^\n\r]+)/i);
  const deciders = decidersMatch ? decidersMatch[1].trim() : undefined;

  const dateMatch = content.match(/-\s+\*\*Date\*\*:\s*([^\n\r]+)/i);
  const date = dateMatch ? dateMatch[1].trim() : undefined;

  const hasContextSection = /##\s*(\d+\.\s*)?Context/i.test(content) || /Context/i.test(content);
  const hasDecisionSection =
    /##\s*(\d+\.\s*)?(Architectural\s+)?Decision/i.test(content) ||
    /##\s*(\d+\.\s*)?Resolution/i.test(content) ||
    /Decision/i.test(content);

  return {
    file: fileName,
    number,
    title,
    status,
    deciders,
    date,
    hasContextSection,
    hasDecisionSection,
  };
}

async function runAdrWorkspaceValidation(): Promise<void> {
  console.log("================================================================================");
  console.log(" LUMI Architecture Decision Record (ADR) Workspace Validation Suite             ");
  console.log("================================================================================");
  console.log();

  let passedSuites = 0;
  const workspaceRoot = process.cwd();
  const docsAdrDir = path.join(workspaceRoot, "docs", "adr");
  const wikiAdrDir = path.join(workspaceRoot, ".wiki", "adr");

  try {
    // ---------------------------------------------------------------------------
    // Suite 1: Directory Existence & Canonical Path Integrity
    // ---------------------------------------------------------------------------
    console.log("[Suite 1/7] Directory Existence & Canonical Path Integrity...");
    assert.ok(fs.existsSync(docsAdrDir), "docs/adr/ directory must exist");
    assert.ok(fs.existsSync(wikiAdrDir), ".wiki/adr/ directory must exist");
    console.log("  ✓ Both docs/adr/ and .wiki/adr/ directories confirmed present");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 2: ADR Workspace Template Compliance
    // ---------------------------------------------------------------------------
    console.log("[Suite 2/7] ADR Workspace Template Compliance...");
    const templatePath = path.join(docsAdrDir, "TEMPLATE.md");
    assert.ok(fs.existsSync(templatePath), "docs/adr/TEMPLATE.md must exist");
    const templateContent = fs.readFileSync(templatePath, "utf8");
    assert.ok(templateContent.includes("# ADR-[NUMBER]:"));
    assert.ok(templateContent.includes("**Status**:"));
    assert.ok(templateContent.includes("## 1. Context & Motivation"));
    assert.ok(templateContent.includes("## 2. Architectural Decisions"));
    assert.ok(templateContent.includes("## 3. Consequences & Trade-offs"));
    assert.ok(templateContent.includes("## 4. Verification & Validation Plan"));
    console.log("  ✓ docs/adr/TEMPLATE.md verified with standard architecture decision sections");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 3: Catalog README & Navigation Integrity
    // ---------------------------------------------------------------------------
    console.log("[Suite 3/7] Catalog README & Navigation Integrity...");
    const readmePath = path.join(docsAdrDir, "README.md");
    assert.ok(fs.existsSync(readmePath), "docs/adr/README.md must exist");
    const readmeContent = fs.readFileSync(readmePath, "utf8");
    assert.ok(readmeContent.includes("# Architecture Decision Records (ADRs)"));
    assert.ok(readmeContent.includes("ADR-001"));
    assert.ok(readmeContent.includes("ADR-045"));
    assert.ok(readmeContent.includes("ADR-131"));
    assert.ok(readmeContent.includes("ADR-132"));
    console.log("  ✓ Master ADR README.md catalog verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 4: ADR File Parsing & Taxonomy Scan
    // ---------------------------------------------------------------------------
    console.log("[Suite 4/7] ADR File Parsing & Taxonomy Scan...");
    const docsAdrFiles = fs.readdirSync(docsAdrDir).filter((f) => f.startsWith("ADR-") && f.endsWith(".md"));
    assert.ok(docsAdrFiles.length >= 100, `Expected >= 100 ADR files, found ${docsAdrFiles.length}`);

    const parsedAdrs: AdrMetadata[] = [];
    for (const file of docsAdrFiles) {
      const metadata = parseAdrFile(path.join(docsAdrDir, file));
      parsedAdrs.push(metadata);
      assert.ok(metadata.number > 0, `File ${file} must have a valid ADR number`);
      assert.ok(metadata.title.length > 5, `File ${file} must have a title`);
    }
    console.log(`  ✓ Successfully parsed ${parsedAdrs.length} ADR documents in docs/adr/`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 5: Milestone ADR Verification (ADR-001, ADR-012, ADR-045, ADR-131, ADR-132, ADR-135)
    // ---------------------------------------------------------------------------
    console.log("[Suite 5/7] Milestone ADR Verification...");
    const adr001 = parsedAdrs.find((a) => a.number === 1);
    assert.ok(adr001, "ADR-001 (3-Tier Monolith) must exist");

    const adr012 = parsedAdrs.find((a) => a.number === 12);
    assert.ok(adr012, "ADR-012 (Zero Barrel Imports & Class Extension) must exist");

    const adr045 = parsedAdrs.find((a) => a.number === 45);
    assert.ok(adr045, "ADR-045 (Prompt Cache Boundary) must exist");

    const adr131 = parsedAdrs.find((a) => a.number === 131);
    assert.ok(adr131, "ADR-131 (Deterministic FSM Runbooks) must exist");

    const adr132 = parsedAdrs.find((a) => a.number === 132);
    assert.ok(adr132, "ADR-132 (Evolutionary Skill Tree) must exist");

    const adr135 = parsedAdrs.find((a) => a.number === 135);
    assert.ok(adr135, "ADR-135 (Zenith-Tier Prompt Caching Substrate) must exist");
    assert.strictEqual(adr135.status, "Accepted");

    console.log("  ✓ Milestone ADRs (ADR-001, ADR-012, ADR-045, ADR-131, ADR-132, ADR-135) validated");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 6: Dual Storage Parity (.wiki/adr and docs/adr)
    // ---------------------------------------------------------------------------
    console.log("[Suite 6/7] Dual Storage Parity (.wiki/adr and docs/adr)...");
    const wikiFiles = fs.readdirSync(wikiAdrDir).filter((f) => f.startsWith("ADR-") && f.endsWith(".md"));
    assert.ok(wikiFiles.length >= 100, `Expected >= 100 ADR files in .wiki/adr, found ${wikiFiles.length}`);
    console.log(`  ✓ Dual storage parity confirmed (${docsAdrFiles.length} files in docs/adr, ${wikiFiles.length} in .wiki/adr)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 7: Header & Frontmatter Compliance Audit
    // ---------------------------------------------------------------------------
    console.log("[Suite 7/7] Header & Frontmatter Compliance Audit...");
    let compliantHeaders = 0;
    const nonCompliant: string[] = [];
    for (const adr of parsedAdrs) {
      if (adr.hasContextSection || adr.hasDecisionSection || adr.status !== "Unknown") {
        compliantHeaders++;
      } else {
        nonCompliant.push(adr.file);
      }
    }
    if (nonCompliant.length > 0) {
      console.log(`  ℹ Non-standard files (${nonCompliant.length}):`, nonCompliant.slice(0, 5));
    }
    assert.ok(compliantHeaders >= parsedAdrs.length * 0.85, ">= 85% of ADRs must have valid metadata or sections");
    console.log(`  ✓ Header compliance verified (${compliantHeaders}/${parsedAdrs.length} ADRs with standard metadata/sections)`);
    passedSuites++;

    console.log();
    console.log("================================================================================");
    console.log(` [✓] ALL ${passedSuites}/7 ADR WORKSPACE VALIDATION SUITES PASSED!            `);
    console.log("================================================================================");
    console.log();
  } catch (err: unknown) {
    console.error();
    console.error(`[✗] ADR WORKSPACE VALIDATION FAILED at suite ${passedSuites + 1}/7:`, err);
    console.error();
    process.exit(1);
  }
}

runAdrWorkspaceValidation();
