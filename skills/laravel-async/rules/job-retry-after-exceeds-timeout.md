---
title: Keep retry_after Longer Than Any Job's Timeout
impact: CRITICAL
impactDescription: stops a running job from being executed a second time
tags: jobs, queue, configuration, duplication, timeout
---

## Keep retry_after Longer Than Any Job's Timeout

`retry_after` on the queue connection is how long the worker waits before deciding a reserved job died and releasing it back to the queue. If a job is still running when that timer expires, a second worker picks it up — two copies of the same charge, the same export, the same email.

The rule is one line: `retry_after` must exceed the longest `timeout` of any job on that connection, plus its startup cost.

**Incorrect (a two-minute job on a ninety-second lease):**

```php
final class GenerateMonthlyStatements implements ShouldQueue
{
    public int $timeout = 120;
}
```

```php
// config/queue.php
'redis' => [
    'driver' => 'redis',
    'retry_after' => 90,      // job is re-dispatched while the first copy is still working
],
```

**Correct:**

```php
// config/queue.php — one connection per timeout class
'redis' => [
    'driver' => 'redis',
    'queue' => 'default',
    'retry_after' => 180,
],

'redis-long' => [
    'driver' => 'redis',
    'queue' => 'reports',
    'retry_after' => 3600,    // exports may legitimately run for 45 minutes
],
```

```php
final class GenerateMonthlyStatements implements ShouldQueue
{
    public int $timeout = 120;
    public string $connection = 'redis';
}
```

Horizon's `timeout` supervisor setting must be lower than `retry_after` for the same reason. Idempotent handlers are the backstop when this is wrong — see `rules/job-idempotent-handlers.md` — but the configuration is the fix.
