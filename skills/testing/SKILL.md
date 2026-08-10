---
name: testing
description: Test strategy for a layered Laravel application — which test style fits each layer, hand-written fakes over mocks, real-database tests for Query Classes and Repositories, pure tests for Value Objects, and feature tests that assert authorization, payload shape and query counts. Use when writing or reviewing Laravel tests, deciding what to fake, diagnosing a flaky or slow suite, or setting a project's testing conventions.
license: MIT
metadata:
  author: Foysal Ahmed
  version: "1.0.0"
  laravel: "^12.0 || ^13.0"
  php: "^8.3"
  pest: "^3.0 || ^4.0"
---

# Laravel Testing

Test strategy for a layered Laravel application: 18 rules across 5 sections. Examples use Pest; every rule applies equally to PHPUnit.

The organizing idea: **each layer has one test style that fits it.** Testing an Action against a real database, or a Query Class against a mock, produces a slow suite that breaks on refactors and misses real bugs.

## When to Apply

- Writing tests for any layer defined by the `laravel-skill:patterns` skill
- Deciding what to fake and what to run for real
- The suite is slow, flaky, or nobody runs it locally
- Reviewing a pull request's test coverage
- Setting testing conventions for a project

## The Layer Table

| Layer | Style | Database | What it proves |
|-------|-------|----------|----------------|
| Action | Unit, fake repository | No | The use case orchestrates correctly |
| Service | Unit, fakes | No | The business decision is right |
| Repository | Integration, factories | Yes | Methods return the right domain types |
| Query Class | Integration, factories | Yes | Which rows are in, out, and in what order |
| Value Object | Pure unit | No | Predicates and transformations |
| Controller / route | Feature test | Usually | Status, payload, authorization |
| Job / Listener | Unit handler, faked dispatch | Depends | Idempotency and effects |

## Pick the Rule

| About to write | Read |
|----------------|------|
| A test for anything at all | `strategy-layer-to-test-type`, `strategy-test-your-rules-not-the-framework` |
| A test that needs a Repository | `fake-repository-anonymous-class`, `fake-never-mock-eloquent` |
| A test for a Query Class | `db-refresh-database-and-factories`, `db-assert-inclusion-and-exclusion` |
| A test for ordering or defaults | `db-test-ordering-and-defaults` |
| A test for an endpoint | `http-assert-payload-shape`, `http-assert-authorization` |
| A test that a job or event fired | `http-assert-side-effects-dispatched`, `fake-framework-facades` |
| A test involving dates or randomness | `fake-time-and-randomness` |
| A test for a Value Object | `vo-test-predicates-directly`, `vo-never-hand-a-builder` |
| A test that feels pointless to write | `strategy-if-testing-feels-silly` |

## Before You Write Code

- Every API named in these rules is verified against Laravel `^12.0 || ^13.0` and PHP `^8.3`. If you need something these rules do not name, check the docs — never infer an API from its name.
- Version-gated APIs are marked inline ("Laravel 13 only"). Read the project's `composer.json` first; on Laravel 12 use the fallback the rule gives.
- Where the project already differs from a rule, follow the project. Name the rule you set aside and why, rather than half-converting the codebase.
- When two rules collide, the higher-impact section wins — sections are ordered by impact.
- One example is not the whole rule. Open `rules/{slug}.md` before adapting it to a case the example does not show.

## Rule Sections by Priority

| # | Section | Impact | Prefix |
|---|---------|--------|--------|
| 1 | Strategy by Layer | HIGH | `strategy-` |
| 2 | Fakes and Doubles | HIGH | `fake-` |
| 3 | Database Tests | HIGH | `db-` |
| 4 | Feature Tests | MEDIUM-HIGH | `http-` |
| 5 | Value Object Tests | MEDIUM | `vo-` |

## Quick Reference

### 1. Strategy by Layer (HIGH)

- `strategy-layer-to-test-type` — Match the test style to the layer
- `strategy-test-your-rules-not-the-framework` — Test your rules, not Eloquent
- `strategy-if-testing-feels-silly` — A pointless test means a pointless class
- `strategy-pest-and-suite-speed` — Keep the suite fast enough to run on every save

### 2. Fakes and Doubles (HIGH)

- `fake-repository-anonymous-class` — Fake a Repository with an anonymous class
- `fake-framework-facades` — `Queue::fake()`, `Event::fake()`, `Http::fake()` and friends
- `fake-never-mock-eloquent` — Never mock Eloquent or the query builder
- `fake-time-and-randomness` — Freeze time, seed randomness

### 3. Database Tests (HIGH)

- `db-refresh-database-and-factories` — `RefreshDatabase` plus factories, never shared fixtures
- `db-assert-inclusion-and-exclusion` — Assert what is excluded, not only what is included
- `db-test-ordering-and-defaults` — Cover ordering, defaults and the sort allow-list
- `db-test-eager-loading` — Lock the N+1 fix in place
- `db-test-transactions-and-idempotency` — Prove rollback and repeat-safety

### 4. Feature Tests (MEDIUM-HIGH)

- `http-assert-authorization` — Unauthenticated, unpermitted, and another tenant's record
- `http-assert-payload-shape` — Pin the contract, including keys that must not appear
- `http-assert-side-effects-dispatched` — Assert the jobs and events an endpoint queues

### 5. Value Object Tests (MEDIUM)

- `vo-test-predicates-directly` — Construct, call, assert — no database, no container
- `vo-never-hand-a-builder` — A test needing a `Builder` means the boundary is broken

## Suite Configuration

```php
// tests/Pest.php
uses(Tests\TestCase::class, RefreshDatabase::class)->in('Feature', 'Integration');
uses(Tests\TestCase::class)->in('Unit');   // no database
```

```xml
<!-- phpunit.xml -->
<env name="DB_CONNECTION" value="sqlite"/>
<env name="DB_DATABASE" value=":memory:"/>
<env name="QUEUE_CONNECTION" value="sync"/>
<env name="CACHE_STORE" value="array"/>
<env name="MAIL_MAILER" value="array"/>
```

```php
// AppServiceProvider::boot() — makes N+1 and typos fail the suite
Model::shouldBeStrict(! $this->app->isProduction());
```

SQLite differs from MySQL and Postgres on JSON operators, full-text search, locking and strict-mode errors. Run the integration suite against the production engine in CI even when local runs use SQLite.

## Reference Material

- `references/test-templates.md` — copy-paste starting points for each layer
- `references/checklist.md` — pre-merge self-check for test coverage

## How to Use

Load in this order and stop when the answer is clear:

1. This file — the Quick Reference names every rule, and usually settles the question.
2. One rule file for the reasoning and both examples (~465 tokens each):

```
rules/fake-repository-anonymous-class.md
rules/db-assert-inclusion-and-exclusion.md
```

3. A `references/` file only when a rule points at one.

`AGENTS.md` is every rule compiled into one document (~8k tokens), for agents that read the AGENTS.md convention. Do not load it when the individual rule files are reachable.

## Related Skills

- `laravel-skill:patterns` — the layers these tests are organized around
- `laravel-skill:eloquent` — the query rules the database tests assert
- `laravel-skill:rest-api` — the endpoints the feature tests cover
- `laravel-skill:async` — testing idempotency, batches and cache invalidation
