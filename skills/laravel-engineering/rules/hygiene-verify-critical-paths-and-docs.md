---
title: Verify Critical Paths and Synchronize Documentation
impact: HIGH
impactDescription: prevents unproven changes and configuration that differs from the behavior operators deploy
tags: verification, testing, documentation, configuration, critical-paths
---

## Verify Critical Paths and Synchronize Documentation

Verify the changed behavior at its highest-risk boundary: authorization, state transition, persistence, external effect or response contract. Add a focused test for that decision, not framework behavior or every branch; when configuration, operations or public behavior changes, update the documentation in the same change and read it back against the implementation.

**Incorrect (tests a framework write instead of the business decision):**

```php
it('creates an order', function (): void {
    $order = Order::factory()->create();

    expect($order)->toBeInstanceOf(Order::class);
});
```

**Correct (tests the authorization boundary that protects the write):**

```php
it('rejects a user from another tenant', function (): void {
    $response = $this->actingAs($otherTenantUser)->postJson(route('orders.store'), validOrderPayload());

    $response->assertForbidden();
});
```

Use `laravel-testing` to choose the test type, and verify configuration through the same boot or command path production uses.
