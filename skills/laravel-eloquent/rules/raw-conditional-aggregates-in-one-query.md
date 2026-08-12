---
title: Compute Dashboard Counters in One Query
impact: MEDIUM-HIGH
impactDescription: replaces N aggregate round trips with one
tags: aggregates, dashboard, performance, expressions
---

## Compute Dashboard Counters in One Query

A stats panel that runs one `count()` per tile issues one round trip per tile, each scanning the same table. Conditional aggregates collapse them into a single pass.

**Incorrect (five scans of the same table):**

```php
return [
    'pending' => Order::where('status', 'pending')->count(),
    'paid' => Order::where('status', 'paid')->count(),
    'refunded' => Order::where('status', 'refunded')->count(),
    'revenue' => Order::where('status', 'paid')->sum('total'),
];
```

**Correct (one query, typed expressions):**

```php
final readonly class OrderStatsQuery
{
    public function handle(int $merchantId, DateRange $period): object
    {
        $paid = new Equal('status', new Value(OrderStatus::Paid->value));

        return Order::query()
            ->select([
                new Alias(new CountFilter(new Equal('status', new Value('pending'))), 'pending'),
                new Alias(new CountFilter($paid), 'paid'),
                new Alias(new CountFilter(new Equal('status', new Value('refunded'))), 'refunded'),
                new Alias(new SumFilter('total', $paid), 'revenue'),
            ])
            ->where('merchant_id', $merchantId)
            ->tap(fn (Builder $q) => $this->applyDateRange($q, $period, 'created_at'))
            ->toBase()
            ->first();
    }
}
```

Add `toBase()` when the result is a row of scalars rather than models — it skips hydration entirely, which is the whole point of collapsing the counts into one query. Cache the result if the panel is hit on every page load.

`tpetry/laravel-query-expressions` ships `CountFilter` and `SumFilter` but no filtered average, so derive one from the row rather than inventing a class name: `$row->paid > 0 ? $row->revenue / $row->paid : 0`.
