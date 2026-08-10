---
title: Return a Builder or Execute, One per Query
impact: MEDIUM
impactDescription: lets one query serve paginate, get and count
tags: query-class, builder, return-type
---

## Return a Builder or Execute, One per Query

Choose one return style per Query Class:

- **Execute inside `handle()`** when there is one expected result type — return `Collection`, `LengthAwarePaginator`, `int`, `Model` or `bool`.
- **Return a `Builder`** when callers legitimately need different result types (paginate here, `get()` there, `count()` in a badge) and let the Repository method execute it.

Returning a `Builder` is allowed here and nowhere else. The Repository interface still returns a domain type.

**Incorrect (executed too early, so the export has to re-implement the filters):**

```php
final readonly class SearchOrdersQuery
{
    public function handle(OrderQueryFilter $filter): Collection
    {
        return Order::query()/* filters */->get();   // export needs a cursor, dashboard needs a count
    }
}
```

**Correct (Builder out, Repository decides how to run it):**

```php
final readonly class SearchOrdersQuery
{
    public function handle(OrderQueryFilter $filter): Builder { /* ... */ }
}

final readonly class EloquentOrderRepository implements OrderRepositoryInterface
{
    public function searchOrders(OrderQueryFilter $filter, int $perPage = 25): LengthAwarePaginator
    {
        return $this->searchOrders->handle($filter)->paginate($perPage);
    }

    public function countMatching(OrderQueryFilter $filter): int
    {
        return $this->searchOrders->handle($filter)->count();
    }

    public function streamMatching(OrderQueryFilter $filter): LazyCollection
    {
        return $this->searchOrders->handle($filter)->lazyById();
    }
}
```
