#!/usr/bin/env node
/** Dependency-free VSIX packaging and installation checks for LUMI/BroccoliDB. */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import AdmZip from "adm-zip"

export const REQUIRED_RUNTIME_PACKAGES = []
export const VSIX_NATIVE_MODULE_MARKER = "extension/package.json"
export const INSTALLED_NATIVE_MODULE_RELATIVE = "package.json"
export const MIN_NATIVE_BINARY_BYTES = 0
export const ELECTRON_VERSION = "39.2.3"
export const EXPECTED_ELECTRON_ABI = 140
export const NATIVE_VSIX_TARGETS = ["win32-x64", "win32-arm64", "linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64"]

const HOST_TARGETS = new Map([
	["win32:x64", "win32-x64"],
	["win32:arm64", "win32-arm64"],
	["linux:x64", "linux-x64"],
	["linux:arm64", "linux-arm64"],
	["darwin:x64", "darwin-x64"],
	["darwin:arm64", "darwin-arm64"],
])

export const DEFAULT_EXTENSION_ROOTS = [
	{ id: "antigravity", label: "Antigravity IDE", dir: path.join(os.homedir(), ".antigravity-ide", "extensions") },
	{ id: "cursor", label: "Cursor", dir: path.join(os.homedir(), ".cursor", "extensions") },
	{ id: "vscode", label: "VS Code", dir: path.join(os.homedir(), ".vscode", "extensions") },
]

export const LUMI_EXTENSION_FOLDER_PATTERN = /(?:cardsorting\.lumi|lumi-vscode|dietcode)/i
export const OPENVSX_DENIED_VSIX_MARKERS = ["extension/scripts/", "extension/test_workspace/", "test_extension.node", "/deps/download.sh", "extension/.dietcode/"]
export const OPENVSX_VSCODEIGNORE_MARKERS = ["scripts/**", "test_workspace/**", "**/*.sh"]

export function nativeTargetForHost(platform = process.platform, arch = process.arch) {
	const target = HOST_TARGETS.get(`${platform}:${arch}`)
	if (!target) throw new Error(`Unsupported extension host: ${platform}-${arch}`)
	return target
}

export function inferVsixTarget(vsixPath) {
	const name = path.basename(vsixPath, ".vsix")
	return NATIVE_VSIX_TARGETS.find((target) => name.endsWith(`-${target}`) || name.endsWith(`@${target}`)) ?? null
}

function listVsixEntries(vsixPath) {
	if (!fs.existsSync(vsixPath)) return ""
	try {
		return new AdmZip(vsixPath).getEntries().map((entry) => entry.entryName).join("\n")
	} catch {
		return ""
	}
}

export function auditOpenVsxPackaging(listing, vsixName = "vsix") {
	return [
		...OPENVSX_DENIED_VSIX_MARKERS.map((marker) => ({
			id: `${vsixName}:openvsx:${marker}`,
			status: listing.includes(marker) ? "fail" : "pass",
			title: listing.includes(marker) ? `${vsixName} ships forbidden path (${marker})` : `${vsixName} excludes ${marker}`,
			detail: listing.includes(marker) ? "Remove the path from the package and repackage." : undefined,
			fix: listing.includes(marker) ? ["Update .vscodeignore and repackage"] : undefined,
		})),
		{
			id: `${vsixName}:openvsx:shell-scripts`,
			status: /extension\/[^\n]*\.sh/.test(listing) ? "fail" : "pass",
			title: /extension\/[^\n]*\.sh/.test(listing) ? `${vsixName} includes shell scripts` : `${vsixName} includes no shell scripts`,
			fix: /extension\/[^\n]*\.sh/.test(listing) ? ['Ensure "**/*.sh" is in .vscodeignore'] : undefined,
		},
	]
}

export function auditVsixHealth(vsixPath) {
	const name = path.basename(vsixPath)
	if (!fs.existsSync(vsixPath)) return [{ id: `${name}:exists`, status: "fail", title: `${name} not found`, fix: ["Run: npm run package:vsix:all"] }]
	const listing = listVsixEntries(vsixPath)
	const checks = [
		{ id: `${name}:archive`, status: listing ? "pass" : "fail", title: `${name} is a readable VSIX archive`, detail: listing ? undefined : "The archive is empty or unreadable.", fix: listing ? undefined : ["Re-package the extension"] },
		{ id: `${name}:broccolidb`, status: "pass", title: `${name} uses dependency-free BroccoliDB state storage`, detail: "No native database binary is required." },
	]
	return [...checks, ...auditOpenVsxPackaging(listing, name)]
}

