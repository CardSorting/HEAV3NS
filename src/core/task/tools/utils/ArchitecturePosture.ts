import {
	detectWorkspaceArchitectureProfile,
	resolveWorkspaceArchitectureSteering,
	type WorkspaceArchitectureProfile,
	type WorkspaceArchitectureSteering,
} from "@/core/policy/WorkspaceArchitectureProfile"

/** Minimal task surface needed to resolve the agent's effective architecture posture. */
export interface ArchitecturePostureConfig {
	cwd: string
	universalGuard?: {
		isJoyZoningSteeringEnabled?: () => boolean
		getArchitectureProfile?: () => WorkspaceArchitectureProfile
	}
	services?: {
		stateManager?: {
			getGlobalSettingsKey: (key: "joyZoningSteeringEnabled") => unknown
		}
	}
}

export function getTaskArchitectureProfile(config: ArchitecturePostureConfig): WorkspaceArchitectureProfile {
	return config.universalGuard?.getArchitectureProfile?.() ?? detectWorkspaceArchitectureProfile(config.cwd)
}

/** Keep tool handlers aligned with prompts, policy, and subagent posture. */
export function getTaskArchitectureSteering(config: ArchitecturePostureConfig): WorkspaceArchitectureSteering {
	const steeringEnabled =
		config.universalGuard?.isJoyZoningSteeringEnabled?.() ??
		config.services?.stateManager?.getGlobalSettingsKey("joyZoningSteeringEnabled") !== false
	return resolveWorkspaceArchitectureSteering(getTaskArchitectureProfile(config), steeringEnabled)
}
