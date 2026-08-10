---
title: A Listener Touches Only Its Own Domain
impact: HIGH
impactDescription: keeps bounded contexts bounded
tags: events, listeners, ddd, boundary
---

## A Listener Touches Only Its Own Domain

Listeners live with the **consumer**, in `Domain/<Context>/Listeners/`, and use only that domain's Repositories and Actions. A listener that reaches into the producer's Models has moved the coupling rather than removed it.

Registration follows the same rule: the consumer registers its own listeners.

**Incorrect (Billing's listener queries Orders' tables):**

```php
namespace App\Domain\Billing\Listeners;

use App\Domain\Orders\Models\Order;       // forbidden cross-domain import

final class RecordOrderUsage
{
    public function handle(OrderPlaced $event): void
    {
        $order = Order::with('items')->find($event->orderId->value);

        UsageRecord::create(['amount' => $order->items->sum('total')]);
    }
}
```

**Correct:**

```php
namespace App\Domain\Billing\Listeners;

use App\Domain\Orders\Contracts\OrderIntegrationInterface;   // public surface
use App\Domain\Orders\Events\OrderPlaced;                    // public surface

final readonly class RecordOrderUsage implements ShouldQueue
{
    public function __construct(
        private OrderIntegrationInterface $orders,
        private RecordUsageAction $recordUsage,
    ) {}

    public function handle(OrderPlaced $event): void
    {
        $summary = $this->orders->orderSummary($event->orderId);

        $this->recordUsage->handle($event->tenantId, $summary->total);
    }
}
```

A domain's `Events/` and `Contracts/` are public. Its `Models/`, `Repositories/` and `Queries/` are not — see the `laravel-patterns` skill.
