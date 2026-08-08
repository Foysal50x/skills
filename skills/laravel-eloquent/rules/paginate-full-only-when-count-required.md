---
title: Reserve paginate() for a Genuinely Required Count
impact: MEDIUM
impactDescription: makes the expensive default a deliberate choice
tags: pagination, count, performance, api-design
---

## Reserve paginate() for a Genuinely Required Count

Default to `simplePaginate()` or `cursorPaginate()`. Reach for `paginate()` when the count is part of the product — a result total, a page picker, a report header.

When the count is wanted but expensive, decouple it: return the page with a cheap paginator and expose the total separately, cached or approximate.

**Incorrect (an exact count of 12 million rows, recomputed per keystroke):**

```php
return Order::query()->where('status', $status)->paginate(25);
// Frontend renders: "About 12,481,203 results"
```

**Correct (separate the two questions):**

```php
interface OrderRepositoryInterface
{
    public function searchOrders(OrderQueryFilter $filter, int $perPage = 25): Paginator;

    /** Cached for 60s; the header does not need to be exact. */
    public function countMatching(OrderQueryFilter $filter): int;
}
```

```php
public function countMatching(OrderQueryFilter $filter): int
{
    return Cache::remember(
        'orders:count:'.md5(serialize($filter)),
        now()->addMinute(),
        fn () => $this->searchOrders->handle($filter)->count(),
    );
}
```
