# Security Policy

HEAV3NS / LUMI-JOY is a local-first developer tool that can read workspaces,
invoke configured providers, run approved tools, and persist local state. A
security report should therefore include enough context to distinguish a
workspace-only issue from credential, provider, extension, or release-artifact
impact.

## Reporting

Please report suspected vulnerabilities privately through GitHub Security
Advisories when private reporting is enabled for this repository. If that
channel is unavailable, contact the project steward at
`willcruzdesigner@gmail.com` with the subject `HEAV3NS security report`.

Do not include live API keys, OAuth tokens, private workspace data, or other
secrets in an issue or an initial report. Redact logs and attach the smallest
reproduction that demonstrates the problem.

Useful reports include:

- a concise impact statement and affected version or commit;
- reproduction steps or a minimal test case;
- whether the issue crosses a workspace, process, provider, or extension
  boundary; and
- any proposed mitigation, if available.

## Release and provenance concerns

Report tampered archives, missing license or attribution files, dependency
provenance concerns, and suspicious source inclusion through the same private
channel. The project treats a release artifact as untrusted until its source,
dependency, and package-boundary checks pass.

## Scope and disclosure

This policy does not promise a response time, a bounty, or a particular
disclosure schedule. The project steward will acknowledge reports when
practical, coordinate a fix or mitigation, and publish a release note when
disclosure is safe. Please do not publicly disclose an exploitable issue while
users remain exposed.
