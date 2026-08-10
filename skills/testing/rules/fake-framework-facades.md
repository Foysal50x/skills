---
title: Fake Framework Boundaries With the Built-In Fakes
impact: HIGH
impactDescription: assert what was dispatched without running it
tags: fakes, queue, event, mail, http
---

## Fake Framework Boundaries With the Built-In Fakes

Laravel's fakes record calls instead of performing them, and give you assertions over what was recorded. Use them for anything that leaves the process.

`Queue::fake()`, `Bus::fake()`, `Event::fake()`, `Mail::fake()`, `Notification::fake()`, `Storage::fake()`, `Http::fake()`.

**Incorrect (relies on `sync` and actually performs the work):**

```php
it('places an order', function (): void {
    $this->postJson('/api/orders', $payload)->assertCreated();

    expect(Mail::to(...))->/* no way to assert; the mail was really attempted */;
});
```

**Correct:**

```php
it('queues confirmation and usage recording when an order is placed', function (): void {
    Event::fake([OrderPlaced::class]);

    $order = app(PlaceOrderAction::class)->handle($data);

    Event::assertDispatched(OrderPlaced::class, fn (OrderPlaced $e) => $e->orderId->value === $order->id);
});
```

```php
it('dispatches the export to the low queue', function (): void {
    Queue::fake();

    app(PlaceExportAction::class)->handle($user, $filter);

    Queue::assertPushedOn('low', GenerateOrderExport::class);
    Queue::assertPushed(GenerateOrderExport::class, 1);
});
```

```php
it('retries the upstream call', function (): void {
    Http::fake(['upstream.test/*' => Http::sequence()
        ->push(status: 500)
        ->push(['ok' => true], 200)]);

    (new SyncToUpstream($payload))->handle();

    Http::assertSentCount(2);
});
```

`Event::fake()` with no arguments suppresses *every* event, including model events other assertions rely on. Pass the specific classes.
