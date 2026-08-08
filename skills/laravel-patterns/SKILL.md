---
name: laravel-patterns
description: Placement rules for domain-driven Laravel applications — when to create an Action, Service, Repository, Query Class or Value Object, and when to just use Eloquent. Use when writing, reviewing or refactoring Laravel code that touches application structure, data access, domain boundaries or class placement. Triggers on questions like "where should this live", "should this be a service", "do I need a repository", or any new class in app/Domain.
license: MIT
metadata:
  author: Foysal Ahmed
  version: "1.0.0"
  laravel: "^12.0 || ^13.0"
  php: "^8.3"
---

# Laravel Patterns

Placement rules for domain-driven Laravel applications: Action, Service, Repository, Query Class, Value Object. 55 rules across 9 sections.

**Core philosophy: practicality over purity. Never take a greedy decision.**

- Eloquent is already a good abstraction for most data access.
- A Repository over Eloquent does not fully decouple you from Eloquent. That is acceptable and expected — do not chase purity.
- Both extremes are bugs: a layer for every model (dead boilerplate) *and* none at all (queries scattered everywhere).
- A Query Class is the internal implementation technique of a Repository, not a competing pattern.
- Value Objects keep signatures clean and carry pure behavior. They never touch a `Builder`.
- Domains are bounded contexts. One domain never imports another's internals.

## When to Apply

Reference these rules when:

- Creating any class under `app/Domain/`
- Deciding between a Service, a Repository and inline code
- Reviewing a pull request that adds a layer
- Refactoring queries scattered across Actions, Services or Blade
- Splitting a monolithic `app/` into bounded contexts
- Wiring one domain to another

## Start Here

Run the Decision Gate before writing any class: `references/decision-gate.md`.

**Default answer: keep it in the Action, use Eloquent directly.**

```
Q1. Single end-to-end use case?              → ACTION
Q2. Called by 2+ Actions, or worth isolating? → SERVICE
Q3. Used in only one Action?                  → KEEP IT IN THE ACTION
Q4. Simple CRUD / one-off query?              → ELOQUENT DIRECTLY
Q5. Backend may swap, OR the query earns a
    name and its own tests?                   → REPOSITORY (+ Query Classes)
```

Ambiguous between Q4 and Q5? Choose Q4.

## Rule Sections by Priority

| # | Section | Impact | Prefix |
|---|---------|--------|--------|
| 1 | The Decision Gate | CRITICAL | `gate-` |
| 2 | Actions | HIGH | `action-` |
| 3 | Services | HIGH | `service-` |
| 4 | Repositories | HIGH | `repo-` |
| 5 | Query Classes | HIGH | `query-` |
| 6 | Value Objects and Parameter Isolation | MEDIUM-HIGH | `vo-` |
| 7 | Directory and Namespace Layout | MEDIUM | `layout-` |
| 8 | Inter-Domain Communication | HIGH | `domain-` |
| 9 | Configuration and Environments | MEDIUM | `config-` |

## Quick Reference

### 1. The Decision Gate (CRITICAL)

- `gate-run-decision-gate-first` — Name the trigger before creating any class
- `gate-action-for-use-case` — One use case means one Action
- `gate-service-only-when-reused` — Extract a Service only when two Actions need it
- `gate-eloquent-directly-by-default` — Use Eloquent directly by default
- `gate-repository-earns-its-name` — A Repository must name its trigger
- `gate-query-class-and-repository-together` — Query Classes and Repositories arrive together

### 2. Actions (HIGH)

- `action-one-use-case-end-to-end` — An Action orchestrates one use case end to end
- `action-keep-single-use-logic-inline` — Keep single-use logic inside the Action
- `action-naming-verb-noun` — Name Actions `<Verb><Noun>Action`
- `action-maps-request-to-value-objects` — Map HTTP input to domain types at the edge

### 3. Services (HIGH)

- `service-two-or-more-actions` — A Service serves two or more Actions
- `service-stateless-and-focused` — Services are stateless and context-agnostic
- `service-never-imports-query-classes` — A Service never imports a Query Class
- `service-not-a-disguised-repository` — A Service whose body is a query is a mislabeled Repository
- `service-naming-business-decision` — Name Services after the business decision

### 4. Repositories (HIGH)

