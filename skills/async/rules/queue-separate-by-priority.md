---
title: Separate Queues by Priority and Latency Budget
impact: HIGH
impactDescription: a bulk backfill stops delaying password-reset emails
tags: queues, priority, workers, latency
---

## Separate Queues by Priority and Latency Budget

One default queue means a 50,000-job import sits in front of the password-reset email dispatched a second later. Split by how long a user is willing to wait, and give each queue its own worker allocation.

A workable default: `high` (user-facing, seconds), `default` (normal), `low` (bulk, minutes to hours).

**Incorrect (everything on one queue, one worker pool):**

```php
SendPasswordReset::dispatch($user);
RebuildSearchIndex::dispatch($merchant);    // 40 minutes
GenerateMonthlyStatements::dispatch();      // 200,000 jobs
```

**Correct:**

```php
SendPasswordReset::dispatch($user)->onQueue('high');
RebuildSearchIndex::dispatch($merchant)->onQueue('low');

// Or declared on the job, so no caller has to remember:
final class RebuildSearchIndex implements ShouldQueue
{
    public string $queue = 'low';
}
```

```bash
# Workers drain in the listed order per poll
php artisan queue:work redis --queue=high,default,low
```

```php
// config/horizon.php — separate pools, so 'low' cannot starve 'high'
'supervisor-high' => ['queue' => ['high'], 'maxProcesses' => 10, 'balance' => 'auto'],
'supervisor-bulk' => ['queue' => ['default', 'low'], 'maxProcesses' => 4],
```

Add a dedicated queue for anything with a distinct rate limit — a per-vendor webhook queue, for instance.
