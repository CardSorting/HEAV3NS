import fs from "node:fs"
import path from "node:path"
import * as vscode from "vscode"
import { HostProvider } from "@/hosts/host-provider"

/** BroccoliDB uses Node built-ins and ordinary files; no native runtime package is required. */
export const REQUIRED_PACKAGES = [] as const

export const TROUBLESHOOTING_URL = "https://docs.dietcode.io/troubleshooting/extension-wont-start"
export const HEALTH_OUTPUT_CHANNEL_NAME = "LUMI Health"
export type HealthStatus = "pass" | "warn" | "fail"

export type InstallationHealthCheck = { id: string; status: HealthStatus; title: string; detail?: string; fix?: string[] }
export type NativeDepsHealthResult = { ok: boolean; missingPackages: string[]; loadError?: string }

const STATUS_LABEL: Record<HealthStatus, string> = { pass: "OK", warn: "WARN", fail: "FAIL" }
let healthOutputChannel: vscode.OutputChannel | undefined

export function getHealthOutputChannel(): vscode.OutputChannel {
	if (!healthOutputChannel) healthOutputChannel = vscode.window.createOutputChannel(HEALTH_OUTPUT_CHANNEL_NAME)
	return healthOutputChannel
}

export function registerHealthOutputChannel(context: vscode.ExtensionContext): vscode.OutputChannel {
	const channel = getHealthOutputChannel()
	context.subscriptions.push(channel)
	return channel
}

export function checkExtensionNativeDeps(_extensionPath: string): NativeDepsHealthResult {
	return { ok: true, missingPackages: [] }
}

export function auditCurrentInstallation(extensionPath: string): InstallationHealthCheck[] {
	const checks: InstallationHealthCheck[] = [
		{
			id: "broccolidb",
			status: "pass",
			title: "BroccoliDB state layer",
			detail: "Table/WAL/CAS persistence is dependency-free; no native database module is required.",
		},
		{
			id: "extension",
			status: fs.existsSync(path.join(extensionPath, "package.json")) ? "pass" : "fail",
			title: "Extension manifest available",
			detail: fs.existsSync(path.join(extensionPath, "package.json")) ? undefined : "Install appears incomplete.",
			fix: fs.existsSync(path.join(extensionPath, "package.json"))
				? undefined
				: ["Reinstall LUMI from a VSIX file", `See: ${TROUBLESHOOTING_URL}`],
		},
	]

	try {
		const globalStoragePath = HostProvider.get().globalStorageFsPath
		checks.push({
			id: "storage",
			status: fs.existsSync(globalStoragePath) ? "pass" : "warn",
			title: "Global storage directory",
			detail: fs.existsSync(globalStoragePath) ? `Path: ${globalStoragePath}` : "Created on first use.",
		})
	} catch {
		// HostProvider can be uninitialized during standalone checks.
	}
	return checks
}

export function summarizeInstallationChecks(checks: InstallationHealthCheck[]) {
	const pass = checks.filter((check) => check.status === "pass").length
	const warn = checks.filter((check) => check.status === "warn").length
	const fail = checks.filter((check) => check.status === "fail").length
	return { pass, warn, fail, total: checks.length, ok: fail === 0 }
}

export function formatInstallationHealthReport({
	checks,
	extensionPath,
	extensionVersion,
	hostName,
	hostVersion,
}: {
	checks: InstallationHealthCheck[]
	extensionPath: string
	extensionVersion: string
	hostName: string
	hostVersion: string
}): string {
	const summary = summarizeInstallationChecks(checks)
	const lines = [
		"LUMI Installation Health Check",
		"==============================",
		"",
		`Editor:     ${hostName} ${hostVersion}`,
		`Extension:  ${extensionVersion}`,
		`Location:   ${extensionPath}`,
		"",
		"Checks",
		"------",
	]
	for (const check of checks) {
		lines.push(`[${STATUS_LABEL[check.status]}] ${check.title}`)
		if (check.detail) lines.push(`       ${check.detail}`)
	}
	lines.push(
		"",
		`Summary: ${summary.ok ? "Healthy" : "Needs attention"} — ${summary.pass} passed, ${summary.warn} warnings, ${summary.fail} failed`,
	)
	if (!summary.ok) {
		lines.push("", "Recommended next steps", "----------------------")
		let step = 1
		for (const check of checks) {
			if (check.status === "pass" || !check.fix?.length) continue
			for (const fix of check.fix) lines.push(`${step++}. ${fix}`)
		}
	}
	lines.push("", `Help: ${TROUBLESHOOTING_URL}`)
	return lines.join("\n")
}

export async function runInstallationHealthCheck(context: vscode.ExtensionContext): Promise<boolean> {
	const channel = getHealthOutputChannel()
	const checks = auditCurrentInstallation(context.extensionPath)
	const summary = summarizeInstallationChecks(checks)
	const report = formatInstallationHealthReport({
		checks,
		extensionPath: context.extensionPath,
		extensionVersion: context.extension.packageJSON.version ?? "unknown",
		hostName: vscode.env.appName || "VS Code compatible editor",
		hostVersion: vscode.version,
	})
	channel.clear()
	channel.appendLine(report)
	channel.show(true)
	if (summary.ok && summary.warn === 0) {
		const choice = await vscode.window.showInformationMessage(
			"LUMI installation looks healthy. See the LUMI Health panel for details.",
			"Open guide",
		)
		if (choice === "Open guide") await vscode.env.openExternal(vscode.Uri.parse(TROUBLESHOOTING_URL))
		return true
	}
	return summary.ok
}

export async function showNativeDepsFailure(result: NativeDepsHealthResult): Promise<void> {
	const detail = result.loadError ? `\n\nTechnical detail: ${result.loadError}` : ""
	await vscode.window.showErrorMessage(`LUMI state storage could not start.${detail}`, "How to fix")
}

export function nativeDepsFailureMessage(result: NativeDepsHealthResult): string {
	return result.loadError ? `LUMI state storage could not start: ${result.loadError}` : "LUMI state storage could not start"
}
