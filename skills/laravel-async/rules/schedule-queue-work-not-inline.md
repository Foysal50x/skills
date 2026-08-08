---
title: A Scheduled Task Queues Work, It Does Not Do It
impact: MEDIUM-HIGH
impactDescription: keeps the scheduler loop free and the work retryable
tags: scheduling, jobs, queues, resilience
---

## A Scheduled Task Queues Work, It Does Not Do It

The scheduler runs every minute in a single process. Work performed inline blocks the next tick, has no retry, and vanishes if the process is killed mid-run.

The scheduled entry should decide *what* needs doing and dispatch jobs. The jobs do the work, with the retry and failure handling jobs already have.

**Incorrect (an hour of work inside the scheduler, no retries):**

```php
Schedule::call(function (): void {
    foreach (Merchant::all() as $merchant) {
        $rows = $this->reports->monthly($merchant->id);
        (new FastExcel($rows))->export(storage_path("statements/{$merchant->id}.xlsx"));
        Mail::to($merchant->email)->send(new StatementReady());
    }
})->monthlyOn(1, '02:00');
```

**Correct:**

```php
Schedule::job(new DispatchMonthlyStatements())->monthlyOn(1, '02:00');
```

```php
final class DispatchMonthlyStatements implements ShouldQueue
{
    public function handle(): void
    {
        Merchant::query()
            ->where('statements_enabled', true)
            ->lazyById(500)
            ->each(fn (Merchant $m) => GenerateMonthlyStatement::dispatch($m->id)->onQueue('low'));
    }
}
```

`Schedule::command()` is fine for genuinely short tasks — a cleanup, a health ping. The dividing line is whether losing the run mid-way matters.
