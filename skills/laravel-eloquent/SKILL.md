---
name: laravel-eloquent
description: Eloquent and query-layer engineering rules for Laravel — eliminating N+1, choosing a pagination strategy, short atomic transactions, casts and scopes on the model, and where raw SQL is allowed. Use when writing or reviewing Eloquent models, migrations, query classes, repositories, exports or reporting queries, or when a Laravel endpoint is slow, leaking memory, or returning wrongly-typed columns.
license: MIT
metadata:
  author: Foysal Ahmed
  version: "1.0.0"
  laravel: "^12.0 || ^13.0"
  php: "^8.3"
---

# Laravel Eloquent

Data-layer engineering rules: 36 rules across 7 sections, ordered by what actually takes an application down.

Assumes the layering from the `laravel-patterns` skill: **all query construction lives in Query Classes and Repository implementations.** These rules describe what goes *inside* those classes.

## When to Apply

- Writing or reviewing a Query Class, Repository implementation or migration
- An endpoint is slow, times out, or exhausts memory
- A column comes back as a string when it should be an enum, date or array
- Writing an import, export, backfill or reporting query
- Adding a scope, global scope or soft deletes to a model

## Pick the Rule

| About to write | Read |
|----------------|------|
| A query that reads relations | `perf-eager-load-every-touched-relation`, `perf-prevent-lazy-loading` |
| A query returning many rows | `paginate-always-paginate-lists`, `paginate-cursor-for-deep-pagination` |
| A new model | `model-cast-every-column`, `model-final-and-typed`, `model-minimal-fillable` |
| A write touching more than one table | `tx-wrap-multi-step-writes`, `tx-keep-transactions-short` |
| Raw SQL or a database expression | `raw-never-interpolate-user-input`, `raw-only-inside-query-classes` |
| An update or insert over many rows | `bulk-update-bypasses-events`, `bulk-upsert-instead-of-loop` |
| A filter used by several queries | `scope-query-scopes-for-reusable-filters` |
| An existence check | `perf-exists-not-count` |
| A pass over a large table | `perf-chunk-large-result-sets`, `bulk-lazy-by-id-for-huge-sets` |
| A slow endpoint to diagnose | `perf-index-filtered-columns`, `perf-avoid-wherehas-on-hot-paths` |

## Before You Write Code

- Every API named in these rules is verified against Laravel `^12.0 || ^13.0` and PHP `^8.3`. If you need something these rules do not name, check the docs — never infer an API from its name.
- Version-gated APIs are marked inline ("Laravel 13 only"). Read the project's `composer.json` first; on Laravel 12 use the fallback the rule gives.
- Where the project already differs from a rule, follow the project. Name the rule you set aside and why, rather than half-converting the codebase.
- When two rules collide, the higher-impact section wins — sections are ordered by impact.
- One example is not the whole rule. Open `rules/{slug}.md` before adapting it to a case the example does not show.

## Rule Sections by Priority

| # | Section | Impact | Prefix |
|---|---------|--------|--------|
| 1 | Query Performance | CRITICAL | `perf-` |
| 2 | Pagination | HIGH | `paginate-` |
| 3 | Transactions and Consistency | HIGH | `tx-` |
| 4 | Model Declaration | HIGH | `model-` |
| 5 | Scopes, Global Scopes and Soft Deletes | MEDIUM-HIGH | `scope-` |
| 6 | Raw SQL and Query Expressions | MEDIUM | `raw-` |
| 7 | Bulk Operations | MEDIUM | `bulk-` |

## Quick Reference

### 1. Query Performance (CRITICAL)

- `perf-eager-load-every-touched-relation` — Every relation the output touches is in `with([...])`
- `perf-prevent-lazy-loading` — Make lazy loading throw outside production
- `perf-select-only-needed-columns` — Narrow the select on wide tables
- `perf-exists-not-count` — Ask `exists()` when you only need a boolean
- `perf-chunk-large-result-sets` — Chunk or stream instead of `get()`
- `perf-avoid-wherehas-on-hot-paths` — Replace `whereHas` with a join on hot paths
- `perf-index-filtered-columns` — Index every column you filter, join or sort on

### 2. Pagination (HIGH)

