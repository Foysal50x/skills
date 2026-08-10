---
title: Assert the Effects an Endpoint Queues
impact: MEDIUM-HIGH
impactDescription: covers the work that happens after the response
tags: feature-test, queues, events, side-effects
---

## Assert the Effects an Endpoint Queues

Most of what an endpoint does happens after the response: jobs queued, events dispatched, mail sent. A feature test asserting only the 201 covers a fraction of the behavior.

Fake the boundary and assert what was recorded — including the queue it went to.

**Incorrect (the response is checked, the work is not):**

```php
it('creates an order', function (): void {
    $this->actingAs($user)->postJson('/api/orders', $payload)->assertCreated();
});
```

**Correct:**

```php
it('creates the order and queues its side effects', function (): void {
    Queue::fake();
    Event::fake([OrderPlaced::class]);

    $this->actingAs($user)
        ->postJson('/api/orders', $payload)
        ->assertCreated()
        ->assertJsonPath('data.status', 'pending');

    $order = Order::sole();

    Event::assertDispatched(
        OrderPlaced::class,
        fn (OrderPlaced $event) => $event->orderId->value === $order->id,
    );

    Queue::assertPushedOn('high', SendOrderConfirmation::class);
});
```

```php
// And that nothing fires on the failure path:
it('queues nothing when validation fails', function (): void {
    Queue::fake();

    $this->actingAs($user)->postJson('/api/orders', ['items' => []])->assertUnprocessable();

    Queue::assertNothingPushed();
});
```

`Event::fake()` with no arguments suppresses model events too, which can break other assertions — always name the classes.
