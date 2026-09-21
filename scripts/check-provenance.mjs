#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const failures = []

function readJson(relativePath) {
	return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"))
}

function walk(directory, files = []) {
	if (!fs.existsSync(directory)) return files
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const absolutePath = path.join(directory, entry.name)
		if (entry.isDirectory()) {
			if (!new Set(["node_modules", "out", "dist", ".git"]).has(entry.name)) walk(absolutePath, files)
		} else if (entry.isFile()) {
			files.push(absolutePath)
		}
	}
	return files
}

function relative(absolutePath) {
	return path.relative(repoRoot, absolutePath).replaceAll(path.sep, "/")
}

let manifest
try {
	manifest = readJson(".wiki/ip/SOURCE-RELEASE-MANIFEST.json")
} catch (error) {
	failures.push(`unable to read source release manifest: ${error instanceof Error ? error.message : String(error)}`)
}

if (manifest) {
	if (manifest.schemaVersion !== 1) failures.push("source release manifest schemaVersion must be 1")
	if (manifest.releaseStatus !== "cleared")
		failures.push(`release status is ${manifest.releaseStatus ?? "missing"}; source provenance is not cleared`)
	if (manifest.releaseDecision !== "allow")
		failures.push(`release decision is ${manifest.releaseDecision ?? "missing"}; publication is denied`)
	if (manifest.policy?.unknownProvenance !== "deny") failures.push("manifest must deny unknown provenance")
	if (manifest.policy?.missingLicenseEvidence !== "deny") failures.push("manifest must deny missing license evidence")

	for (const surface of manifest.knownSurfaces ?? []) {
		if (surface.status !== "cleared") {
			failures.push(
				`${surface.id ?? "unnamed surface"}: status ${surface.status ?? "missing"} requires human resolution before release`,
			)
		}
	}
}

const migrationMarker =
	/(?:lifted\s+from|absorbed\s+from|external\s+source\s+workspace\/codemarie|packages\/codemarie|codemarie-new\/(?:src|broccolidb))/i
const productionSourceFiles = walk(path.join(repoRoot, "src")).filter((absolutePath) => {
	const file = relative(absolutePath)
	return /\.(?:[cm]?[jt]sx?)$/.test(file) && !/(?:\.test|\.spec)\.[cm]?[jt]sx?$/.test(file) && !file.includes("/__tests__/")
})
const markedFiles = []
for (const file of productionSourceFiles) {
	const lines = fs.readFileSync(file, "utf8").split(/\r?\n/)
	for (const [index, line] of lines.entries()) {
		if (migrationMarker.test(line)) markedFiles.push(`${relative(file)}:${index + 1}`)
	}
}
if (markedFiles.length > 0) {
	failures.push(`found ${markedFiles.length} unverified historical source marker${markedFiles.length === 1 ? "" : "s"}`)
	for (const marker of markedFiles.slice(0, 12)) failures.push(`  ${marker}`)
	if (markedFiles.length > 12) failures.push(`  ... ${markedFiles.length - 12} additional marker(s)`)
}

const localeFiles = walk(path.join(repoRoot, "locales")).filter((absolutePath) => /\.(?:md|txt|json)$/i.test(absolutePath))
const attributedLocales = localeFiles.filter((file) => /cline\s+bot\s+inc/i.test(fs.readFileSync(file, "utf8")))
if (attributedLocales.length > 0) {
	failures.push(
		`found ${attributedLocales.length} localized file(s) with external Cline Bot Inc attribution lacking local clearance`,
	)
	for (const file of attributedLocales.slice(0, 12)) failures.push(`  ${relative(file)}`)
	if (attributedLocales.length > 12) failures.push(`  ... ${attributedLocales.length - 12} additional localized file(s)`)
}

if (failures.length > 0) {
	console.error("provenance:check FAILED — release is not cleared")
	for (const failure of failures) console.error(`- ${failure}`)
	process.exitCode = 1
} else {
	console.log("provenance:check OK — all release surfaces have evidence-backed clearance")
}
