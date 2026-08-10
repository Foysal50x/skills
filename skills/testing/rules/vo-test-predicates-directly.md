---
title: Test Value Object Predicates Directly
impact: MEDIUM
impactDescription: fast, exhaustive coverage of the pure logic
tags: value-object, unit-test, purity
---

## Test Value Object Predicates Directly

Value Objects are pure data plus pure predicates and transformations, so their tests need no database, no container and no HTTP. Construct, call, assert.

Because they are cheap, cover the boundaries exhaustively — a datasets block gives you a dozen cases for the price of one test.

**Incorrect (testing the Value Object through a query):**

```php
uses(RefreshDatabase::class);

it('covers dates in range', function (): void {
    Order::factory()->create(['created_at' => now()->subDay()]);

    $results = $repository->searchOrders(new OrderQueryFilter(dateRange: new DateRange(now()->subDays(3), now())));

    expect($results)->toHaveCount(1);
});
// A slow, indirect test of DateRange::covers().
```

**Correct:**

```php
it('covers dates inside the range', function (): void {
    $range = new DateRange(CarbonImmutable::parse('2026-03-01'), CarbonImmutable::parse('2026-03-31'));

    expect($range->isBounded())->toBeTrue()
        ->and($range->covers(CarbonImmutable::parse('2026-03-15')))->toBeTrue()
        ->and($range->covers(CarbonImmutable::parse('2026-03-01')))->toBeTrue()   // inclusive
        ->and($range->covers(CarbonImmutable::parse('2026-04-01')))->toBeFalse();
});

it('treats a null bound as open-ended', function (?string $from, ?string $to, string $date, bool $expected): void {
    $range = new DateRange(
        $from === null ? null : CarbonImmutable::parse($from),
        $to === null ? null : CarbonImmutable::parse($to),
    );

    expect($range->covers(CarbonImmutable::parse($date)))->toBe($expected);
})->with([
    [null, '2026-03-31', '2020-01-01', true],
    ['2026-03-01', null, '2030-01-01', true],
    [null, null, '2026-03-15', true],
    ['2026-03-01', '2026-03-31', '2026-02-28', false],
]);
```

Named constructors and transformations get the same treatment: `Sorting::latest()`, `DateRange::intersect()`, `LastNMonths(3)->range()`.
