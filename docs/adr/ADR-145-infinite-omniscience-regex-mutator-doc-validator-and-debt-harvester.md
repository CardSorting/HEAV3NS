# ADR-145: Infinite Omniscience Regex Mutator, Doc Link Validator, History Inspector & Debt Harvester

## Status
Accepted (Phase 75)

## Context
Refactoring across large file trees requires multi-file regex mutations with capture group replacements, automated documentation link verification, technical debt tracking, and contiguous memory slab telemetry.

## Decision
1. **Multi-File Regex Mutation Engine**:
   - Implemented `batch_regex_mutate` ([`BatchRegexMutator`](file:///Users/bozoegg/Desktop/LUMI-NEW/src/tooling/extensions/execution/batch-regex-mutator.ts)) supporting capture groups (`$1`, `$2`), flags (`g`, `m`, `i`), dry-run preview, and transactional journal backups.
2. **Markdown Documentation Link Validator**:
   - Implemented `validate_documentation_links` ([`DocLinkValidator`](file:///Users/bozoegg/Desktop/LUMI-NEW/src/tooling/extensions/search/doc-link-validator.ts)) parsing markdown files and verifying relative targets and anchors.
3. **Mutation Journal History Inspector**:
   - Implemented `inspect_file_history` querying `ToolTransactionJournal` to display chronological file revisions, tool names, turn IDs, and diffs.
4. **Technical Debt & TODO Harvester**:
   - Implemented `harvest_technical_debt` ([`TechnicalDebtHarvester`](file:///Users/bozoegg/Desktop/LUMI-NEW/src/tooling/extensions/search/technical-debt-harvester.ts)) extracting and prioritizing `TODO`, `FIXME`, `HACK`, `BUG`, `OPTIMIZE`, and `DEPRECATED` annotations.
5. **Memory Slab & Buffer Optimizer**:
   - Implemented `optimize_memory_slab` inspecting RSS, external array buffers, heap memory, and confirming the 16MB contiguous slab memory invariant.

## Consequences
- Multi-file pattern transformations are executed reliably in a single tool invocation.
- Documentation references and technical debt markers are tracked and maintained autonomously.
