---
title: Serialize Through a Resource, Never a Raw Model
impact: HIGH
impactDescription: the response shape stops depending on the schema
tags: resources, api, serialization, security
---

## Serialize Through a Resource, Never a Raw Model

Returning a Model or a Collection of Models makes the API contract equal to the table. Add a column and it appears in the response; rename one and every client breaks. `$hidden` helps but is a denylist — the next sensitive column is exposed by default.

Every JSON response goes through a `JsonResource` or `ResourceCollection`, which is an allow-list.

**Incorrect:**

```php
return response()->json($order);

return response()->json(Order::with('customer')->paginate(25));
```

**Correct:**

```php
final class OrderResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'number' => $this->number,
            'status' => $this->status->value,
            'total' => $this->total->minorUnits,
            'currency' => $this->total->currency,
            'placed_at' => $this->created_at->toIso8601String(),
        ];
    }
}
```

```php
return new OrderResource($order);

return OrderResource::collection($orders);   // keeps pagination meta and links
```

Returning the Resource directly from the controller is enough — Laravel converts it to a response.
