---
title: Prefer Single-Action Invokable Controllers
impact: MEDIUM
impactDescription: one route, one class, no shared mutable surface
tags: controller, structure, routing
---

## Prefer Single-Action Invokable Controllers

A resource controller with seven methods accumulates shared constructor dependencies that most methods do not use, and shared middleware that most methods do not need. An invokable controller per route keeps each endpoint's dependencies exact.

Resource controllers remain fine for genuine CRUD where all seven methods share the same model, policy and dependencies.

**Incorrect (dependencies injected for the two methods that need them):**

```php
final class OrderController extends Controller
{
    public function __construct(
        private PlaceOrderAction $place,
        private CancelOrderAction $cancel,
        private RefundOrderAction $refund,
        private OrderRepositoryInterface $orders,
        private ExportService $export,
    ) {}

    public function index() { /* uses $orders */ }
    public function store() { /* uses $place */ }
    // ... five more, each resolving all five dependencies
}
```

**Correct:**

```php
final class OrderIndexController
{
    public function __invoke(SearchOrdersRequest $request, OrderRepositoryInterface $orders): AnonymousResourceCollection
    {
        return OrderResource::collection($orders->searchOrders($request->toFilter()));
    }
}

final class OrderStoreController
{
    public function __invoke(StoreOrderRequest $request, PlaceOrderAction $action): JsonResponse
    {
        return response()->json(new OrderResource($action->handle($request->toDto())), 201);
    }
}
```

```php
Route::get('/orders', OrderIndexController::class)->name('orders.index');
Route::post('/orders', OrderStoreController::class)->name('orders.store');
```
