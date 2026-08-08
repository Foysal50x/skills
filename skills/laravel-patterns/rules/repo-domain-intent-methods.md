---
title: Repository Methods Express Intent, Not CRUD
impact: HIGH
impactDescription: keeps the contract stable when the backend changes
tags: repository, contract, naming
---

## Repository Methods Express Intent, Not CRUD

Interface methods name the business question, not the database operation. A CRUD-mirroring interface (`find`, `all`, `create`, `update`, `delete`) adds a layer without adding meaning — and it cannot survive a backend swap, because a vector store has no `all()`.

Good: `recentMessages()`, `relevantMessages()`, `searchOrders()`, `pendingOrders()`, `expireAbandoned()`.
Bad: `find()`, `all()`, `getByStatus()`, `firstWhere()`, `updateById()`.

**Incorrect (Eloquent's API with extra steps):**

```php
interface OrderRepositoryInterface
{
    public function all(): Collection;
    public function find(int $id): ?Order;
    public function getByStatus(string $status): Collection;
    public function updateById(int $id, array $attributes): bool;
}
```

**Correct (questions the business actually asks):**

```php
interface OrderRepositoryInterface
{
    public function searchOrders(OrderQueryFilter $filter, int $perPage = 25): LengthAwarePaginator;
    public function pendingOrders(?int $merchantId = null): Collection;
    public function expireAbandoned(CarbonImmutable $expiredBefore): int;
}
```

Each method should map roughly one-to-one to a named query. See `rules/repo-inline-simple-delegate-complex.md`.
