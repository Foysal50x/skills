---
title: Test Ordering, Defaults and the Sort Allow-List
impact: HIGH
impactDescription: covers the rules a count assertion cannot see
tags: database, sorting, defaults, security
---

## Test Ordering, Defaults and the Sort Allow-List

Three query rules that count assertions never reach: the order rows come back in, the default applied when no input is given, and what happens when the sort column is not on the allow-list.

The last one is a security test — an unwhitelisted column reaching `orderBy` is an injection surface.

**Incorrect (order and defaults untested):**

```php
it('searches orders', function (): void {
    Order::factory()->count(3)->create();

    expect($this->repository->searchOrders(new OrderQueryFilter()))->toHaveCount(3);
});
```

**Correct:**

```php
it('defaults to newest first when no sort is supplied', function (): void {
    $old = Order::factory()->create(['created_at' => now()->subDays(2)]);
    $new = Order::factory()->create(['created_at' => now()]);

    $results = $this->repository->searchOrders(new OrderQueryFilter());

    expect($results->pluck('id')->all())->toBe([$new->id, $old->id]);
});

it('sorts by an allow-listed column', function (): void {
    $b = Order::factory()->create(['number' => 'B-2']);
    $a = Order::factory()->create(['number' => 'A-1']);

    $results = $this->repository->searchOrders(new OrderQueryFilter(
        sorting: new Sorting('number', Direction::Asc),
    ));

    expect($results->pluck('id')->all())->toBe([$a->id, $b->id]);
});

it('falls back to the default order when the sort column is not allow-listed', function (): void {
    $old = Order::factory()->create(['created_at' => now()->subDay()]);
    $new = Order::factory()->create(['created_at' => now()]);

    $results = $this->repository->searchOrders(new OrderQueryFilter(
        sorting: new Sorting('password', Direction::Asc),
    ));

    expect($results->pluck('id')->all())->toBe([$new->id, $old->id]);
});
```
