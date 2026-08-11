---
title: Sort by a Related Value With a Subquery, Not a Join
impact: MEDIUM-HIGH
impactDescription: keeps row counts and pagination totals correct
tags: performance, sorting, subquery, pagination
---

## Sort by a Related Value With a Subquery, Not a Join

Joining a has-many to sort by one of its columns multiplies the parent row by the number of children. The page then contains duplicates, `paginate()`'s `COUNT` reports the joined total, and adding `distinct()` to fix it forces a sort of the whole result.

A correlated subquery inside `orderBy()` sorts the parent rows without changing how many there are.

**Incorrect (one order per payment, and a total nobody can explain):**

```php
return Order::query()
    ->leftJoin('payments', 'payments.order_id', '=', 'orders.id')
    ->orderByDesc('payments.created_at')
    ->paginate(25);
```

**Correct:**

```php
#[Scope]
protected function orderByLastPaidAt(Builder $query, Direction $direction = Direction::Desc): void
{
    $query->orderBy(
        Payment::select('created_at')
            ->whereColumn('order_id', 'orders.id')
            ->latest()
            ->take(1),
        $direction->value,
    );
}

// In the Query Class
return Order::query()
    ->withLastPaidAt()
    ->orderByLastPaidAt()
    ->paginate(25);
```

Pair it with the `addSelect()` scope from `rules/perf-subquery-select-for-single-values.md` so the value you sorted by is also displayable, and index `(order_id, created_at)` on the child table.

The direction still comes from an allow-list — see `rules/perf-index-filtered-columns.md` for the index and the `laravel-patterns` skill for the sortable-column whitelist.
