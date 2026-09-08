---
title: Trace Data and Effects Across the Whole Path
impact: CRITICAL
impactDescription: prevents a locally correct mutation from violating validation, authorization, persistence or asynchronous consumers
tags: context, data-flow, side-effects, authorization, transactions
---

## Trace Data and Effects Across the Whole Path

Trace the changed value from input through validation, domain logic, persistence and every emitted effect. Establish who owns validation, authorization and each transition before moving logic; a field name or model relationship is not proof of permission or lifecycle.

**Incorrect (the controller mutates state before the domain contract runs):**

```php
public function cancel(Order $order): Response
{
    $order->update(['status' => OrderStatus::Cancelled]);

    return response()->noContent();
}
```

**Correct (the Action owns the transition and its effects):**

```php
public function __invoke(CancelOrderRequest $request, Order $order, CancelOrderAction $action): Response
{
    $action->handle($order, $request->reason());

    return response()->noContent();
}
```

Use `laravel-rest-api` for the request boundary and `laravel-async` for effects that must happen after persistence commits.
