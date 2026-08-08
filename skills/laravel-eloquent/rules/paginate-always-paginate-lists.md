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
public function pendingOrders(): Collection
{
    return Order::where('status', OrderStatus::Pending)->get();
}

// and, with a client-controlled limit:
->paginate($request->integer('per_page'));   // per_page=100000
```

**Correct:**

```php
public function pendingOrders(int $perPage = 25): LengthAwarePaginator
{
    return $this->pendingOrders->handle()->paginate($perPage);
}
```

```php
$perPage = min($request->integer('per_page', 25), 100);
```

An internal method that genuinely must return everything should stream instead — see `rules/perf-chunk-large-result-sets.md`.
