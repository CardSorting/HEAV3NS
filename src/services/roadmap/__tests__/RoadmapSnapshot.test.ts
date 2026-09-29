import { strict as assert } from "node:assert"
import * as path from "node:path"
import { getSnapshotFromCache, invalidateSnapshotCache, setSnapshotCache, type WorkspaceSnapshot } from "../RoadmapSnapshot"

function snapshot(workspace: string): WorkspaceSnapshot {
	return {
		workspace,
		roadmapPath: path.join(workspace, "ROADMAP.md"),
		roadmapMtimeMs: 1,
		tier: "light",
		evidence: { nested: { label: "original" } },
		validation: null,
		gateState: {},
		cachedAt: Date.now(),
	}
}
function key(workspace: string, revision = 1): string {
	return `${path.resolve(workspace)}::light::${revision}`
}

describe("Roadmap snapshot retention", () => {
	afterEach(() => invalidateSnapshotCache())
	it("isolates stored evidence from both producers and consumers", () => {
		const original = snapshot("/snapshot-isolation")
		setSnapshotCache(key(original.workspace), original)
		;(original.evidence.nested as { label: string }).label = "producer mutation"
		const first = getSnapshotFromCache(key(original.workspace))!
		assert.deepEqual(first.evidence.nested, { label: "original" })
		;(first.evidence.nested as { label: string }).label = "consumer mutation"
		assert.deepEqual(getSnapshotFromCache(key(original.workspace))!.evidence.nested, { label: "original" })
	})
	it("discards obsolete revisions and bounds retained workspaces", () => {
		invalidateSnapshotCache()
		for (let revision = 0; revision < 1000; revision++)
			setSnapshotCache(key("/snapshot-revisions", revision), snapshot("/snapshot-revisions"))
		assert.equal(getSnapshotFromCache(key("/snapshot-revisions", 998)), undefined)
		assert.ok(getSnapshotFromCache(key("/snapshot-revisions", 999)))
		for (let i = 0; i < 128; i++) setSnapshotCache(key(`/snapshot-${i}`), snapshot(`/snapshot-${i}`))
		assert.equal(getSnapshotFromCache(key("/snapshot-revisions", 999)), undefined)
		assert.ok(getSnapshotFromCache(key("/snapshot-127")))
	})
	it("invalidates one workspace without removing its similarly named neighbor", () => {
		for (const workspace of ["/snapshot", "/snapshot-other"]) setSnapshotCache(key(workspace), snapshot(workspace))
		invalidateSnapshotCache("/snapshot")
		assert.equal(getSnapshotFromCache(key("/snapshot")), undefined)
		assert.ok(getSnapshotFromCache(key("/snapshot-other")))
	})
})
