---
title: Test Your Rules, Not Eloquent
impact: HIGH
impactDescription: keeps the suite about your code
tags: strategy, scope, framework, testing
---

## Test Your Rules, Not Eloquent

Laravel is tested. A test asserting that `create()` writes a row, that `belongsTo()` resolves, or that a cast returns a `Carbon` proves nothing about your application and breaks on upgrades.

Test the decisions you made: which rows a filter includes and excludes, what order results come back in, what the default is when input is missing, which relations are eager-loaded.

**Incorrect (asserting framework behavior):**

```php
it('creates an order', function (): void {
    $order = Order::factory()->create(['number' => 'A-1']);

    expect($order->number)->toBe('A-1')
        ->and(Order::count())->toBe(1);
});

it('casts status to an enum', function (): void {
    expect(Order::factory()->create(['status' => 'paid'])->status)->toBeInstanceOf(OrderStatus::class);
});
```

**Correct (asserting your query's rules):**

```php
it('excludes orders outside the date range and other merchants', function (): void {
    $merchant = Merchant::factory()->create();

    $included = Order::factory()->for($merchant)->create(['created_at' => now()->subDays(2)]);
    Order::factory()->for($merchant)->create(['created_at' => now()->subMonths(3)]);  // out of range
    Order::factory()->create(['created_at' => now()->subDays(2)]);                    // other merchant

    $results = app(OrderRepositoryInterface::class)->searchOrders(new OrderQueryFilter(
        merchantId: $merchant->id,
        dateRange: (new ThisMonth())->range(),
    ));

    expect($results)->toHaveCount(1)
        ->and($results->first()->is($included))->toBeTrue();
});
```

Always assert exclusions. A filter test that only checks the included row passes when the filter is missing entirely.
