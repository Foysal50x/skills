---
title: A Controller Constructs No Queries
impact: HIGH
impactDescription: keeps the query-construction boundary intact at the edge
tags: controller, query, boundary, architecture
---

## A Controller Constructs No Queries

`where()`, `orderBy()`, `with()` and `join()` do not appear in a controller. The controller builds Value Objects from the request and calls the Repository; the Query Class writes the clauses.

The same applies to Blade: a view receives data, it does not fetch it.

**Incorrect (filters built in the controller, duplicated in the export endpoint):**

```php
public function index(Request $request): View
{
    $orders = Order::query()
        ->when($request->filled('status'), fn ($q) => $q->where('status', $request->input('status')))
        ->when($request->filled('from'), fn ($q) => $q->where('created_at', '>=', $request->date('from')))
        ->with('customer')
        ->orderBy($request->input('sort', 'created_at'), $request->input('dir', 'desc'))
        ->paginate(25);

    return view('orders.index', compact('orders'));
}
```

**Correct:**

```php
public function __invoke(SearchOrdersRequest $request, OrderRepositoryInterface $orders): View
{
    return view('orders.index', [
        'orders' => $orders->searchOrders($request->toFilter(), perPage: 25),
    ]);
}
```

The sort column is now whitelisted inside the Query Class rather than passed raw from the request. See the `laravel-patterns` skill for the full boundary.
