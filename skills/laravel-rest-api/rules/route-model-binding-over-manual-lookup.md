---
title: Bind Route Models Instead of Looking Them Up
impact: HIGH
impactDescription: removes lookup boilerplate and gives a consistent 404
tags: routing, model-binding, controller
---

## Bind Route Models Instead of Looking Them Up

Type-hint the model and Laravel resolves it from the route parameter, returning 404 when it does not exist. Manual `findOrFail()` in every method repeats the lookup and drifts — one method uses `find()` and returns a 500 on null.

Bind by a non-key column with `getRouteKeyName()` or inline in the route.

**Incorrect:**

```php
Route::get('/orders/{id}', [OrderController::class, 'show']);

public function show(int $id): JsonResponse
{
    $order = Order::find($id);          // null → 500 in the Resource

    return response()->json(new OrderResource($order));
}
```

**Correct:**

```php
Route::get('/orders/{order}', OrderShowController::class);

final class OrderShowController
{
    public function __invoke(Order $order, OrderRepositoryInterface $orders): OrderResource
    {
        return new OrderResource($orders->withDetail($order));
    }
}
```

The controller does not call `load()` itself: eager loading is query construction, so the Repository owns which relations the Resource can read. See `rules/controller-no-query-construction.md` and `rules/resource-when-loaded-for-relations.md`.

```php
// Bind by slug instead of id:
final class Project extends Model
{
    public function getRouteKeyName(): string
    {
        return 'slug';
    }
}

// Or per-route:
Route::get('/projects/{project:slug}', ProjectShowController::class);
```

Binding respects global scopes, so a tenant global scope makes cross-tenant URLs 404 automatically.
