---
title: Always Paginate List Endpoints
impact: HIGH
impactDescription: bounds memory and response size regardless of data growth
tags: pagination, performance, api
---

## Always Paginate List Endpoints

Never `->get()` an unbounded list to a client. A table that holds 200 rows in development holds 200,000 in production, and the endpoint that worked all year fails in one afternoon.

Cap `per_page` server-side even when the client supplies it.

**Incorrect:**

```php
// Feeds GET /api/orders — every matching row, on every request.
public function ordersForMerchant(int $merchantId): Collection
{
    return Order::where('merchant_id', $merchantId)->get();
}

// and, with a client-controlled limit:
->paginate($request->integer('per_page'));   // per_page=100000
```

**Correct:**

```php
public function ordersForMerchant(int $merchantId, int $perPage = 25): LengthAwarePaginator
{
    return $this->merchantOrders->handle($merchantId)->paginate($perPage);
}
```

```php
$perPage = max(1, min($request->integer('per_page', 25), 100));   // per_page=0 paginates by zero
```

The rule is about what reaches a client. A repository read the query itself bounds — a dashboard's pending queue, a picker's twenty most recent — may still return a `Collection`; what a list endpoint renders is always paginated.

An internal method that genuinely must return everything should stream instead — see `rules/perf-chunk-large-result-sets.md`.
