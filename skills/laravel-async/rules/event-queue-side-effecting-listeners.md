---
title: Queue Side-Effecting Listeners
impact: HIGH
impactDescription: a failing consumer stops breaking the producer's request
tags: events, listeners, queues, resilience
---

## Queue Side-Effecting Listeners

A synchronous listener runs inside the producer's request. A slow one adds its latency to the response; a failing one throws into the Action that dispatched the event, potentially rolling back a transaction that had nothing to do with it.

Anything with a side effect — mail, HTTP, file writes, cross-domain writes — implements `ShouldQueue`. Pure in-memory projections may stay inline.

**Incorrect (the order fails because the analytics endpoint is down):**

```php
final class TrackOrderPlaced
{
    public function handle(OrderPlaced $event): void
    {
        Http::post(config('analytics.url'), ['order' => $event->orderId->value]);
    }
}
```

**Correct:**

```php
final class TrackOrderPlaced implements ShouldQueue
{
    public string $queue = 'low';
    public int $tries = 3;

    public function backoff(): array
    {
        return [10, 60, 300];
    }

    public function handle(OrderPlaced $event): void
    {
        Http::timeout(5)
            ->post(config('analytics.url'), ['order' => $event->orderId->value])
            ->throw();   // a 500 must fail the job, not pass silently
    }

    public function failed(OrderPlaced $event, Throwable $e): void
    {
        report($e);   // analytics loss is acceptable; silence is not
    }
}
```

A queued listener runs more than once, so `rules/job-idempotent-handlers.md` applies to it exactly as it does to a job.
