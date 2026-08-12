---
title: Parameterize Presets Instead of Copying Classes
impact: MEDIUM
impactDescription: one class replaces a family
tags: value-object, presets, anti-greed
---

## Parameterize Presets Instead of Copying Classes

A family of presets that differ only by a number is one parameterized class. `LastThreeMonths`, `LastSixMonths` and `LastTwelveMonths` are `LastNMonths`.

Add a thin named alias only when the name itself is a domain term people say out loud.

**Incorrect (a class per number):**

```php
final readonly class LastThreeMonths implements DateRangable { /* ... */ }
final readonly class LastSixMonths implements DateRangable { /* ... */ }
final readonly class LastTwelveMonths implements DateRangable { /* ... */ }
final readonly class PreviousSevenDays implements DateRangable { /* ... */ }
final readonly class PreviousThirtyDays implements DateRangable { /* ... */ }
```

**Correct (one shape covers the family, validated):**

```php
final readonly class LastNMonths implements DateRangable
{
    public function __construct(private int $n)
    {
        if ($n < 1) {
            throw new InvalidArgumentException('LastNMonths requires n >= 1.');
        }
    }

    /** N calendar months ending with the current one — LastNMonths(3) in August is June–August. */
    public function range(): DateRange
    {
        $now = CarbonImmutable::now();

        return new DateRange($now->subMonths($this->n - 1)->startOfMonth(), $now->endOfMonth());
    }
}

// Alias only where the name carries business meaning:
final readonly class TrailingQuarter implements DateRangable
{
    public function range(): DateRange
    {
        return (new LastNMonths(3))->range();
    }
}
```

Fixed-boundary presets that are not a numeric family still get their own class: `Today`, `ThisWeek`, `ThisMonth`, `LastMonth`, `ThisQuarter`, `ThisYear`, `LastYear`.
