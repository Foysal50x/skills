---
title: Guard Relations With whenLoaded
impact: HIGH
impactDescription: a Resource can no longer trigger N+1 on its own
tags: resources, n+1, relations, performance
---

## Guard Relations With whenLoaded

A Resource that reads `$this->customer` lazy-loads it when the feeding query did not. That is an N+1 the Resource caused, and it appears wherever that Resource is reused.

`whenLoaded()` includes the relation only if it is already loaded, so the query decides the payload and the Resource cannot surprise it.

**Incorrect (one extra query per row, wherever this Resource is used):**

```php
public function toArray(Request $request): array
{
    return [
        'id' => $this->id,
        'customer' => new CustomerResource($this->customer),
        'items' => ItemResource::collection($this->items),
        'item_count' => $this->items->count(),
    ];
}
```

**Correct:**

```php
public function toArray(Request $request): array
{
    return [
        'id' => $this->id,
        'customer' => new CustomerResource($this->whenLoaded('customer')),
        'items' => ItemResource::collection($this->whenLoaded('items')),
        'item_count' => $this->whenCounted('items'),
        'total_paid' => $this->whenAggregated('payments', 'amount', 'sum'),
    ];
}
```

```php
// The query decides what the payload contains:
Order::query()->with(['customer', 'items'])->withCount('items')->paginate(25);
```

Combine with `Model::preventLazyLoading()` so a missing eager load throws in development rather than degrading in production.
