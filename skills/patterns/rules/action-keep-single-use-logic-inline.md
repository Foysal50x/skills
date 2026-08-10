---
title: Keep Single-Use Logic Inside the Action
impact: HIGH
impactDescription: avoids a file per idea
tags: action, service, simplicity
---

## Keep Single-Use Logic Inside the Action

Q3 of the Decision Gate. If logic is used by exactly one Action, it belongs in that Action — as inline code or a `private` method. Do not create a Service, helper class or trait for it.

A `private` method inside the Action is the correct extraction when the `handle()` body gets long. It keeps the logic where its only caller is, and it costs nothing to inline later.

**Incorrect (one-caller Service, plus a trait nobody else uses):**

```php
final class OrderNumberGeneratorService
{
    public function generate(Merchant $merchant): string
    {
        return $merchant->prefix.'-'.Str::upper(Str::random(8));
    }
}

trait CalculatesOrderWeight { /* used by PlaceOrderAction only */ }
```

**Correct (private methods inside the single caller):**

```php
final readonly class PlaceOrderAction
{
    public function handle(CreateOrderData $data, Merchant $merchant): Order
    {
        $order = $this->orders->place($data, $this->orderNumber($merchant));
        // ...
    }

    private function orderNumber(Merchant $merchant): string
    {
        return $merchant->prefix.'-'.Str::upper(Str::random(8));
    }
}
```

When a second Action needs `orderNumber()`, promote it to a Service then — not before.
