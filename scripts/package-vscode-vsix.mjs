#!/usr/bin/env node
/**
 * Package VS Code Marketplace VSIX as CardSorting.lumi-vscode.
 *
 * Packages the extension and verifies the dependency-free BroccoliDB runtime.
 *
 * Usage:
 *   npm run package:vsix
 */
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { assertVsixHasNativeModule, nativeTargetForHost } from "./vsix-native-deps.mjs"

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const packageJsonPath = path.join(repoRoot, "package.json")

function buildPackageArtifacts(repoRoot) {
	const npm = process.platform === "win32" ? "npm.cmd" : "npm"
	console.log("[vscode] rebuilding extension and webview artifacts before packaging...")
	execFileSync(npm, ["run", "build:webview"], {
		stdio: "inherit",
		cwd: repoRoot,
		shell: process.platform === "win32",
	})
	execFileSync(process.execPath, ["esbuild.mjs", "--production"], {
		stdio: "inherit",
		cwd: repoRoot,
	})
}

function main() {
	const originalPackageJson = fs.readFileSync(packageJsonPath, "utf8")
	const pkg = JSON.parse(originalPackageJson)
	const target = nativeTargetForHost()
	const outPath = path.join(repoRoot, "dist", `${pkg.name}-${pkg.version}-${target}.vsix`)

	fs.mkdirSync(path.dirname(outPath), { recursive: true })

	try {
		buildPackageArtifacts(repoRoot)
		const packageManifest = { ...pkg }
		delete packageManifest.files
		fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageManifest, null, "\t")}\n`)

		const vsceArgs = ["package", "--target", target, "--allow-package-secrets", "sendgrid", "--out", outPath]

		execFileSync(process.platform === "win32" ? "vsce.cmd" : "vsce", vsceArgs, {
			stdio: "inherit",
			cwd: repoRoot,
			shell: process.platform === "win32",
		})
		assertVsixHasNativeModule(outPath)
		console.log(`[vscode] packaged ${outPath}`)
	} catch (error) {
		process.exitCode = 1
		if (error instanceof Error) {
			console.error(`[vscode] ${error.message}`)
		}
	} finally {
		fs.writeFileSync(packageJsonPath, originalPackageJson)
	}
}

main()
