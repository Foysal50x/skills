---
title: Authorize Before the Domain Runs
impact: CRITICAL
impactDescription: closes the most common access-control gap
tags: authorization, security, policies, form-request
---

## Authorize Before the Domain Runs

Every request that reads or writes non-public data is authorized at the edge, before the Action executes. The three places that qualify: a Form Request's `authorize()`, a controller `authorize()` call, or route middleware.

Authorization inside the Action is too late in one important way — it mixes the access decision with the use case, so the same Action called from a console command silently enforces a user policy that has no user.

**Incorrect (the write happens, then the check):**

```php
final class UpdateOrderController
{
    public function __invoke(Request $request, Order $order, UpdateOrderAction $action): JsonResponse
    {
        $order = $action->handle($order, $request->validated());

        abort_unless($request->user()->can('update', $order), 403);   // already updated

        return response()->json(new OrderResource($order));
    }
}
```

**Correct (Form Request decides, then the Action runs):**

```php
final class UpdateOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('update', $this->route('order')) ?? false;
    }
}

final class UpdateOrderController
{
    public function __invoke(UpdateOrderRequest $request, Order $order, UpdateOrderAction $action): JsonResponse
    {
        return response()->json(new OrderResource($action->handle($order, $request->toDto())));
    }
}
```

Laravel 13 adds `#[Authorize]` on controller methods — see `rules/controller-attributes-for-middleware-and-authorization.md`.
