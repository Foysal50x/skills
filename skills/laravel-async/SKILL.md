---
name: laravel-async
description: Asynchronous and caching rules for Laravel — idempotent queued jobs with retries and backoff, domain events for side effects, queue separation and failure handling, deterministic cache keys with event-driven invalidation, and scheduled tasks that queue rather than block. Use when writing or reviewing jobs, events, listeners, queue configuration, caching or scheduled tasks, or when work is duplicated, lost, or blocking a request.
license: MIT
metadata:
  author: Foysal Ahmed
  version: "1.1.2"
  laravel: "^12.0 || ^13.0"
  php: "^8.3"
---

# Laravel Async

Rules for work that happens outside the request: 36 rules across 5 sections.

Two assumptions run through all of them:

- **A queued handler runs more than once.** Delivery is at-least-once, so every handler must be safe to repeat.
- **A cache entry is wrong until something invalidates it.** A TTL is a backstop, not the mechanism.

## When to Apply

- Writing or reviewing a Job, Event, Listener or scheduled task
- Work is duplicated, lost, or executing inside a request that should return immediately
- A queue is backing up, or failures are going unnoticed
- Adding caching, or debugging stale or cross-tenant cached data
- Configuring queue connections, Horizon supervisors or the scheduler

## Pick the Rule

| About to write | Read |
|----------------|------|
| Slow or external work inside a request | `job-queue-slow-work`, `job-retries-and-backoff` |
| A job constructor | `job-serialize-ids-not-models`, `job-never-serialize-secrets` |
| A handler that may run twice | `job-idempotent-handlers` |
| Something that must happen after a write | `event-emit-for-side-effects`, `event-dispatch-after-commit` |
| A listener that sends mail or calls an API | `event-queue-side-effecting-listeners` |
| Caching an expensive read | `cache-read-heavy-endpoints`, `cache-stable-key-convention` |
| A fix for stale or cross-tenant cached data | `cache-invalidate-on-model-events`, `cache-tags-for-related-data` |
| A scheduler entry | `schedule-queue-work-not-inline`, `schedule-prevent-overlapping` |
| A fix for duplicate dispatches | `job-unique-jobs` |
| A job that calls a third-party API | `job-rate-limit-external-calls` |
| Queue configuration, or a job running twice | `job-retry-after-exceeds-timeout` |
| A notification or mailable | `event-queue-notifications-and-mailables` |
| The same lookup read all over one request | `cache-memoize-within-the-request` |

## Before You Write Code

- Every API named in these rules is verified against Laravel `^12.0 || ^13.0` and PHP `^8.3`. If you need something these rules do not name, check the docs — never infer an API from its name.
- Version-gated APIs are marked inline ("Laravel 13 only"). Read the project's `composer.json` first; on Laravel 12 use the fallback the rule gives.
- Where the project already differs from a rule, follow the project. Name the rule you set aside and why, rather than half-converting the codebase.
- When two rules collide, the higher-impact section wins — sections are ordered by impact.
- One example is not the whole rule. Open `rules/{slug}.md` before adapting it to a case the example does not show.

## Rule Sections by Priority

| # | Section | Impact | Prefix |
|---|---------|--------|--------|
| 1 | Jobs | CRITICAL | `job-` |
| 2 | Domain Events | HIGH | `event-` |
| 3 | Queue Operations | HIGH | `queue-` |
| 4 | Caching | HIGH | `cache-` |
| 5 | Scheduling | MEDIUM | `schedule-` |

## Quick Reference

### 1. Jobs (CRITICAL)

- `job-idempotent-handlers` — Running twice must equal running once
- `job-queue-slow-work` — Queue anything slow or externally dependent
- `job-retries-and-backoff` — Set tries, backoff and timeout on every job
- `job-serialize-ids-not-models` — Pass identifiers, not object graphs
- `job-never-serialize-secrets` — A credential never enters a job payload
- `job-retry-after-exceeds-timeout` — `retry_after` longer than any job's timeout
- `job-rate-limit-external-calls` — Throttle jobs that call a third-party API
- `job-unique-jobs` — Collapse duplicate dispatches with `ShouldBeUnique`
- `job-batches-and-chains` — Batches for fan-out, chains for ordered steps
- `job-handle-failure-explicitly` — Decide what happens after the last attempt
- `job-fail-fast-on-permanent-errors` — Stop retrying what cannot succeed

