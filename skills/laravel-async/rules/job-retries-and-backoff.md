---
title: Set Tries, Backoff and Timeout on Every Job
impact: CRITICAL
impactDescription: the difference between a transient blip and a stuck queue
tags: jobs, retries, backoff, resilience
---

## Set Tries, Backoff and Timeout on Every Job

The defaults are wrong for most jobs. Unlimited tries turn a permanently failing job into an infinite loop that starves the queue. No backoff hammers an upstream that is already struggling. No timeout lets one hung HTTP call occupy a worker forever.

Set all three explicitly, with exponential backoff for anything that talks to a network.

**Incorrect (retries immediately and forever against a rate-limited API):**

```php
final class SyncToUpstream implements ShouldQueue
{
    public function handle(): void
    {
        Http::post('https://upstream.test/sync', $this->payload);
    }
}
```

**Correct:**

```php
final class SyncToUpstream implements ShouldQueue
{
    public int $tries = 5;
    public int $timeout = 30;
    public int $maxExceptions = 3;

    /** Exponential backoff with a ceiling: 10s, 30s, 2m, 5m, 10m. */
    public function backoff(): array
    {
        return [10, 30, 120, 300, 600];
    }

    /** Stop retrying after this instant regardless of attempts left. */
    public function retryUntil(): DateTimeInterface
    {
        return now()->addHours(6);
    }
}
```

**Laravel 13 — the same thing as attributes:**

```php
use Illuminate\Queue\Attributes\{Backoff, FailOnTimeout, Timeout, Tries};

#[Tries(5)]
#[Backoff([10, 30, 120, 300, 600])]
#[Timeout(30)]
#[FailOnTimeout]
final class SyncToUpstream implements ShouldQueue
{
    // ...
}
```

Add jitter when many jobs retry together, or they synchronize into a thundering herd.
