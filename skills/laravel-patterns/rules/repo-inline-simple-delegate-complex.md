---
title: Inline Simple Queries, Delegate Complex Ones
impact: MEDIUM
impactDescription: avoids a Query Class per repository method
tags: repository, query-class, composition
---

## Inline Simple Queries, Delegate Complex Ones

Inside a Repository implementation each method either inlines a simple query or delegates to a Query Class and executes the result into a domain type. Not every method needs a Query Class — a one-liner in the implementation is fine.

Delegate when the query has business meaning, coordinates several scopes, applies optional filters, controls eager loading, returns aggregates, has pagination or ordering rules, is reused by more than one method, or needs its own tests.

**Incorrect (a class per trivial line):**

```php
final readonly class ConversationLastMessageAtQuery
{
    public function handle(Conversation $conversation): ?CarbonImmutable
    {
        return $conversation->messages()->max('created_at');
    }
}
```

**Correct (mixed, by weight):**

```php
final readonly class EloquentOrderRepository implements OrderRepositoryInterface
{
    public function __construct(
        private SearchOrdersQuery $searchOrders,
        private ExpireAbandonedOrdersQuery $expireAbandoned,
    ) {}

    // Delegated: many optional filters, eager loading, sorting rules, own tests.
    public function searchOrders(OrderQueryFilter $filter, int $perPage = 25): LengthAwarePaginator
    {
        return $this->searchOrders->handle($filter)->paginate($perPage);
    }

    // Inlined: one condition, no rules worth naming. Bounded, and it feeds the
    // ops queue rather than a list endpoint — anything a client pages through
    // returns a paginator instead.
    public function pendingOrders(?int $merchantId = null): Collection
    {
        return Order::query()
            ->where('status', OrderStatus::Pending)
            ->when($merchantId !== null, fn (Builder $q) => $q->where('merchant_id', $merchantId))
            ->limit(200)
            ->get();
    }

    // Delegated: a conditional bulk write worth naming and testing.
    public function expireAbandoned(CarbonImmutable $expiredBefore): int
    {
        return $this->expireAbandoned->handle($expiredBefore);
    }
}
```
