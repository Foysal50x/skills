---
title: Monitor Queue Depth, Wait Time and Failures
impact: HIGH
impactDescription: turns a silent backlog into a page
tags: queues, monitoring, observability, horizon
---

## Monitor Queue Depth, Wait Time and Failures

A queue fails quietly. Jobs pile up, latency grows, and nothing surfaces until a user reports that an email never arrived. Three signals catch almost everything: queue depth, oldest-job wait time, and failed-job rate.

**Incorrect (no visibility, discovered by a support ticket):**

```bash
php artisan queue:work redis
# Nothing watches it.
```

**Correct (Horizon thresholds, plus an external check):**

```php
// config/horizon.php
'waits' => [
    'redis:high' => 30,       // alert if a high-priority job waits over 30s
    'redis:default' => 300,
    'redis:low' => 3600,
],
```

```php
// Structured log plus a windowed counter, on every failure:
Queue::failing(function (JobFailed $e): void {
    Log::error('queue.job_failed', [
        'job' => $e->job->resolveName(),
        'queue' => $e->job->getQueue(),
    ]);

    $bucket = 'queue:failures:'.now()->format('YmdH');
    Cache::add($bucket, 0, now()->addHours(3));
    Cache::increment($bucket);
});
```

```php
// A health endpoint your monitor can poll
final class QueueHealthController
{
    public function __invoke(): JsonResponse
    {
        $depth = Queue::size('high');
        $failuresThisHour = (int) Cache::get('queue:failures:'.now()->format('YmdH'), 0);

        return response()->json(
            ['queue_depth' => $depth, 'failures_this_hour' => $failuresThisHour],
            $depth > 1000 || $failuresThisHour > 50 ? 503 : 200,
        );
    }
}
```

Threshold on a rate, not on `FailedJobProviderInterface::count()`. That count is every failure ever recorded in `failed_jobs`, so once the table has accumulated enough history the endpoint reports 503 forever and the signal is gone.

Laravel Pulse and Horizon both cover this; the point is that something alerts, not which tool does it.
