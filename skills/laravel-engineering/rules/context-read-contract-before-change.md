---
title: Read the Local Contract Before Changing Code
impact: CRITICAL
impactDescription: prevents changes that satisfy one file while breaking its callers, configuration or authorization boundary
tags: context, contract, configuration, consumers, change
---

## Read the Local Contract Before Changing Code

Before editing, read the nearest instructions, the implementation, its direct callers, the configuration it reads and the test that proves its present contract. Search before creating a helper or a second implementation; a locally plausible change can still break a boundary the file does not show.

**Incorrect (changes only the visible method):**

```php
final class RefundOrderAction
{
    public function handle(Order $order): void
    {
        $order->update(['status' => OrderStatus::Refunded]);
    }
}
```

**Correct (uses the existing state transition that owns its invariants):**

```php
final class RefundOrderAction
{
    public function handle(Order $order): void
    {
        $order->markRefunded();
    }
}
```

Read `laravel-patterns` before choosing a new class, `laravel-rest-api` when the caller is HTTP, and `laravel-eloquent` when the change affects data access.
