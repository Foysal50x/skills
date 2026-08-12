---
title: Keep Transactions Short and Free of External Calls
impact: HIGH
impactDescription: avoids holding row locks across network latency
tags: transactions, locking, performance, http
---

## Keep Transactions Short and Free of External Calls

A transaction holds locks for its whole duration. An HTTP call, a mail send or a file upload inside one holds those locks across network latency — and if the remote hangs, so does every request contending for the same rows.

Do the external work before or after. Inside the transaction, only database statements.

**Incorrect (row locks held for the length of a payment API round trip):**

```php
DB::transaction(function () use ($order): void {
    $order->update(['status' => OrderStatus::Processing]);

    $charge = Http::post('https://payments.test/charge', [...])->json();   // seconds

    $order->update(['status' => OrderStatus::Paid, 'charge_id' => $charge['id']]);
    Mail::to($order->customer)->send(new Receipt($order));
});
```

**Correct (external call outside, transaction narrow, mail queued after commit):**

```php
$order->update(['status' => OrderStatus::Processing]);

$charge = $this->payments->charge(
    amount: $order->total,
    token: $order->paymentToken(),
    idempotencyKey: "order-{$order->id}-charge",
);

DB::transaction(function () use ($order, $charge): void {
    $order->update(['status' => OrderStatus::Paid, 'charge_id' => $charge->id]);
    $order->items()->update(['paid_at' => now()]);
});

OrderPaid::dispatch($order->tenantId(), $order->id());
```

Moving the call out does not make the pair atomic — it moves the failure. If the transaction fails after the charge succeeds, the customer is charged and the order is not paid. That is why the charge carries an idempotency key: a retry re-attaches the same charge instead of creating a second one, and a reconciliation job can settle any `Processing` order left behind by asking the provider what happened to that key.

A longer transaction does not fix this. Atomicity across a network boundary is a saga or an outbox.
