---
title: An ID in a Request Is a Claim, Not a Fact
impact: CRITICAL
impactDescription: closes insecure direct object reference
tags: authorization, idor, security, validation
---

## An ID in a Request Is a Claim, Not a Fact

`exists:orders,id` proves the row exists. It does not prove the caller may touch it. Every ID arriving from the client must be constrained to what that caller can reach — through a scoped relationship query, a global tenant scope, or a policy check on the resolved model.

**Incorrect (validated, existing, and belonging to someone else):**

```php
public function rules(): array
{
    return ['order_id' => ['required', 'integer', 'exists:orders,id']];
}

$order = Order::findOrFail($request->integer('order_id'));   // any tenant's order
```

**Correct (scope the lookup to the caller):**

```php
public function rules(): array
{
    return [
        'order_id' => [
            'required',
            'integer',
            Rule::exists('orders', 'id')->where('merchant_id', $this->user()->merchant_id),
        ],
    ];
}
```

```php
// Or resolve through the relationship, so the constraint is structural:
$order = $request->user()->merchant->orders()->findOrFail($request->integer('order_id'));
```

The same applies to nested route parameters — see `rules/route-scoped-bindings-for-nested-resources.md` — and to any `whereIn` built from client input.
