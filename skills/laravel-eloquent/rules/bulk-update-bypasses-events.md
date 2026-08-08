---
title: Bulk Writes Skip Model Events — Handle That Deliberately
impact: HIGH
impactDescription: prevents silently skipped observers, audit rows and cache invalidation
tags: bulk, events, observers, correctness
---

## Bulk Writes Skip Model Events — Handle That Deliberately

`Model::query()->update()`, `->delete()`, `insert()` and `upsert()` run one SQL statement without hydrating models. No `saving`, `saved`, `updating`, `updated`, `deleting` or `deleted` event fires, so observers, audit trails and cache invalidation do not run.

That is usually the point — it is why the bulk write is fast. Make the decision explicit and cover the side effects yourself.

**Incorrect (cache never invalidated, no audit row, nobody notices for months):**

```php
Order::where('status', 'pending')
    ->where('created_at', '<=', now()->subHours(2))
    ->update(['status' => 'expired']);
// OrderObserver::updated() — which flushes the cache tag — never ran.
```

**Correct — either fire the effect explicitly:**

```php
$count = $this->orders->expireAbandoned(CarbonImmutable::now()->subHours(2));

if ($count > 0) {
    Cache::tags(['orders'])->flush();
    OrdersExpired::dispatch($count);
}
```

**Or iterate when per-row effects genuinely matter:**

```php
Order::query()
    ->where('status', OrderStatus::Pending)
    ->where('created_at', '<=', $cutoff)
    ->chunkById(500, fn (Collection $orders) => $orders->each->update(['status' => OrderStatus::Expired]));
```

Choose by cost: thousands of rows with a required per-row side effect is a queued job over chunks, not a single bulk statement.
