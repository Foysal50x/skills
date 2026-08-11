---
title: An Action Orchestrates One Use Case End to End
impact: HIGH
impactDescription: single home for a use case, callable from any entry point
tags: action, orchestration, structure
---

## An Action Orchestrates One Use Case End to End

An Action owns one use case from entry to result: it coordinates Services and Repositories, applies the workflow rules, dispatches side effects and returns a domain type. It is callable from a controller, a job, a console command or a test without change.

Shape: `final readonly`, constructor injection, one public `handle()`.

**Incorrect (Action returns an HTTP concern and reads the request):**

```php
final class PlaceOrderAction
{
    public function handle(Request $request): JsonResponse
    {
        $order = Order::create($request->validated());

        return response()->json(['id' => $order->id], 201);
    }
}
```

**Correct (domain in, domain out):**

```php
namespace App\Domain\Orders\Actions;

final readonly class PlaceOrderAction
{
    public function __construct(
        private OrderRepositoryInterface $orders,
        private PricingService $pricing,
    ) {}

    public function handle(CreateOrderData $data): Order
    {
        $order = DB::transaction(fn (): Order => $this->orders->place(
            $data,
            $this->pricing->totalFor($data),
        ));

        OrderPlaced::dispatch($order->tenantId(), $order->id());   // after the commit

        return $order;
    }
}
```

The transaction covers the write and nothing else: an event dispatched inside it can reach a queued listener before the commit. See the `laravel-async` skill's `event-dispatch-after-commit` rule.

The controller maps `Request` to `CreateOrderData` and the result to a Resource. See `rules/action-maps-request-to-value-objects.md`.
