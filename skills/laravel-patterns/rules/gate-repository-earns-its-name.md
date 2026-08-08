---
title: A Repository Must Name Its Trigger
impact: HIGH
impactDescription: keeps the data boundary meaningful
tags: gate, repository, justification
---

## A Repository Must Name Its Trigger

Q5 of the Decision Gate. Create a Repository only when at least one trigger is true **and can be named concretely**:

1. **Backend swap** — the data source may change (relational DB to vector store, external API to local cache).
2. **Named query with reuse** — the query is important or complex and is called from enough places that one change point is required.

Write the trigger down. "For consistency with the other domains" is not a trigger.

**Incorrect (no named trigger):**

```php
// Why does this exist? Nobody can say.
interface TenantRepositoryInterface
{
    public function all(): Collection;
    public function find(int $id): ?Tenant;
    public function paginate(int $perPage): LengthAwarePaginator;
}
```

**Correct (trigger stated in the docblock):**

```php
/**
 * Trigger: Q5(a) — message retrieval moves from MySQL LIKE search to a
 * pgvector similarity index in Q4. Callers must not change when it does.
 */
interface ChatRepositoryInterface
{
    public function recentMessages(Conversation $conversation, int $limit = 20): Collection;
    public function relevantMessages(Conversation $conversation, string $prompt, int $limit = 10): Collection;
}
```

```php
/**
 * Trigger: Q5(b) — order search drives the admin list, the CSV export and
 * the merchant dashboard. One change point for the filter rules.
 */
interface OrderRepositoryInterface
{
    public function searchOrders(OrderQueryFilter $filter, int $perPage = 25): LengthAwarePaginator;
}
```
