#!/usr/bin/env node
/**
 * Guardrails for docs/README.md structure and required cross-links.
 */
import assert from "node:assert"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const docsRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs")
const content = fs.readFileSync(path.join(docsRoot, "README.md"), "utf8")

const requiredSections = ["## Source of truth", "## Current verification model", "## Reproduce"]

for (const section of requiredSections) {
	assert.ok(content.includes(section), `docs/README.md missing section: ${section}`)
}

const requiredLinks = [
	"CLAIM-SCOPE.md",
	"LIVE_BASELINE.json",
	"BENCHMARK_REPORT.md",
	"GRAND_ARCHITECTURAL_AUDIT.md",
	"../ROADMAP.md",
	"QOL_ROLLING_AUDIT.md",
]

for (const link of requiredLinks) {
	assert.ok(content.includes(link), `docs/README.md missing: ${link}`)
}

// Validate actual navigation, including newly curated links, rather than requiring
// the retired editor-extension documentation layout.
for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
	const target = match[1].split("#")[0]
	if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue
	assert.ok(fs.existsSync(path.resolve(docsRoot, target)), `docs/README.md broken link: ${target}`)
}
assert.ok(content.includes("npm run baseline:update"), "docs/README.md must document baseline reproduction")

console.log("docs:check-docs-readme OK")
