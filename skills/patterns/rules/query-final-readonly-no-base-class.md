---
title: Plain final readonly, No Abstract Query Base
impact: MEDIUM
impactDescription: prevents an inheritance chain nobody can delete later
tags: query-class, inheritance, simplicity
---

## Plain final readonly, No Abstract Query Base

Start every Query Class as a plain `final readonly class`. Do not create an abstract `Query` base, a `HasFilters` trait or a generic `AbstractQuery` with template methods. Share only after real, repeated duplication — and prefer composition (`rules/query-compose-query-classes.md`) over inheritance when you do.

**Incorrect (framework grown before the second use case):**

```php
abstract class Query
{
    abstract protected function baseQuery(): Builder;
    abstract protected function filters(): array;

    public function handle(mixed $filter): Builder
    {
        $query = $this->baseQuery();
        foreach ($this->filters() as $apply) { $apply($query, $filter); }
        return $query;
    }
}

final class SearchOrdersQuery extends Query { /* now indirect and untraceable */ }
```

**Correct:**

```php
final readonly class SearchOrdersQuery
{
    public function handle(OrderQueryFilter $filter): Builder
    {
        return Order::query()->with(['customer', 'merchant'])/* ... */;
    }
}
```

You can read the whole query in one file. That is the point.
