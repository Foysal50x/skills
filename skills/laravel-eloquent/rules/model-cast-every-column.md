---
title: Cast Every Date, Enum, JSON and Money Column
impact: HIGH
impactDescription: removes per-call-site type juggling and comparison bugs
tags: casts, model, enums, dates, json
---

## Cast Every Date, Enum, JSON and Money Column

An un-cast column returns a string. Every caller then has to remember to parse it, and one that forgets compares a string to a `Carbon` or an enum and silently gets `false`.

Cast in `casts()` so the type is declared once:

- Enums → the enum class
- Dates → `datetime` or `immutable_datetime`
- JSON → `array`, `collection` or `AsArrayObject`
- Money and other Value Objects → a custom `CastsAttributes` class
- Encrypted columns → `encrypted`, `encrypted:array`

**Incorrect (three call sites, three different interpretations):**

```php
final class Order extends Model
{
    // no casts
}

$order->status === OrderStatus::Paid;        // false — string vs enum
$order->expires_at->isPast();                // Error: method on string
$order->metadata['channel'];                 // Error: string offset
```

**Correct:**

```php
final class Order extends Model
{
    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'status' => OrderStatus::class,
            'expires_at' => 'immutable_datetime',
            'metadata' => AsArrayObject::class,
            'total' => MoneyCast::class,
            'settings' => 'encrypted:array',
        ];
    }
}
```

Prefer `immutable_datetime` — a mutable `Carbon` shared between two variables produces action-at-a-distance bugs when one of them calls `addDay()`.
