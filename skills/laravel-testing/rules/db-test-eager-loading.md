---
title: Assert the Query Eager-Loads What the Resource Reads
impact: HIGH
impactDescription: locks the N+1 fix in place
tags: database, n+1, eager-loading, regression
---

## Assert the Query Eager-Loads What the Resource Reads

An eager load added to fix an N+1 is one refactor away from being dropped. Two ways to hold it: assert the relation is loaded, or count queries on the endpoint.

Counting queries is the stronger test because it catches loads added later by a different path.

**Incorrect (nothing prevents the `with()` being removed):**

```php
it('returns orders', function (): void {
    Order::factory()->count(5)->hasItems(3)->create();

    expect($this->repository->searchOrders(new OrderQueryFilter()))->toHaveCount(5);
});
```

**Correct (assert the relations are loaded):**

```php
it('eager-loads the relations the resource renders', function (): void {
    Order::factory()->hasItems(2)->create();

    $order = $this->repository->searchOrders(new OrderQueryFilter())->first();

    expect($order->relationLoaded('customer'))->toBeTrue()
        ->and($order->relationLoaded('items'))->toBeTrue();
});
```

**Correct (count queries on the endpoint):**

```php
it('renders the order list in a constant number of queries', function (): void {
    Order::factory()->count(20)->hasItems(3)->create();

    $queries = 0;
    DB::listen(function () use (&$queries): void { $queries++; });

    $this->getJson('/api/orders')->assertOk();

    expect($queries)->toBeLessThanOrEqual(4);
});
```

With `Model::preventLazyLoading()` enabled in the test environment, a missing eager load throws rather than degrading — which makes these assertions a second line of defence rather than the only one.
