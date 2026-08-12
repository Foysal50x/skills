---
title: Use First-Party JSON:API Resources When the Spec Applies
impact: MEDIUM
impactDescription: removes hand-rolled spec compliance
tags: resources, jsonapi, laravel-13, api
---

## Use First-Party JSON:API Resources When the Spec Applies

Laravel 13 ships JSON:API resources, handling resource-object serialization, relationship inclusion, sparse fieldsets, links and the compliant response headers. If the API commits to JSON:API, use them rather than reimplementing `?include=` and `?fields[]=` parsing by hand.

Laravel 13 only. On Laravel 12, either use a plain `JsonResource` shape or a third-party package.

**Incorrect (hand-rolled include and sparse-fieldset handling):**

```php
public function toArray(Request $request): array
{
    $includes = explode(',', $request->string('include')->toString());
    $fields = explode(',', $request->string('fields.orders')->toString());

    $payload = ['id' => (string) $this->id, 'type' => 'orders', 'attributes' => []];
    // ... 60 lines reimplementing the spec, subtly wrong
}
```

**Correct (Laravel 13):**

```php
use Illuminate\Http\Resources\JsonApi\JsonApiResource;

final class OrderResource extends JsonApiResource
{
    /** @return array<string, mixed> */
    public function toAttributes(Request $request): array
    {
        return [
            'number' => $this->number,
            'status' => $this->status->value,
            'placed_at' => $this->created_at->toIso8601String(),
        ];
    }

    /** @return array<string, mixed> */
    public function toRelationships(Request $request): array
    {
        return [
            'customer' => fn () => new CustomerResource($this->whenLoaded('customer')),
            'items' => fn () => OrderItemResource::collection($this->whenLoaded('items')),
        ];
    }
}
```

Do not adopt JSON:API because it is available. Adopt it when clients want the spec — otherwise a plain Resource is simpler and `rules/resource-stable-payload-shape.md` still applies.
