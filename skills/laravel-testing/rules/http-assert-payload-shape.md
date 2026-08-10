---
title: Assert the Payload Shape, Not Just the Status
impact: MEDIUM-HIGH
impactDescription: makes an accidental contract change fail the build
tags: feature-test, api, resources, contracts
---

## Assert the Payload Shape, Not Just the Status

`assertOk()` passes for any body. Since the Resource is the API contract, the test should pin its shape — the keys, their types, and that nothing extra leaked.

`assertJsonStructure` catches missing keys. Add an explicit check for keys that must *not* appear.

**Incorrect:**

```php
it('returns an order', function (): void {
    $order = Order::factory()->create();

    $this->actingAs($user)->getJson("/api/orders/{$order->id}")->assertOk();
});
```

**Correct:**

```php
it('returns the documented order shape', function (): void {
    $order = Order::factory()->for($merchant)->create(['number' => 'A-1']);

    $this->actingAs($merchant->owner)
        ->getJson("/api/orders/{$order->id}")
        ->assertOk()
        ->assertJsonStructure([
            'data' => ['id', 'number', 'status', 'total' => ['amount', 'currency'], 'placed_at'],
        ])
        ->assertJsonPath('data.number', 'A-1')
        ->assertJsonPath('data.status', 'pending')
        ->assertJsonMissingPath('data.internal_notes')
        ->assertJsonMissingPath('data.payment_token');
});
```

```php
// Validation contracts deserve the same treatment:
it('rejects an empty item list', function (): void {
    $this->actingAs($user)
        ->postJson('/api/orders', ['customer_id' => $customer->id, 'items' => []])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['items']);
});
```

`assertJsonMissingPath` on sensitive fields is what turns a Resource allow-list from a convention into an enforced rule.
