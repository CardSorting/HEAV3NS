import { TemplateEngine } from "../templates/TemplateEngine"
import type { PromptVariant, SystemPromptContext } from "../types"

const getIntegrityWikiTemplateText = () => `[INTEGRITY_KNOWLEDGE_LEDGER_OMNI_BRIDGE]

- LEDGER_SCOPE: Treat .wiki/ as an existing project surface, not a prerequisite for implementation. Read relevant entries when they reduce uncertainty; do not create or update docs solely to satisfy this contract.
- TAXONOMY_STRUCTURE: When the assigned lane explicitly owns documentation, follow the repository's existing .wiki/ structure; otherwise leave shared-ledger synthesis to the parent:
  - onboarding/: getting-started.md, walkthrough.md, troubleshooting.md
  - architecture/: overview.md (Mermaid diagrams), directories.md, schemas.md, risk-map.md
  - adr/: lifecycle.json is canonical; managed/ and LIFECYCLE.md are generated; legacy ADR Markdown is not active authority until curated
  - incidents/: register.json is current state, events.jsonl is append-only history, records/ contains generated postmortems
  - knowledge/: source-map.json maps changed project surfaces to current-state guides
  - agent/: playbook.md (live brief), agent-memory.md, key-findings.md, troubleshooting.md, common-pitfalls.md, patterns.md
  - root (.wiki/): index.md (TOC), changelog.md (blast radius report)
- ANTI_LAZINESS_PROTOCOL: Do not leave orphan docs when you own documentation; deep-link new entries using the repository's normal index convention.
- AGENT_PLAYBOOK_METHOD: Read or update the playbook only when it is relevant to the assigned scope and write authority.
- FORENSIC_PHASE_WORKFLOW: If documentation is in scope: finish implementation -> capture evidence -> write the smallest useful doc change -> verify links. Code lanes do not pause implementation for a documentation phase.
- DECISION_INCIDENT_SEPARATION: Keep the decision, its implementation, and supporting verification as separate lifecycle claims. Register meaningful incidents with evidence, events and follow-ups; do not treat ordinary bugs as incidents or rewrite event history.
- TERMINAL_CHECKLIST: Verify only the documentation surfaces you changed, with claims backed by FPoW.`

export async function getIntegrityWikiSection(_variant: PromptVariant, context: SystemPromptContext): Promise<string> {
	if (!context.isSubagentRun) {
		return ""
	}
	const template = getIntegrityWikiTemplateText()
	return new TemplateEngine().resolve(template, context, {})
}
