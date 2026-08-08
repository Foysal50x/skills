---
title: Attach Observers With the ObservedBy Attribute
impact: MEDIUM
impactDescription: the model states its own lifecycle hooks
tags: observers, attributes, model, events
---

## Attach Observers With the ObservedBy Attribute

Registering observers in a service provider hides them: reading the model tells you nothing about what fires on save. `#[ObservedBy]` puts the registration on the model, where anyone editing it will see it.

**Incorrect (registration far from the model):**

```php
// AppServiceProvider::boot() — 40 lines of unrelated bootstrapping
Order::observe(OrderObserver::class);
Order::observe(AuditObserver::class);
```

**Correct:**

```php
use Illuminate\Database\Eloquent\Attributes\ObservedBy;

#[ObservedBy([OrderObserver::class, AuditObserver::class])]
final class Order extends Model
{
    // ...
}
```

Two cautions that do not change with the attribute:

- Observers do not fire on bulk `update()`, `delete()` or `upsert()` — see `rules/bulk-update-bypasses-events.md`.
- Keep observers to bookkeeping (slugs, audit rows, cache invalidation). Business workflows belong in Actions, announced by Domain Events.
