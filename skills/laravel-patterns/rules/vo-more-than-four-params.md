---
title: More Than Four Parameters Must Be Grouped
impact: MEDIUM-HIGH
impactDescription: hard trigger, no judgement call required
tags: value-object, parameter-object, threshold
---

## More Than Four Parameters Must Be Grouped

A signature with more than four parameters must be reduced by grouping, regardless of layer. This is a hard trigger, not a preference: past four, call sites become positional puzzles and every new filter is a breaking change to every caller.

**Incorrect (seven parameters, three of them nullable booleans):**

```php
public function searchOrders(
    ?int $merchantId,
    ?string $status,
    ?CarbonImmutable $from,
    ?CarbonImmutable $to,
    ?string $search,
    ?string $sortColumn,
    ?string $sortDirection,
): LengthAwarePaginator
```

**Correct (one composite filter):**

```php
public function searchOrders(OrderQueryFilter $filter, int $perPage = 25): LengthAwarePaginator
```

```php
final readonly class OrderQueryFilter
{
    public function __construct(
        public ?int $merchantId = null,
        public ?OrderStatus $status = null,
        public ?DateRange $dateRange = null,
        public ?string $search = null,
        public ?Sorting $sorting = null,
    ) {}
}
```

Adding a filter now touches the DTO and the Query Class — not every caller.
