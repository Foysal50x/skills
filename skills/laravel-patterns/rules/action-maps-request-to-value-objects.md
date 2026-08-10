---
title: Map HTTP Input to Domain Types at the Edge
impact: HIGH
impactDescription: keeps HTTP out of the domain
tags: action, request, dto, boundary
---

## Map HTTP Input to Domain Types at the Edge

`Illuminate\Http\Request` stops at the Controller or Form Request. Everything inward — Actions, Services, Repositories, Query Classes — takes plain domain values, DTOs or Value Objects.

This is what makes an Action callable from a queue worker or a console command without inventing a fake request.

**Incorrect (Request travels inward):**

```php
final readonly class PlaceOrderAction
{
    public function handle(Request $request): Order { /* ... */ }
}

// Now the nightly import command has to fake a Request to reuse it.
```

**Correct (Form Request produces the DTO, Action takes the DTO):**

```php
final class StoreOrderRequest extends FormRequest
{
    public function toDto(): CreateOrderData
    {
        return new CreateOrderData(
            customerId: (int) $this->validated('customer_id'),
            items: $this->validated('items'),
        );
    }
}

final class StoreOrderController
{
    public function __invoke(StoreOrderRequest $request, PlaceOrderAction $action): JsonResponse
    {
        return response()->json(new OrderResource($action->handle($request->toDto())), 201);
    }
}

// The import command builds the same DTO from a CSV row — no HTTP involved.
$action->handle(new CreateOrderData(customerId: $row['customer'], items: $row['items']));
```

See `rules/vo-composite-filter-per-query.md` for the read-side equivalent.
