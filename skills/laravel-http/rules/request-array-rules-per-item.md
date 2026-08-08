---
title: Validate Array Items, Not Just the Array
impact: HIGH
impactDescription: stops unvalidated nested payloads reaching the domain
tags: validation, arrays, security
---

## Validate Array Items, Not Just the Array

`'items' => 'required|array'` validates that `items` is an array and nothing else. Every element, and every key inside every element, passes through unchecked — including keys you never intended to accept.

Validate each element with `items.*`, and close the shape so unexpected keys are rejected rather than carried along.

**Incorrect (element shape unvalidated; a `price` key rides along into the DTO):**

```php
public function rules(): array
{
    return [
        'items' => ['required', 'array', 'min:1'],
    ];
}

// Payload: [{"sku": "A1", "quantity": 1, "price": 0}]
```

**Correct:**

```php
public function rules(): array
{
    return [
        'items' => ['required', 'array', 'min:1', 'max:100'],
        'items.*' => ['array:sku,quantity'],           // exactly these keys
        'items.*.sku' => ['required', 'string', 'max:64', 'exists:products,sku'],
        'items.*.quantity' => ['required', 'integer', 'min:1', 'max:999'],
    ];
}
```

Two things worth adding on any array input: a `max` on the array itself (an unbounded array is a denial-of-service vector), and `exists` scoped to what the caller may reach — see `rules/authz-never-trust-request-ids.md`.
