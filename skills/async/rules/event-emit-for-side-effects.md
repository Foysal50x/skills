---
title: Announce State Changes, Do Not Perform Side Effects Inline
impact: HIGH
impactDescription: adding a reaction stops meaning editing the use case
tags: events, side-effects, decoupling, domain
---

## Announce State Changes, Do Not Perform Side Effects Inline

When a use case completes, the Action dispatches a past-tense Domain Event. Emails, analytics, cache invalidation, downstream syncs and metering are listeners.

The test: adding a new reaction should not require editing the Action.

**Incorrect (the Action grows a line per consumer, forever):**

```php
final readonly class PlaceOrderAction
{
    public function handle(CreateOrderData $data): Order
    {
        $order = $this->orders->place($data);

        Mail::to($order->customer)->send(new OrderConfirmation($order));
        UsageRecord::create(['tenant_id' => $order->tenant_id, 'amount' => $order->total]);
        Http::post(config('analytics.url'), ['event' => 'order_placed']);
        Cache::tags(['orders'])->flush();
        $this->search->index($order);

        return $order;
    }
}
```

**Correct:**

```php
final readonly class PlaceOrderAction
{
    public function handle(CreateOrderData $data): Order
    {
        $order = DB::transaction(fn (): Order => $this->orders->place($data));

        OrderPlaced::dispatch($order->tenantId(), $order->id());

        return $order;
    }
}
```

```php
// Each consumer registers its own listener, in its own domain:
// Domain/Notifications/Listeners/SendOrderConfirmation.php
// Domain/Billing/Listeners/RecordOrderUsage.php
// Domain/Search/Listeners/IndexOrder.php
```

Keep effects that are part of the use case's own invariants inside the Action — reserving stock is not a reaction, it is the use case.
