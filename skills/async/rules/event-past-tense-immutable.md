---
title: Events Are Immutable and Past Tense
impact: MEDIUM-HIGH
impactDescription: an event states a fact rather than requesting an action
tags: events, naming, immutability, ddd
---

## Events Are Immutable and Past Tense

An event records something that already happened, so its name is past tense and its data cannot change. A present-tense or imperative name — `SendOrderEmail`, `ProcessOrder` — is a command wearing an event's clothes, and it couples the producer to one consumer.

Shape: `final readonly`, public promoted properties, no methods that mutate.

**Incorrect (a command named as an event, with mutable state):**

```php
class SendOrderEmail
{
    public Order $order;
    public bool $handled = false;    // listeners mutate shared state

    public function __construct(Order $order) { $this->order = $order; }
}
```

**Correct:**

```php
namespace App\Domain\Orders\Events;

final readonly class OrderPlaced
{
    public function __construct(
        public TenantId $tenantId,
        public OrderId $orderId,
        public CarbonImmutable $placedAt,
    ) {}
}
```

Good names: `OrderPlaced`, `OrderCancelled`, `PaymentCaptured`, `ConversationCompleted`, `UsageThresholdReached`.
Bad names: `OrderEvent`, `ProcessOrder`, `SendReceipt`, `OrderHandler`, `UpdateInventory`.

If you find yourself wanting a listener to return a value to the producer, you wanted a synchronous call — see the `laravel-skill:patterns` skill on Open Host Services.
