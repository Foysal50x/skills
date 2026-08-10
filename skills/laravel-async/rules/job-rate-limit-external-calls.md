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
    public int $tries = 5;

    /** @return list<object> */
    public function middleware(): array
    {
        return [(new RateLimited('crm'))->dontRelease()];
    }
}
```

`RateLimited` releases the job with a delay by default, so a throttled job returns to the queue rather than burning an attempt. `dontRelease()` is for the case where you would rather the job wait in the worker than churn the queue.

For a limit that is about not overlapping rather than not exceeding a rate, use `WithoutOverlapping` keyed by the resource.
