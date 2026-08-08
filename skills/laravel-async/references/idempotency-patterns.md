# Making a Handler Repeat-Safe

Queues deliver at least once. Pick the cheapest pattern that fits.

## 1. Database constraint (preferred)

Let the schema reject the duplicate. No extra state, no race window.

```php
UsageRecord::firstOrCreate(
    ['tenant_id' => $tenantId, 'order_id' => $orderId],   // unique index
    ['amount' => $amount],
);
```

```php
$table->unique(['tenant_id', 'order_id']);
```

Works for: metering rows, audit entries, join-table writes, anything with a natural key.

## 2. State guard

Check whether the work is already done and return early.

```php
if ($order->status !== OrderStatus::Pending) {
    return;
}
```

Works for: state machines where the transition is one-way. Not safe on its own for money — pair it with a lock or pattern 4.

## 3. Atomic operation

Express the change as one statement rather than read-modify-write.

```php
Product::whereKey($id)->where('stock', '>=', $qty)->decrement('stock', $qty);
```

The `where` makes it conditional and atomic. Check the affected-row count to know whether it applied.

## 4. Idempotency key

Give the external system a key so *it* deduplicates.

```php
$gateway->charge(
    amount: $order->total,
    token: $order->paymentToken(),
    idempotencyKey: "order-{$order->id}-charge",
);
```

Works for: payment gateways, most modern REST APIs. Required for anything that moves money.

## 5. Processed marker (last resort)

Record that this exact unit was handled.

```php
$key = "processed:webhook:{$event->id}";

if (! Cache::add($key, true, now()->addDays(7))) {
    return;   // already handled
}
```

`Cache::add()` is atomic — it returns false if the key exists. Needs an atomic store, and a TTL long enough to outlive every retry.

## Reducing duplicates is not the same as tolerating them

`ShouldBeUnique` narrows the window; it does not close it. A worker can crash between doing the work and acknowledging, after the uniqueness lock is released. Uniqueness is an optimization; one of patterns 1–5 is the correctness argument.

## Testing it

```php
it('is safe to run twice', function (): void {
    $order = Order::factory()->pending()->create();

    (new ChargeOrder($order->id))->handle($gateway);
    (new ChargeOrder($order->id))->handle($gateway);

    expect($order->fresh()->status)->toBe(OrderStatus::Paid)
        ->and(Charge::where('order_id', $order->id)->count())->toBe(1);
});
```
