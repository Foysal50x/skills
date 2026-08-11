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
        $this->countKey($filter),
        now()->addMinute(),
        fn (): int => $this->searchOrders->handle($filter)->count(),
    );
}

private function countKey(OrderQueryFilter $filter): string
{
    // Every field that changes which rows match — sorting does not.
    $fingerprint = [
        'merchant' => $filter->merchantId,
        'status' => $filter->status?->value,
        'from' => $filter->dateRange?->from?->toDateString(),
        'to' => $filter->dateRange?->to?->toDateString(),
        'search' => $filter->search,
    ];

    ksort($fingerprint);

    return 'orders:count:v1:'.md5(json_encode($fingerprint, JSON_THROW_ON_ERROR));
}
```

Build the key from an ordered fingerprint, never from `serialize($filter)` — that key changes with the order the DTO's properties happened to be set, so it never hits. See the `laravel-async` skill's `cache-stable-key-convention` rule.
