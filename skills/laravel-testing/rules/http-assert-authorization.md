---
title: Every Protected Endpoint Has an Authorization Test
impact: HIGH
impactDescription: catches the endpoint that shipped without a policy check
tags: feature-test, authorization, security
---

## Every Protected Endpoint Has an Authorization Test

The happy-path test passes whether or not the endpoint is protected. Authorization needs its own cases: unauthenticated, authenticated but not permitted, and — for tenant-scoped data — permitted for someone else's record.

The third case is the one that catches insecure direct object references.

**Incorrect (only the permitted user is tested):**

```php
it('updates an order', function (): void {
    $order = Order::factory()->create();

    $this->actingAs($order->merchant->owner)
        ->patchJson("/api/orders/{$order->id}", ['note' => 'hi'])
        ->assertOk();
});
```

**Correct (three cases, one per failure mode):**

```php
it('rejects unauthenticated requests', function (): void {
    $order = Order::factory()->create();

    $this->patchJson("/api/orders/{$order->id}", ['note' => 'hi'])->assertUnauthorized();
});

it('rejects a user from another merchant', function (): void {
    $order = Order::factory()->create();
    $outsider = User::factory()->create();

    $this->actingAs($outsider)
        ->patchJson("/api/orders/{$order->id}", ['note' => 'hi'])
        ->assertForbidden();

    expect($order->fresh()->note)->toBeNull();
});

it('scopes nested bindings to the parent', function (): void {
    $conversation = Conversation::factory()->create();
    $foreignMessage = Message::factory()->create();          // different conversation

    $this->actingAs($conversation->user)
        ->getJson("/api/conversations/{$conversation->id}/messages/{$foreignMessage->id}")
        ->assertNotFound();
});
```

Assert the state did not change, not only the status code — a 403 returned after the write has already happened is still a bug.
