---
title: Test Rollback and Repeat-Safety Explicitly
impact: HIGH
impactDescription: proves the two properties production depends on
tags: database, transactions, idempotency, jobs
---

## Test Rollback and Repeat-Safety Explicitly

Two properties are assumed everywhere and asserted almost nowhere: that a failing multi-step write leaves nothing behind, and that a queued handler run twice produces the same state as running it once.

Both are one short test each.

**Incorrect (the happy path only):**

```php
it('places an order', function (): void {
    $order = app(PlaceOrderAction::class)->handle($data);

    expect($order->status)->toBe(OrderStatus::Pending);
});
```

**Correct (rollback):**

```php
it('leaves no partial state when reserving stock fails', function (): void {
    $product = Product::factory()->create(['stock' => 0]);

    expect(fn () => app(PlaceOrderAction::class)->handle($dataFor($product)))
        ->toThrow(StockException::class);

    expect(Order::count())->toBe(0)
        ->and(OrderItem::count())->toBe(0)
        ->and($product->fresh()->stock)->toBe(0);
});
```

**Correct (idempotency):**

```php
it('charges the order only once when the job runs twice', function (): void {
    $order = Order::factory()->pending()->create();
    $gateway = new FakePaymentGateway();

    (new ChargeOrder($order->id))->handle($gateway);
    (new ChargeOrder($order->id))->handle($gateway);

    expect($order->fresh()->status)->toBe(OrderStatus::Paid)
        ->and($gateway->chargeCount)->toBe(1);
});
```

Note that `RefreshDatabase` wraps the test in its own transaction, so a nested `DB::transaction()` rollback still works — but `DB::afterCommit()` callbacks will not fire until the outer test transaction ends. Assert the dispatch with `Queue::fake()` rather than the side effect.
