# ADR-108: Dollar-Denominated Billing Usage, Top-Up Balance Rollover & Low-Balance Alerting Subsystem

## Status
**ACCEPTED** (Phase 132 / Target #65)

## Context
In conversational AI agent platforms and subscription surfaces (`/usage`, `/subscription`), users require transparent, dollar-denominated spend visibility rather than obfuscated "credit" tokens. Crucially:
1. Expiring monthly plan allowances (e.g. $20/month included in plan) must be visibly distinguished from non-expiring purchased top-up balances (e.g. $50 top-up that rolls over).
2. Trying to cram these two distinct magnitudes into a single 3-segment progress bar causes unreadable visual density at terminal widths.
3. Mid-run cutoffs occur if accounts drop below safe balance thresholds without warning ($< $5.00).
4. Subsystems need frame-perfect snapshotting and instant state rollback ($<0.05\text{ ms SLA}$) with ultra-high-throughput metering ($>1,000,000\text{ ops/sec}$).

## Decision
We implement a zero-GC, typed, deterministic Dollar-Denominated Billing Usage Subsystem in **LUMI-JOY**:
1. **Core Contracts (`billing-usage.contracts.ts`)**:
   - Defines `AccountStatus` (`free`, `active_paid`, `low_balance`, `exhausted`, `unreachable`), `UsageBarDescriptor` (plan vs topup), `UsageModelDescriptor`, `BillingAccountInfo`, `BillingUsageConfig`, and `BillingUsageWorkspaceSnapshot`.
2. **In-Memory Substrate & Snapshots (`broccoli-billing-usage-substrate.ts`, `billing-usage-snapshot-manager.ts`)**:
   - In-memory Broccolidb repository tracking active account billing states, transaction ledgers, credit/debit history, and binary snapshotting with $<0.05\text{ ms SLA}$ rollback.
3. **Deterministic Engine (`deterministic-billing-usage-engine.ts`)**:
   - Evaluates USD precision math, formats renewal dates (`Jul 24, 2026`), renders ASCII dual visual bars, and classifies account status.
4. **Supervisor (`billing-usage-supervisor.ts`)**:
   - Coordinates billing state lifecycle (`getUsageModel()`, `debitUsage()`, `addTopup()`, `formatStatusSummary()`), prioritizing plan allowance deductions before top-up rollover balances.
5. **Model Tool Suite (`billing-usage-tool-suite.ts`)**:
   - Exposes 5 model tools (`billing_usage_get_model`, `billing_usage_record_debit`, `billing_usage_add_topup`, `billing_usage_configure`, `billing_usage_get_metrics`).
6. **Grand Monolith Expansion**:
   - Monolith expanded from **499 to 504 components** in optimal alphabetical cohesion.

## Consequences
- Guaranteed clear dollar-denominated accounting across CLI and TUI interfaces.
- Automatic plan allowance depletion prior to non-expiring top-up rollover deduction.
- Frame-perfect rollback and zero-GC memory performance.
