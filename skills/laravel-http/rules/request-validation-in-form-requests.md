---
title: Validation Lives in a Form Request
impact: HIGH
impactDescription: one testable place per endpoint's input contract
tags: validation, form-request, controller
---

## Validation Lives in a Form Request

Inline `$request->validate()` mixes the input contract with the controller's job, cannot be reused by a second endpoint, and cannot be unit-tested without a full HTTP round trip. A Form Request holds the rules, the authorization decision, input normalization and the DTO conversion.

Name it after the action: `StoreOrderRequest`, `UpdateOrderRequest`, `SearchOrdersRequest`.

**Incorrect:**

```php
final class StoreOrderController
{
    public function __invoke(Request $request, PlaceOrderAction $action): JsonResponse
    {
        $data = $request->validate([
            'customer_id' => 'required|integer|exists:customers,id',
            'items' => 'required|array|min:1',
        ]);

        return response()->json(new OrderResource($action->handle(CreateOrderData::fromArray($data))), 201);
    }
}
```

**Correct:**

```php
final class StoreOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', Order::class) ?? false;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'customer_id' => ['required', 'integer', 'exists:customers,id'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.sku' => ['required', 'string'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
        ];
    }

    public function toDto(): CreateOrderData
    {
        return new CreateOrderData(
            customerId: (int) $this->validated('customer_id'),
            items: $this->validated('items'),
        );
    }
}
```

Prefer array rule syntax over pipe strings: it survives rules that contain a `|`, such as regexes and `Rule` objects.
