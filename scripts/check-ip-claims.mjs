#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const failures = []
const requiredSurfaces = [
	"README.md",
	"PREFACE.md",
	"SOUL_AND_SKILLS_GUIDE.md",
	"NOTICE",
	"CHANGELOG.md",
	"PRODUCT.md",
	"PATENT-NON-AGGRESSION-PLEDGE.md",
	"TRADEMARKS.md",
	"THIRD-PARTY-NOTICES.md",
	"SECURITY.md",
	"CONTRIBUTING.md",
	"LICENSE-MAP.md",
	"docs/CLAIM-SCOPE.md",
	"docs/LEGAL-STRATEGY.md",
	".wiki/ip/README.md",
	".wiki/ip/CLAIM-REGISTER.md",
	".wiki/ip/SOURCE-PROVENANCE.md",
	".wiki/ip/INVENTION-DISCLOSURE-AND-PRIOR-ART.md",
	".wiki/ip/DEFENSIVE-PRIOR-ART-CLAIMS.md",
	".wiki/adr/ADR-052-permissive-open-source-licensing-and-patent-grant.md",
	"docs/adr/ADR-052-permissive-open-source-licensing-and-patent-grant.md",
	"package.json",
]
function collectMarkdownFiles(relativeDirectory) {
	const root = path.join(repoRoot, relativeDirectory)
	const collected = []
	function visit(directory) {
		for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
			const absolutePath = path.join(directory, entry.name)
			if (entry.isDirectory()) visit(absolutePath)
			else if (entry.isFile() && entry.name.endsWith(".md")) collected.push(path.relative(repoRoot, absolutePath))
		}
	}
	if (fs.existsSync(root)) visit(root)
	return collected
}
const surfaces = [...new Set([...requiredSurfaces, ...collectMarkdownFiles("docs"), ...collectMarkdownFiles(".wiki")])]
const forbidden = [
	[/\b100%\s+permissive\b/i, "unsupported universal-permission language"],
	[/\b100%\s+(?:pure(?:\s+typescript)?|type-safe|non-destructive|dynamic(?:\s+user\s+model\s+selection)?)\b/i, "unsupported absolute implementation claim"],
	[/\birrefutable\b/i, "unsupported conclusory evidence language"],
	[/\blegally\s+binding\b/i, "unsupported legal-effect language"],
	[/\bno\s+entity\s+may\b/i, "unsupported universal patent conclusion"],
	[/\bpublic[- ]domain\b/i, "unintended public-domain dedication"],
	[/\bprimary\s+inventor\b/i, "unsupported inventorship conclusion"],
	[/\b(?:co-?authored|authors?)\s+by\s+antigravity\b/i, "unsupported AI co-authorship claim"],
	[/\bguaranteed\s+(?:performance\s+)?sla\b/i, "unsupported service-level guarantee"],
	[/\bguaranteed\s+(?:zero\s+token|zero\s+port|performance|latency)\b/i, "unsupported absolute operational guarantee"],
	[/\bup\s+to\s+90%/i, "unbounded savings headline"],
	[/\b5[–-]10x\b/i, "unproven comparative speed headline"],
	[/\b2\.9x\b/i, "unproven comparative speed headline"],
	[/file:\/\/\/Users\/|\/Users\/bozoegg\//i, "machine-local path in public claim surface"],
]
const guaranteeLanguage = /\b(?:guarantee(?:s|d)?|immunity|immune)\b/i
const boundedGuaranteeContext =
	/\b(?:not|no|does|cannot|may|can|intended|designed|covered|modeled|workload|historical|requires|remains|outside|without|subject|supports|checks|reduces|limited)\b/i

for (const relativePath of surfaces) {
	const absolutePath = path.join(repoRoot, relativePath)
	if (!fs.existsSync(absolutePath)) {
		failures.push(`${relativePath}: required claim surface is missing`)
		continue
	}
	const lines = fs.readFileSync(absolutePath, "utf8").split(/\r?\n/)
	for (const [index, line] of lines.entries()) {
		for (const [pattern, description] of forbidden) {
			if (pattern.test(line)) failures.push(`${relativePath}:${index + 1}: ${description}`)
		}
		if (guaranteeLanguage.test(line) && !boundedGuaranteeContext.test(line)) {
			failures.push(`${relativePath}:${index + 1}: unbounded guarantee or immunity language`)
		}
	}
}

const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8")
for (const requiredReference of ["docs/LIVE_BASELINE.json", ".wiki/ip/CLAIM-REGISTER.md", "docs/LEGAL-STRATEGY.md"]) {
	if (!readme.includes(requiredReference)) failures.push(`README.md must link ${requiredReference}`)
}

const patentPolicy = fs.readFileSync(path.join(repoRoot, "PATENT-NON-AGGRESSION-PLEDGE.md"), "utf8")
for (const requiredBoundary of ["not a patent application", "does not expand the Apache grant", "seek qualified counsel"]) {
	if (!patentPolicy.includes(requiredBoundary)) failures.push(`PATENT-NON-AGGRESSION-PLEDGE.md must state: ${requiredBoundary}`)
}

if (failures.length > 0) {
	console.error("ip:check FAILED")
	for (const failure of failures) console.error(`- ${failure}`)
	process.exitCode = 1
} else {
	console.log(`ip:check OK — ${surfaces.length} public claim surfaces checked against bounded-claim policy`)
}
