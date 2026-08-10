---
title: Chunk or Stream Large Result Sets
impact: HIGH
impactDescription: keeps memory flat regardless of table size
tags: performance, memory, chunk, lazy, export
---

## Chunk or Stream Large Result Sets

`get()` loads every matching row into memory. For exports, backfills and migrations, iterate in batches instead.

- `chunkById()` / `lazyById()` — safe when the loop modifies the rows it is reading. Plain `chunk()` uses `OFFSET` and skips rows when the result set shifts underneath it.
- `cursor()` — one query, one model at a time, but the database still buffers the full result.
- `lazyById()` returns a `LazyCollection`, so `map`, `filter` and `each` work as usual.

**Incorrect (400 MB of models, and rows skipped as the update shifts the offset):**

```php
foreach (Order::where('status', 'pending')->get() as $order) {
    $order->update(['status' => 'expired']);
}

Order::where('status', 'pending')->chunk(500, function ($orders) {
    $orders->each->update(['status' => 'expired']);   // OFFSET drift skips rows
});
```

**Correct:**

```php
Order::query()
    ->where('status', OrderStatus::Pending)
    ->chunkById(500, function (Collection $orders): void {
        $orders->each->update(['status' => OrderStatus::Expired]);
    });

// Streaming an export:
return Order::query()
    ->where('status', OrderStatus::Paid)
    ->lazyById(1000)
    ->map(fn (Order $order) => [$order->number, $order->total]);
```

Wrap the iteration in a Query Class so the batching rule lives with the query.

One trap in the list above: `cursor()` silently ignores `with()`, so every relation access inside the loop is a fresh query. Use `lazy()` or `lazyById()` when the loop reads relations, and keep `cursor()` for attribute-only passes.
