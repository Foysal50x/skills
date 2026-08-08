---
title: Make Every Job Handler Idempotent
impact: CRITICAL
impactDescription: prevents double charges, duplicate emails and doubled counters
tags: jobs, idempotency, queues, correctness
---

## Make Every Job Handler Idempotent

Queues deliver at least once. A worker that crashes after doing the work but before acknowledging the job causes a retry — so every handler must be safe to run twice.

The techniques, in order of preference: a unique constraint the second attempt violates harmlessly, a guard on current state, or an explicit processed-marker keyed by an idempotency key.

**Incorrect (retry charges the customer twice):**

```php
final class ChargeOrder implements ShouldQueue
{
    public function handle(PaymentGateway $gateway): void
    {
        $order = Order::findOrFail($this->orderId);

        $charge = $gateway->charge($order->total, $order->paymentToken());

        $order->update(['status' => OrderStatus::Paid, 'charge_id' => $charge->id]);
    }
}
```

**Correct (guard on state, and give the gateway an idempotency key):**

```php
final class ChargeOrder implements ShouldQueue
{
    public function __construct(private readonly int $orderId) {}

    public function handle(PaymentGateway $gateway): void
    {
        $order = Order::findOrFail($this->orderId);

        if ($order->status !== OrderStatus::Pending) {
            return;   // already charged, or cancelled — nothing to do
        }

        $charge = $gateway->charge(
            amount: $order->total,
            token: $order->paymentToken(),
            idempotencyKey: "order-{$order->id}-charge",
        );

        $order->update(['status' => OrderStatus::Paid, 'charge_id' => $charge->id]);
    }
}
```

```php
// Or let the database enforce it:
UsageRecord::firstOrCreate(
    ['tenant_id' => $tenantId, 'order_id' => $orderId],   // unique index
    ['amount' => $amount],
);
```

Test it by calling `handle()` twice and asserting the same end state.
