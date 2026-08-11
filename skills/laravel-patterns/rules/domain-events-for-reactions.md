---
title: Use Domain Events for Cross-Domain Reactions
impact: HIGH
impactDescription: the preferred integration pattern — decoupled and async
tags: ddd, events, listeners, integration
---

## Use Domain Events for Cross-Domain Reactions

When domain A's state changes meaningfully and domain B must react, A dispatches a Domain Event and B listens in its own model. This is the preferred pattern for "when X happens in A, B does Y".

Rules:

- Events live with the **producer**: `Domain/<Context>/Events/`. Immutable, past-tense: `OrderPlaced`, `ConversationCompleted`, `UsageThresholdReached`.
- Events carry **identity plus minimal data** — `OrderId`, Value Objects. Never aggregate roots or Eloquent Models.
- Listeners live with the **consumer**: `Domain/<OtherContext>/Listeners/`. A listener touches only its own domain's Repositories and Actions.
- Side-effecting listeners run **queued**. Pure read-model projections may run inline.

**Incorrect (producer performs the consumer's work, and ships a Model):**

```php
final readonly class PlaceOrderAction
{
    public function handle(CreateOrderData $data): Order
    {
        $order = $this->orders->place($data);

        UsageRecord::create(['amount' => $order->total]);          // Billing's job
        Mail::to($order->customer)->send(new OrderConfirmation($order));

        return $order;
    }
}
```

**Correct (producer announces, consumers react on their own side):**

```php
// Domain/Orders/Events/OrderPlaced.php
final readonly class OrderPlaced
{
    public function __construct(public TenantId $tenantId, public OrderId $orderId) {}
}

// Domain/Orders/Actions/PlaceOrderAction.php
$order = DB::transaction(fn (): Order => $this->orders->place($data));
OrderPlaced::dispatch($order->tenantId(), $order->id());

// Domain/Billing/Listeners/RecordOrderUsage.php   — queued, Billing's data only
// Domain/Notifications/Listeners/SendOrderConfirmation.php — queued
```

Dispatch after the transaction commits so listeners never read uncommitted state.
