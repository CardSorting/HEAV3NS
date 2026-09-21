#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

import { execFileSync } from "node:child_process"

const failures = []
const args = process.argv.slice(2)
const rangeIndex = args.indexOf("--range")
const requestedRange = rangeIndex >= 0 ? args[rangeIndex + 1] : undefined
const range = requestedRange && !/^0{40}(?:\.\.0{40})?$/.test(requestedRange) ? requestedRange : "HEAD"
const format = "%x1e%H%x00%an%x00%ae%x00%cn%x00%ce%x00%B"

function gitLog() {
	return execFileSync("git", ["log", "--no-merges", `--format=${format}`, range], { encoding: "utf8" })
}

let raw
try {
	raw = gitLog()
} catch (error) {
	console.error(`dco:check FAILED — unable to read commit range ${range}`)
	console.error(error instanceof Error ? error.message : String(error))
	process.exitCode = 1
}

if (raw !== undefined) {
	const records = raw.split("\x1e").filter((record) => record.trim().length > 0)
	for (const record of records) {
		const fields = record.split("\x00")
		const [commit, authorName, authorEmail, committerName, committerEmail, ...bodyParts] = fields
		const body = bodyParts.join("\x00")
		const signoffs = [...body.matchAll(/^Signed-off-by:\s*(.+?)\s+<([^>]+)>\s*$/gim)]
		if (signoffs.length === 0) {
			failures.push(`${commit}: missing Signed-off-by trailer`)
			continue
		}
		const hasMatchingSignoff = signoffs.some((match) => {
			const email = match[2].trim().toLowerCase()
			return email === authorEmail.trim().toLowerCase() || email === committerEmail.trim().toLowerCase()
		})
		if (!hasMatchingSignoff) failures.push(`${commit}: sign-off must match author ${authorName} <${authorEmail}> or committer ${committerName} <${committerEmail}>`)
	}

	if (failures.length > 0) {
		console.error("dco:check FAILED")
		for (const failure of failures) console.error(`- ${failure}`)
		process.exitCode = 1
	} else {
		console.log(`dco:check OK — ${records.length} commit${records.length === 1 ? "" : "s"} signed off`)
	}
}
