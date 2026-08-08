---
title: Freeze Time and Seed Randomness
impact: MEDIUM-HIGH
impactDescription: removes the flakiness that makes a suite untrusted
tags: fakes, time, flakiness, determinism
---

## Freeze Time and Seed Randomness

A test that depends on the wall clock fails at midnight, at month boundaries, or when CI is slow. `Carbon::setTestNow()` — or Laravel's `travelTo()` / `freezeTime()` — makes time an input rather than an ambient condition.

The same applies to anything random: seed it, or assert the shape rather than the value.

**Incorrect (passes most days):**

```php
it('includes this month\'s orders', function (): void {
    $order = Order::factory()->create(['created_at' => now()->subDays(3)]);

    $results = $repository->searchOrders(new OrderQueryFilter(dateRange: (new ThisMonth())->range()));

    expect($results)->toHaveCount(1);
});
// Fails on the 1st and 2nd of every month.
```

**Correct:**

```php
it('includes this month\'s orders', function (): void {
    $this->travelTo(CarbonImmutable::parse('2026-03-15 10:00:00'));

    $inRange = Order::factory()->create(['created_at' => '2026-03-12 09:00:00']);
    Order::factory()->create(['created_at' => '2026-02-28 23:59:00']);   // previous month

    $results = $repository->searchOrders(new OrderQueryFilter(dateRange: (new ThisMonth())->range()));

    expect($results->pluck('id')->all())->toBe([$inRange->id]);
});
```

```php
// Freeze without moving, when only stability matters:
$this->freezeTime();

// Testing an expiry window:
$this->travel(3)->hours();
```

Time travel is undone automatically at the end of each test. Set the timezone explicitly in any test involving day boundaries.
