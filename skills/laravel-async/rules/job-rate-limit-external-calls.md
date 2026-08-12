---
title: Rate Limit Jobs That Call an External API
impact: MEDIUM-HIGH
impactDescription: the queue stops turning a backlog into a 429 storm
tags: jobs, rate-limiting, middleware, external-api
---

## Rate Limit Jobs That Call an External API

Ten workers draining a backlog will hit a third-party API as fast as the network allows. The provider answers with 429s, every job fails, all of them retry, and the retries produce the same burst. Backoff on the job does not help — the limit is global, not per job.

Define the limiter once and apply it as job middleware, which releases the job back to the queue instead of consuming an attempt.

**Incorrect (concurrency decided by how many workers happen to be running):**

```php
final class SyncContactToCrm implements ShouldQueue
{
    public int $tries = 5;
    public array $backoff = [10, 30, 60];

    public function handle(CrmClient $crm): void
    {
        $crm->upsert($this->contactId);   // 429 as soon as the queue has depth
    }
}
```

**Correct:**

```php
// AppServiceProvider::boot()
RateLimiter::for('crm', fn () => Limit::perMinute(60));
```

```php
final class SyncContactToCrm implements ShouldQueue
{
    public int $tries = 25;   // a throttled release counts as an attempt

    /** @return list<object> */
    public function middleware(): array
    {
        return [new RateLimited('crm')];
    }
}
```

`RateLimited` releases a throttled job back to the queue with a delay taken from the limiter. A release still increments the attempt counter, so a job that is throttled repeatedly will exhaust `$tries` without ever having run — give it a generous `$tries`, or time-box it with `retryUntil()` instead.

Do not reach for `dontRelease()` to "make the job wait". It makes the middleware return `false`, so the throttled job is neither run nor released, and the worker deletes it. The work is silently dropped. Use it only when losing the job is genuinely acceptable.

For a limit that is about not overlapping rather than not exceeding a rate, use `WithoutOverlapping` keyed by the resource.
