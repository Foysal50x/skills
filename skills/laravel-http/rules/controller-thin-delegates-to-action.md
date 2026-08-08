---
title: A Controller Maps HTTP and Delegates
impact: MEDIUM-HIGH
impactDescription: the use case becomes reusable outside HTTP
tags: controller, action, boundary
---

## A Controller Maps HTTP and Delegates

A controller does four things: receive a validated request, convert it to a DTO, call an Action or a Repository, and shape the result into a response. Anything else — business rules, transactions, dispatching jobs, sending mail — belongs in the Action.

The measure: a controller method should be readable in one glance, usually three to five lines.

**Incorrect (the use case lives in the controller):**

```php
public function store(StoreOrderRequest $request): JsonResponse
{
    $order = DB::transaction(function () use ($request) {
        $order = Order::create($request->validated());
        foreach ($request->validated('items') as $item) {
            $order->items()->create($item);
            Product::where('sku', $item['sku'])->decrement('stock', $item['quantity']);
        }
        return $order;
    });

    Mail::to($order->customer)->send(new OrderConfirmation($order));
    UsageRecord::create(['tenant_id' => $order->tenant_id, 'amount' => $order->total]);

    return response()->json(new OrderResource($order), 201);
}
```

**Correct:**

```php
final class StoreOrderController
{
    public function __invoke(StoreOrderRequest $request, PlaceOrderAction $action): JsonResponse
    {
        return response()->json(
            new OrderResource($action->handle($request->toDto())),
            Response::HTTP_CREATED,
        );
    }
}
```

The Action now runs identically from the CSV importer and the test suite.
