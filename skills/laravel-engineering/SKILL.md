---
name: laravel-engineering
description: Laravel implementation discipline for tracing context, reusing present contracts, keeping code simple, preserving failures, and verifying the changed critical path. Use when implementing, refactoring, debugging or reviewing Laravel code where callers, configuration, data flow or proof of correctness may be unclear.
license: MIT
metadata:
  author: Foysal Ahmed
  version: "1.1.2"
  laravel: "^12.0 || ^13.0"
  php: "^8.3"
---

# Laravel Engineering

Cross-cutting implementation rules for Laravel changes. Use this skill with the specialist skill that owns the boundary: `laravel-rest-api`, `laravel-eloquent`, `laravel-async`, `laravel-patterns` or `laravel-testing`.

## When to Apply

- Implementing, debugging, refactoring or reviewing a Laravel change
- A request mentions reuse, readability, root cause, errors, dead code, documentation or verification
- A local patch could affect callers, configuration, persistence, authorization or queued effects

## Pick the Rule

| About to do | Read |
|-------------|------|
| Start an unfamiliar change | `context-read-contract-before-change`, `context-trace-data-and-effects` |
| Extract a helper, interface, constant or configuration value | `design-reuse-before-abstraction`, `design-simple-readable-code` |
| Handle a failure or repair a bug | `correct-fix-causes-and-fail-loudly` |
| Return data after a write | `correct-read-back-through-the-consumer-shape` |
| Clean up or explain code | `hygiene-no-comments-or-dead-code` |
| Decide what to test or document | `hygiene-verify-critical-paths-and-docs` |

## Before You Write Code

1. Read the local contract: instructions, implementation, callers, configuration and relevant tests.
2. Trace the value and effects through its actual boundary before choosing a fix.
3. Reuse a present contract or write the smallest direct code that owns the decision.
4. Preserve failure and verify the risk-bearing path after the change.

Security, authorization and data-consistency guarantees override a convenience or simplicity preference. Project-specific conventions win when they are documented and the reason is clear.

## Rule Sections by Priority

| # | Section | Impact | Prefix |
|---|---------|--------|--------|
| 1 | Context and Contracts | CRITICAL | `context-` |
| 2 | Design and Reuse | HIGH | `design-` |
| 3 | Correctness and Failure | CRITICAL | `correct-` |
| 4 | Hygiene and Verification | HIGH | `hygiene-` |

## Quick Reference

### 1. Context and Contracts (CRITICAL)

- `context-read-contract-before-change` — Read instructions, callers, configuration and proof before editing
- `context-trace-data-and-effects` — Trace data through validation, state and effects

### 2. Design and Reuse (HIGH)

- `design-reuse-before-abstraction` — Reuse a present contract before adding a seam
- `design-simple-readable-code` — Keep one-off policy visible at its decision

### 3. Correctness and Failure (CRITICAL)

- `correct-fix-causes-and-fail-loudly` — Fix the cause and never write after a failed operation
- `correct-read-back-through-the-consumer-shape` — Return the explicit shape the consumer reads

### 4. Hygiene and Verification (HIGH)

- `hygiene-no-comments-or-dead-code` — Avoid redundant implementation comments; preserve type and context annotations
- `hygiene-verify-critical-paths-and-docs` — Prove the risk-bearing path and synchronize docs

## How to Use

Load this index, then one rule that matches the decision. Read the specialist skill only for the boundary involved; do not load generated `AGENTS.md` when rule files are reachable.

## Related Skills

- `laravel-patterns` — placement, reuse boundaries and configuration seams
- `laravel-eloquent` — persistence, transactions and response query shape
- `laravel-rest-api` — authorization, request and response boundaries
- `laravel-async` — queued effects and failure handling
- `laravel-testing` — proportionate proof for the affected layer
