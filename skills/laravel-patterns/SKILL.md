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

Placement rules for domain-driven Laravel applications: Action, Service, Repository, Query Class, Value Object. 59 rules across 9 sections.

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
Q4. Single-record CRUD (find / create /
    update / delete)?                         → ELOQUENT DIRECTLY
                                                (from an Action or Repository)
Q5. Backend may swap, OR the query earns a
    name and its own tests?                   → REPOSITORY (+ Query Classes)
```

Ambiguous between Q4 and Q5? Choose Q4 — except for a list endpoint, which is always Q5.

## Non-Negotiables

These are the mistakes that survive review because each one looks locally reasonable:

- Query construction never appears in a Controller, Form Request, Resource, Blade view or Middleware — however small the query is.
- A paginated, filtered or ownership-scoped list is a named query behind a Repository, not "simple CRUD".
- An Action that only forwards to one collaborator is deleted; the caller calls the collaborator.
- An interface, its implementation and its container binding land in the same change. Never an empty `Repositories/`.
- One concept has one home: a shared module owns the mechanism, each domain owns the content describing its own data.
- Every route is authorized in exactly one place — see the `laravel-rest-api` skill.

## Pick the Rule

| About to write | Read |
|----------------|------|
| Any new class under `app/Domain/` | `gate-run-decision-gate-first` |
| An index / list / search endpoint | `gate-reads-go-through-a-named-query`, `query-whitelist-sortable-columns` |
| A create, update or delete use case | `gate-action-for-use-case`, `action-one-use-case-end-to-end` |
| An Action that only calls one thing | `action-not-a-pass-through` |
| A Repository interface | `gate-repository-earns-its-name`, `repo-ship-implementation-and-binding` |
| A query with filters, sorting or eager loads | `query-owns-all-query-construction`, `query-single-handle-method` |
| Logic a second Action now needs | `gate-service-only-when-reused` |
| A method with more than four parameters | `vo-more-than-four-params`, `vo-group-related-parameters` |
| Code that touches another domain | `domain-no-cross-domain-models`, `domain-events-for-reactions` |
| A notification, report or export class | `layout-shared-module-owns-mechanism` |
| Anything reading configuration | `config-never-env-outside-config` |
| A file you cannot place | `layout-scope-based-co-location` |

## Build Order

A vertical slice lands in this order — each step exists only if the step above it earned it:

1. `Contracts/<X>RepositoryInterface.php` — the Q5 trigger named in the docblock
2. `Queries/<BusinessQuestion>Query.php` — one `handle()`, all clauses
3. `Repositories/Eloquent<X>Repository.php` — implements the interface
4. the binding in `DomainServiceProvider` — same change, never later
5. `Actions/<Verb><Noun>Action.php` — only when state changes
6. the edge: Form Request → Controller → Resource (`laravel-rest-api`)
7. tests per layer (`laravel-testing`)

## Before You Write Code

- Every API named in these rules is verified against Laravel `^12.0 || ^13.0` and PHP `^8.3`. If you need something these rules do not name, check the docs — never infer an API from its name.
- Version-gated APIs are marked inline ("Laravel 13 only"). Read the project's `composer.json` first; on Laravel 12 use the fallback the rule gives.
- Where the project already differs from a rule, follow the project. Name the rule you set aside and why, rather than half-converting the codebase.
- When two rules collide, the higher-impact section wins — sections are ordered by impact.
- One example is not the whole rule. Open `rules/{slug}.md` before adapting it to a case the example does not show.

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
- `gate-reads-go-through-a-named-query` — A list endpoint is a named query

### 2. Actions (HIGH)

- `action-one-use-case-end-to-end` — An Action orchestrates one use case end to end
- `action-keep-single-use-logic-inline` — Keep single-use logic inside the Action
- `action-naming-verb-noun` — Name Actions `<Verb><Noun>Action`
- `action-maps-request-to-value-objects` — Map HTTP input to domain types at the edge
- `action-not-a-pass-through` — Never create an Action that only forwards

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
- `repo-ship-implementation-and-binding` — Interface, implementation and binding in one change
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
- `layout-shared-module-owns-mechanism` — A shared module owns the mechanism, not other domains' messages

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
- `references/pre-completion-checklist.md` — 31-question self-check before declaring done
- `examples/orders-domain/` — one worked vertical slice with every layer in place

## How to Use

Load in this order and stop when the answer is clear:

1. This file — the Quick Reference names every rule, and usually settles the question.
2. One rule file for the reasoning and both examples (~405 tokens each):

```
rules/gate-eloquent-directly-by-default.md
rules/query-internal-to-repositories.md
```

3. A `references/` file only when a rule points at one.

`AGENTS.md` is every rule compiled into one document (~22k tokens), for agents that read the AGENTS.md convention. Do not load it when the individual rule files are reachable.

## Related Skills

- `laravel-eloquent` — what goes *inside* a Query Class: casts, scopes, N+1, pagination, transactions, raw SQL
- `laravel-rest-api` — the edge: routing, binding, form requests, resources, authorization, error mapping
- `laravel-async` — events, queued jobs, caching and scheduling
- `laravel-testing` — how to test each layer defined here