- `paginate-always-paginate-lists` — Never return an unbounded list
- `paginate-cursor-for-deep-pagination` — `cursorPaginate()` for deep or fast-growing sets
- `paginate-simple-when-no-total` — `simplePaginate()` when the total is not rendered
- `paginate-full-only-when-count-required` — Reserve `paginate()` for a required count

### 3. Transactions and Consistency (HIGH)

- `tx-wrap-multi-step-writes` — Multi-step writes are atomic
- `tx-keep-transactions-short` — No HTTP, mail or file I/O inside a transaction
- `tx-dispatch-after-commit` — Jobs and events fire after commit
- `tx-lock-for-update-on-contention` — Lock rows you read then modify
- `tx-retry-on-deadlock` — Pass `attempts:` so deadlocks retry

### 4. Model Declaration (HIGH)

- `model-cast-every-column` — Cast every date, enum, JSON and money column
- `model-custom-casts-for-value-objects` — Value Objects get a `CastsAttributes` class
- `model-minimal-fillable` — `$fillable` is a security boundary
- `model-scope-attribute` — Declare scopes with `#[Scope]` (Laravel 12+)
- `model-observed-by-attribute` — Attach observers with `#[ObservedBy]`
- `model-immutable-dates-and-timezones` — Store UTC, cast immutable, convert at the edge
- `model-final-and-typed` — `final`, `strict_types`, typed relations, `@property` docblocks

### 5. Scopes, Global Scopes and Soft Deletes (MEDIUM-HIGH)

- `scope-query-scopes-for-reusable-filters` — Small reusable constraints live on the model
- `scope-global-scope-for-default-filter` — Global scope for a filter that must never be forgotten
- `scope-global-or-named-not-both` — One filter, one mechanism
- `scope-soft-deletes-for-recoverable` — `SoftDeletes` only for genuinely recoverable records
- `scope-explicit-trashed-queries` — Name the query after what it includes

### 6. Raw SQL and Query Expressions (MEDIUM)

- `raw-only-inside-query-classes` — Raw SQL belongs in Query Classes and Repositories
- `raw-tpetry-instead-of-db-raw` — Type-safe expressions instead of `DB::raw()`
- `raw-conditional-aggregates-in-one-query` — Dashboard counters in a single query
- `raw-custom-expression-helpers` — Wrap driver-specific SQL in an `Expression` class
- `raw-never-interpolate-user-input` — Bindings for values, allow-lists for identifiers

### 7. Bulk Operations (MEDIUM)

- `bulk-upsert-instead-of-loop` — Batch inserts and upserts
- `bulk-update-bypasses-events` — Bulk writes skip model events; handle that deliberately
- `bulk-lazy-by-id-for-huge-sets` — `chunkById`/`lazyById`, never offset paging while writing

## Recommended Packages

Verified against Laravel 13:

| Need | Package | Constraint |
|------|---------|------------|
| Type-safe SQL expressions (replaces `DB::raw()`) | `tpetry/laravel-query-expressions` | `^1.6` |
| Declarative, reusable model filters | `indexzer0/eloquent-filtering` | `^2.2.2` |
| Excel import and export | `rap2hpoutre/fast-excel` | `^5.14` |

All three are used **inside Query Classes and Repositories only**. Drop to raw expressions when a declarative filter package hurts performance on a hot query.

## Reference Material

- `references/n-plus-one-playbook.md` — finding, fixing and preventing N+1
- `references/pagination-decision.md` — choosing between the three paginators
- `references/checklist.md` — pre-merge self-check for the data layer

## How to Use

Load in this order and stop when the answer is clear:

1. This file — the Quick Reference names every rule, and usually settles the question.
2. One rule file for the reasoning and both examples (~366 tokens each):

```
rules/perf-eager-load-every-touched-relation.md
rules/tx-dispatch-after-commit.md
```

3. A `references/` file only when a rule points at one.

`AGENTS.md` is every rule compiled into one document (~12k tokens), for agents that read the AGENTS.md convention. Do not load it when the individual rule files are reachable.

## Related Skills

- `laravel-patterns` — where the query goes: Query Class, Repository, Action or inline
- `laravel-rest-api` — pagination and resources at the HTTP edge
- `laravel-async` — caching query results and invalidating on model events
- `laravel-testing` — testing query rules against a real database