- `repo-interface-in-domain-contracts` — Interface in `Contracts/`, implementation in `Repositories/`
- `repo-domain-intent-methods` — Repository methods express intent, not CRUD
- `repo-never-returns-builder` — A Repository interface never returns a `Builder`
- `repo-never-accepts-request` — A Repository never accepts a `Request`
- `repo-no-base-repository` — No generic `BaseRepository`
- `repo-small-focused-interface` — Keep Repository interfaces under ~6 methods
- `repo-bind-in-service-provider` — Bind the interface in a service provider
- `repo-inline-simple-delegate-complex` — Inline simple queries, delegate complex ones

### 5. Query Classes (HIGH)

- `query-single-handle-method` — Exactly one public method, `handle()`
- `query-internal-to-repositories` — Query Classes are internal to Repositories
- `query-name-the-business-question` — Name the business question, not the DB operation
- `query-final-readonly-no-base-class` — Plain `final readonly`, no abstract base
- `query-can-write` — A Query Class may write
- `query-return-builder-or-execute` — Return a `Builder` or execute, one per query
- `query-compose-query-classes` — Compose instead of duplicating clauses
- `query-whitelist-sortable-columns` — Whitelist sortable columns in the Query Class
- `query-owns-all-query-construction` — All query construction lives here

### 6. Value Objects and Parameter Isolation (MEDIUM-HIGH)

- `vo-group-related-parameters` — Group contextually related parameters
- `vo-more-than-four-params` — More than four parameters must be grouped
- `vo-never-touches-builder` — A Value Object never touches a `Builder`
- `vo-no-single-scalar-wrapper` — Never wrap a single unrelated scalar
- `vo-pass-domain-objects-directly` — Pass essential domain objects directly
- `vo-date-range-and-presets` — Express named date ranges through an interface
- `vo-parameterized-presets` — Parameterize presets instead of copying classes
- `vo-composite-filter-per-query` — Collapse a query's inputs into one composite filter

### 7. Directory and Namespace Layout (MEDIUM)

- `layout-domain-first-structure` — Organize by domain, not by layer
- `layout-scope-based-co-location` — Scope decides placement
- `layout-no-top-level-service-repository-query` — No top-level layer folders
- `layout-optional-folders-are-deliberate` — A missing folder is a decision
- `layout-contracts-vs-support` — `Contracts/` holds interfaces, `Support/` holds implementations

### 8. Inter-Domain Communication (HIGH)

- `domain-public-vs-private-surface` — A domain has a public surface and a private one
- `domain-no-cross-domain-models` — Never import another domain's Models, Repositories or Queries
- `domain-events-for-reactions` — Use Domain Events for cross-domain reactions
- `domain-open-host-service-for-sync` — Use an Open Host Service for synchronous reads
- `domain-shared-kernel-concepts-only` — The Shared Kernel holds concepts, never calls
- `domain-anti-corruption-layer` — Wrap external upstreams in an Anti-Corruption Layer

### 9. Configuration and Environments (MEDIUM)

- `config-secrets-in-env-structure-in-config` — Secrets in `.env`, structure in `config/`
- `config-never-env-outside-config` — Never call `env()` outside `config/`
- `config-per-environment-overrides` — Override per environment, not per branch
- `config-cache-in-production` — Cache config, routes and events in production

## Reference Material

Read on demand — do not load all of these at once:

- `references/decision-gate.md` — the gate, layer definitions, who may call what
- `references/directory-layout.md` — full tree, folder meanings, CI guards
- `references/inter-domain-decision-guide.md` — picking Event vs Open Host Service vs Shared Kernel vs ACL
- `references/anti-patterns.md` — 18 forbidden patterns with their grep signals
- `references/pre-completion-checklist.md` — 28-question self-check before declaring done
- `examples/orders-domain/` — one worked vertical slice with every layer in place

## How to Use

Read individual rule files for the full explanation and both code examples:

```
rules/gate-eloquent-directly-by-default.md
rules/query-internal-to-repositories.md
```

For the complete guide with every rule expanded: `AGENTS.md`.

## Related Skills

- `laravel-eloquent` — what goes *inside* a Query Class: casts, scopes, N+1, pagination, transactions, raw SQL
- `laravel-http` — the edge: routing, binding, form requests, resources, authorization, error mapping
- `laravel-async` — events, queued jobs, caching and scheduling
- `laravel-testing` — how to test each layer defined here
