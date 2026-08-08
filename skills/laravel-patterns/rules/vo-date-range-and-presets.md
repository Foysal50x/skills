---
title: Express Named Date Ranges Through an Interface
impact: MEDIUM
impactDescription: business periods become selectable values
tags: value-object, date-range, interface, presets
---

## Express Named Date Ranges Through an Interface

A `DateRangable` interface lets you express periods as named business concepts and select them polymorphically. `range()` resolves a preset into a concrete `DateRange`.

Generic, cross-domain interfaces live in `app/Contracts/`. The presets live with their Value Object under `app/Support/Filters/Date/Presets/`.

**Incorrect (period logic re-derived at every call site):**

```php
$from = now()->startOfMonth();
$to = now()->endOfMonth();
$revenue = $reports->revenueBetween($from, $to);

// elsewhere, subtly different:
$from = now()->startOfMonth();
$to = now();
```

**Correct (named, resolved once):**

```php
namespace App\Contracts;

interface DateRangable
{
    public function range(): DateRange;
}
```

```php
namespace App\Support\Filters\Date\Presets;

final readonly class ThisMonth implements DateRangable
{
    public function range(): DateRange
    {
        $now = CarbonImmutable::now();

        return new DateRange($now->startOfMonth(), $now->endOfMonth());
    }
}
```

```php
$revenue = $reports->revenue((new ThisMonth())->range());

// Selecting a preset from user input:
$preset = match ($request->string('period')->toString()) {
    'today' => new Today(),
    'month' => new ThisMonth(),
    default => new LastNMonths(3),
};
$revenue = $reports->revenue($preset->range());
```

Use one suffix convention consistently: `DateRangable`, or `ResolvesDateRange`, or `ProvidesDateRange`. Pick one.
