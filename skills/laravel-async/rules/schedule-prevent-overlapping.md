---
title: Prevent Overlapping Runs
impact: HIGH
impactDescription: stops a slow task stacking copies of itself
tags: scheduling, locking, concurrency, correctness
---

## Prevent Overlapping Runs

A task scheduled every five minutes that occasionally takes seven starts a second copy while the first is still running. Two copies process the same rows, double-send, and contend for the same locks — and each run makes the next one slower.

`withoutOverlapping()` takes a lock for the duration. Give it an expiry so a crashed run does not block the task forever.

**Incorrect:**

```php
Schedule::command('orders:expire-abandoned')->everyFiveMinutes();
// Run at 10:00 still going at 10:05 → two processes expiring the same orders.
```

**Correct:**

```php
Schedule::command('orders:expire-abandoned')
    ->everyFiveMinutes()
    ->withoutOverlapping(10);       // lock expires after 10 minutes
```

```php
// For a task with a per-tenant key, lock inside the job instead:
final class ExpireAbandonedOrders implements ShouldQueue, ShouldBeUnique
{
    public int $uniqueFor = 600;

    public function uniqueId(): string
    {
        return (string) $this->tenantId;
    }
}
```

The lock lives in the cache, so an atomic store is required — the same requirement as unique jobs. Pick an expiry longer than the worst observed run time and shorter than the interval times two.

When the work is an unbounded cursor rather than a fixed batch, bound it by time as well: `->takeUntilTimeout(now()->addMinutes(13))` on the LazyCollection ends the pass before the next tick, leaving the remainder for the following run.
