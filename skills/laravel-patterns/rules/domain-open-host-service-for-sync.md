---
title: Use an Open Host Service for Synchronous Cross-Domain Reads
impact: HIGH
impactDescription: sync coupling without exposing internals
tags: ddd, integration, contracts, dto
---

## Use an Open Host Service for Synchronous Cross-Domain Reads

When domain A must synchronously read or command domain B right now, it calls a published contract — the Open Host Service — whose inputs and outputs are DTOs and Value Objects (the Published Language).

- The provider exposes the contract in its own `Contracts/`, returning DTOs, never its Models.
- The consumer type-hints the interface and receives it by constructor injection; the container binds the provider's implementation.
- Data crossing the boundary is identities, never object graphs.

**Incorrect (consumer queries the provider's tables):**

```php
namespace App\Domain\Billing\Services;

use App\Domain\Orders\Models\Order;

final readonly class UsageCalculatorService
{
    public function monthlyTotal(TenantId $tenant): Money
    {
        return Money::of(Order::where('tenant_id', $tenant->value)->sum('total'));
    }
}
```

**Correct (published contract + DTO):**

```php
// Domain/Orders/Contracts/OrderIntegrationInterface.php  — PUBLIC surface
interface OrderIntegrationInterface
{
    public function orderSummary(OrderId $id): OrderSummaryDTO;

    public function monthlyTotal(TenantId $tenant, DateRange $period): Money;
}

// Domain/Orders/Contracts/OrderSummaryDTO.php — the Published Language
final readonly class OrderSummaryDTO
{
    public function __construct(
        public OrderId $id,
        public OrderStatus $status,
        public Money $total,
        public CarbonImmutable $placedAt,
    ) {}
}

// Domain/Orders/Integration/OrderIntegration.php — implementation, uses Orders' own repository
// Domain/Billing/Services/UsageCalculatorService.php — depends on the interface only
```

Prefer a Domain Event when the interaction is a reaction rather than a question.
