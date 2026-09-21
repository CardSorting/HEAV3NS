#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

import { execFile } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import * as esbuild from "esbuild"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const watch = process.argv.includes("--watch")

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: "esbuild-problem-matcher",

	setup(build) {
		build.onStart(() => {
			console.log("[watch] build started")
		})
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`)
				console.error(`    ${location.file}:${location.line}:${location.column}:`)
			})
			console.log("[watch] build finished")
		})
	},
}

const srcConfig = {
	bundle: true,
	minify: false,
	sourcemap: true,
	sourcesContent: true,
	logLevel: "silent",
	entryPoints: ["src/packages/**/*.ts"],
	outdir: "out/packages",
	format: "cjs",
	platform: "node",
	define: {
		"process.env.IS_TEST": "true",
	},
	external: ["vscode"],
	plugins: [esbuildProblemMatcherPlugin],
}

const execFileAsync = promisify(execFile)

async function runTsc() {
	const tscBin = path.join(__dirname, "..", "node_modules", "typescript", "bin", "tsc")
	await execFileAsync(process.execPath, [tscBin, "-p", "./tsconfig.test.json", "--incremental", "--outDir", "out"], {
		encoding: "utf-8",
	})
}

async function main() {
	const srcCtx = await esbuild.context(srcConfig)

	if (watch) {
		runTsc().catch(() => {})
		await srcCtx.watch()
	} else {
		await Promise.all([runTsc(), srcCtx.rebuild()])
		await srcCtx.dispose()
	}
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