### 2. Domain Events (HIGH)

- `event-emit-for-side-effects` — Announce state changes, do not perform effects inline
- `event-past-tense-immutable` — Events are immutable and past tense
- `event-carry-identity-not-models` — Events carry identities, not Models
- `event-listeners-own-domain-only` — A listener touches only its own domain
- `event-queue-side-effecting-listeners` — Side-effecting listeners are queued
- `event-dispatch-after-commit` — Dispatch after the transaction commits
- `event-queue-notifications-and-mailables` — Queue them, and send after commit
- `event-outbox-for-must-deliver` — Commit the intent with the data when loss is unacceptable

### 3. Queue Operations (HIGH)

- `queue-separate-by-priority` — Separate queues by latency budget
- `queue-route-by-class` — Route jobs to queues centrally (Laravel 13)
- `queue-never-sync-in-production` — `sync` is for tests only
- `queue-restart-workers-on-deploy` — Workers keep old code until restarted
- `queue-monitor-depth-and-failures` — Depth, wait time and failure rate
- `queue-sqs-visibility-timeout` — On SQS the lease lives in AWS, not in config

### 4. Caching (HIGH)

- `cache-read-heavy-endpoints` — Cache in the Repository, cache results not models
- `cache-stable-key-convention` — Deterministic keys including every input
- `cache-invalidate-on-model-events` — Invalidate on write, not on a timer
- `cache-tags-for-related-data` — Tag related entries to flush a group
- `cache-lock-against-stampede` — One rebuild, not two hundred
- `cache-touch-to-extend-ttl` — Sliding expiry without a rewrite (Laravel 13)
- `cache-memoize-within-the-request` — Collapse repeat reads inside one request

### 5. Scheduling (MEDIUM)

- `schedule-queue-work-not-inline` — A scheduled task queues work
- `schedule-prevent-overlapping` — Stop a slow task stacking copies
- `schedule-run-on-one-server` — Exactly one server per task
- `schedule-monitor-and-alert` — Make silence itself the alert

## Version Notes

| Feature | Availability |
|---------|--------------|
| `#[Tries]`, `#[Backoff]`, `#[Timeout]`, `#[FailOnTimeout]` on jobs | Laravel 13+ |
| `Queue::route(JobClass::class, connection:, queue:)` | Laravel 13+ |
| `Cache::touch($key, $ttl)` | Laravel 13+ |
| `Cache::flexible($key, [$fresh, $stale], $callback)` | Laravel 11+ |
| `after_commit` on the queue connection | Laravel 8+ |

## Infrastructure Requirements

| Feature | Requires |
|---------|----------|
| `ShouldBeUnique`, `Cache::lock()`, `withoutOverlapping()`, `onOneServer()` | An atomic cache store — Redis, Memcached, DynamoDB or database. Not `file` or `array`. |
| `Cache::tags()` | Redis, Memcached or `array`. Not `file`, `database` or `dynamodb`. |
| `Bus::batch()` | The `job_batches` table |
| Failed-job retention | The `failed_jobs` table |
| `Cache::memo()` | Laravel 12.9+ |
| `failover` cache driver | Laravel 12.35+ |

## Reference Material

- `references/idempotency-patterns.md` — the four ways to make a handler repeat-safe
- `references/cache-invalidation-playbook.md` — choosing TTL, tags, versions or events
- `references/checklist.md` — pre-merge self-check for async work

## How to Use

Load in this order and stop when the answer is clear:

1. This file — the Quick Reference names every rule, and usually settles the question.
2. One rule file for the reasoning and both examples (~397 tokens each):

```
rules/job-idempotent-handlers.md
rules/cache-invalidate-on-model-events.md
```

3. A `references/` file only when a rule points at one.

`AGENTS.md` is every rule compiled into one document (~11k tokens), for agents that read the AGENTS.md convention. Do not load it when the individual rule files are reachable.

## Related Skills

- `laravel-engineering` — trace callers and effects, preserve failures, and verify the changed path
- `laravel-patterns` — where events, listeners and their contracts live across domains
- `laravel-eloquent` — transactions, `after_commit` and bulk writes that skip observers
- `laravel-rest-api` — returning 202 and a pollable resource instead of blocking
- `laravel-testing` — `Queue::fake()`, `Bus::fake()`, `Event::fake()` and testing idempotency
