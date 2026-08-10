---
title: Run Each Scheduled Task on Exactly One Server
impact: HIGH
impactDescription: prevents duplicate execution across a horizontally-scaled fleet
tags: scheduling, distributed, locking, operations
---

## Run Each Scheduled Task on Exactly One Server

With the scheduler cron installed on three application servers, every task fires three times. Three statement runs, three emails, three sets of expired orders.

`onOneServer()` uses an atomic cache lock so only the first server to claim the minute runs the task.

**Incorrect (the same task on every node):**

```php
Schedule::job(new DispatchMonthlyStatements())->monthlyOn(1, '02:00');
// Three servers → three runs → three statements per merchant.
```

**Correct:**

```php
Schedule::job(new DispatchMonthlyStatements())
    ->monthlyOn(1, '02:00')
    ->onOneServer()
    ->withoutOverlapping();
```

Requirements and caveats:

- A shared atomic cache store — Redis, Memcached, DynamoDB or database. A per-server `file` store gives every server its own lock, which defeats the purpose.
- All servers must share the same `config('cache.prefix')`, or the locks live in different keyspaces.
- Named closures need `->name('...')` so the lock key is stable across servers.

The alternative — running the cron on only one designated node — creates a single point of failure. Prefer the lock.

Shared settings belong on a group rather than repeated per entry — one place to change, and no task that quietly missed the flag:

```php
Schedule::daily()->onOneServer()->timezone('Europe/London')->group(function (): void {
    Schedule::job(new PruneExports)->name('prune-exports');
    Schedule::job(new SendDigests)->name('send-digests');
});
```
