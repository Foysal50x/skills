---
title: Query Classes Are Internal to Repositories
impact: CRITICAL
impactDescription: preserves a single public data-access boundary
tags: query-class, repository, boundary, encapsulation
---

## Query Classes Are Internal to Repositories

Only files under `*/Repositories/` may import or instantiate a `*Query` class. Controllers, Actions, Services, Jobs, Commands, Blade views and application-logic tests call the Repository interface instead.

If a Query Class is reachable from outside, there are now two public data-access paths and the Repository contract stops meaning anything.

**Incorrect (Controller and Job both reach into the query layer):**

```php
use App\Domain\Orders\Queries\PendingOrdersQuery;

final class OrderDashboardController
{
    public function __invoke(PendingOrdersQuery $pendingOrders): View
    {
        return view('dashboard', ['orders' => $pendingOrders->handle(null)->get()]);
    }
}
```

**Correct (everything goes through the interface):**

```php
use App\Domain\Orders\Contracts\OrderRepositoryInterface;

final class OrderDashboardController
{
    public function __invoke(OrderRepositoryInterface $orders): View
    {
        return view('dashboard', ['orders' => $orders->pendingOrders()]);
    }
}
```

Enforce it in CI:

```bash
grep -rln 'use App\\Domain\\[A-Za-z]*\\Queries\\' app --include='*.php' \
  | grep -v '/Repositories/' && exit 1 || exit 0
```
