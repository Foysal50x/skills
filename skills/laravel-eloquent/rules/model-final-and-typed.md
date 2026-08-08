---
title: Type Models Fully and Mark Them final
impact: MEDIUM
impactDescription: static analysis catches the errors tests would not
tags: model, types, static-analysis, php
---

## Type Models Fully and Mark Them final

Use the PHP features the project's version supports: native return types on relations, typed properties, `final` on classes with no intended subclass, `declare(strict_types=1)` at the top of every file.

Annotate model properties with `@property` so static analysis and the IDE know what `$order->status` is. Laravel IDE helper generates these; committing them is the point.

**Incorrect (untyped, extendable, invisible to analysis):**

```php
class Order extends Model
{
    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }
}
```

**Correct:**

```php
<?php

declare(strict_types=1);

namespace App\Domain\Orders\Models;

/**
 * @property int $id
 * @property string $number
 * @property OrderStatus $status
 * @property Money $total
 * @property CarbonImmutable $created_at
 * @property-read Customer $customer
 */
final class Order extends Model
{
    /** @return BelongsTo<Customer, $this> */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
```

`final` is the right default for domain models. Drop it only when a subclass genuinely exists — single-table inheritance, or a test double that cannot be built another way.
