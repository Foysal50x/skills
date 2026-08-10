---
title: Make Jobs Unique When Duplicates Are Wasteful or Wrong
impact: HIGH
impactDescription: collapses a storm of duplicate dispatches into one
tags: jobs, uniqueness, locking, queues
---

## Make Jobs Unique When Duplicates Are Wasteful or Wrong

A webhook that fires five times, or a model observer on a busy row, dispatches the same job five times. `ShouldBeUnique` keeps one queued at a time for a given key; `ShouldBeUniqueUntilProcessing` releases the lock when the job starts rather than when it finishes.

Uniqueness is not idempotency — it reduces duplicates but does not eliminate them. You still need `rules/job-idempotent-handlers.md`.

**Incorrect (five identical rebuilds queued, four of them wasted):**

```php
final class RebuildSearchIndex implements ShouldQueue
{
    public function __construct(private readonly int $merchantId) {}
}
```

**Correct:**

```php
final class RebuildSearchIndex implements ShouldQueue, ShouldBeUnique
{
    public int $uniqueFor = 300;   // lock expires after 5 minutes, in case of a crash

    public function __construct(private readonly int $merchantId) {}

    public function uniqueId(): string
    {
        return (string) $this->merchantId;
    }
}
```

```php
// Release the lock as soon as processing starts, so a change made during
// the run still queues a follow-up:
final class RebuildSearchIndex implements ShouldQueue, ShouldBeUniqueUntilProcessing
{
    // ...
}
```

Uniqueness requires a cache driver with atomic locks — Redis, Memcached, DynamoDB or a database store. The `array` and `file` drivers will not do it correctly across processes.

`ShouldBeUnique` holds the lock until the job finishes, so a change made while it runs is dropped. `ShouldBeUniqueUntilProcessing` releases the lock as processing starts, which is what you want for a job that rebuilds current state — a search-index or cache refresh.
