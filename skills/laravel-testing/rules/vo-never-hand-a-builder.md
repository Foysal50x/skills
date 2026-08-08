---
title: Never Test a Value Object by Handing It a Builder
impact: MEDIUM
impactDescription: the test that is impossible to write proves the boundary holds
tags: value-object, builder, boundary, purity
---

## Never Test a Value Object by Handing It a Builder

If a Value Object test needs a `Builder`, the Value Object is building queries — which the architecture forbids. The test is not the problem; the design is.

Value Objects hold data and pure behavior. Query construction lives in Query Classes, and is tested there against a real database.

**Incorrect (the test only compiles because the boundary was broken):**

```php
it('applies the date range to a query', function (): void {
    $query = Order::query();

    (new DateRange(now()->subDays(3), now()))->apply($query, 'created_at');

    expect($query->toSql())->toContain('created_at >=');
});
// DateRange::apply(Builder) should not exist.
```

**Correct — the Value Object is tested purely:**

```php
it('reports whether a date falls inside the range', function (): void {
    $range = new DateRange(CarbonImmutable::parse('2026-03-01'), CarbonImmutable::parse('2026-03-31'));

    expect($range->covers(CarbonImmutable::parse('2026-03-15')))->toBeTrue();
});
```

**And the query rule is tested against the database:**

```php
uses(RefreshDatabase::class);

it('excludes orders outside the date range', function (): void {
    $inside = Order::factory()->create(['created_at' => '2026-03-15']);
    Order::factory()->create(['created_at' => '2026-04-02']);

    $results = $this->repository->searchOrders(new OrderQueryFilter(
        dateRange: new DateRange(CarbonImmutable::parse('2026-03-01'), CarbonImmutable::parse('2026-03-31')),
    ));

    expect($results->pluck('id')->all())->toBe([$inside->id]);
});
```

Asserting on `toSql()` is a related smell: it tests the string you generated, not the rows you get back.
