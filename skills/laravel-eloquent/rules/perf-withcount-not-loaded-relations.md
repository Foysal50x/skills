---
title: Count With withCount(), Never With a Loaded Collection
impact: HIGH
impactDescription: replaces N queries and N hydrated collections with one aggregate
tags: performance, counting, aggregates, n-plus-one
---

## Count With withCount(), Never With a Loaded Collection

`$order->items->count()` either fires a query per row or loads every child model to count them. `withCount()` adds a subquery aggregate to the original query and returns `items_count` as an integer.

Aliased closures give conditional counts in the same pass, and `withExists()` answers a yes/no question without counting at all.

**Incorrect (a collection loaded per order, to render a number):**

```php
$orders = Order::all();

foreach ($orders as $order) {
    echo $order->items->count();
    echo $order->refunds->count();
}
```

**Correct:**

```php
$orders = Order::query()
    ->withCount([
        'items',
        'items as digital_items_count' => fn (Builder $q) => $q->where('is_digital', true),
        'refunds',
    ])
    ->withExists('disputes')
    ->get();

foreach ($orders as $order) {
    echo $order->items_count;
    echo $order->digital_items_count;
    echo $order->disputes_exists ? 'disputed' : 'clear';
}
```

`withCount()` on a paginated list is charged per row on the page, not per row in the table — but the child table still needs the foreign-key index. When you need the count *and* the rows, `with()` plus `$order->items->count()` is correct: the collection is already in memory. See `rules/perf-exists-not-count.md` for the query-level version.
