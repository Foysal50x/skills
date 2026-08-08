---
title: The Request Stops at the Controller
impact: HIGH
impactDescription: keeps Actions callable from jobs, commands and tests
tags: request, boundary, dto, testability
---

## The Request Stops at the Controller

`Illuminate\Http\Request` — and `FormRequest`, and `$request->all()` — do not travel past the controller. Actions, Services, Repositories and Query Classes take DTOs, Value Objects or plain values.

The test is simple: can a console command call this Action? If it would have to fabricate a `Request`, the boundary is in the wrong place.

**Incorrect:**

```php
final readonly class PlaceOrderAction
{
    public function handle(Request $request): Order { /* ... */ }
}

// The nightly CSV importer now does this:
$action->handle(Request::create('/orders', 'POST', $row));
```

**Correct:**

```php
final readonly class PlaceOrderAction
{
    public function handle(CreateOrderData $data): Order { /* ... */ }
}
```

```php
// HTTP:
$action->handle($request->toDto());

// Console:
$action->handle(new CreateOrderData(customerId: $row['customer_id'], items: $row['items']));

// Test:
$action->handle(new CreateOrderData(customerId: 1, items: [['sku' => 'A1', 'quantity' => 2]]));
```

The same rule applies to `auth()->user()` inside domain classes: pass the user, or the identity, as a parameter.
