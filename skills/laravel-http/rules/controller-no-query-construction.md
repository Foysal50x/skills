---
title: A Controller Constructs No Queries
impact: HIGH
impactDescription: keeps the query-construction boundary intact at the edge
tags: controller, query, boundary, architecture
---

## A Controller Constructs No Queries

`where()`, `orderBy()`, `with()` and `join()` do not appear in a controller. The controller builds Value Objects from the request and calls the Repository; the Query Class writes the clauses.

This holds however small the query looks. It includes:

- a single `where()` plus `paginate()` — a list is a named query, not simple CRUD
- a relation read off the authenticated user, `$request->user()->notifications()->…`
- `->when($request->boolean('unread'), …)` — an optional filter is a query rule
- a page size taken from the request, and `latest()` / `orderBy()` defaults

The same applies to a Blade view and to a Form Request: a view receives data, it does not fetch it, and `authorize()`/`rules()` never build a result set.

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

**Incorrect (small enough to feel harmless — still four query rules at the edge):**

```php
final class ListNotificationsController
{
    public function __invoke(Request $request): AnonymousResourceCollection
    {
        $notifications = $request->user()->notifications()
            ->when($request->boolean('unread'), fn (Builder $query): Builder => $query->whereNull('read_at'))
            ->latest()
            ->paginate(min((int) $request->input('per_page', 15), 100));

        return NotificationResource::collection($notifications);
    }
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

```php
final class ListNotificationsController
{
    public function __invoke(
        ListNotificationsRequest $request,
        NotificationRepositoryInterface $notifications,
    ): AnonymousResourceCollection {
        return NotificationResource::collection(
            $notifications->feedFor($request->user(), $request->toFilter()),
        );
    }
}
```

The sort column is whitelisted and the page-size cap lives in the filter Value Object, not in a controller expression. See the `laravel-patterns` skill for the full boundary.
