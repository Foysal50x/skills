---
title: A Service Whose Body Is a Query Is a Mislabeled Repository
impact: HIGH
impactDescription: catches the most common naming lie in Laravel codebases
tags: service, repository, anti-pattern
---

## A Service Whose Body Is a Query Is a Mislabeled Repository

If a `*Service` contains nothing but raw Eloquent, it is not a Service. Either it is a Repository (interface plus Query-Class-backed implementation), or — if the backend will not change and it is used once — it is inline code in the Action.

A Service holds a business *decision*. A query is not a decision.

**Incorrect (a query wearing a Service name):**

```php
final class OrderSearchService
{
    public function search(?int $merchantId, ?string $status, ?string $from, ?string $to): Collection
    {
        return Order::query()
            ->when($merchantId, fn ($q) => $q->where('merchant_id', $merchantId))
            ->when($status, fn ($q) => $q->where('status', $status))
            ->when($from, fn ($q) => $q->where('created_at', '>=', $from))
            ->when($to, fn ($q) => $q->where('created_at', '<=', $to))
            ->get();
    }
}
```

**Correct (Repository contract + Query Class, or nothing at all):**

```php
// app/Domain/Orders/Contracts/OrderRepositoryInterface.php
interface OrderRepositoryInterface
{
    public function searchOrders(OrderQueryFilter $filter, int $perPage = 25): LengthAwarePaginator;
}

// app/Domain/Orders/Queries/SearchOrdersQuery.php — owns the where() clauses
// app/Domain/Orders/Repositories/EloquentOrderRepository.php — executes them
```

If the search is used in exactly one place and will never move backends, delete the class and write the query in the Action.
