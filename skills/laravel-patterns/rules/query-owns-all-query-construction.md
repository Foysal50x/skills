---
title: All Query Construction Lives in Query Classes and Repositories
impact: CRITICAL
impactDescription: one place to change how data is fetched
tags: query-class, boundary, eloquent, architecture
---

## All Query Construction Lives in Query Classes and Repositories

`Builder`, `where()`, `orderBy()`, `join()`, `DB::raw()`, CTEs, query-expression objects — all of it appears only inside Query Classes and Repository implementations. Never in Controllers, Actions, Services, Jobs, Commands, Blade or Value Objects.

Inside those two places, embrace Eloquent openly. Coupling to relationships, accessors and scopes there is fine and expected.

**Incorrect (the same intent rebuilt in three files):**

```php
// Controller
$orders = Order::where('status', 'pending')->where('merchant_id', $id)->get();

// Service
$count = Order::where('status', 'pending')->count();

// Blade
@foreach (\App\Models\Order::where('status', 'pending')->get() as $order)
```

**Correct (one named query, three callers of one contract):**

```php
// app/Domain/Orders/Queries/PendingOrdersQuery.php
final readonly class PendingOrdersQuery
{
    public function handle(?int $merchantId = null): Builder
    {
        return Order::query()
            ->where('status', OrderStatus::Pending)
            ->when($merchantId !== null, fn (Builder $q) => $q->where('merchant_id', $merchantId));
    }
}

// Callers:
$orders->pendingOrders($merchantId);
$orders->countPending();
// Blade receives the result from the controller — it never queries.
```

See `rules/vo-never-touches-builder.md` for the other half of this boundary.
