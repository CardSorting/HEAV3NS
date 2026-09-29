/** Unified workspace evidence cache invalidation. */

import { invalidateSnapshotCache } from "./RoadmapSnapshot"

export function invalidateRoadmapWorkspaceCache(workspace?: string): void {
	invalidateSnapshotCache(workspace)
}
