---
title: RefreshDatabase Plus Factories, Never Shared Fixtures
impact: HIGH
impactDescription: each test states its own preconditions
tags: database, factories, isolation, setup
---

## RefreshDatabase Plus Factories, Never Shared Fixtures

`RefreshDatabase` wraps each test in a transaction and rolls back, so tests do not leak into each other. Factories build exactly the rows a test needs, in the test that needs them.

A shared seeder used by many tests is a hidden dependency: reading the test does not tell you why it passes, and changing the seeder breaks unrelated tests.

**Incorrect (preconditions live somewhere else):**

```php
beforeEach(fn () => $this->seed(DemoDataSeeder::class));   // 400 rows, unknown shape

it('returns pending orders', function (): void {
    expect($this->repository->pendingOrders())->toHaveCount(7);
    // Why 7? Nobody knows. Add a row to the seeder and this breaks.
});
```

**Correct:**

```php
uses(RefreshDatabase::class);

it('returns pending orders for the given merchant', function (): void {
    $merchant = Merchant::factory()->create();

    Order::factory()->for($merchant)->pending()->count(2)->create();
    Order::factory()->for($merchant)->paid()->create();
    Order::factory()->pending()->create();                    // different merchant

    expect($this->repository->pendingOrders($merchant->id))->toHaveCount(2);
});
```

```php
// Model-specific states keep the intent readable:
class OrderFactory extends Factory
{
    public function pending(): static
    {
        return $this->state(['status' => OrderStatus::Pending, 'paid_at' => null]);
    }
}
```

Reserve seeders for reference data the whole suite needs — currencies, plans, permissions — and load it once via `RefreshDatabase::$seed`.
