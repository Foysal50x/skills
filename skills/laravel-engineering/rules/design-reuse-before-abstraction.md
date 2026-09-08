---
title: Reuse a Present Contract Before Adding an Abstraction
impact: HIGH
impactDescription: prevents duplicate behavior and extension seams with no current consumer
tags: reuse, abstraction, duplication, contracts, simplicity
---

## Reuse a Present Contract Before Adding an Abstraction

Reuse an existing domain operation when it already owns the behavior. Extract a shared implementation only when two current consumers need the same stable contract; do not introduce an interface, registry, factory or generic helper for a hypothetical caller.

**Incorrect (duplicates an existing transition):**

```php
final class CancelSubscriptionAction
{
    public function handle(Subscription $subscription): void
    {
        $subscription->update(['status' => SubscriptionStatus::Cancelled]);
    }
}
```

**Correct (delegates to the existing owner):**

```php
final class CancelSubscriptionAction
{
    public function handle(Subscription $subscription): void
    {
        $subscription->cancel();
    }
}
```

Use the `laravel-patterns` Decision Gate before adding a layer or configurable extension seam.
