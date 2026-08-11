---
title: Fire Side Effects After Commit
impact: HIGH
impactDescription: stops workers reading rows that were rolled back
tags: transactions, queues, events, race-condition
---

## Fire Side Effects After Commit

A job dispatched inside a transaction can be picked up by a worker before the transaction commits — the worker then queries for a row that does not exist yet, or that never will if the transaction rolls back. The failure is intermittent and load-dependent, which makes it expensive to diagnose.

Two fixes, both correct: set `after_commit` on the queue connection, or use `DB::afterCommit()` / `->afterCommit()` per dispatch.

**Incorrect (worker races the commit):**

```php
DB::transaction(function () use ($data): void {
    $order = Order::create($data);
    ProcessOrder::dispatch($order->id);           // may run before COMMIT
    OrderPlaced::dispatch($order->id);
});
```

**Correct (global setting):**

```php
// config/queue.php
'redis' => [
    // ...
    'after_commit' => true,
],
```

**Correct (explicit, per dispatch):**

```php
DB::transaction(function () use ($data): void {
    $order = Order::create($data);

    ProcessOrder::dispatch($order->id)->afterCommit();

    DB::afterCommit(fn () => OrderPlaced::dispatch($order->tenantId(), $order->id()));
});
```

The connection setting reaches queued event listeners, mailables, notifications and broadcast events as well as jobs, and a rollback discards every one of them. Where `after_commit` is on globally and a particular dispatch must not wait, `->beforeCommit()` opts that one out.
