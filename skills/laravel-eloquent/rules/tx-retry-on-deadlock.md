---
title: Let Transactions Retry on Deadlock
impact: MEDIUM
impactDescription: turns an intermittent 500 into a retried success
tags: transactions, deadlock, resilience
---

## Let Transactions Retry on Deadlock

Deadlocks are normal under concurrency — two transactions grab the same rows in different orders and the database kills one. `DB::transaction()` accepts an attempt count and retries the whole closure when that happens.

The closure must be safe to re-run: no external calls, no accumulating state, no dispatching inside it.

**Incorrect (a single attempt, so a routine deadlock surfaces as a 500):**

```php
DB::transaction(function () use ($order): void {
    $order->update(['status' => OrderStatus::Paid]);
    $order->merchant->increment('balance', $order->total);
});
```

**Correct:**

```php
DB::transaction(function () use ($order): void {
    $order->update(['status' => OrderStatus::Paid]);
    $order->merchant->increment('balance', $order->total);
}, attempts: 3);
```

Two things reduce deadlocks more than retrying does: acquiring locks in a consistent order across all code paths, and keeping transactions short (`rules/tx-keep-transactions-short.md`).
