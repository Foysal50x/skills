---
title: Give Value Objects a Custom Cast
impact: MEDIUM
impactDescription: the domain type crosses the persistence boundary intact
tags: casts, value-object, model
---

## Give Value Objects a Custom Cast

When a column represents a Value Object — money with a currency, a coordinate pair, an encrypted token — implement `CastsAttributes` so the model returns the domain type directly. Otherwise every caller reconstructs it, and one of them will get it wrong.

The cast belongs with the domain: `app/Domain/<Context>/Casts/`, or `app/Support/Casts/` when the Value Object is in the Shared Kernel.

**Incorrect (reassembled at every read):**

```php
$total = new Money($order->total_minor, $order->currency);       // in the Resource
$total = new Money($order->total_minor, $order->currency);       // in the invoice PDF
$total = Money::of($order->total_minor / 100, $order->currency); // and here, wrongly
```

**Correct:**

```php
namespace App\Support\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;

/** @implements CastsAttributes<Money, Money> */
final class MoneyCast implements CastsAttributes
{
    public function get(Model $model, string $key, mixed $value, array $attributes): ?Money
    {
        return $value === null ? null : new Money((int) $value, $attributes['currency'] ?? 'USD');
    }

    /** @return array<string, mixed> */
    public function set(Model $model, string $key, mixed $value, array $attributes): array
    {
        if (! $value instanceof Money) {
            throw new InvalidArgumentException('total must be a Money instance.');
        }

        return ['total' => $value->minorUnits, 'currency' => $value->currency];
    }
}
```

```php
protected function casts(): array
{
    return ['total' => MoneyCast::class];
}

$order->total->plus($shipping);   // a Money, everywhere
```
