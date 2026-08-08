---
title: Assert What Is Excluded, Not Only What Is Included
impact: HIGH
impactDescription: catches a filter that is missing entirely
tags: database, query, assertions, coverage
---

## Assert What Is Excluded, Not Only What Is Included

A test that creates one matching row and asserts it comes back passes when the filter does nothing at all. Every filter test needs at least one row that must be excluded, for each condition.

Create one row per boundary: wrong tenant, wrong status, outside the date range, soft-deleted.

**Incorrect (passes with no filter in the query at all):**

```php
it('filters by merchant', function (): void {
    $merchant = Merchant::factory()->create();
    Order::factory()->for($merchant)->create();

    expect($this->repository->searchOrders(new OrderQueryFilter(merchantId: $merchant->id)))
        ->toHaveCount(1);
});
```

**Correct (a negative case per condition):**

```php
it('filters by merchant, status and date range', function (): void {
    $this->travelTo(CarbonImmutable::parse('2026-03-15'));
    $merchant = Merchant::factory()->create();

    $included = Order::factory()->for($merchant)->pending()->create(['created_at' => '2026-03-10']);

    Order::factory()->for($merchant)->paid()->create(['created_at' => '2026-03-10']);      // status
    Order::factory()->for($merchant)->pending()->create(['created_at' => '2026-01-10']);   // date
    Order::factory()->pending()->create(['created_at' => '2026-03-10']);                   // merchant

    $results = $this->repository->searchOrders(new OrderQueryFilter(
        merchantId: $merchant->id,
        status: OrderStatus::Pending,
        dateRange: (new ThisMonth())->range(),
    ));

    expect($results->pluck('id')->all())->toBe([$included->id]);
});
```

Asserting the exact id list rather than a count also catches a filter that includes the right number of wrong rows.
