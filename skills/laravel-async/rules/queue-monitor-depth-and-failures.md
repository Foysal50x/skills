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
// A health endpoint your monitor can poll
final class QueueHealthController
{
    public function __invoke(): JsonResponse
    {
        $depth = Queue::size('high');
        $failed = app(FailedJobProviderInterface::class)->count();

        return response()->json(
            ['queue_depth' => $depth, 'failed_jobs' => $failed],
            $depth > 1000 || $failed > 50 ? 503 : 200,
        );
    }
}
```

```php
// Structured log on every failure, for alerting rules:
Queue::failing(fn (JobFailed $e) => Log::error('queue.job_failed', [
    'job' => $e->job->resolveName(),
    'queue' => $e->job->getQueue(),
]));
```

Laravel Pulse and Horizon both cover this; the point is that something alerts, not which tool does it.
