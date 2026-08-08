---
title: Use Batches for Fan-Out and Chains for Ordered Steps
impact: MEDIUM-HIGH
impactDescription: progress, cancellation and completion callbacks for free
tags: jobs, batches, chains, orchestration
---

## Use Batches for Fan-Out and Chains for Ordered Steps

- **Batch** — many independent jobs, run in parallel, with progress tracking, cancellation and a `then`/`catch`/`finally` callback when all are done.
- **Chain** — steps that must run in order, where a failure stops the rest.

Hand-rolling either with a counter row or a job that dispatches the next one loses the failure handling.

**Incorrect (no progress, no completion hook, failures invisible):**

```php
foreach ($merchants as $merchant) {
    GenerateMonthlyStatement::dispatch($merchant->id);
}
// How do you know when they are all done? You do not.
```

**Correct (batch):**

```php
$batch = Bus::batch(
    $merchants->map(fn (Merchant $m) => new GenerateMonthlyStatement($m->id))->all(),
)
    ->name('monthly-statements')
    ->allowFailures()
    ->then(fn (Batch $batch) => StatementRunCompleted::dispatch($batch->id))
    ->catch(fn (Batch $batch, Throwable $e) => report($e))
    ->dispatch();

return response()->json(['batch_id' => $batch->id]);
```

**Correct (chain, when order matters):**

```php
Bus::chain([
    new ExtractOrders($exportId),
    new WriteSpreadsheet($exportId),
    new UploadToStorage($exportId),
    new NotifyRequester($exportId),
])->onQueue('exports')->dispatch();
```

Batches need the `job_batches` table (`php artisan queue:batches-table`). Inside a batched job, check `$this->batch()?->cancelled()` before doing expensive work.
