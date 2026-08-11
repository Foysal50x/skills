---
title: Decide What Happens When a Job Finally Fails
impact: HIGH
impactDescription: failures become visible and recoverable instead of silent
tags: jobs, failure, observability, resilience
---

## Decide What Happens When a Job Finally Fails

After the last attempt a job lands in `failed_jobs` and, by default, nothing else happens. For anything a user is waiting on, that is a silent failure: no notification, no state change, no alert.

Implement `failed()` to record the outcome, and monitor the failed queue.

**Incorrect (the export row stays "processing" forever):**

```php
final class GenerateOrderExport implements ShouldQueue
{
    public int $tries = 3;

    public function handle(): void { /* ... */ }
}
```

**Correct:**

```php
final class GenerateOrderExport implements ShouldQueue
{
    public int $tries = 3;

    public function handle(): void { /* ... */ }

    public function failed(?Throwable $e): void
    {
        // A per-row write, so the export's observers still fire.
        Export::find($this->exportId)?->markFailed(now());

        report($e);

        Notification::route('slack', config('alerts.slack'))
            ->notify(new ExportFailed($this->exportId));
    }
}
```

```php
// Global hook for cross-cutting alerting, in AppServiceProvider::boot():
Queue::failing(function (JobFailed $event): void {
    Log::error('queue.job_failed', [
        'connection' => $event->connectionName,
        'job' => $event->job->resolveName(),
        'exception' => $event->exception->getMessage(),
    ]);
});
```

Alert on failed-job count, not just on a dashboard nobody opens. Retry with `php artisan queue:retry` once the cause is fixed.