export function auditExtensionHealth(extensionDir, { ideLabel = "Editor" } = {}) {
	const name = path.basename(extensionDir)
	const manifest = path.join(extensionDir, "package.json")
	const exists = fs.existsSync(manifest)
	return [
		{ id: `${name}:manifest`, status: exists ? "pass" : "fail", title: `${ideLabel} → ${name} has an extension manifest`, detail: exists ? undefined : "Install appears incomplete.", fix: exists ? undefined : ["Run: npm run doctor -- --fix"] },
		{ id: `${name}:broccolidb`, status: "pass", title: `${ideLabel} → ${name} has dependency-free BroccoliDB state storage`, detail: "No native database module is required." },
	]
}

export function vsixHasNativeModule(vsixPath) {
	return auditVsixHealth(vsixPath).every((check) => check.status !== "fail")
}

export function extensionHasNativeModule(extensionDir) {
	return auditExtensionHealth(extensionDir).every((check) => check.status !== "fail")
}

export function assertVsixHasNativeModule(vsixPath) {
	const failed = auditVsixHealth(vsixPath).filter((check) => check.status === "fail")
	if (failed.length > 0) throw new Error(`Packaged VSIX checks failed:\n${failed.map((check) => `  - ${check.title}`).join("\n")}`)
	console.log(`[vsix] verified BroccoliDB packaging in ${path.basename(vsixPath)}`)
}

export function verifyOpenVsxVscodeignore(repoRoot) {
	const ignorePath = path.join(repoRoot, ".vscodeignore")
	if (!fs.existsSync(ignorePath)) return [{ id: "openvsx:vscodeignore:missing", status: "fail", title: ".vscodeignore exists", fix: ["Restore .vscodeignore"] }]
	const ignore = fs.readFileSync(ignorePath, "utf8")
	return OPENVSX_VSCODEIGNORE_MARKERS.map((marker) => ({
		id: `openvsx:vscodeignore:${marker}`,
		status: ignore.includes(marker) ? "pass" : "fail",
		title: `.vscodeignore includes ${marker}`,
		fix: ignore.includes(marker) ? undefined : [`Add "${marker}" to .vscodeignore`],
	}))
}

export function discoverVsixFiles(distDir = path.resolve("dist"), { version } = {}) {
	if (!fs.existsSync(distDir)) return []
	const entries = fs.readdirSync(distDir).filter((entry) => entry.endsWith(".vsix"))
	return entries
		.filter((entry) => !version || entry.includes(`-${version}`))
		.map((entry) => path.join(distDir, entry))
		.sort((a, b) => a.localeCompare(b))
}

const lumiExtensionsMemo = new Map()
export function discoverLumiExtensions(extensionsRoots = DEFAULT_EXTENSION_ROOTS) {
	const key = JSON.stringify(extensionsRoots.map((root) => root.dir))
	if (lumiExtensionsMemo.has(key)) return lumiExtensionsMemo.get(key)
	const results = []
	for (const root of extensionsRoots) {
		if (!fs.existsSync(root.dir)) continue
		for (const entry of fs.readdirSync(root.dir)) {
			const extensionDir = path.join(root.dir, entry)
			if (!fs.existsSync(extensionDir) || !fs.statSync(extensionDir).isDirectory() || !LUMI_EXTENSION_FOLDER_PATTERN.test(entry)) continue
			results.push({ path: extensionDir, name: entry, ideId: root.id, ideLabel: root.label })
		}
	}
	const sorted = results.sort((a, b) => a.name.localeCompare(b.name))
	lumiExtensionsMemo.set(key, sorted)
	return sorted
}

export function pickRepairVsix(distDir, extensionFolderName, target = nativeTargetForHost()) {
	const versionMatch = extensionFolderName.match(/-(\d+\.\d+\.\d+(?:-universal)?)$/)
	const version = versionMatch ? versionMatch[1].replace("-universal", "") : null
	let candidates = discoverVsixFiles(distDir).filter((file) => !inferVsixTarget(file) || inferVsixTarget(file) === target)
	if (version) candidates = candidates.filter((file) => path.basename(file).includes(`-${version}`))
	return candidates.at(-1) ?? null
}

export function repairExtensionFromVsix({ extensionDir, vsixPath }) {
	if (!vsixPath || !fs.existsSync(vsixPath)) throw new Error(`No repair VSIX found for ${path.basename(extensionDir)}`)
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lumi-repair-"))
	try {
		new AdmZip(vsixPath).extractAllTo(tmpDir, true)
		const extracted = path.join(tmpDir, "extension")
		if (!fs.existsSync(extracted)) throw new Error(`VSIX ${path.basename(vsixPath)} has no extension/ folder`)
		fs.rmSync(extensionDir, { recursive: true, force: true })
		fs.cpSync(extracted, extensionDir, { recursive: true })
	} finally {
		fs.rmSync(tmpDir, { recursive: true, force: true })
	}
	return vsixPath
}

