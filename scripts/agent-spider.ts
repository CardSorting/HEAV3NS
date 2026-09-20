import { execSync } from "node:child_process"
import { createHash } from "node:crypto"
import * as fs from "node:fs"
import * as path from "node:path"
import { BroccoliDatabaseKernel } from "@noorm/broccolidb"

type IndexedFile = {
	id: string
	path: string
	content: string
	contentSha256: string
	size: number
	updatedAt: number
	branch: string
} & Record<string, unknown>

type SpiderMetadata = {
	id: string
	branch: string
	seededAt: number
	fileCount: number
} & Record<string, unknown>

const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"])

function hash(value: string): string {
	return createHash("sha256").update(value, "utf8").digest("hex")
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function currentBranch(root: string): string {
	return execSync("git rev-parse --abbrev-ref HEAD", { cwd: root, encoding: "utf8" }).trim()
}

function trackedCodeFiles(root: string): string[] {
	return execSync("git ls-files", { cwd: root, encoding: "utf8" })
		.split("\n")
		.map((file) => file.trim())
		.filter((file) => file.length > 0 && CODE_EXTENSIONS.has(path.extname(file)))
}

function importSpecifiers(content: string): string[] {
	const imports = new Set<string>()
	const pattern = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["']([^"']+)["']/g
	for (const match of content.matchAll(pattern)) imports.add(match[1])
	return [...imports]
}

function normalizedFilePath(root: string, value: string): string {
	const absolute = path.isAbsolute(value) ? value : path.resolve(root, value)
	return path.relative(root, absolute).split(path.sep).join("/")
}

function findRecord(files: readonly IndexedFile[], root: string, value: string): IndexedFile | undefined {
	const normalized = normalizedFilePath(root, value)
	return files.find((file) => file.path === normalized)
}

function directDependents(files: readonly IndexedFile[], target: IndexedFile): IndexedFile[] {
	const targetBase = target.path.replace(/\.[^.]+$/, "")
	return files.filter(
		(file) =>
			file.id !== target.id &&
			importSpecifiers(file.content).some((specifier) => {
				const normalized = specifier.replace(/\.(?:js|jsx|mjs|cjs|ts|tsx)$/, "")
				return normalized.endsWith(targetBase) || normalized.endsWith(`/${targetBase}`)
			}),
	)
}

function printUsage(): void {
	console.log(
		"Usage: npx tsx scripts/agent-spider.ts <seed|re-seed|status|find-symbol|find-usage|deps|blast-radius|verify-graph|mermaid|pre-heat>",
	)
}

async function runCommand(
	command: string,
	args: readonly string[],
	root: string,
	kernel: BroccoliDatabaseKernel,
): Promise<number> {
	const filesTable = kernel.getTable<IndexedFile>("spider_files")
	const metadataTable = kernel.getTable<SpiderMetadata>("spider_metadata")

	if (command === "seed" || command === "re-seed") {
		const branch = currentBranch(root)
		const files = trackedCodeFiles(root)
		const forceFull = command === "re-seed" || args.includes("--force-full")
		console.log(`📡 Seeding in-memory BroccoliDB on branch '${branch}'...`)

		await kernel.transaction(async () => {
			if (forceFull) filesTable.clear()
			for (const file of files) {
				const absolutePath = path.join(root, file)
				if (!fs.existsSync(absolutePath)) continue
				const content = fs.readFileSync(absolutePath, "utf8")
				filesTable.put(file, {
					id: file,
					path: file,
					content,
					contentSha256: hash(content),
					size: Buffer.byteLength(content, "utf8"),
					updatedAt: Date.now(),
					branch,
				})
			}
			metadataTable.put("workspace", { id: "workspace", branch, seededAt: Date.now(), fileCount: filesTable.count() })
		})
		await kernel.checkpoint("agent_spider_seed")
		console.log(`✅ Indexed ${filesTable.count()} files with the table/WAL/CAS kernel.`)
		return 0
	}

	const files = filesTable.getAll()
	if (files.length === 0) {
		console.error("⚠️  BroccoliDB is empty. Run 'npx tsx scripts/agent-spider.ts seed' first.")
		return 1
	}

	if (command === "status") {
		const metadata = metadataTable.get("workspace")
		console.log(`📊 Indexed files: ${files.length}`)
		console.log(`🌿 Branch: ${metadata?.branch ?? "unknown"}`)
		console.log(`🕒 Seeded: ${metadata?.seededAt ? new Date(metadata.seededAt).toISOString() : "unknown"}`)
		return 0
	}

	if (command === "find-symbol") {
		const symbol = args[0]
		if (!symbol) {
			console.error("Usage: find-symbol <name>")
			return 1
		}
		const declaration = new RegExp(`\\b(?:class|function|const|let|var|interface|type|enum)\\s+${escapeRegExp(symbol)}\\b`)
		const matches = files.filter((file) => declaration.test(file.content))
		for (const file of matches) console.log(`  - ${file.path}`)
		if (matches.length === 0) console.log(`No declaration found for '${symbol}'.`)
		return 0
	}

	if (command === "find-usage") {
		const symbol = args[0]
		if (!symbol) {
			console.error("Usage: find-usage <symbol>")
			return 1
		}
		const usage = new RegExp(`\\b${escapeRegExp(symbol)}\\b`)
		for (const file of files.filter((item) => usage.test(item.content))) console.log(`  <- ${file.path}`)
		return 0
	}

	if (command === "deps" || command === "blast-radius" || command === "pre-heat") {
		const file = args[0]
		if (!file) {
			console.error(`Usage: ${command} <file>`)
			return 1
		}
		const target = findRecord(files, root, file)
		if (!target) {
			console.error(`File not found in indexed table: ${file}`)
			return 1
		}
		const specifiers = importSpecifiers(target.content)
		const dependents = directDependents(files, target)
		if (command === "deps") {
			console.log(`📦 Dependencies for ${target.path}:`)
			for (const specifier of specifiers) console.log(`  -> ${specifier}`)
			console.log("🔗 Direct dependents:")
			for (const dependent of dependents) console.log(`  <- ${dependent.path}`)
		} else if (command === "blast-radius") {
			console.log(`🔥 Blast radius for ${target.path}: ${dependents.length} direct dependents`)
		} else {
			console.log(`🌡️  Study pack for ${target.path}:`)
			for (const specifier of specifiers) console.log(`  - ${specifier}`)
			for (const dependent of dependents) console.log(`  - ${dependent.path} (dependent)`)
		}
		return 0
	}

	if (command === "verify-graph") {
		const stale = files.filter((file) => !fs.existsSync(path.join(root, file.path)))
		console.log(
			stale.length === 0
				? "✅ Indexed table is consistent with the workspace."
				: `⚠️  ${stale.length} stale file records found.`,
		)
		return stale.length === 0 ? 0 : 1
	}

	if (command === "mermaid") {
		console.log("graph TD")
		for (const file of files) {
			for (const specifier of importSpecifiers(file.content).filter((value) => value.startsWith("."))) {
				console.log(`  ${JSON.stringify(file.path)} --> ${JSON.stringify(specifier)}`)
			}
		}
		return 0
	}

	printUsage()
	return 1
}

async function main(): Promise<void> {
	const root = process.cwd()
	const [command = "status", ...args] = process.argv.slice(2)
	const kernel = new BroccoliDatabaseKernel({ workspaceRoot: root })
	await kernel.start()
	try {
		process.exitCode = await runCommand(command, args, root, kernel)
	} finally {
		await kernel.stop()
	}
}

main().catch((error) => {
	console.error("❌ Agent Spider failed:", error)
	process.exitCode = 1
})
