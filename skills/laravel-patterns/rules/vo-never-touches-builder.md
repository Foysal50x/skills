---
title: A Value Object Never Touches a Builder
impact: CRITICAL
impactDescription: keeps query construction in exactly one layer
tags: value-object, builder, boundary, purity
---

## A Value Object Never Touches a Builder

A Value Object holds data and exposes pure methods only: predicates (`covers()`, `isBounded()`), transformations (`intersect()`, `expand()`), named constructors (`latest()`, `oldest()`).

It must never import `Illuminate\Database\Eloquent\Builder`, accept a `Builder` in any method, or call `where()` / `orderBy()` / any query-builder method. An `apply(Builder $query)` method on a Value Object smuggles query logic out of the query layer and re-scatters it.

The Query Class reads the Value Object's data and writes the clause itself.

**Incorrect (the boundary violation):**

```php
use Illuminate\Database\Eloquent\Builder;

final readonly class DateRange
{
    public function apply(Builder $query, string $column): Builder
    {
        return $query->whereBetween($column, [$this->from, $this->to]);
    }
}
```

**Correct (pure data and pure predicates):**

```php
final readonly class DateRange
{
    public function __construct(
        public ?CarbonImmutable $from = null,
        public ?CarbonImmutable $to = null,
    ) {}

    public function isBounded(): bool
    {
        return $this->from !== null || $this->to !== null;
    }

    public function covers(CarbonImmutable $date): bool
    {
        return ($this->from === null || $date->greaterThanOrEqualTo($this->from))
            && ($this->to === null || $date->lessThanOrEqualTo($this->to));
    }
}
```

```php
// The Query Class writes the clause:
private function applyDateRange(Builder $q, DateRange $range, string $column): void
{
    $q->where(function (Builder $q) use ($range, $column): void {
        if ($range->from !== null) { $q->where($column, '>=', $range->from); }
        if ($range->to !== null) { $q->where($column, '<=', $range->to); }
    });
}
```

If that helper repeats across Query Classes, keep the repetition inside the query layer — see `rules/query-compose-query-classes.md`.
