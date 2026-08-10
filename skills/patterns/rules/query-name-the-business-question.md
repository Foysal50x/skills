---
title: Name a Query Class After the Business Question
impact: MEDIUM
impactDescription: a name that repeats Eloquent proves the class was not needed
tags: query-class, naming, convention
---

## Name a Query Class After the Business Question

Name the question the business asks, not the database operation performed. If the best name you can find just repeats an Eloquent method, the query did not need its own class.

Good: `PendingOrdersQuery`, `SearchOrdersQuery`, `ExpireAbandonedOrdersQuery`, `RecentMessagesQuery`, `RelevantMessagesBySimilarityQuery`.
Bad: `GetOrdersQuery`, `FetchProductsQuery`, `FindArticleByIdQuery`, `OrderQuery`.

**Incorrect:**

```php
final readonly class FindArticleByIdQuery
{
    public function handle(int $id): ?Article
    {
        return Article::find($id);   // the name is the giveaway
    }
}
```

**Correct (name states the rule the query encodes):**

```php
final readonly class ExpireAbandonedOrdersQuery
{
    public function handle(CarbonImmutable $expiredBefore): int { /* ... */ }
}

final readonly class RelevantMessagesBySimilarityQuery
{
    public function handle(Conversation $conversation, string $prompt, int $limit): Builder { /* ... */ }
}
```
