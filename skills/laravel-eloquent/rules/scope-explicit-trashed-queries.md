---
title: Be Explicit When Querying Trashed Rows
impact: MEDIUM
impactDescription: makes "why is this row missing?" answerable from the query
tags: soft-deletes, query, clarity
---

## Be Explicit When Querying Trashed Rows

`withTrashed()` and `onlyTrashed()` change what a query means. Put them in the Query Class, name the query accordingly, and never scatter them through Actions or controllers.

A restore flow needs `withTrashed()`; an audit report needs `onlyTrashed()`; everything else needs neither.

**Incorrect (opt-out sprinkled at the call site, intent unclear):**

```php
$order = Order::withTrashed()->find($id);         // in a controller — why?
$orders = Order::withTrashed()->where(...)->get(); // and here
```

**Correct (the query name says what it includes):**

```php
final readonly class RestorableOrderQuery
{
    public function handle(int $id): ?Order
    {
        return Order::query()->withTrashed()->find($id);
    }
}

final readonly class DeletedOrdersForAuditQuery
{
    public function handle(DateRange $period): Builder
    {
        return Order::query()->onlyTrashed()->whereBetween('deleted_at', [$period->from, $period->to]);
    }
}
```

```php
// Repository exposes the intent:
$orders->restorableOrder($id);
$orders->deletedForAudit($period);
```

Note that `restore()` fires `restoring`/`restored` events, while `forceDelete()` is permanent and skips nothing — treat it as a separate, authorized operation.