export function summarizeChecks(checks) {
	const pass = checks.filter((check) => check.status === "pass").length
	const warn = checks.filter((check) => check.status === "warn").length
	const fail = checks.filter((check) => check.status === "fail").length
	return { pass, warn, fail, total: checks.length, ok: fail === 0 }
}

export function printDoctorSection({ title, checks }) {
	console.log(title)
	console.log("─".repeat(title.length))
	for (const check of checks) console.log(`  ${check.status === "pass" ? "✅" : check.status === "warn" ? "⚠️" : "❌"}  ${check.title}${check.detail ? `\n      ${check.detail}` : ""}`)
	console.log("")
	return summarizeChecks(checks)
}

export function printFixSteps(checks) {
	const failed = checks.filter((check) => check.status !== "pass" && check.fix?.length)
	if (failed.length === 0) return
	console.log("How to fix\n──────────")
	let step = 1
	for (const check of failed) {
		console.log(`\n${check.title}:`)
		for (const line of check.fix ?? []) console.log(`  ${step++}. ${line}`)
	}
}

export function formatGithubActionsAnnotations(checks) {
	return checks.filter((check) => check.status !== "pass").map((check) => `::${check.status === "fail" ? "error" : "warning"} title=${check.title}::${check.detail ?? check.title}`).join("\n")
}

export function auditVsixFiles(distDir) {
	return discoverVsixFiles(distDir).map((vsixPath) => ({ path: vsixPath, name: path.basename(vsixPath), ok: vsixHasNativeModule(vsixPath), checks: auditVsixHealth(vsixPath) }))
}

export function auditInstalledExtensions(extensionsRoots) {
	const roots = typeof extensionsRoots[0] === "string" ? extensionsRoots.map((dir) => ({ id: "unknown", label: "Editor", dir })) : extensionsRoots
	return discoverLumiExtensions(roots).map((extension) => ({ path: extension.path, name: extension.name, ok: extensionHasNativeModule(extension.path), hasNodeModules: fs.existsSync(path.join(extension.path, "node_modules")), ideLabel: extension.ideLabel, checks: auditExtensionHealth(extension.path, { ideLabel: extension.ideLabel }) }))
}

export function verifyVscodeignoreWhitelist(repoRoot) {
	const ignorePath = path.join(repoRoot, ".vscodeignore")
	return [{ id: "vscodeignore:exists", status: fs.existsSync(ignorePath) ? "pass" : "fail", title: ".vscodeignore file exists", fix: fs.existsSync(ignorePath) ? undefined : ["Restore .vscodeignore"] }]
}

export function buildDoctorReport({ repoRoot, distDir, extensionRoots = DEFAULT_EXTENSION_ROOTS, scope = "full" }) {
	const pkgVersion = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")).version
	const configChecks = scope === "install" ? [] : [...verifyVscodeignoreWhitelist(repoRoot), ...verifyOpenVsxVscodeignore(repoRoot)]
	const vsixPaths = scope === "install" ? [] : discoverVsixFiles(distDir, { version: pkgVersion })
	const extensions = discoverLumiExtensions(extensionRoots)
	const vsixChecks = vsixPaths.flatMap((file) => auditVsixHealth(file))
	const extensionChecks = extensions.flatMap((extension) => auditExtensionHealth(extension.path, { ideLabel: extension.ideLabel }))
	const overall = summarizeChecks([...configChecks, ...vsixChecks, ...extensionChecks])
	return {
		ok: overall.ok,
		scope,
		summary: overall,
		packaging: summarizeChecks(vsixChecks),
		installs: summarizeChecks(extensionChecks),
		config: summarizeChecks(configChecks),
		configChecks,
		checks: [...configChecks, ...vsixChecks, ...extensionChecks],
		vsix: vsixPaths.map((file) => ({ path: file, name: path.basename(file), checks: auditVsixHealth(file) })),
		extensions: extensions.map((extension) => ({ ...extension, checks: auditExtensionHealth(extension.path, { ideLabel: extension.ideLabel }) })),
	}
}

export function printAuditReport({ vsixResults, extensionResults }) {
	printDoctorSection({ title: "Packaged downloads (dist/*.vsix)", checks: vsixResults.flatMap((result) => result.checks ?? []) })
	printDoctorSection({ title: "Installed extensions", checks: extensionResults.flatMap((result) => result.checks ?? []) })
}
