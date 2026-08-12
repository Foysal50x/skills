---
title: Make Every Job Handler Idempotent
impact: CRITICAL
impactDescription: prevents double charges, duplicate emails and doubled counters
tags: jobs, idempotency, queues, correctness
---

## Make Every Job Handler Idempotent

Queues deliver at least once: a crash after the work but before the acknowledgement causes a retry. Two attempts can also run *at the same time*, when a timeout releases a job the first copy is still working on.

So the guard must be atomic — a unique constraint, a conditional `UPDATE` whose affected-row count picks the winner, or `SELECT … FOR UPDATE`. A read-then-check is not a guard: both workers read `Pending` and both charge.

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

**Correct (atomic claim, plus an idempotency key the gateway honours):**

```php
final class ChargeOrder implements ShouldQueue
{
    public function __construct(private readonly int $orderId) {}

    public function handle(OrderRepositoryInterface $orders, PaymentGateway $gateway): void
    {
        // One conditional UPDATE behind the interface — exactly one caller wins.
        $order = $orders->claimPendingForCharge($this->orderId);

        if ($order === null) {
            return;   // another attempt owns it, or it is no longer chargeable
        }

        $charge = $gateway->charge(
            amount: $order->total,
            token: $order->paymentToken(),
            idempotencyKey: "order-{$order->id}-charge",   // the provider dedupes
        );

        $orders->markPaid($order->id, $charge->id);
    }
}
```

```php
// Or let a unique index decide, without the read-then-insert race:
UsageRecord::createOrFirst(
    ['tenant_id' => $tenantId, 'order_id' => $orderId],   // unique index
    ['amount' => $amount],
);
```

`createOrFirst()` catches the unique-constraint violation and re-reads; `firstOrCreate()` selects first, so two workers can both miss it.

A crash between the claim and the gateway response leaves the row in `Charging` — a reconciliation job settles it against `order-{id}-charge`. Test two concurrent `handle()` calls, not two sequential ones.
