---
title: Replace whereHas With a Join or Denormalized Column on Hot Paths
impact: MEDIUM
impactDescription: removes a correlated subquery from the critical path
tags: performance, whereHas, joins, indexing
---

## Replace whereHas With a Join or Denormalized Column on Hot Paths

`whereHas()` compiles to a correlated `EXISTS` subquery. That is fine for an admin filter and expensive on a hot listing over millions of rows, especially combined with pagination's `COUNT`.

Measure first. When it is the bottleneck, the options are a join, a `whereIn` over a narrow subquery, or a denormalized column kept current by an observer.

**Incorrect (a correlated subquery per row, on the busiest endpoint):**

```php
return Order::query()
    ->whereHas('customer', fn (Builder $q) => $q->where('tier', 'enterprise'))
    ->whereHas('items.product', fn (Builder $q) => $q->where('category_id', $categoryId))
    ->paginate(25);
```

**Correct (join for the selective condition, index the join keys):**

```php
return Order::query()
    ->select('orders.*')
    ->join('customers', 'customers.id', '=', 'orders.customer_id')
    ->where('customers.tier', 'enterprise')
    ->whereIn('orders.id', fn (QueryBuilder $q) => $q
        ->select('order_id')
        ->from('order_items')
        ->join('products', 'products.id', '=', 'order_items.product_id')
        ->where('products.category_id', $categoryId))
    ->paginate(25);
```

Both versions live in the Query Class, so swapping one for the other changes one file. Add `->distinct()` or group when the join can multiply rows.
