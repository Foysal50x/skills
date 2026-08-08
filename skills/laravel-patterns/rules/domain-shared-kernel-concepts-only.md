---
title: The Shared Kernel Holds Concepts, Never Calls
impact: HIGH
impactDescription: keeps the shared layer small enough to change safely
tags: ddd, shared-kernel, support, contracts
---

## The Shared Kernel Holds Concepts, Never Calls

`app/Support/` and `app/Contracts/` are the Shared Kernel: universal, stable, cross-domain Value Objects, identities and generic interfaces — `Money`, `TenantId`, `UserId`, `DateRange`, `DateRangable`.

It must stay small and stable, contain **no domain behavior**, and change only with cross-domain coordination. It is for shared *primitives*, never a channel for one domain to invoke another.

**Incorrect (domain behavior and a cross-domain call smuggled into the kernel):**

```php
namespace App\Support;

final class OrderHelper
{
    public static function isRefundable(int $orderId): bool
    {
        return \App\Domain\Orders\Models\Order::find($orderId)?->status === 'paid';
    }
}
```

**Correct (pure, universal, no domain knowledge):**

```php
namespace App\Support;

final readonly class Money
{
    public function __construct(public int $minorUnits, public string $currency) {}

    public function plus(Money $other): self
    {
        if ($other->currency !== $this->currency) {
            throw new InvalidArgumentException('Cannot add different currencies.');
        }

        return new self($this->minorUnits + $other->minorUnits, $this->currency);
    }
}

final readonly class TenantId
{
    public function __construct(public int $value) {}
}
```

Refundability is an Orders rule and stays in Orders.
