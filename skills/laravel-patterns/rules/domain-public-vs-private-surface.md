---
title: A Domain Has a Public Surface and a Private One
impact: CRITICAL
impactDescription: the rule every other inter-domain rule depends on
tags: ddd, bounded-context, encapsulation, boundary
---

## A Domain Has a Public Surface and a Private One

Domains are bounded contexts. Each has exactly two surfaces:

- **Private** — `Models/`, `Repositories/`, `Queries/`, internal `Services/`, `Filters/` internals. No other domain may import these, ever.
- **Public** — its `Contracts/` (interfaces and DTOs), its `Events/`, and the Shared Kernel (`app/Support`, `app/Contracts`).

Cross-domain code touches only the public surface.

Note that a Repository interface returns Models, which makes it an *intra*-domain boundary — not the cross-domain surface. Cross-domain reads use a separate DTO-returning contract.

**Incorrect (Billing reaches into Orders' internals):**

```php
namespace App\Domain\Billing\Services;

use App\Domain\Orders\Models\Order;               // forbidden
use App\Domain\Orders\Repositories\EloquentOrderRepository;  // forbidden

final readonly class UsageCalculatorService
{
    public function chargeFor(Order $order): Money { /* ... */ }
}
```

**Correct (Billing depends on Orders' published contract):**

```php
namespace App\Domain\Billing\Services;

use App\Domain\Orders\Contracts\OrderIntegrationInterface;

final readonly class UsageCalculatorService
{
    public function __construct(private OrderIntegrationInterface $orders) {}

    public function chargeFor(OrderId $id): Money
    {
        $summary = $this->orders->orderSummary($id);   // a DTO, not an Order
        // ...
    }
}
```

Pick the integration pattern with `references/inter-domain-decision-guide.md`.
