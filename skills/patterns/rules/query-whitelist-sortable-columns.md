---
title: Whitelist Sortable Columns in the Query Class
impact: HIGH
impactDescription: closes a column-enumeration and error-based injection vector
tags: query-class, security, sorting, validation
---

## Whitelist Sortable Columns in the Query Class

`orderBy()` takes a raw column name. A user-supplied sort column lets an attacker probe your schema through error messages and order results by columns you never meant to expose. Validate against an allow-list at the Query Class level — the layer that actually writes the `orderBy`.

Doing this in the Form Request as well is fine; doing it *only* there is not, because the Query Class is also reached from commands and jobs.

**Incorrect (raw input into orderBy):**

```php
public function handle(OrderQueryFilter $filter): Builder
{
    return Order::query()->orderBy($filter->sorting->column, $filter->sorting->direction->value);
}
```

**Correct (allow-list plus a deterministic fallback):**

```php
final readonly class SearchOrdersQuery
{
    private const SORTABLE = ['created_at', 'number', 'total'];

    public function handle(OrderQueryFilter $filter): Builder
    {
        return Order::query()->when(
            $filter->sorting !== null && in_array($filter->sorting->column, self::SORTABLE, true),
            fn (Builder $q) => $q->orderBy($filter->sorting->column, $filter->sorting->direction->value),
            fn (Builder $q) => $q->latest(),
        );
    }
}
```

The same rule applies to any user-controlled identifier reaching `orderBy`, `groupBy`, `having` or a raw expression.
