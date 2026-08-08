---
title: A Query Class Has Exactly One Public Method
impact: HIGH
impactDescription: one class, one question
tags: query-class, structure, single-responsibility
---

## A Query Class Has Exactly One Public Method

A Query Class is a small `final readonly` object representing one named database query or operation. Its only public method is `handle()`. Helpers are `private`.

More than one public method means more than one query class hiding in one file. Split it.

**Incorrect (three queries in one class):**

```php
final readonly class OrderQueries
{
    public function pending(int $merchantId): Collection { /* ... */ }
    public function search(OrderQueryFilter $filter): Builder { /* ... */ }
    public function expire(CarbonImmutable $before): int { /* ... */ }
}
```

**Correct (one file per question, private helpers):**

```php
final readonly class SearchOrdersQuery
{
    private const SORTABLE = ['created_at', 'number', 'total'];

    public function handle(OrderQueryFilter $filter): Builder
    {
        return Order::query()
            ->with(['customer', 'merchant'])
            ->when($filter->dateRange !== null, fn (Builder $q) => $this->applyDateRange($q, $filter->dateRange, 'created_at'));
    }

    private function applyDateRange(Builder $q, DateRange $range, string $column): void { /* ... */ }
}
```
