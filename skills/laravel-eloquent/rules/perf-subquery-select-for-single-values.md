---
title: Pull a Single Related Value With a Subquery
impact: HIGH
impactDescription: one query instead of two, and no rows hydrated to be thrown away
tags: performance, subquery, relationships, eager-loading
---

## Pull a Single Related Value With a Subquery

Eager-loading a whole has-many to read one column runs a second query and hydrates every row so you can discard all but one. A correlated subquery in `addSelect()` returns the value inside the query you were already running.

Add `withCasts()` so the column arrives as a `CarbonImmutable`, an enum or a decimal rather than a raw string.

**Incorrect (every payment loaded so one timestamp can be read):**

```php
$orders = Order::with('payments')->get();

foreach ($orders as $order) {
    echo $order->payments->max('created_at');
}
```

**Correct (the value comes back on the row):**

```php
// On the model
#[Scope]   // Laravel 12.4+; use the scope prefix below that
protected function withLastPaidAt(Builder $query): void
{
    $query->addSelect([
        'last_paid_at' => Payment::select('created_at')
            ->whereColumn('order_id', 'orders.id')
            ->latest()
            ->take(1),
    ])->withCasts(['last_paid_at' => 'immutable_datetime']);
}

// In the Query Class
Order::query()->withLastPaidAt()->where('merchant_id', $merchantId);
```

When the whole related model is needed, select its key the same way and declare a `belongsTo` on that column — one extra query for the entire page, each row fully hydrated:

```php
public function lastPayment(): BelongsTo
{
    return $this->belongsTo(Payment::class, 'last_payment_id');
}

#[Scope]
protected function withLastPayment(Builder $query): void
{
    $query->addSelect([
        'last_payment_id' => Payment::select('id')
            ->whereColumn('order_id', 'orders.id')
            ->latest()
            ->take(1),
    ])->with('lastPayment');
}
```

The subquery needs an index on `(order_id, created_at)` to stay cheap — see `rules/perf-index-filtered-columns.md`.
