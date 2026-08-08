---
title: Never Mock Eloquent or the Query Builder
impact: HIGH
impactDescription: avoids tests that pass while the query is wrong
tags: fakes, eloquent, mocking, anti-pattern
---

## Never Mock Eloquent or the Query Builder

Mocking `Model::where()->orderBy()->get()` asserts the exact chain of calls you happened to write. Refactor the query into something equivalent and the test fails; write a query that returns the wrong rows and the test passes. It verifies syntax, not behavior.

Query construction is tested against a real database. Everything above it is tested against your own interface.

**Incorrect:**

```php
$builder = Mockery::mock(Builder::class);
$builder->shouldReceive('where')->with('status', 'pending')->andReturnSelf();
$builder->shouldReceive('orderBy')->with('created_at', 'desc')->andReturnSelf();
$builder->shouldReceive('get')->andReturn(collect([$order]));

Order::shouldReceive('query')->andReturn($builder);
// Passes even if the filter is on the wrong column.
```

**Correct (real database for the query):**

```php
uses(RefreshDatabase::class);

it('returns pending orders newest first', function (): void {
    $older = Order::factory()->pending()->create(['created_at' => now()->subDay()]);
    $newer = Order::factory()->pending()->create(['created_at' => now()]);
    Order::factory()->paid()->create();

    $results = app(OrderRepositoryInterface::class)->pendingOrders();

    expect($results->pluck('id')->all())->toBe([$newer->id, $older->id]);
});
```

**Correct (fake interface for everything above):**

```php
$orders = new class implements OrderRepositoryInterface {
    public function pendingOrders(?int $merchantId = null): Collection
    {
        return collect([new Order(['id' => 1])]);
    }
    // ...
};
```

The same applies to `Model::shouldReceive()` via `partialMock` — if you need it, the class under test is doing data access it should have delegated.
