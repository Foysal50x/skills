---
title: Events Carry Identities, Not Models
impact: HIGH
impactDescription: smaller payloads, no stale state, no boundary leak
tags: events, serialization, ddd, boundary
---

## Events Carry Identities, Not Models

A queued listener receives a serialized event. Putting an Eloquent Model in it serializes whatever relations happen to be loaded, hands another domain your model, and delivers data that is already stale by the time the listener runs.

Carry identities and small Value Objects. The listener fetches what it needs, from its own side.

**Incorrect (an aggregate crosses the boundary, with its object graph):**

```php
final readonly class OrderPlaced
{
    public function __construct(public Order $order) {}   // items, customer, merchant
}

// Billing now depends on App\Domain\Orders\Models\Order — a forbidden import.
```

**Correct:**

```php
final readonly class OrderPlaced
{
    public function __construct(
        public TenantId $tenantId,
        public OrderId $orderId,
        public Money $total,          // shared-kernel value object, safe to carry
    ) {}
}
```

```php
final readonly class RecordOrderUsage implements ShouldQueue
{
    public function __construct(private OrderIntegrationInterface $orders) {}

    public function handle(OrderPlaced $event): void
    {
        $summary = $this->orders->orderSummary($event->orderId);   // a DTO

        UsageRecord::create([
            'tenant_id' => $event->tenantId->value,
            'amount' => $summary->total->minorUnits,
        ]);
    }
}
```

Include a field in the event only when every consumer needs it and it will not go stale. Otherwise let the consumer ask.
