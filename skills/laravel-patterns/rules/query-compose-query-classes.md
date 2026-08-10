---
title: Compose Query Classes Instead of Duplicating Clauses
impact: MEDIUM
impactDescription: DRY without leaking query code out of the query layer
tags: query-class, composition, dry
---

## Compose Query Classes Instead of Duplicating Clauses

A Query Class may inject another Query Class through its constructor. Composition stays inside the repository layer, so the query-construction boundary is preserved.

When the same clause repeats — a date-range `where`, a tenant scope — extract a `private` helper inside each Query Class that needs it, or compose. Never move it onto a Value Object (see `rules/vo-never-touches-builder.md`).

**Incorrect (shared clause pushed onto the Value Object to avoid repeating it):**

```php
final readonly class DateRange
{
    public function apply(Builder $query, string $column): Builder   // boundary violation
    {
        return $query->whereBetween($column, [$this->from, $this->to]);
    }
}
```

**Correct (compose, or keep a private helper per query):**

```php
final readonly class MerchantRevenueQuery
{
    public function __construct(private SearchOrdersQuery $searchOrders) {}

    public function handle(OrderQueryFilter $filter): Builder
    {
        return $this->searchOrders->handle($filter)
            ->selectRaw('merchant_id, sum(total) as revenue')
            ->groupBy('merchant_id');
    }
}
```

```php
// Or, in each query that needs it:
private function applyDateRange(Builder $q, DateRange $range, string $column): void
{
    $q->where(function (Builder $q) use ($range, $column): void {
        if ($range->from !== null) { $q->where($column, '>=', $range->from); }
        if ($range->to !== null) { $q->where($column, '<=', $range->to); }
    });
}
```
