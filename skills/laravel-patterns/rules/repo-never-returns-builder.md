---
title: A Repository Interface Never Returns a Builder
impact: HIGH
impactDescription: a leaked Builder makes the backend unswappable
tags: repository, contract, builder, boundary
---

## A Repository Interface Never Returns a Builder

Interface methods return domain types: `Collection`, `LengthAwarePaginator`, `Model`, `int`, `bool`, or a domain DTO. Returning `Illuminate\Database\Eloquent\Builder` publishes Eloquent as the contract, so every caller becomes coupled to it and the interface can never be implemented by anything else.

Returning a `Builder` is allowed in exactly one place: from a Query Class's `handle()`, which is internal to the Repository.

**Incorrect (Eloquent leaks through the contract):**

```php
interface OrderRepositoryInterface
{
    public function searchOrders(OrderQueryFilter $filter): Builder;
}

// Callers now do this, and the "swappable backend" is fiction:
$orders->searchOrders($filter)->whereNotNull('shipped_at')->paginate(25);
```

**Correct (the Repository executes; the Builder stays inside):**

```php
interface OrderRepositoryInterface
{
    public function searchOrders(OrderQueryFilter $filter, int $perPage = 25): LengthAwarePaginator;
}

final readonly class EloquentOrderRepository implements OrderRepositoryInterface
{
    public function __construct(private SearchOrdersQuery $searchOrders) {}

    public function searchOrders(OrderQueryFilter $filter, int $perPage = 25): LengthAwarePaginator
    {
        return $this->searchOrders->handle($filter)->paginate($perPage);
    }
}
```

If a caller needs `shipped_at` filtering, add it to `OrderQueryFilter` — that is the contract widening on purpose.
