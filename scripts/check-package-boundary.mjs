#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const failures = []
const requiredLegalFiles = ["LICENSE", "NOTICE", "PATENT-NON-AGGRESSION-PLEDGE.md", "TRADEMARKS.md", "THIRD-PARTY-NOTICES.md", "LICENSE-MAP.md"]

function normalize(value) {
	return value.replaceAll("\\", "/").replace(/^\.\//, "")
}

function run(command, args, options = {}) {
	return execFileSync(command, args, {
		cwd: repoRoot,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
		...options,
	})
}

let vsixFiles
try {
	const executable = process.platform === "win32" ? "node_modules/.bin/vsce.cmd" : "node_modules/.bin/vsce"
	vsixFiles = run(executable, ["ls", "--no-dependencies", "--no-yarn"]).split(/\r?\n/).filter(Boolean).map(normalize)
} catch (error) {
	failures.push(`VSIX file listing failed: ${error instanceof Error ? error.message : String(error)}`)
}

let npmFiles
const packageCheckCache = fs.mkdtempSync(path.join(os.tmpdir(), "lumi-package-check-"))
try {
	const raw = run(process.platform === "win32" ? "npm.cmd" : "npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
		env: { ...process.env, npm_config_cache: packageCheckCache },
	})
	const jsonStart = raw.indexOf("[")
	const metadata = JSON.parse(jsonStart >= 0 ? raw.slice(jsonStart) : raw)
	npmFiles = (metadata.at(-1)?.files ?? []).map((entry) => normalize(entry.path))
} catch (error) {
	failures.push(`npm package dry-run failed: ${error instanceof Error ? error.message : String(error)}`)
} finally {
	fs.rmSync(packageCheckCache, { recursive: true, force: true })
}

function requireFiles(label, files, required) {
	if (!files) return
	const present = new Set(files)
	for (const file of required) if (!present.has(file)) failures.push(`${label} omits required legal file ${file}`)
}

requireFiles("VSIX", vsixFiles, requiredLegalFiles)
requireFiles("npm", npmFiles, [...requiredLegalFiles, "SECURITY.md", "CONTRIBUTING.md", "DCO"])

for (const file of vsixFiles ?? []) {
	if (/^(?:\.wiki|docs|src|scripts|\.github|locales)(?:\/|$)/.test(file)) failures.push(`VSIX contains development surface ${file}`)
}
for (const file of npmFiles ?? []) {
	if (/^(?:\.wiki|docs|src|scripts|\.github|locales|test|tests|webview-ui\/src)(?:\/|$)/.test(file)) failures.push(`npm package contains development surface ${file}`)
}

if (failures.length > 0) {
	console.error("package:check FAILED")
	for (const failure of failures) console.error(`- ${failure}`)
	process.exitCode = 1
} else {
	console.log(`package:check OK — ${npmFiles.length} npm files and ${vsixFiles.length} VSIX files preserve the legal boundary`)
}
