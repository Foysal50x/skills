---
title: Cache Read-Heavy Endpoints and Expensive Queries
impact: HIGH
impactDescription: removes repeated work for data that rarely changes
tags: cache, performance, queries
---

## Cache Read-Heavy Endpoints and Expensive Queries

Dashboard aggregates, reference data, permission lookups, feature flags and rendered fragments are read far more often than they change. Cache them, and put the caching in the Repository — the layer that owns data access — not in the controller.

Cache the computed result, not the Eloquent models: a serialized model graph is large and goes stale in confusing ways.

**Incorrect (caching in the controller, caching models):**

```php
public function __invoke(): View
{
    $stats = Cache::remember('stats', 3600, fn () => Order::with('items')->get());

    return view('dashboard', ['stats' => $stats]);
}
```

**Correct:**

```php
final readonly class EloquentOrderReportingRepository implements OrderReportingRepositoryInterface
{
    public function __construct(private OrderStatsQuery $stats) {}

    public function statsFor(int $merchantId, DateRange $period): OrderStats
    {
        return Cache::tags(['orders', "merchant:{$merchantId}"])->remember(
            $this->key($merchantId, $period),
            now()->addMinutes(15),
            fn (): OrderStats => OrderStats::fromRow($this->stats->handle($merchantId, $period)),
        );
    }
}
```

Choose the TTL from how stale the data may be, and pair it with event-driven invalidation (`rules/cache-invalidate-on-model-events.md`) so the TTL is a backstop, not the mechanism.
