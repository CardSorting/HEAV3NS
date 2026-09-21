import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import AdmZip from "adm-zip"
import {
	auditExtensionHealth,
	auditOpenVsxPackaging,
	auditVsixHealth,
	buildDoctorReport,
	discoverVsixFiles,
	inferVsixTarget,
	nativeTargetForHost,
	REQUIRED_RUNTIME_PACKAGES,
	summarizeChecks,
	verifyOpenVsxVscodeignore,
	verifyVscodeignoreWhitelist,
} from "./vsix-native-deps.mjs"

const repoRoot = path.join(import.meta.dirname, "..")

test("BroccoliDB packaging has no native runtime package chain", () => {
	assert.deepEqual(REQUIRED_RUNTIME_PACKAGES, [])
})

test("nativeTargetForHost maps supported extension hosts", () => {
	assert.equal(nativeTargetForHost("win32", "x64"), "win32-x64")
	assert.equal(nativeTargetForHost("darwin", "arm64"), "darwin-arm64")
	assert.throws(() => nativeTargetForHost("freebsd", "x64"), /Unsupported extension host/)
})

test("inferVsixTarget recognizes targeted filenames", () => {
	assert.equal(inferVsixTarget("lumi-2.8.0-win32-x64.vsix"), "win32-x64")
	assert.equal(inferVsixTarget("lumi-2.8.0.vsix"), null)
})

test("auditVsixHealth accepts a readable dependency-free VSIX", () => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lumi-vsix-audit-"))
	try {
		const zip = new AdmZip()
		zip.addFile("extension/package.json", Buffer.from("{}"))
		const vsix = path.join(tmp, "lumi-1.0.0-win32-x64.vsix")
		zip.writeZip(vsix)
		assert.equal(summarizeChecks(auditVsixHealth(vsix)).ok, true)
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true })
	}
})

test("verify packaging configuration and Open VSX rules", () => {
	assert.equal(summarizeChecks(verifyVscodeignoreWhitelist(repoRoot)).ok, true)
	assert.equal(summarizeChecks(verifyOpenVsxVscodeignore(repoRoot)).ok, true)
	assert.equal(summarizeChecks(auditOpenVsxPackaging("extension/dist/extension.cjs")).ok, true)
})

test("doctor scopes packaging separately from installed extensions", () => {
	const report = buildDoctorReport({ repoRoot, distDir: path.join(repoRoot, "dist"), scope: "install" })
	assert.equal(report.configChecks.length, 0)
	assert.equal(report.vsix.length, 0)
})

test("auditExtensionHealth reports an incomplete installation", () => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lumi-doctor-test-"))
	try {
		assert.equal(summarizeChecks(auditExtensionHealth(tmp)).ok, false)
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true })
	}
})

test("discoverVsixFiles filters by version", () => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lumi-vsix-discovery-"))
	try {
		for (const name of ["lumi-2.8.1.vsix", "lumi-2.8.0.vsix"]) fs.writeFileSync(path.join(tmp, name), "fixture")
		assert.deepEqual(discoverVsixFiles(tmp, { version: "2.8.1" }).map((file) => path.basename(file)), ["lumi-2.8.1.vsix"])
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true })
	}
})
